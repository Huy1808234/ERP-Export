import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency } from './entities/currency.entity';
import {
  ExchangeRate,
  ExchangeRateType,
} from './entities/exchange-rate.entity';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { RedisCacheService } from '@/common/cache/redis-cache.service';
const { XMLParser } = require('fast-xml-parser');

const CURRENCY_CACHE_TTL_SECONDS = 1800;
const VCB_EXCHANGE_RATE_URL =
  'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx';
const VCB_SYNC_TIMEOUT_MS = 8000;

type VcbExchangeRateRow = {
  CurrencyCode?: string;
  Buy?: string | number | null;
  Sell?: string | number | null;
  Transfer?: string | number | null;
};

type VcbSyncResult = {
  message: string;
  updatedCount: number;
  skipped?: boolean;
  error?: string;
};

@Injectable()
export class CurrenciesService implements OnModuleInit {
  private readonly logger = new Logger(CurrenciesService.name);

  constructor(
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(ExchangeRate)
    private readonly exchangeRateRepository: Repository<ExchangeRate>,
    private readonly httpService: HttpService,
    private readonly cache: RedisCacheService,
  ) {}

  async onModuleInit() {
    await this.seedCurrencies();
  }

  private async seedCurrencies() {
    const defaultCurrencies = [
      { code: 'VND', name: 'Việt Nam Đồng', symbol: '₫', isBase: true },
      { code: 'USD', name: 'Đô la Mỹ', symbol: '$', isBase: false },
      { code: 'EUR', name: 'Euro', symbol: '€', isBase: false },
      { code: 'JPY', name: 'Yên Nhật', symbol: '¥', isBase: false },
    ];

    for (const cur of defaultCurrencies) {
      const existing = await this.currencyRepository.findOne({
        where: { code: cur.code },
      });
      if (!existing) {
        console.log(`🌱 Seeding currency: ${cur.code}`);
        await this.currencyRepository.save(this.currencyRepository.create(cur));
      }
    }
  }

  /**
   * Tự động cập nhật tỷ giá từ Vietcombank vào 8:00 sáng mỗi ngày
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleScheduledExchangeRateSync(): Promise<void> {
    const result = await this.syncExchangeRatesFromVCB({ throwOnError: false });
    if (result.skipped) {
      this.logger.warn(result.message);
    }
  }

  async syncExchangeRatesFromVCB(options?: {
    throwOnError?: boolean;
  }): Promise<VcbSyncResult> {
    this.logger.log('Starting sync exchange rates from Vietcombank');
    try {
      const response = await firstValueFrom(
        this.httpService.get<string>(VCB_EXCHANGE_RATE_URL, {
          timeout: VCB_SYNC_TIMEOUT_MS,
        }),
      );
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
      });
      const jsonObj = parser.parse(response.data);
      const rawRates = jsonObj?.ExrateList?.Exrate as
        | VcbExchangeRateRow
        | VcbExchangeRateRow[]
        | undefined;
      const rates = Array.isArray(rawRates)
        ? rawRates
        : rawRates
          ? [rawRates]
          : [];

      if (!rates.length) {
        throw new Error('Vietcombank response does not contain exchange rates');
      }

      const currencies = await this.currencyRepository.find();

      const parseRate = (
        value: string | number | null | undefined,
      ): number | null => {
        if (value === null || value === undefined) return null;
        const asString = String(value);
        if (!asString.trim()) return null;
        const parsed = parseFloat(asString.replace(/,/g, ''));
        return Number.isFinite(parsed) ? parsed : null;
      };

      let updatedCount = 0;
      for (const cur of currencies) {
        if (cur.isBase) continue;

        const vcbRate = rates.find((r) => r.CurrencyCode === cur.code);
        if (!vcbRate) continue;

        const candidates: Array<{
          rateType: ExchangeRateType;
          rate: number | null;
        }> = [
          {
            rateType: ExchangeRateType.BUY,
            rate: parseRate(vcbRate.Buy),
          },
          {
            rateType: ExchangeRateType.SELL,
            rate: parseRate(vcbRate.Sell),
          },
          {
            rateType: ExchangeRateType.TRANSFER,
            rate: parseRate(vcbRate.Transfer),
          },
        ];

        for (const item of candidates) {
          if (item.rate === null) continue;

          const latestRate = await this.exchangeRateRepository.findOne({
            where: { currencyId: cur._id, rateType: item.rateType },
            order: { effectiveDate: 'DESC', createdAt: 'DESC' },
          });

          if (latestRate && Number(latestRate.rate) === item.rate) {
            continue;
          }

          await this.createExchangeRate({
            currencyId: cur._id,
            rate: item.rate,
            rateType: item.rateType,
            effectiveDate: new Date().toISOString(),
            isActive: true,
          });
          updatedCount++;
        }
      }
      return {
        message:
          updatedCount > 0
            ? `Đã cập nhật ${updatedCount} loại tệ.`
            : 'Tỷ giá không có thay đổi so với dữ liệu hiện tại.',
        updatedCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const errorMessage = 'Không thể kết nối với API Vietcombank: ' + message;
      this.logger.warn(`Failed to sync rates from VCB: ${message}`);
      if (options?.throwOnError !== false) {
        throw new BadRequestException(errorMessage);
      }

      return {
        message: errorMessage,
        updatedCount: 0,
        skipped: true,
        error: message,
      };
    }
  }

  // --- Currency Methods ---

  async createCurrency(
    createCurrencyDto: CreateCurrencyDto,
  ): Promise<Currency> {
    const existing = await this.currencyRepository.findOne({
      where: { code: createCurrencyDto.code },
    });
    if (existing) {
      throw new BadRequestException('Currency with this code already exists');
    }

    // If this is set to base, we might want to unset others (optional logic, kept simple for now)
    if (createCurrencyDto.isBase) {
      await this.currencyRepository.update({ isBase: true }, { isBase: false });
    }

    const currency = this.currencyRepository.create(createCurrencyDto);
    const saved = await this.currencyRepository.save(currency);
    await this.cache.delByPattern('mini-erp:currencies:*');
    return saved;
  }

  async findAllCurrencies(): Promise<Currency[]> {
    return this.cache.getOrSet(
      'mini-erp:currencies:all',
      CURRENCY_CACHE_TTL_SECONDS,
      async () => {
        const currencies = await this.currencyRepository.find({
          relations: ['exchangeRates'],
        });
        // Ensure FE can safely read `exchangeRates[0]` as latest
        for (const currency of currencies) {
          if (!Array.isArray((currency as any).exchangeRates)) continue;
          (currency as any).exchangeRates.sort(
            (a: ExchangeRate, b: ExchangeRate) => {
              const dateDiff = String(b.effectiveDate).localeCompare(
                String(a.effectiveDate),
              );
              if (dateDiff !== 0) return dateDiff;
              const aCreated = a.createdAt
                ? new Date(a.createdAt).getTime()
                : 0;
              const bCreated = b.createdAt
                ? new Date(b.createdAt).getTime()
                : 0;
              return bCreated - aCreated;
            },
          );
        }
        return currencies;
      },
    );
  }

  async findCurrencyById(id: string): Promise<Currency> {
    const currency = await this.currencyRepository.findOne({
      where: { _id: id },
      relations: ['exchangeRates'],
    });
    if (!currency) {
      throw new NotFoundException('Currency not found');
    }
    return currency;
  }

  async updateCurrency(
    id: string,
    updateCurrencyDto: UpdateCurrencyDto,
  ): Promise<Currency> {
    const currency = await this.findCurrencyById(id);

    if (updateCurrencyDto.isBase && !currency.isBase) {
      await this.currencyRepository.update({ isBase: true }, { isBase: false });
    }

    Object.assign(currency, updateCurrencyDto);
    const saved = await this.currencyRepository.save(currency);
    await this.cache.delByPattern('mini-erp:currencies:*');
    return saved;
  }

  // --- Exchange Rate Methods ---

  async createExchangeRate(
    createExchangeRateDto: CreateExchangeRateDto,
  ): Promise<ExchangeRate> {
    const currency = await this.currencyRepository.findOne({
      where: { _id: createExchangeRateDto.currencyId },
    });
    if (!currency) {
      throw new NotFoundException('Currency not found');
    }

    const rateType =
      createExchangeRateDto.rateType ?? ExchangeRateType.TRANSFER;
    const isActive = createExchangeRateDto.isActive ?? true;

    // Keep at most one active rate per currency + rateType
    if (isActive) {
      await this.exchangeRateRepository.update(
        {
          currencyId: createExchangeRateDto.currencyId,
          rateType,
          isActive: true,
        },
        { isActive: false },
      );
    }

    const exchangeRate = this.exchangeRateRepository.create({
      ...createExchangeRateDto,
      rateType,
      isActive,
    });
    const saved = await this.exchangeRateRepository.save(exchangeRate);
    await this.cache.delByPattern('mini-erp:currencies:*');
    return saved;
  }

  async findExchangeRatesByCurrency(
    currencyId: string,
    rateType?: ExchangeRateType,
  ): Promise<ExchangeRate[]> {
    return this.cache.getOrSet(
      `mini-erp:currencies:rates:${currencyId}:${rateType || 'ALL'}`,
      CURRENCY_CACHE_TTL_SECONDS,
      () =>
        this.exchangeRateRepository.find({
          where: rateType ? { currencyId, rateType } : { currencyId },
          order: { effectiveDate: 'DESC', createdAt: 'DESC' },
        }),
    );
  }

  async getLatestExchangeRate(
    currencyId: string,
    rateType: ExchangeRateType = ExchangeRateType.TRANSFER,
  ): Promise<ExchangeRate> {
    const rate = await this.cache.getOrSet(
      `mini-erp:currencies:latest:${currencyId}:${rateType}`,
      CURRENCY_CACHE_TTL_SECONDS,
      () =>
        this.exchangeRateRepository.findOne({
          where: { currencyId, isActive: true, rateType },
          order: { effectiveDate: 'DESC', createdAt: 'DESC' },
        }),
    );

    if (!rate) {
      throw new NotFoundException(
        'No active exchange rate found for this currency',
      );
    }
    return rate;
  }

  /**
   * Quy đổi ngoại tệ sang tiền bản định (VND)
   */
  async convertToBase(
    amount: number,
    currencyCode: string,
    rateType: ExchangeRateType = ExchangeRateType.TRANSFER,
  ): Promise<number> {
    if (currencyCode === 'VND') return amount;

    const currency = await this.currencyRepository.findOne({
      where: { code: currencyCode },
    });
    if (!currency)
      throw new NotFoundException(`Currency ${currencyCode} not found`);

    const rate = await this.getLatestExchangeRate(currency._id, rateType);
    return new Decimal(amount).mul(new Decimal(rate.rate)).toNumber();
  }

  /**
   * Tính tỷ giá chéo giữa 2 đồng ngoại tệ (VD: 1 EUR = ? USD)
   */
  async getCrossRate(
    fromCode: string,
    toCode: string,
    rateType: ExchangeRateType = ExchangeRateType.TRANSFER,
  ): Promise<{ from: string; to: string; rate: number }> {
    if (fromCode === toCode) return { from: fromCode, to: toCode, rate: 1 };

    const cacheKey = `mini-erp:currencies:cross:${fromCode}:${toCode}:${rateType}`;
    const cached = await this.cache.get<{
      from: string;
      to: string;
      rate: number;
    }>(cacheKey);
    if (cached) return cached;

    // Lấy tỷ giá của đồng tiền nguồn (Source) quy ra VND
    const sourceVndRate = await this.getLatestVndRate(fromCode, rateType);
    // Lấy tỷ giá của đồng tiền đích (Target) quy ra VND
    const targetVndRate = await this.getLatestVndRate(toCode, rateType);

    // Tính tỷ giá chéo: Source / Target (Sử dụng Decimal để chính xác tuyệt đối)
    const rate = new Decimal(sourceVndRate)
      .div(new Decimal(targetVndRate))
      .toNumber();

    const result = { from: fromCode, to: toCode, rate };
    await this.cache.set(cacheKey, result, CURRENCY_CACHE_TTL_SECONDS);
    return result;
  }

  async getLatestVndRate(
    code: string,
    rateType: ExchangeRateType,
  ): Promise<number> {
    if (code === 'VND') return 1;
    const currency = await this.currencyRepository.findOne({ where: { code } });
    if (!currency) throw new NotFoundException(`Currency ${code} not found`);

    const rateEntity = await this.getLatestExchangeRate(currency._id, rateType);
    return Number(rateEntity.rate);
  }
}
