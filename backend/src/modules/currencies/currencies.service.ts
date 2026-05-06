import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency } from './entities/currency.entity';
import { ExchangeRate, ExchangeRateType } from './entities/exchange-rate.entity';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
const { XMLParser } = require('fast-xml-parser');

@Injectable()
export class CurrenciesService implements OnModuleInit {
  constructor(
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(ExchangeRate)
    private readonly exchangeRateRepository: Repository<ExchangeRate>,
    private readonly httpService: HttpService,
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
      const existing = await this.currencyRepository.findOne({ where: { code: cur.code } });
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
  async syncExchangeRatesFromVCB() {
    console.log('--- Starting Sync Exchange Rates from Vietcombank ---');
    try {
      const url = 'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx';
      const response = await firstValueFrom(this.httpService.get(url));
      
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: ""
      });
      const jsonObj = parser.parse(response.data);
      const rates = jsonObj.ExrateList.Exrate; // Array of rates

      const currencies = await this.currencyRepository.find();
      
      const parseRate = (value: any): number | null => {
        if (value === null || value === undefined) return null;
        const asString = String(value);
        if (!asString.trim()) return null;
        const parsed = parseFloat(asString.replace(/,/g, ''));
        return Number.isFinite(parsed) ? parsed : null;
      };

      let updatedCount = 0;
      for (const cur of currencies) {
        if (cur.isBase) continue;

        const vcbRate = rates.find((r: any) => r.CurrencyCode === cur.code);
        if (!vcbRate) continue;

        const candidates: Array<{ rateType: ExchangeRateType; rate: number | null }> = [
          { rateType: ExchangeRateType.BUY, rate: parseRate((vcbRate as any).Buy) },
          { rateType: ExchangeRateType.SELL, rate: parseRate((vcbRate as any).Sell) },
          { rateType: ExchangeRateType.TRANSFER, rate: parseRate((vcbRate as any).Transfer) },
        ];

        for (const item of candidates) {
          if (item.rate === null) continue;

          const latestRate = await this.exchangeRateRepository.findOne({
            where: { currencyId: cur.id, rateType: item.rateType },
            order: { effectiveDate: 'DESC', createdAt: 'DESC' },
          });

          if (latestRate && Number(latestRate.rate) === item.rate) {
            continue;
          }

          await this.createExchangeRate({
            currencyId: cur.id,
            rate: item.rate,
            rateType: item.rateType,
            effectiveDate: new Date().toISOString(),
            isActive: true,
          });
          updatedCount++;
        }
      }
      return { 
        message: updatedCount > 0 ? `Đã cập nhật ${updatedCount} loại tệ.` : 'Tỷ giá không có thay đổi so với dữ liệu hiện tại.',
        updatedCount 
      };
    } catch (error) {
      console.error('Failed to sync rates from VCB:', error.message);
      throw new BadRequestException('Không thể kết nối với API Vietcombank: ' + error.message);
    }
  }

  // --- Currency Methods ---

  async createCurrency(createCurrencyDto: CreateCurrencyDto): Promise<Currency> {
    const existing = await this.currencyRepository.findOne({ where: { code: createCurrencyDto.code } });
    if (existing) {
      throw new BadRequestException('Currency with this code already exists');
    }

    // If this is set to base, we might want to unset others (optional logic, kept simple for now)
    if (createCurrencyDto.isBase) {
      await this.currencyRepository.update({ isBase: true }, { isBase: false });
    }

    const currency = this.currencyRepository.create(createCurrencyDto);
    return this.currencyRepository.save(currency);
  }

  async findAllCurrencies(): Promise<Currency[]> {
    const currencies = await this.currencyRepository.find({ relations: ['exchangeRates'] });
    // Ensure FE can safely read `exchangeRates[0]` as latest
    for (const currency of currencies) {
      if (!Array.isArray((currency as any).exchangeRates)) continue;
      (currency as any).exchangeRates.sort((a: ExchangeRate, b: ExchangeRate) => {
        const dateDiff = String(b.effectiveDate).localeCompare(String(a.effectiveDate));
        if (dateDiff !== 0) return dateDiff;
        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bCreated - aCreated;
      });
    }
    return currencies;
  }

  async findCurrencyById(id: string): Promise<Currency> {
    const currency = await this.currencyRepository.findOne({ where: { id }, relations: ['exchangeRates'] });
    if (!currency) {
      throw new NotFoundException('Currency not found');
    }
    return currency;
  }

  async updateCurrency(id: string, updateCurrencyDto: UpdateCurrencyDto): Promise<Currency> {
    const currency = await this.findCurrencyById(id);

    if (updateCurrencyDto.isBase && !currency.isBase) {
      await this.currencyRepository.update({ isBase: true }, { isBase: false });
    }

    Object.assign(currency, updateCurrencyDto);
    return this.currencyRepository.save(currency);
  }

  // --- Exchange Rate Methods ---

  async createExchangeRate(createExchangeRateDto: CreateExchangeRateDto): Promise<ExchangeRate> {
    const currency = await this.currencyRepository.findOne({ where: { id: createExchangeRateDto.currencyId } });
    if (!currency) {
      throw new NotFoundException('Currency not found');
    }

    const rateType = createExchangeRateDto.rateType ?? ExchangeRateType.TRANSFER;
    const isActive = createExchangeRateDto.isActive ?? true;

    // Keep at most one active rate per currency + rateType
    if (isActive) {
      await this.exchangeRateRepository.update(
        { currencyId: createExchangeRateDto.currencyId, rateType, isActive: true },
        { isActive: false },
      );
    }

    const exchangeRate = this.exchangeRateRepository.create({
      ...createExchangeRateDto,
      rateType,
      isActive,
    });
    return this.exchangeRateRepository.save(exchangeRate);
  }

  async findExchangeRatesByCurrency(currencyId: string, rateType?: ExchangeRateType): Promise<ExchangeRate[]> {
    return this.exchangeRateRepository.find({
      where: rateType ? { currencyId, rateType } : { currencyId },
      order: { effectiveDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async getLatestExchangeRate(currencyId: string, rateType: ExchangeRateType = ExchangeRateType.TRANSFER): Promise<ExchangeRate> {
    const rate = await this.exchangeRateRepository.findOne({
      where: { currencyId, isActive: true, rateType },
      order: { effectiveDate: 'DESC', createdAt: 'DESC' },
    });

    if (!rate) {
      throw new NotFoundException('No active exchange rate found for this currency');
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

    const currency = await this.currencyRepository.findOne({ where: { code: currencyCode } });
    if (!currency) throw new NotFoundException(`Currency ${currencyCode} not found`);

    const rate = await this.getLatestExchangeRate(currency.id, rateType);
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

    // Lấy tỷ giá của đồng tiền nguồn (Source) quy ra VND
    const sourceVndRate = await this.getLatestVndRate(fromCode, rateType);
    // Lấy tỷ giá của đồng tiền đích (Target) quy ra VND
    const targetVndRate = await this.getLatestVndRate(toCode, rateType);

    // Tính tỷ giá chéo: Source / Target (Sử dụng Decimal để chính xác tuyệt đối)
    const rate = new Decimal(sourceVndRate).div(new Decimal(targetVndRate)).toNumber();

    return { from: fromCode, to: toCode, rate };
  }

  private async getLatestVndRate(code: string, rateType: ExchangeRateType): Promise<number> {
    if (code === 'VND') return 1;
    const currency = await this.currencyRepository.findOne({ where: { code } });
    if (!currency) throw new NotFoundException(`Currency ${code} not found`);
    
    const rateEntity = await this.getLatestExchangeRate(currency.id, rateType);
    return Number(rateEntity.rate);
  }
}
