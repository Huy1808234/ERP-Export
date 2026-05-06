import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Quotation, QuotationStatus } from './entities/quotation.entity';
import { QuotationItem } from './entities/quotation-item.entity';
import { CreateQuotationDto } from '@/modules/quotations/dto/create-quotation.dto';
import { UpdateQuotationDto } from '@/modules/quotations/dto/update-quotation.dto';
import { User } from '@/modules/users/entities/user.entity';
import { CurrenciesService } from '../currencies/currencies.service';
import { ExchangeRateType } from '../currencies/entities/exchange-rate.entity';
import { Decimal } from 'decimal.js';

@Injectable()
export class QuotationsService {
  constructor(
    @InjectRepository(Quotation)
    private quotationsRepository: Repository<Quotation>,
    @InjectRepository(QuotationItem)
    private quotationItemsRepository: Repository<QuotationItem>,
    private currenciesService: CurrenciesService,
    private dataSource: DataSource,
  ) {}

  async create(createQuotationDto: CreateQuotationDto, user: User) {
    console.log('>>> QuotationsService.create - User Object:', user);
    const { items, ...quotationData } = createQuotationDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Generate Quotation Number (Simple logic for now: QT-YYYYMMDD-Random)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const quotationNumber = `QT-${dateStr}-${randomStr}`;

      // 2. Calculate Total Amount (SỬ DỤNG DECIMAL.JS & QUY ĐỔI ĐA TIỀN TỆ)
      let itemsSum = new Decimal(0);
      for (const item of items) {
        itemsSum = itemsSum.plus(new Decimal(item.quantity).times(new Decimal(item.unitPrice)));
      }
      
      const docCurrency = createQuotationDto.currency || 'USD';

      // Quy đổi Logistics Fee sang Doc Currency nếu khác loại tệ
      let logisticsFeeInDoc = new Decimal(createQuotationDto.logisticsFee || 0);
      if (createQuotationDto.logisticsFeeCurrency && createQuotationDto.logisticsFeeCurrency !== docCurrency) {
        const crossRateObj = await this.currenciesService.getCrossRate(createQuotationDto.logisticsFeeCurrency, docCurrency, ExchangeRateType.TRANSFER);
        logisticsFeeInDoc = logisticsFeeInDoc.times(new Decimal(crossRateObj.rate));
      }

      // Quy đổi Other Fee sang Doc Currency
      let otherFeeInDoc = new Decimal(createQuotationDto.otherFee || 0);
      if (createQuotationDto.otherFeeCurrency && createQuotationDto.otherFeeCurrency !== docCurrency) {
        const crossRateObj = await this.currenciesService.getCrossRate(createQuotationDto.otherFeeCurrency, docCurrency, ExchangeRateType.TRANSFER);
        otherFeeInDoc = otherFeeInDoc.times(new Decimal(crossRateObj.rate));
      }

      const totalAmount = itemsSum.plus(logisticsFeeInDoc).plus(otherFeeInDoc);

      // 3. Chốt tỷ giá (Fixing Rate) quy ra VND để lưu vết kế toán sau này
      let exchangeRate = createQuotationDto.exchangeRate;
      if (!exchangeRate) {
        const rateObj = await this.currenciesService.getCrossRate(docCurrency, 'VND', ExchangeRateType.TRANSFER);
        exchangeRate = rateObj.rate;
      }

      // 4. Create Quotation
      const quotation = this.quotationsRepository.create({
        ...quotationData,
        quotationNumber,
        exchangeRate,
        totalAmount: totalAmount.toNumber(),
        createdById: user.id,
        status: QuotationStatus.DRAFT,
      });

      const savedQuotation = await queryRunner.manager.save(quotation) as unknown as Quotation;

      // 4. Create Items
      const quotationItems = items.map(item => this.quotationItemsRepository.create({
        ...item,
        quotationId: savedQuotation.id,
        totalAmount: item.quantity * item.unitPrice,
      }));

      await queryRunner.manager.save(quotationItems);

      await queryRunner.commitTransaction();
      return this.findOne(savedQuotation.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query: any) {
    const current = +query.current || 1;
    const pageSize = +query.pageSize || 10;
    const skip = (current - 1) * pageSize;

    const { current: _c, pageSize: _p, ...filters } = query;

    const [results, total] = await this.quotationsRepository.findAndCount({
      where: filters,
      relations: ['customer', 'createdBy', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
      take: pageSize,
      skip: skip,
    });

    return {
      results,
      meta: {
        current,
        pageSize,
        pages: Math.ceil(total / pageSize),
        total,
      },
    };
  }

  async findOne(id: string) {
    const quotation = await this.quotationsRepository.findOne({
      where: { id },
      relations: ['customer', 'createdBy', 'items', 'items.product'],
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  async update(id: string, updateQuotationDto: UpdateQuotationDto) {
    const quotation = await this.findOne(id);
    if (quotation.status !== QuotationStatus.DRAFT && quotation.status !== QuotationStatus.SENT) {
      throw new BadRequestException('Only DRAFT or SENT quotations can be updated');
    }

    const { items, ...quotationData } = updateQuotationDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Calculate new total (SỬ DỤNG DECIMAL.JS & QUY ĐỔI ĐA TIỀN TỆ)
      const docCurrency = updateQuotationDto.currency || quotation.currency;
      let totalAmount = new Decimal(0);

      // Tính tổng tiền hàng
      if (items) {
        for (const item of items) {
          totalAmount = totalAmount.plus(new Decimal(item.quantity).times(new Decimal(item.unitPrice)));
        }
      } else {
        // Nếu không gửi items, lấy tổng tiền hàng cũ (cần trừ đi phí cũ trước)
        const oldItemsSum = new Decimal(quotation.totalAmount)
          .minus(new Decimal(quotation.logisticsFee || 0))
          .minus(new Decimal(quotation.otherFee || 0)); // Chỗ này có thể chưa chuẩn nếu phí cũ khác currency, nhưng giả định docCurrency
        totalAmount = oldItemsSum;
      }

      // Quy đổi Logistics Fee sang Doc Currency
      const logisticsFeeVal = updateQuotationDto.logisticsFee !== undefined ? updateQuotationDto.logisticsFee : (quotation.logisticsFee || 0);
      const logisticsFeeCur = updateQuotationDto.logisticsFeeCurrency || quotation.logisticsFeeCurrency || docCurrency;
      let logisticsFeeInDoc = new Decimal(logisticsFeeVal);
      
      if (logisticsFeeCur !== docCurrency) {
        const crossRateObj = await this.currenciesService.getCrossRate(logisticsFeeCur, docCurrency, ExchangeRateType.TRANSFER);
        logisticsFeeInDoc = logisticsFeeInDoc.times(new Decimal(crossRateObj.rate));
      }

      // Quy đổi Other Fee sang Doc Currency
      const otherFeeVal = updateQuotationDto.otherFee !== undefined ? updateQuotationDto.otherFee : (quotation.otherFee || 0);
      const otherFeeCur = updateQuotationDto.otherFeeCurrency || quotation.otherFeeCurrency || docCurrency;
      let otherFeeInDoc = new Decimal(otherFeeVal);

      if (otherFeeCur !== docCurrency) {
        const crossRateObj = await this.currenciesService.getCrossRate(otherFeeCur, docCurrency, ExchangeRateType.TRANSFER);
        otherFeeInDoc = otherFeeInDoc.times(new Decimal(crossRateObj.rate));
      }

      totalAmount = totalAmount.plus(logisticsFeeInDoc).plus(otherFeeInDoc);

      // 2. Update Quotation Header
      Object.assign(quotation, {
        ...quotationData,
        totalAmount: totalAmount.toNumber()
      });
      const savedQuotation = await queryRunner.manager.save(quotation);

      // 3. Handle Items if provided
      if (items) {
        // Delete existing items
        await queryRunner.manager.delete(QuotationItem, { quotationId: id });

        // Create new items
        const quotationItems = items.map(item => this.quotationItemsRepository.create({
          ...item,
          quotationId: id,
          totalAmount: item.quantity * item.unitPrice,
        }));
        await queryRunner.manager.save(quotationItems);
      }

      await queryRunner.commitTransaction();
      return this.findOne(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string) {
    const quotation = await this.findOne(id);
    return this.quotationsRepository.softRemove(quotation);
  }

  async updateStatus(id: string, status: QuotationStatus) {
    const quotation = await this.findOne(id);
    quotation.status = status;
    return this.quotationsRepository.save(quotation);
  }

  async bulkRemove(ids: string[]) {
    // Tìm các bản ghi cần xóa để dùng softRemove (đảm bảo trigger audit/hooks)
    const items = await this.quotationsRepository.findByIds(ids);
    return this.quotationsRepository.softRemove(items);
  }
}
