import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager, Like } from 'typeorm';
import { ProformaInvoice, PIStatus } from './entities/proforma-invoice.entity';
import { ProformaInvoiceItem } from './entities/proforma-invoice-item.entity';
import { CreateProformaInvoiceDto, ConvertQuotationToPiDto } from '@/modules/proforma-invoices/dto/create-proforma-invoice.dto';
import { UpdateProformaInvoiceDto } from '@/modules/proforma-invoices/dto/update-proforma-invoice.dto';
import { User } from '@/modules/users/entities/user.entity';
import { QuotationsService } from '../quotations/quotations.service';
import { QuotationStatus, Incoterm } from '../quotations/entities/quotation.entity';
import { ProductsService } from '../products/products.service';
import { CurrenciesService } from '../currencies/currencies.service';
import { ExchangeRateType } from '../currencies/entities/exchange-rate.entity';
import { Decimal } from 'decimal.js';
import { AccountingService } from '../accounting/accounting.service';

@Injectable()
export class ProformaInvoicesService implements OnModuleInit {
  constructor(
    @InjectRepository(ProformaInvoice)
    private piRepository: Repository<ProformaInvoice>,
    @InjectRepository(ProformaInvoiceItem)
    private piItemsRepository: Repository<ProformaInvoiceItem>,
    private quotationsService: QuotationsService,
    private productsService: ProductsService,
    private currenciesService: CurrenciesService,
    private accountingService: AccountingService,
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'proforma_invoices_status_enum' AND e.enumlabel = 'ACCEPTED') THEN
            ALTER TYPE proforma_invoices_status_enum ADD VALUE 'ACCEPTED';
          END IF;
        END
        $$;
      `);
      await queryRunner.release();
    } catch (error) {
      console.warn('[PI] onModuleInit warning:', error.message);
    }
  }

  async create(createPiDto: CreateProformaInvoiceDto, user: User) {
    const { items, ...piData } = createPiDto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const piNumber = `PI-${dateStr}-${randomStr}`;

      let itemsSum = new Decimal(0);
      for (const item of items) {
        itemsSum = itemsSum.plus(new Decimal(item.quantity).times(new Decimal(item.unitPrice)));
      }
      
      const docCurrency = createPiDto.currency || 'USD';
      let logisticsFeeInDoc = new Decimal(createPiDto.logisticsFee || 0);
      if (createPiDto.logisticsFeeCurrency && createPiDto.logisticsFeeCurrency !== docCurrency) {
        const crossRateObj = await this.currenciesService.getCrossRate(createPiDto.logisticsFeeCurrency, docCurrency, ExchangeRateType.TRANSFER);
        logisticsFeeInDoc = logisticsFeeInDoc.times(new Decimal(crossRateObj.rate));
      }

      let otherFeeInDoc = new Decimal(createPiDto.otherFee || 0);
      if (createPiDto.otherFeeCurrency && createPiDto.otherFeeCurrency !== docCurrency) {
        const crossRateObj = await this.currenciesService.getCrossRate(createPiDto.otherFeeCurrency, docCurrency, ExchangeRateType.TRANSFER);
        otherFeeInDoc = otherFeeInDoc.times(new Decimal(crossRateObj.rate));
      }

      const totalAmount = itemsSum.plus(logisticsFeeInDoc).plus(otherFeeInDoc);

      let exchangeRate = createPiDto.exchangeRate;
      if (!exchangeRate) {
        const rateObj = await this.currenciesService.getCrossRate(docCurrency, 'VND', ExchangeRateType.TRANSFER);
        exchangeRate = rateObj.rate;
      }

      const pi = this.piRepository.create({
        ...piData,
        piNumber,
        exchangeRate,
        logisticsFee: logisticsFeeInDoc.toNumber(),
        logisticsFeeCurrency: createPiDto.logisticsFeeCurrency || docCurrency,
        otherFee: otherFeeInDoc.toNumber(),
        otherFeeCurrency: createPiDto.otherFeeCurrency || docCurrency,
        totalAmount: totalAmount.toNumber(),
        totalAmountVnd: totalAmount.times(new Decimal(exchangeRate)).toNumber(),
        createdById: user.id,
        status: PIStatus.DRAFT,
      });

      const savedPi = await queryRunner.manager.save(pi) as unknown as ProformaInvoice;

      const piItems = items.map(item => this.piItemsRepository.create({
        ...item,
        totalAmount: item.quantity * item.unitPrice,
      }));

      for (const item of piItems) {
        item.proformaInvoiceId = savedPi.id;
        await queryRunner.manager.save(item);
      }

      if (piData.quotationId) {
        await this.quotationsService.updateStatus(piData.quotationId, QuotationStatus.CONVERTED);
      }

      await queryRunner.commitTransaction();
      return this.findOne(savedPi.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async createFromQuotation(dto: ConvertQuotationToPiDto, user: User) {
    const quotationId = dto.quotationId;
    if (!quotationId) throw new BadRequestException('Quotation ID is required');

    const quotation = await this.quotationsService.findOne(quotationId);
    if (quotation.status !== QuotationStatus.ACCEPTED && quotation.status !== QuotationStatus.SENT) {
      throw new BadRequestException('Quotation must be SENT or ACCEPTED to convert to PI');
    }

    const piDto: CreateProformaInvoiceDto = {
      customerId: quotation.customerId,
      quotationId: quotation.id,
      incoterm: dto.incoterm || quotation.incoterm,
      incotermLocation: dto.incotermLocation || quotation.incotermLocation,
      portOfLoading: dto.portOfLoading || quotation.portOfLoading,
      portOfDischarge: dto.portOfDischarge || quotation.portOfDischarge,
      issueDate: dto.issueDate || new Date().toISOString(),
      currency: quotation.currency,
      exchangeRate: quotation.exchangeRate,
      paymentTerms: dto.paymentTerms || quotation.paymentTerms,
      note: dto.note || quotation.note,
      logisticsFee: dto.logisticsFee !== undefined ? dto.logisticsFee : (quotation.logisticsFee || 0),
      logisticsFeeCurrency: dto.logisticsFeeCurrency || quotation.logisticsFeeCurrency || 'USD',
      otherFee: dto.otherFee !== undefined ? dto.otherFee : (quotation.otherFee || 0),
      otherFeeCurrency: dto.otherFeeCurrency || quotation.otherFeeCurrency || 'USD',
      depositAmount: dto.depositAmount || 0,
      depositPercent: dto.depositPercent !== undefined ? dto.depositPercent : 30,
      items: quotation.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        note: item.note,
      })),
    };

    return this.create(piDto, user);
  }

  async findAll(query: any) {
    const current = +query.current || 1;
    const pageSize = +query.pageSize || 10;
    const skip = (current - 1) * pageSize;
    const { current: _c, pageSize: _p, populate, ...filters } = query;
    const relations = populate ? populate.split(',') : ['customer', 'createdBy', 'quotation', 'salesContract'];

    const [results, total] = await this.piRepository.findAndCount({
      where: filters,
      relations,
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
    const pi = await this.piRepository.findOne({
      where: { id },
      relations: ['customer', 'createdBy', 'quotation', 'items', 'items.product'],
    });
    if (!pi) throw new NotFoundException('Proforma Invoice not found');
    return pi;
  }

  async update(id: string, updatePiDto: UpdateProformaInvoiceDto) {
    const pi = await this.findOne(id);
    if (!pi) throw new NotFoundException('Proforma Invoice not found');
    Object.assign(pi, updatePiDto);
    return this.piRepository.save(pi);
  }

  async updateStatus(id: string, status: PIStatus) {
    const pi = await this.findOne(id);
    if (!pi) throw new NotFoundException('Proforma Invoice not found');

    const validStatuses = [PIStatus.DRAFT, PIStatus.SENT, PIStatus.ACCEPTED, PIStatus.CANCELLED];
    if (!validStatuses.includes(status)) {
       throw new BadRequestException(`Trạng thái ${status} không hợp lệ cho Báo giá (PI). Vui lòng thực hiện tại Hợp đồng (Sales Contract).`);
    }

    pi.status = status;
    return this.piRepository.save(pi);
  }
}
