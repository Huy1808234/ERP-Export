import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Quotation, QuotationStatus, Incoterm } from './entities/quotation.entity';
import { validateIncotermLogisticsFee } from '@/helpers/incoterm.util';
import { QuotationItem } from './entities/quotation-item.entity';
import { CreateQuotationDto } from '@/modules/quotations/dto/create-quotation.dto';
import { UpdateQuotationDto } from '@/modules/quotations/dto/update-quotation.dto';
import { User } from '@/modules/users/entities/user.entity';
import { CurrenciesService } from '../currencies/currencies.service';
import { ExchangeRateType } from '../currencies/entities/exchange-rate.entity';
import { Decimal } from 'decimal.js';
import { PricingPoliciesService } from '../pricing-policies/pricing-policies.service';
import { SalesPriceSourceType } from '../pricing-policies/entities/sales-price-history.entity';
import { createOpaqueCode } from '@/common/ids/entity-id.util';
import { ApprovalMatrixService } from '../approval-matrix/approval-matrix.service';
import { ApprovalDocumentType } from '../approval-matrix/entities/approval-rule.entity';

@Injectable()
export class QuotationsService {
  constructor(
    @InjectRepository(Quotation)
    private quotationsRepository: Repository<Quotation>,
    @InjectRepository(QuotationItem)
    private quotationItemsRepository: Repository<QuotationItem>,
    private currenciesService: CurrenciesService,
    private pricingPoliciesService: PricingPoliciesService,
    private dataSource: DataSource,
    private approvalMatrixService: ApprovalMatrixService,
  ) {}

  private validateQuotationForSend(quotation: Quotation) {
    const validation = validateIncotermLogisticsFee(quotation.incoterm, {
      logisticsFee: quotation.logisticsFee,
      seaFreight: quotation.seaFreight,
      insuranceCost: quotation.insuranceCost,
      domesticTransportCost: quotation.domesticTransportCost,
      portCharges: quotation.portCharges
    });
    if (!validation.isValid) {
      throw new BadRequestException(validation.message);
    }
  }

  private async applyPricingPolicies(items: any[], quotationData: Partial<CreateQuotationDto>) {
    const incoterm = quotationData.incoterm || Incoterm.FOB;
    const currency = quotationData.currency || 'USD';
    const normalizedItems: any[] = [];

    for (const item of items || []) {
      if (Number(item.unitPrice || 0) > 0) {
        normalizedItems.push(item);
        continue;
      }

      // Pricing Policy chỉ tự điền giá khi người dùng chưa nhập giá.
      // Nếu không có policy phù hợp, service sẽ báo lỗi để tránh gửi báo giá sai.
      const resolved = await this.pricingPoliciesService.resolvePrice({
        productId: item.productId,
        buyerId: quotationData.customerId,
        quantity: Number(item.quantity),
        incoterm,
        currency,
      });

      normalizedItems.push({
        ...item,
        unitPrice: resolved.unitPrice,
        note: item.note || `Auto price from ${resolved.source}`,
      });
    }

    return normalizedItems;
  }

  async create(createQuotationDto: CreateQuotationDto, user: User) {
    console.log('>>> QuotationsService.create - User Object:', user);
    const { items, ...quotationData } = createQuotationDto;
    const normalizedItems = await this.applyPricingPolicies(items, quotationData);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Generate Quotation Number (Simple logic for now: QT-YYYYMMDD-Random)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const suffix = createOpaqueCode('quote_no').split('_').pop()?.toUpperCase();
      const quotationNumber = `QT-${dateStr}-${suffix}`;

      // 2. Calculate Total Amount (SỬ DỤNG DECIMAL.JS & QUY ĐỔI ĐA TIỀN TỆ)
      let itemsSum = new Decimal(0);
      for (const item of normalizedItems) {
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

      const totalAmount = itemsSum
        .plus(logisticsFeeInDoc)
        .plus(otherFeeInDoc)
        .plus(Number(createQuotationDto.domesticTransportCost || 0))
        .plus(Number(createQuotationDto.portCharges || 0))
        .plus(Number(createQuotationDto.seaFreight || 0))
        .plus(Number(createQuotationDto.insuranceCost || 0));

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
        createdByUsername: user.username,
        status: QuotationStatus.DRAFT,
      });

      // Tech Lead Logic: Validate Incoterm vs Logistics Fee
      const validation = validateIncotermLogisticsFee(quotation.incoterm, {
        logisticsFee: quotation.logisticsFee,
        seaFreight: quotation.seaFreight,
        insuranceCost: quotation.insuranceCost,
        domesticTransportCost: quotation.domesticTransportCost,
        portCharges: quotation.portCharges
      });
      if (!validation.isValid) {
        throw new BadRequestException(validation.message);
      }

      const savedQuotation = await queryRunner.manager.save(quotation) as unknown as Quotation;

      // 4. Create Items
      const quotationItems = normalizedItems.map(item => this.quotationItemsRepository.create({
        ...item,
        quotationId: savedQuotation._id,
        totalAmount: item.quantity * item.unitPrice,
      }));

      await queryRunner.manager.save(quotationItems);

      await this.pricingPoliciesService.recordDocumentHistory({
        sourceType: SalesPriceSourceType.QUOTATION,
        sourceId: savedQuotation._id,
        sourceNumber: savedQuotation.quotationNumber,
        buyerId: savedQuotation.customerId,
        quotationId: savedQuotation._id,
        incoterm: savedQuotation.incoterm,
        currency: savedQuotation.currency,
        exchangeRate: savedQuotation.exchangeRate,
        createdByUsername: user.username,
        items: normalizedItems,
      });

      await queryRunner.commitTransaction();
      return this.findOne(savedQuotation._id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query: any, current: number, pageSize: number) {
    const aqp = (await import('api-query-params')).default;
    const { filter, sort } = aqp(query);
    
    // Dọn dẹp các tham số không thuộc về thực thể Quotation
    delete filter.current;
    delete filter.pageSize;
    delete filter.limit;
    delete filter.populate;

    const skip = (+current - 1) * (+pageSize);

    // Xử lý tìm kiếm quotationNumber bằng ILike nếu có regex
    if (filter.quotationNumber) {
      let source = '';
      if (filter.quotationNumber instanceof RegExp) {
        source = filter.quotationNumber.source;
      } else if (typeof filter.quotationNumber === 'string') {
        // Hỗ trợ cả trường hợp gửi chuỗi regex /.../i
        if (filter.quotationNumber.startsWith('/') && filter.quotationNumber.endsWith('/i')) {
          source = filter.quotationNumber.slice(1, -2);
        } else {
          source = filter.quotationNumber;
        }
      }
      
      if (source) {
        const { ILike } = await import('typeorm');
        filter.quotationNumber = ILike(`%${source}%`);
      }
    }

    const [results, total] = await this.quotationsRepository.findAndCount({
      where: filter,
      relations: ['customer', 'createdBy', 'items', 'items.product'],
      order: sort || { createdAt: 'DESC' },
      take: pageSize || 10,
      skip: skip || 0,
    });

    return {
      results,
      meta: {
        current: +current || 1,
        pageSize: +pageSize || 10,
        pages: Math.ceil(total / (pageSize || 10)),
        total,
      },
    };
  }

  async findOne(id: string) {
    const quotation = await this.quotationsRepository.findOne({
      where: { _id: id },
      relations: ['customer', 'createdBy', 'items', 'items.product', 'proformaInvoices'],
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

      const totalAmountVal = totalAmount
        .plus(logisticsFeeInDoc)
        .plus(otherFeeInDoc)
        .plus(Number(quotationData.domesticTransportCost || 0))
        .plus(Number(quotationData.portCharges || 0))
        .plus(Number(quotationData.seaFreight || 0))
        .plus(Number(quotationData.insuranceCost || 0));

      // 2. Update Quotation Header
      Object.assign(quotation, {
        ...quotationData,
        totalAmount: totalAmountVal.toNumber()
      });

      // Tech Lead Logic: Validate Incoterm vs Logistics Fee
      const validation = validateIncotermLogisticsFee(quotation.incoterm, {
        logisticsFee: quotation.logisticsFee,
        seaFreight: quotation.seaFreight,
        insuranceCost: quotation.insuranceCost,
        domesticTransportCost: quotation.domesticTransportCost,
        portCharges: quotation.portCharges
      });
      if (!validation.isValid) {
        throw new BadRequestException(validation.message);
      }

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

  async updateStatus(id: string, status: QuotationStatus, user?: User) {
    const quotation = await this.findOne(id);

    if (
      [QuotationStatus.SENT, QuotationStatus.PENDING_APPROVAL].includes(status) &&
      [QuotationStatus.DRAFT, QuotationStatus.REJECTED].includes(
        quotation.status,
      )
    ) {
      this.validateQuotationForSend(quotation);

      const amountVnd = await this.currenciesService.convertToBase(
        Number(quotation.totalAmount || 0),
        quotation.currency,
      );
      const matchingRule = await this.approvalMatrixService.findMatchingRule(
        ApprovalDocumentType.QUOTATION,
        amountVnd,
        quotation.currency,
      );

      if (!matchingRule) {
        quotation.status = QuotationStatus.SENT;
        quotation.approvedByUsername = user?.username || quotation.createdByUsername;
        quotation.approvedAt = new Date();
        quotation.rejectionReason = null;
        return this.quotationsRepository.save(quotation);
      }

      return this.dataSource.transaction(async (manager) => {
        const approvalRequest =
          await this.approvalMatrixService.createRequestInTransaction(
            manager,
            {
              ruleId: matchingRule._id,
              documentType: ApprovalDocumentType.QUOTATION,
              documentId: quotation._id,
              documentNumber: quotation.quotationNumber,
              title: `Approve Quotation ${quotation.quotationNumber}`,
              currency: quotation.currency,
              amount: Number(quotation.totalAmount || 0),
              amountVnd,
              metadata: {
                customerId: quotation.customerId,
                customerName: quotation.customer?.name || null,
                incoterm: quotation.incoterm,
                source: 'quotations.updateStatus',
              },
            },
            user,
          );

        quotation.status = QuotationStatus.PENDING_APPROVAL;
        quotation.approvalWorkflowRequestId = approvalRequest?._id || null;
        quotation.submittedForApprovalByUsername =
          user?.username || quotation.createdByUsername;
        quotation.submittedForApprovalAt = new Date();
        quotation.approvedByUsername = null;
        quotation.approvedAt = null;
        quotation.rejectedByUsername = null;
        quotation.rejectedAt = null;
        quotation.rejectionReason = null;

        const savedQuotation = await manager.save(quotation);
        return {
          ...savedQuotation,
          approvalRequest,
        };
      });
    }

    if (quotation.status === QuotationStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Quotation is already pending approval');
    }

    this.validateQuotationForSend(quotation);
    quotation.status = status;
    return this.quotationsRepository.save(quotation);
  }

  async bulkRemove(ids: string[]) {
    // Tìm các bản ghi cần xóa để dùng softRemove (đảm bảo trigger audit/hooks)
    const items = await this.quotationsRepository.findByIds(ids);
    return this.quotationsRepository.softRemove(items);
  }
}
