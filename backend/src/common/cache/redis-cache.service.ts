import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';

type CacheFactory<T> = () => Promise<T>;

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis | null = null;
  private connectPromise: Promise<Redis | null> | null = null;
  private unavailableUntil = 0;
  private lastWarningAt = 0;

  constructor(private readonly configService: ConfigService) {}

  private get enabled(): boolean {
    return (
      this.configService
        .get<string>('REDIS_CACHE_ENABLED', 'true')
        .toLowerCase() !== 'false'
    );
  }

  private warnOnce(error: unknown): void {
    const now = Date.now();
    if (now - this.lastWarningAt < 60_000) return;
    this.lastWarningAt = now;
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Redis cache unavailable, bypassing cache: ${message}`);
  }

  private resetClient(): void {
    const client = this.client;
    this.connectPromise = null;
    this.client = null;
    if (!client) return;
    client.disconnect();
  }

  private markUnavailable(error: unknown): null {
    this.unavailableUntil = Date.now() + 30_000;
    this.resetClient();
    this.warnOnce(error);
    return null;
  }

  private createClient(): Redis {
    const host = this.configService.get<string>('REDIS_HOST', '127.0.0.1');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');

    const client = new Redis({
      host,
      port,
      password,
      lazyConnect: true,
      enableOfflineQueue: false,
      autoResendUnfulfilledCommands: false,
      autoResubscribe: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 500,
      retryStrategy: () => null,
    });

    client.on('error', (error: Error) => {
      this.markUnavailable(error);
    });

    return client;
  }

  private async getClient(): Promise<Redis | null> {
    if (!this.enabled || Date.now() < this.unavailableUntil) return null;
    if (!this.client) {
      this.client = this.createClient();
    }

    if (this.client.status === 'ready') return this.client;
    if (this.connectPromise) return this.connectPromise;
    if (this.client.status !== 'wait') return null;

    this.connectPromise = this.client
      .connect()
      .then(() => (this.client?.status === 'ready' ? this.client : null))
      .catch((error: unknown) => this.markUnavailable(error))
      .finally(() => {
        this.connectPromise = null;
      });

    return this.connectPromise;
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    return `{${entries
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${this.stableStringify(entryValue)}`,
      )
      .join(',')}}`;
  }

  makeKey(namespace: string, parts: unknown): string {
    const hash = createHash('sha1')
      .update(this.stableStringify(parts))
      .digest('hex')
      .slice(0, 24);

    return `mini-erp:${namespace}:${hash}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const client = await this.getClient();
    if (!client) return null;

    try {
      const value = await client.get(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.markUnavailable(error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const client = await this.getClient();
    if (!client) return;

    try {
      const payload = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await client.set(key, payload, 'EX', ttlSeconds);
      } else {
        await client.set(key, payload);
      }
    } catch (error) {
      this.markUnavailable(error);
    }
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    factory: CacheFactory<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await factory();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  async del(keys: string | string[]): Promise<void> {
    const normalizedKeys = Array.isArray(keys) ? keys : [keys];
    if (!normalizedKeys.length) return;

    const client = await this.getClient();
    if (!client) return;

    try {
      await client.del(...normalizedKeys);
    } catch (error) {
      this.markUnavailable(error);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    const client = await this.getClient();
    if (!client) return;

    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length) {
          await client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      this.markUnavailable(error);
    }
  }

  onModuleDestroy(): void {
    this.resetClient();
  }
}
