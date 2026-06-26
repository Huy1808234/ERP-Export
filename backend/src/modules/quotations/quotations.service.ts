import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Quotation,
  QuotationStatus,
  Incoterm,
} from './entities/quotation.entity';
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
import { PortsService } from '../ports/ports.service';
import { Partner } from '@/modules/partners/entities/partner.entity';

const QUOTATION_PORTAL_PUBLISHED_EVENT = 'quotation.portal_published';

type PricingSource =
  | 'PRICING_POLICY'
  | 'PRICING_POLICY_DERIVED'
  | 'PRODUCT_DEFAULT';

type LogisticsFeeField =
  | 'domesticTransportCost'
  | 'portCharges'
  | 'seaFreight'
  | 'insuranceCost';

type BreakdownCostField =
  | 'inlandCostPerUnit'
  | 'portChargePerUnit'
  | 'freightCostPerUnit'
  | 'insuranceCostPerUnit'
  | 'destinationDeliveryCostPerUnit';

type PriceBreakdown = {
  inlandCostPerUnit: number;
  portChargePerUnit: number;
  freightCostPerUnit: number;
  insuranceCostPerUnit: number;
  destinationDeliveryCostPerUnit: number;
};

type QuotationPricingResolution = {
  source: PricingSource;
  unitPrice: number;
  priceBreakdown?: PriceBreakdown;
};

type QuotationLineInput = {
  productId: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  note?: string;
};

type AppliedPricingPolicies = {
  normalizedItems: QuotationLineInput[];
  includedLogisticsFields: Set<LogisticsFeeField>;
};

type QuotationLogisticsValues = Partial<
  Pick<
    CreateQuotationDto,
    'domesticTransportCost' | 'portCharges' | 'seaFreight' | 'insuranceCost'
  >
>;

const MONEY_COMPARE_EPSILON = 0.000001;

const EXACT_POLICY_INCLUDED_FIELDS_BY_INCOTERM: Record<
  Incoterm,
  LogisticsFeeField[]
> = {
  [Incoterm.EXW]: [],
  [Incoterm.FOB]: ['domesticTransportCost', 'portCharges'],
  [Incoterm.CFR]: ['domesticTransportCost', 'portCharges', 'seaFreight'],
  [Incoterm.CIF]: [
    'domesticTransportCost',
    'portCharges',
    'seaFreight',
    'insuranceCost',
  ],
  [Incoterm.DAP]: [
    'domesticTransportCost',
    'portCharges',
    'seaFreight',
    'insuranceCost',
  ],
  [Incoterm.DDP]: [
    'domesticTransportCost',
    'portCharges',
    'seaFreight',
    'insuranceCost',
  ],
};

const LOGISTICS_INCLUDED_RULES: Array<{
  field: LogisticsFeeField;
  breakdownFields: BreakdownCostField[];
}> = [
  {
    field: 'domesticTransportCost',
    breakdownFields: ['inlandCostPerUnit', 'destinationDeliveryCostPerUnit'],
  },
  {
    field: 'portCharges',
    breakdownFields: ['portChargePerUnit'],
  },
  {
    field: 'seaFreight',
    breakdownFields: ['freightCostPerUnit'],
  },
  {
    field: 'insuranceCost',
    breakdownFields: ['insuranceCostPerUnit'],
  },
];

type QuotationRouteInput = Pick<
  Partial<CreateQuotationDto>,
  | 'portOfLoading'
  | 'portOfLoading_port_id'
  | 'portOfDischarge'
  | 'portOfDischarge_port_id'
>;

type QuotationRoutePatchInput = QuotationRouteInput & {
  currentPortOfLoading?: string | null;
  currentPortOfLoadingPortId?: string | null;
  currentPortOfDischarge?: string | null;
  currentPortOfDischargePortId?: string | null;
  hasPortOfLoading: boolean;
  hasPortOfLoadingPortId: boolean;
  hasPortOfDischarge: boolean;
  hasPortOfDischargePortId: boolean;
};

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
    private portsService: PortsService,
    private eventEmitter: EventEmitter2,
  ) {}

  private emitQuotationPublishedForPortal(
    quotation: Quotation,
    username?: string | null,
  ): void {
    this.eventEmitter.emit(QUOTATION_PORTAL_PUBLISHED_EVENT, {
      quotation_id: quotation._id,
      buyer_id: quotation.customerId,
      quotationNumber: quotation.quotationNumber,
      totalAmount: Number(quotation.totalAmount || 0),
      currency: quotation.currency,
      publishedByUsername: username || null,
    });
  }

  private validateQuotationForSend(quotation: Quotation) {
    const validation = validateIncotermLogisticsFee(quotation.incoterm, {
      logisticsFee: quotation.logisticsFee,
      seaFreight: quotation.seaFreight,
      insuranceCost: quotation.insuranceCost,
      domesticTransportCost: quotation.domesticTransportCost,
      portCharges: quotation.portCharges,
    });
    if (!validation.isValid) {
      throw new BadRequestException(validation.message);
    }
  }

  private async resolveQuotationPorts<T extends QuotationRouteInput>(
    data: T,
  ): Promise<T> {
    const loading = await this.portsService.resolvePortSnapshot(
      data.portOfLoading_port_id,
      data.portOfLoading,
    );
    const discharge = await this.portsService.resolvePortSnapshot(
      data.portOfDischarge_port_id,
      data.portOfDischarge,
    );

    return {
      ...data,
      portOfLoading_port_id: loading.port_id,
      portOfLoading: loading.label,
      portOfDischarge_port_id: discharge.port_id,
      portOfDischarge: discharge.label,
    };
  }

  private async resolveQuotationPortsForUpdate(
    data: QuotationRoutePatchInput,
  ): Promise<QuotationRouteInput> {
    const loading = await this.portsService.resolvePortSnapshotPatch({
      incomingPortRef: data.portOfLoading_port_id,
      incomingLabel: data.portOfLoading,
      currentPortRef: data.currentPortOfLoadingPortId,
      currentLabel: data.currentPortOfLoading,
      hasIncomingPortRef: data.hasPortOfLoadingPortId,
      hasIncomingLabel: data.hasPortOfLoading,
    });
    const discharge = await this.portsService.resolvePortSnapshotPatch({
      incomingPortRef: data.portOfDischarge_port_id,
      incomingLabel: data.portOfDischarge,
      currentPortRef: data.currentPortOfDischargePortId,
      currentLabel: data.currentPortOfDischarge,
      hasIncomingPortRef: data.hasPortOfDischargePortId,
      hasIncomingLabel: data.hasPortOfDischarge,
    });

    return {
      portOfLoading_port_id: loading.port_id,
      portOfLoading: loading.label,
      portOfDischarge_port_id: discharge.port_id,
      portOfDischarge: discharge.label,
    };
  }

  private pricesMatch(left: number, right: number): boolean {
    return (
      Math.abs(Number(left || 0) - Number(right || 0)) <= MONEY_COMPARE_EPSILON
    );
  }

  private getIncludedLogisticsFieldsFromResolution(
    resolved: QuotationPricingResolution,
    incoterm: Incoterm,
  ): LogisticsFeeField[] {
    if (resolved.source === 'PRICING_POLICY') {
      return EXACT_POLICY_INCLUDED_FIELDS_BY_INCOTERM[incoterm];
    }

    if (
      resolved.source !== 'PRICING_POLICY_DERIVED' ||
      !resolved.priceBreakdown
    ) {
      return [];
    }

    return LOGISTICS_INCLUDED_RULES.filter((rule) =>
      rule.breakdownFields.some(
        (field) => Number(resolved.priceBreakdown?.[field] || 0) > 0,
      ),
    ).map((rule) => rule.field);
  }

  private normalizeIncludedLogisticsFees<T extends QuotationLogisticsValues>(
    values: T,
    includedFields: Set<LogisticsFeeField>,
  ): T {
    const normalizedValues: T = { ...values };

    includedFields.forEach((field) => {
      normalizedValues[field] = 0;
    });

    return normalizedValues;
  }

  private toQuotationLineInputs(
    items: QuotationItem[] = [],
  ): QuotationLineInput[] {
    return items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity || 0),
      unit: item.unit,
      unitPrice: Number(item.unitPrice || 0),
      note: item.note,
    }));
  }

  private async applyPricingPolicies(
    items: QuotationLineInput[] = [],
    quotationData: Partial<CreateQuotationDto>,
  ): Promise<AppliedPricingPolicies> {
    const incoterm = quotationData.incoterm || Incoterm.FOB;
    const currency = quotationData.currency || 'USD';
    const normalizedItems: QuotationLineInput[] = [];
    const includedLogisticsFields = new Set<LogisticsFeeField>();

    for (const item of items || []) {
      const manualUnitPrice = Number(item.unitPrice || 0);
      const hasManualUnitPrice = manualUnitPrice > 0;
      let resolved: QuotationPricingResolution | null = null;

      // Pricing Policy chỉ tự điền giá khi người dùng chưa nhập giá.
      // Nếu không có policy phù hợp, service sẽ báo lỗi để tránh gửi báo giá sai.
      try {
        resolved = await this.pricingPoliciesService.resolvePrice({
          productId: item.productId,
          buyerId: quotationData.customerId,
          quantity: Number(item.quantity),
          incoterm,
          currency,
          priceDate: quotationData.issueDate,
          origin_port_id: quotationData.portOfLoading_port_id || undefined,
          destination_port_id:
            quotationData.portOfDischarge_port_id || undefined,
        });
      } catch (error) {
        if (!hasManualUnitPrice) throw error;
      }

      const unitPrice = hasManualUnitPrice
        ? manualUnitPrice
        : Number(resolved?.unitPrice || 0);

      if (!hasManualUnitPrice && !resolved) {
        throw new NotFoundException(
          'Khong tim thay gia phu hop cho dong bao gia',
        );
      }

      if (
        resolved &&
        resolved.source !== 'PRODUCT_DEFAULT' &&
        this.pricesMatch(unitPrice, Number(resolved.unitPrice || 0))
      ) {
        this.getIncludedLogisticsFieldsFromResolution(
          resolved,
          incoterm,
        ).forEach((field) => includedLogisticsFields.add(field));
      }

      normalizedItems.push({
        ...item,
        quantity: Number(item.quantity),
        unitPrice,
        note:
          item.note ||
          (!hasManualUnitPrice && resolved
            ? `Auto price from ${resolved.source}`
            : undefined),
      });
    }

    return { normalizedItems, includedLogisticsFields };
  }

  async create(createQuotationDto: CreateQuotationDto, user: User) {
    const { items, ...quotationData } = createQuotationDto;
    if (!quotationData.paymentTerms && quotationData.customerId) {
      const partner = await this.dataSource.getRepository(Partner).findOne({
        where: { _id: quotationData.customerId },
      });
      if (partner?.defaultPaymentTerm) {
        quotationData.paymentTerms = partner.defaultPaymentTerm;
      }
    }
    const quotationRouteData = await this.resolveQuotationPorts(quotationData);

    const pricingResult = await this.applyPricingPolicies(
      items,
      quotationRouteData,
    );
    const normalizedItems = pricingResult.normalizedItems;
    const normalizedQuotationData = this.normalizeIncludedLogisticsFees(
      quotationRouteData,
      pricingResult.includedLogisticsFields,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Generate Quotation Number (Simple logic for now: QT-YYYYMMDD-Random)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const suffix = createOpaqueCode('quote_no')
        .split('_')
        .pop()
        ?.toUpperCase();
      const quotationNumber = `QT-${dateStr}-${suffix}`;

      // 2. Calculate Total Amount (SỬ DỤNG DECIMAL.JS & QUY ĐỔI ĐA TIỀN TỆ)
      let itemsSum = new Decimal(0);
      for (const item of normalizedItems) {
        itemsSum = itemsSum.plus(
          new Decimal(item.quantity).times(new Decimal(item.unitPrice)),
        );
      }

      const docCurrency = normalizedQuotationData.currency || 'USD';

      // Quy đổi Logistics Fee sang Doc Currency nếu khác loại tệ
      let logisticsFeeInDoc = new Decimal(
        normalizedQuotationData.logisticsFee || 0,
      );
      if (
        normalizedQuotationData.logisticsFeeCurrency &&
        normalizedQuotationData.logisticsFeeCurrency !== docCurrency
      ) {
        const crossRateObj = await this.currenciesService.getCrossRate(
          normalizedQuotationData.logisticsFeeCurrency,
          docCurrency,
          ExchangeRateType.TRANSFER,
        );
        logisticsFeeInDoc = logisticsFeeInDoc.times(
          new Decimal(crossRateObj.rate),
        );
      }

      // Quy đổi Other Fee sang Doc Currency
      let otherFeeInDoc = new Decimal(normalizedQuotationData.otherFee || 0);
      if (
        normalizedQuotationData.otherFeeCurrency &&
        normalizedQuotationData.otherFeeCurrency !== docCurrency
      ) {
        const crossRateObj = await this.currenciesService.getCrossRate(
          normalizedQuotationData.otherFeeCurrency,
          docCurrency,
          ExchangeRateType.TRANSFER,
        );
        otherFeeInDoc = otherFeeInDoc.times(new Decimal(crossRateObj.rate));
      }

      const totalAmount = itemsSum
        .plus(logisticsFeeInDoc)
        .plus(otherFeeInDoc)
        .plus(Number(normalizedQuotationData.domesticTransportCost || 0))
        .plus(Number(normalizedQuotationData.portCharges || 0))
        .plus(Number(normalizedQuotationData.seaFreight || 0))
        .plus(Number(normalizedQuotationData.insuranceCost || 0));

      // 3. Chốt tỷ giá (Fixing Rate) quy ra VND để lưu vết kế toán sau này
      let exchangeRate = normalizedQuotationData.exchangeRate;
      if (!exchangeRate) {
        const rateObj = await this.currenciesService.getCrossRate(
          docCurrency,
          'VND',
          ExchangeRateType.TRANSFER,
        );
        exchangeRate = rateObj.rate;
      }

      // 4. Create Quotation
      const quotation = this.quotationsRepository.create({
        ...normalizedQuotationData,
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
        portCharges: quotation.portCharges,
      });
      if (!validation.isValid) {
        throw new BadRequestException(validation.message);
      }

      const savedQuotation = (await queryRunner.manager.save(
        quotation,
      )) as unknown as Quotation;

      // 4. Create Items
      const quotationItems = normalizedItems.map((item) =>
        this.quotationItemsRepository.create({
          ...item,
          quotationId: savedQuotation._id,
          totalAmount: item.quantity * item.unitPrice,
        }),
      );

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
        occurredAt: savedQuotation.issueDate,
        origin_port_id: savedQuotation.portOfLoading_port_id,
        destination_port_id: savedQuotation.portOfDischarge_port_id,
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

    const skip = (+current - 1) * +pageSize;

    // Xử lý tìm kiếm quotationNumber bằng ILike nếu có regex
    if (filter.quotationNumber) {
      let source = '';
      if (filter.quotationNumber instanceof RegExp) {
        source = filter.quotationNumber.source;
      } else if (typeof filter.quotationNumber === 'string') {
        // Hỗ trợ cả trường hợp gửi chuỗi regex /.../i
        if (
          filter.quotationNumber.startsWith('/') &&
          filter.quotationNumber.endsWith('/i')
        ) {
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
      relations: [
        'customer',
        'createdBy',
        'items',
        'items.product',
        'proformaInvoices',
      ],
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  async update(id: string, updateQuotationDto: UpdateQuotationDto) {
    const quotation = await this.findOne(id);
    if (
      quotation.status !== QuotationStatus.DRAFT &&
      quotation.status !== QuotationStatus.SENT
    ) {
      throw new BadRequestException(
        'Only DRAFT or SENT quotations can be updated',
      );
    }

    const { items, ...quotationData } = updateQuotationDto;
    const hasPortOfLoadingPortId = Object.prototype.hasOwnProperty.call(
      quotationData,
      'portOfLoading_port_id',
    );
    const hasPortOfLoading = Object.prototype.hasOwnProperty.call(
      quotationData,
      'portOfLoading',
    );
    const hasPortOfDischargePortId = Object.prototype.hasOwnProperty.call(
      quotationData,
      'portOfDischarge_port_id',
    );
    const hasPortOfDischarge = Object.prototype.hasOwnProperty.call(
      quotationData,
      'portOfDischarge',
    );
    const quotationRouteData = await this.resolveQuotationPortsForUpdate({
      portOfLoading_port_id: quotationData.portOfLoading_port_id,
      portOfLoading: quotationData.portOfLoading,
      portOfDischarge_port_id: quotationData.portOfDischarge_port_id,
      portOfDischarge: quotationData.portOfDischarge,
      currentPortOfLoadingPortId: quotation.portOfLoading_port_id,
      currentPortOfLoading: quotation.portOfLoading,
      currentPortOfDischargePortId: quotation.portOfDischarge_port_id,
      currentPortOfDischarge: quotation.portOfDischarge,
      hasPortOfLoadingPortId,
      hasPortOfLoading,
      hasPortOfDischargePortId,
      hasPortOfDischarge,
    });
    const pricingContext: Partial<CreateQuotationDto> = {
      customerId: quotationData.customerId || quotation.customerId,
      incoterm: quotationData.incoterm || quotation.incoterm,
      currency: quotationData.currency || quotation.currency,
      issueDate: quotationData.issueDate || quotation.issueDate.toISOString(),
      ...quotationRouteData,
    };
    const pricingInputItems =
      items || this.toQuotationLineInputs(quotation.items);
    const pricingResult = await this.applyPricingPolicies(
      pricingInputItems,
      pricingContext,
    );
    const normalizedItems = items ? pricingResult.normalizedItems : undefined;
    const normalizedQuotationData = this.normalizeIncludedLogisticsFees(
      { ...quotationData, ...quotationRouteData },
      pricingResult.includedLogisticsFields,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Calculate new total (SỬ DỤNG DECIMAL.JS & QUY ĐỔI ĐA TIỀN TỆ)
      const docCurrency =
        normalizedQuotationData.currency || quotation.currency;
      let totalAmount = new Decimal(0);

      // Tính tổng tiền hàng
      if (normalizedItems) {
        for (const item of normalizedItems) {
          totalAmount = totalAmount.plus(
            new Decimal(item.quantity).times(new Decimal(item.unitPrice)),
          );
        }
      } else {
        // Nếu không gửi items, lấy tổng tiền hàng cũ (cần trừ đi phí cũ trước)
        const oldItemsSum = new Decimal(quotation.totalAmount)
          .minus(new Decimal(quotation.logisticsFee || 0))
          .minus(new Decimal(quotation.otherFee || 0))
          .minus(new Decimal(quotation.domesticTransportCost || 0))
          .minus(new Decimal(quotation.portCharges || 0))
          .minus(new Decimal(quotation.seaFreight || 0))
          .minus(new Decimal(quotation.insuranceCost || 0)); // Giả định các phí chi tiết cùng docCurrency.
        totalAmount = oldItemsSum;
      }

      // Quy đổi Logistics Fee sang Doc Currency
      const logisticsFeeVal =
        normalizedQuotationData.logisticsFee !== undefined
          ? normalizedQuotationData.logisticsFee
          : quotation.logisticsFee || 0;
      const logisticsFeeCur =
        normalizedQuotationData.logisticsFeeCurrency ||
        quotation.logisticsFeeCurrency ||
        docCurrency;
      let logisticsFeeInDoc = new Decimal(logisticsFeeVal);

      if (logisticsFeeCur !== docCurrency) {
        const crossRateObj = await this.currenciesService.getCrossRate(
          logisticsFeeCur,
          docCurrency,
          ExchangeRateType.TRANSFER,
        );
        logisticsFeeInDoc = logisticsFeeInDoc.times(
          new Decimal(crossRateObj.rate),
        );
      }

      // Quy đổi Other Fee sang Doc Currency
      const otherFeeVal =
        normalizedQuotationData.otherFee !== undefined
          ? normalizedQuotationData.otherFee
          : quotation.otherFee || 0;
      const otherFeeCur =
        normalizedQuotationData.otherFeeCurrency ||
        quotation.otherFeeCurrency ||
        docCurrency;
      let otherFeeInDoc = new Decimal(otherFeeVal);

      if (otherFeeCur !== docCurrency) {
        const crossRateObj = await this.currenciesService.getCrossRate(
          otherFeeCur,
          docCurrency,
          ExchangeRateType.TRANSFER,
        );
        otherFeeInDoc = otherFeeInDoc.times(new Decimal(crossRateObj.rate));
      }

      const domesticTransportCostVal =
        normalizedQuotationData.domesticTransportCost !== undefined
          ? normalizedQuotationData.domesticTransportCost
          : quotation.domesticTransportCost || 0;
      const portChargesVal =
        normalizedQuotationData.portCharges !== undefined
          ? normalizedQuotationData.portCharges
          : quotation.portCharges || 0;
      const seaFreightVal =
        normalizedQuotationData.seaFreight !== undefined
          ? normalizedQuotationData.seaFreight
          : quotation.seaFreight || 0;
      const insuranceCostVal =
        normalizedQuotationData.insuranceCost !== undefined
          ? normalizedQuotationData.insuranceCost
          : quotation.insuranceCost || 0;

      const totalAmountVal = totalAmount
        .plus(logisticsFeeInDoc)
        .plus(otherFeeInDoc)
        .plus(Number(domesticTransportCostVal || 0))
        .plus(Number(portChargesVal || 0))
        .plus(Number(seaFreightVal || 0))
        .plus(Number(insuranceCostVal || 0));

      // 2. Update Quotation Header
      Object.assign(quotation, {
        ...normalizedQuotationData,
        totalAmount: totalAmountVal.toNumber(),
      });

      // Tech Lead Logic: Validate Incoterm vs Logistics Fee
      const validation = validateIncotermLogisticsFee(quotation.incoterm, {
        logisticsFee: quotation.logisticsFee,
        seaFreight: quotation.seaFreight,
        insuranceCost: quotation.insuranceCost,
        domesticTransportCost: quotation.domesticTransportCost,
        portCharges: quotation.portCharges,
      });
      if (!validation.isValid) {
        throw new BadRequestException(validation.message);
      }

      const savedQuotation = await queryRunner.manager.save(quotation);

      // 3. Handle Items if provided
      if (normalizedItems) {
        // Delete existing items
        await queryRunner.manager.delete(QuotationItem, { quotationId: id });

        // Create new items
        const quotationItems = normalizedItems.map((item) =>
          this.quotationItemsRepository.create({
            ...item,
            quotationId: id,
            totalAmount: item.quantity * item.unitPrice,
          }),
        );
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
      [QuotationStatus.SENT, QuotationStatus.PENDING_APPROVAL].includes(
        status,
      ) &&
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
        quotation.approvedByUsername =
          user?.username || quotation.createdByUsername;
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
