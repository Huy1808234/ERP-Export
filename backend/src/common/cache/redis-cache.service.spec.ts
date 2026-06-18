import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from './redis-cache.service';

type ConfigValue = string | number | boolean | undefined;
type MockRedisStatus = 'wait' | 'ready' | 'end';

type MockRedisClient = {
  status: MockRedisStatus;
  connect: jest.Mock<Promise<void>, []>;
  get: jest.Mock<Promise<string | null>, [string]>;
  set: jest.Mock<Promise<'OK'>, [string, string, ...string[]]>;
  del: jest.Mock<Promise<number>, string[]>;
  scan: jest.Mock<
    Promise<[string, string[]]>,
    [string, string, string, string, number]
  >;
  disconnect: jest.Mock<void, []>;
  on: jest.Mock<MockRedisClient, [string, (error: Error) => void]>;
};

function createConfigService(values: Record<string, ConfigValue>) {
  return {
    get<T = ConfigValue>(key: string, fallback?: T): T {
      const value = values[key];
      return (value === undefined ? fallback : value) as T;
    },
  } as ConfigService;
}

function createMockRedisClient(): MockRedisClient {
  const store = new Map<string, string>();
  const client: Partial<MockRedisClient> = {
    status: 'wait',
  };

  client.connect = jest.fn<Promise<void>, []>(async () => {
    client.status = 'ready';
  });
  client.get = jest.fn<Promise<string | null>, [string]>(
    async (key) => store.get(key) ?? null,
  );
  client.set = jest.fn<Promise<'OK'>, [string, string, ...string[]]>(
    async (key, value) => {
      store.set(key, value);
      return 'OK';
    },
  );
  client.del = jest.fn<Promise<number>, string[]>(async (...keys) => {
    let deleted = 0;
    keys.forEach((key) => {
      if (store.delete(key)) deleted += 1;
    });
    return deleted;
  });
  client.scan = jest.fn<
    Promise<[string, string[]]>,
    [string, string, string, string, number]
  >(async () => ['0', []]);
  client.disconnect = jest.fn<void, []>(() => {
    client.status = 'end';
  });
  client.on = jest.fn<MockRedisClient, [string, (error: Error) => void]>(
    () => client as MockRedisClient,
  );

  return client as MockRedisClient;
}

describe('RedisCacheService', () => {
  it('builds stable cache keys from object parts', () => {
    const service = new RedisCacheService(createConfigService({}));

    expect(service.makeKey('dashboard', { b: 2, a: 1 })).toBe(
      service.makeKey('dashboard', { a: 1, b: 2 }),
    );
  });

  it('falls back to the factory when cache is disabled', async () => {
    const service = new RedisCacheService(
      createConfigService({ REDIS_CACHE_ENABLED: 'false' }),
    );
    const factory = jest.fn<Promise<string>, []>().mockResolvedValue('fresh');

    await expect(
      service.getOrSet('mini-erp:test:key', 60, factory),
    ).resolves.toBe('fresh');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('reuses a pending Redis connection for concurrent cache reads', async () => {
    const service = new RedisCacheService(createConfigService({}));
    const redis = createMockRedisClient();
    let finishConnect: (() => void) | undefined;

    redis.connect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishConnect = () => {
            redis.status = 'ready';
            resolve();
          };
        }),
    );

    Reflect.set(service, 'createClient', () => redis);

    const firstRead = service.get<string>('mini-erp:test:first');
    const secondRead = service.get<string>('mini-erp:test:second');

    expect(redis.connect).toHaveBeenCalledTimes(1);
    finishConnect?.();

    await expect(Promise.all([firstRead, secondRead])).resolves.toEqual([
      null,
      null,
    ]);
    expect(redis.connect).toHaveBeenCalledTimes(1);
  });
});
