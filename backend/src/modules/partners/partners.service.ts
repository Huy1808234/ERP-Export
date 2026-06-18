import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import {
  BuyerRegion,
  BuyerRiskLevel,
  Partner,
  PartnerType,
} from './entities/partner.entity';
import { Quotation } from '@/modules/quotations/entities/quotation.entity';
import {
  PIStatus,
  ProformaInvoice,
} from '@/modules/proforma-invoices/entities/proforma-invoice.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/entities/purchase-order.entity';
import {
  QCClaimStatus,
  QCResult,
  QualityCheck,
} from '@/modules/quality-control/entities/quality-check.entity';
import { VendorInvoice } from '@/modules/vendor-invoices/entities/vendor-invoice.entity';
import {
  AccountPayable,
  APStatus,
} from '@/modules/account-payables/entities/account-payable.entity';
import { CurrenciesService } from '../currencies/currencies.service';
import { ExchangeRateType } from '../currencies/entities/exchange-rate.entity';
import { Decimal } from 'decimal.js';
import * as XLSX from 'xlsx';
import {
  normalizeCountryCode,
  resolveRegionByCountry,
} from '@/common/geo.util';

type PartnerFilterValue = string | number | boolean | RegExp | null | undefined;
type PartnerFilter = Record<string, PartnerFilterValue>;
type PartnerSort = Record<string, number>;
type PartnerWithSnapshot = Omit<Partner, 'assignId'> & {
  apBalance: number;
  availableCredit: number;
  balanceSortValue: number;
  creditLimit: number;
  currentDebt: number;
  riskLevel: BuyerRiskLevel;
};

const PARTNER_SEARCH_COLUMNS = [
  'name',
  'taxCode',
  'country',
  'email',
  'phone',
  'contactName',
] as const;

const PARTNER_TEXT_FILTER_COLUMNS = new Set<string>(PARTNER_SEARCH_COLUMNS);

const PARTNER_REGION_COUNTRY_ALIASES: Record<string, string[]> = {
  ASEAN: [
    'ASEAN',
    'Việt Nam',
    'Vietnam',
    'Thailand',
    'Singapore',
    'Malaysia',
    'Indonesia',
    'Philippines',
  ],
  APAC: ['APAC', 'China', 'Japan', 'Korea', 'Australia', 'Asia'],
  EU: ['EU', 'Europe', 'European', 'Germany', 'France', 'Netherlands'],
  MIDDLE_EAST: ['Middle East', 'UAE', 'Saudi', 'Qatar'],
  US: ['US', 'USA', 'United States', 'America', 'American', 'Hoa Kỳ', 'Mỹ'],
};

const PARTNER_DB_SORT_COLUMNS = new Set([
  'country',
  'isActive',
  'name',
  'partnerType',
  'region',
  'updatedAt',
]);

const PARTNER_DYNAMIC_SORT_COLUMNS = new Set(['balance', 'debt']);

const toBuyerRegion = (value?: string | null): BuyerRegion | null => {
  if (!value) return null;
  return Object.values(BuyerRegion).includes(value as BuyerRegion)
    ? (value as BuyerRegion)
    : null;
};

@Injectable()
export class PartnersService {
  constructor(
    @InjectRepository(Partner)
    private partnerRepository: Repository<Partner>,

    @InjectRepository(Quotation)
    private quotationRepository: Repository<Quotation>,

    @InjectRepository(ProformaInvoice)
    private proformaInvoiceRepository: Repository<ProformaInvoice>,

    @InjectRepository(Shipment)
    private shipmentRepository: Repository<Shipment>,

    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,

    @InjectRepository(VendorInvoice)
    private vendorInvoiceRepository: Repository<VendorInvoice>,

    @InjectRepository(AccountPayable)
    private accountPayableRepository: Repository<AccountPayable>,

    @InjectRepository(QualityCheck)
    private qualityCheckRepository: Repository<QualityCheck>,

    private currenciesService: CurrenciesService,
  ) {}

  /**
   * Chuyển đổi giá trị sang number an toàn
   */
  private toNumber(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  private normalizeSubmittedCountryCode(
    countryCode?: string | null,
    country?: string | null,
  ): string | null {
    const rawCountryCode = countryCode?.trim();
    if (rawCountryCode) {
      const normalized = normalizeCountryCode(rawCountryCode);
      if (!normalized) {
        throw new BadRequestException(
          'Ma quoc gia khong hop le. Vui long chon ma ISO 2 ky tu, vi du: VN.',
        );
      }
      return normalized;
    }

    return normalizeCountryCode(country);
  }

  /**
   * Phân loại mức độ rủi ro dựa trên dư nợ và hạn mức
   */
  private classifyBuyerRisk(
    currentDebt: number,
    creditLimit: number,
    partner: Partner,
  ): BuyerRiskLevel {
    // 1. Ưu tiên ghi đè thủ công (VIP/Special cases)
    if (partner.isManualRisk && partner.manualRiskLevel) {
      return partner.manualRiskLevel;
    }

    // 2. Logic tự động chuẩn
    if (currentDebt <= 0) return BuyerRiskLevel.LOW;
    if (!creditLimit || creditLimit <= 0) return BuyerRiskLevel.HIGH;

    const utilization = currentDebt / creditLimit;
    if (utilization >= 0.8) return BuyerRiskLevel.HIGH;
    if (utilization >= 0.5) return BuyerRiskLevel.MEDIUM;
    return BuyerRiskLevel.LOW;
  }

  private async calculateActualBalances(
    partnerId: string,
  ): Promise<{ arBalance: number; apBalance: number }> {
    try {
      const arResult = await this.partnerRepository.manager.query(
        `SELECT SUM(debit) as debit, SUM(credit) as credit FROM ledger_entries WHERE "accountCode" = '131' AND "partnerId" = $1`,
        [partnerId],
      );

      const arBalance = new Decimal(arResult[0]?.debit || 0)
        .minus(new Decimal(arResult[0]?.credit || 0))
        .toNumber();

      const apResult = await this.partnerRepository.manager.query(
        `SELECT SUM(debit) as debit, SUM(credit) as credit FROM ledger_entries WHERE "accountCode" = '331' AND "partnerId" = $1`,
        [partnerId],
      );

      const apBalance = new Decimal(apResult[0]?.credit || 0)
        .minus(new Decimal(apResult[0]?.debit || 0))
        .toNumber();

      return { arBalance, apBalance };
    } catch (error) {
      console.error(
        'Error calculating actual balances for partner',
        partnerId,
        ':',
        error,
      );
      return { arBalance: 0, apBalance: 0 };
    }
  }

  /**
   * Tính tổng dư nợ hiện tại quy đổi theo tiền tệ của đối tác
   */
  private async getCurrentDebt(
    partner: Partner,
    actualDebtInVnd: number,
  ): Promise<number> {
    const partnerCurrency = partner.defaultCurrency || 'USD';
    const debtInVnd = this.toNumber(actualDebtInVnd);

    if (partnerCurrency === 'VND' || debtInVnd === 0) return debtInVnd;

    try {
      const rateObj = await this.currenciesService.getCrossRate(
        'VND',
        partnerCurrency,
        ExchangeRateType.TRANSFER,
      );
      return new Decimal(debtInVnd).times(new Decimal(rateObj.rate)).toNumber();
    } catch (error) {
      // Senior Fallback: Nếu DB chưa có tỷ giá, dùng tỷ giá mặc định thay vì trả về VND sai lệch
      if (partnerCurrency === 'USD')
        return new Decimal(debtInVnd).div(26128).toNumber();
      if (partnerCurrency === 'EUR')
        return new Decimal(debtInVnd).div(27500).toNumber();
      return debtInVnd;
    }
  }

  /**
   * Tạo Snapshot thông tin tài chính của Buyer
   */
  private async buildBuyerSnapshot(partner: Partner) {
    const { arBalance, apBalance } = await this.calculateActualBalances(
      partner._id,
    );
    const currentDebt = await this.getCurrentDebt(partner, arBalance);

    // Đối với AP Balance cũng cần quy đổi nếu khác VND
    const apBalanceConverted = await this.getCurrentDebt(partner, apBalance);

    const creditLimit = this.toNumber(partner.creditLimit);
    const riskLevel = this.classifyBuyerRisk(currentDebt, creditLimit, partner);

    return {
      balanceSortValue:
        partner.partnerType === PartnerType.CUSTOMER ? arBalance : apBalance,
      currentDebt,
      apBalance: apBalanceConverted,
      creditLimit,
      riskLevel,
      isManualRisk: partner.isManualRisk,
      manualRiskLevel: partner.manualRiskLevel,
      availableCredit:
        creditLimit > 0 ? Math.max(creditLimit - currentDebt, 0) : 0,
    };
  }

  private consumeSearchTerm(filter: PartnerFilter): string | null {
    const rawSearch = filter.search;
    delete filter.search;

    if (rawSearch instanceof RegExp) {
      return rawSearch.source.trim() || null;
    }

    if (typeof rawSearch === 'string' || typeof rawSearch === 'number') {
      return String(rawSearch).trim() || null;
    }

    return null;
  }

  private consumeRiskLevelFilter(filter: PartnerFilter): BuyerRiskLevel | null {
    const rawRiskLevel = filter.riskLevel;
    delete filter.riskLevel;

    if (typeof rawRiskLevel !== 'string') return null;

    return (Object.values(BuyerRiskLevel) as string[]).includes(rawRiskLevel)
      ? (rawRiskLevel as BuyerRiskLevel)
      : null;
  }

  private async buildPartnerRows(
    partners: Partner[],
  ): Promise<PartnerWithSnapshot[]> {
    return Promise.all(
      partners.map(async (item) => {
        const snapshot = await this.buildBuyerSnapshot(item);
        return { ...item, ...snapshot };
      }),
    );
  }

  private getPrimarySort(
    sort?: PartnerSort,
  ): { field: string; order: 'ASC' | 'DESC' } | null {
    if (!sort) return null;

    const [field] = Object.keys(sort);
    if (!field) return null;

    return {
      field,
      order: sort[field] === 1 ? 'ASC' : 'DESC',
    };
  }

  private sortPartnerRows(
    rows: PartnerWithSnapshot[],
    sortConfig: { field: string; order: 'ASC' | 'DESC' } | null,
  ): PartnerWithSnapshot[] {
    if (!sortConfig || !PARTNER_DYNAMIC_SORT_COLUMNS.has(sortConfig.field)) {
      return rows;
    }

    const direction = sortConfig.order === 'ASC' ? 1 : -1;

    return [...rows].sort((first, second) => {
      return (first.balanceSortValue - second.balanceSortValue) * direction;
    });
  }

  private applySearch(
    queryBuilder: SelectQueryBuilder<Partner>,
    searchTerm: string | null,
  ) {
    if (!searchTerm) return;

    const compactSearchTerm = searchTerm.replace(/[^0-9A-Za-z]/g, '');

    queryBuilder.andWhere(
      new Brackets((qb) => {
        PARTNER_SEARCH_COLUMNS.forEach((column, index) => {
          const condition = `partner.${column} ILIKE :partnerSearch`;
          if (index === 0) {
            qb.where(condition, { partnerSearch: `%${searchTerm}%` });
            return;
          }

          qb.orWhere(condition);
        });

        if (compactSearchTerm) {
          qb.orWhere(
            `regexp_replace(COALESCE(partner.taxCode, ''), '[^0-9A-Za-z]', '', 'g') ILIKE :partnerCompactSearch`,
            { partnerCompactSearch: `%${compactSearchTerm}%` },
          );
        }
      }),
    );
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Partner>,
    filter: PartnerFilter,
  ) {
    Object.keys(filter).forEach((key) => {
      const value = filter[key];
      if (value === undefined || value === null || value === '') return;

      if (key === 'region' && typeof value === 'string') {
        const aliases = PARTNER_REGION_COUNTRY_ALIASES[value] ?? [];
        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where('partner.region = :region', { region: value });
            aliases.forEach((alias, index) => {
              qb.orWhere(`partner.country ILIKE :regionAlias${index}`, {
                [`regionAlias${index}`]: `%${alias}%`,
              });
            });
          }),
        );
        return;
      }

      if (value instanceof RegExp) {
        queryBuilder.andWhere(`partner.${key} ILIKE :${key}`, {
          [key]: `%${value.source}%`,
        });
        return;
      }

      if (typeof value === 'string' && PARTNER_TEXT_FILTER_COLUMNS.has(key)) {
        queryBuilder.andWhere(`partner.${key} ILIKE :${key}`, {
          [key]: `%${value}%`,
        });
        return;
      }

      queryBuilder.andWhere(`partner.${key} = :${key}`, {
        [key]: value,
      });
    });
  }

  private applySort(
    queryBuilder: SelectQueryBuilder<Partner>,
    sort?: PartnerSort,
  ) {
    const sortConfig = this.getPrimarySort(sort);

    if (sortConfig?.field === 'partnerType') {
      queryBuilder.addOrderBy(
        `CASE partner.partnerType WHEN 'LOGISTICS' THEN 1 WHEN 'CUSTOMER' THEN 2 WHEN 'SUPPLIER' THEN 3 ELSE 4 END`,
        sortConfig.order,
      );
      return;
    }

    if (sortConfig && PARTNER_DB_SORT_COLUMNS.has(sortConfig.field)) {
      queryBuilder.addOrderBy(`partner.${sortConfig.field}`, sortConfig.order);
      return;
    }

    queryBuilder.orderBy('partner.updatedAt', 'DESC');
  }

  async create(createPartnerDto: CreatePartnerDto) {
    if (createPartnerDto.taxCode) {
      const existingPartner = await this.partnerRepository.findOne({
        where: { taxCode: createPartnerDto.taxCode },
      });
      if (existingPartner) {
        throw new BadRequestException('Đối tác đã tồn tại với mã số thuế này');
      }
    }

    const countryCode = this.normalizeSubmittedCountryCode(
      createPartnerDto.countryCode,
      createPartnerDto.country,
    );
    const inferredRegion = toBuyerRegion(resolveRegionByCountry(countryCode));
    const partner = this.partnerRepository.create({
      ...createPartnerDto,
      countryCode: countryCode,
      country: createPartnerDto.country || undefined,
      region:
        createPartnerDto.region ||
        (createPartnerDto.partnerType === PartnerType.CUSTOMER
          ? inferredRegion
          : null),
      // creditLimit đã được transformer xử lý, gán trực tiếp number
      creditLimit: createPartnerDto.creditLimit ?? 0,
      isActive: createPartnerDto.isActive ?? true,
    });

    const saved = await this.partnerRepository.save(partner);
    return saved;
  }

  async findAll(query: any, current: number, pageSize: number) {
    const aqp = (await import('api-query-params')).default;
    const { filter, sort } = aqp(query);
    ['current', 'pageSize', 'limit', 'skip'].forEach(
      (key) => delete filter[key],
    );

    // Parse to number safely
    const curr = +current || 1;
    const pSize = +pageSize || 10;

    const searchTerm = this.consumeSearchTerm(filter);
    const riskLevelFilter = this.consumeRiskLevelFilter(filter);
    const sortConfig = this.getPrimarySort(sort);
    const shouldSortAfterSnapshot =
      !!sortConfig && PARTNER_DYNAMIC_SORT_COLUMNS.has(sortConfig.field);

    const skip = (curr - 1) * pSize;

    const queryBuilder = this.partnerRepository.createQueryBuilder('partner');

    this.applyFilters(queryBuilder, filter);
    this.applySearch(queryBuilder, searchTerm);
    this.applySort(queryBuilder, sort);

    if (riskLevelFilter || shouldSortAfterSnapshot) {
      const allResultsRaw = await queryBuilder.getMany();
      const allResults = await this.buildPartnerRows(allResultsRaw);
      const riskFilteredResults = allResults.filter(
        (item) => !riskLevelFilter || item.riskLevel === riskLevelFilter,
      );
      const sortedResults = this.sortPartnerRows(
        riskFilteredResults,
        sortConfig,
      );

      return {
        results: sortedResults.slice(skip, skip + pSize),
        totalPages: Math.ceil(sortedResults.length / pSize),
        totalItems: sortedResults.length,
      };
    }

    queryBuilder.skip(skip).take(pSize);

    const [resultsRaw, totalItems] = await queryBuilder.getManyAndCount();

    const results = await this.buildPartnerRows(resultsRaw);

    return {
      results,
      totalPages: Math.ceil(totalItems / pSize),
      totalItems,
    };
  }

  async findOne(id: string) {
    const partner = await this.partnerRepository.findOneBy({ _id: id });
    if (!partner) throw new NotFoundException('Không tìm thấy đối tác');

    const snapshot = await this.buildBuyerSnapshot(partner);
    return { ...partner, ...snapshot };
  }

  async getPartnerHistory(id: string) {
    const partner = await this.partnerRepository.findOneBy({ _id: id });
    if (!partner) throw new NotFoundException('Không tìm thấy đối tác');

    const isVendorLike =
      partner.partnerType === 'SUPPLIER' || partner.partnerType === 'LOGISTICS';

    const [
      quotations,
      quotationTotal,
      piItems,
      piTotal,
      shipmentsRaw,
      shipmentTotal,
      purchaseOrders,
      poTotal,
      vendorInvoices,
      vendorInvoiceTotal,
      payables,
      payableTotal,
      qualityClaims,
      qualityClaimTotal,
      snapshot,
    ] = await Promise.all([
      // Chỉ lấy Quotations cho Customer
      partner.partnerType === 'CUSTOMER'
        ? this.quotationRepository.find({
            where: { customerId: id },
            order: { updatedAt: 'DESC' },
            take: 5,
          })
        : Promise.resolve([]),
      partner.partnerType === 'CUSTOMER'
        ? this.quotationRepository.count({ where: { customerId: id } })
        : Promise.resolve(0),

      // Chỉ lấy PI cho Customer
      partner.partnerType === 'CUSTOMER'
        ? this.proformaInvoiceRepository.find({
            where: { customerId: id },
            order: { updatedAt: 'DESC' },
            take: 5,
          })
        : Promise.resolve([]),
      partner.partnerType === 'CUSTOMER'
        ? this.proformaInvoiceRepository.count({ where: { customerId: id } })
        : Promise.resolve(0),

      // Lấy Shipments cho Logistics
      partner.partnerType === 'LOGISTICS'
        ? this.shipmentRepository.find({
            where: { logisticsPartnerId: id },
            order: { updatedAt: 'DESC' },
            take: 10,
          })
        : Promise.resolve([]),
      partner.partnerType === 'LOGISTICS'
        ? this.shipmentRepository.count({ where: { logisticsPartnerId: id } })
        : Promise.resolve(0),

      isVendorLike
        ? this.purchaseOrderRepository.find({
            where: { vendorId: id },
            relations: ['items', 'items.product'],
            order: { updatedAt: 'DESC' },
            take: 5,
          })
        : Promise.resolve([]),
      isVendorLike
        ? this.purchaseOrderRepository.count({ where: { vendorId: id } })
        : Promise.resolve(0),

      isVendorLike
        ? this.vendorInvoiceRepository.find({
            where: { vendorId: id },
            relations: ['purchaseOrder'],
            order: { updatedAt: 'DESC' },
            take: 5,
          })
        : Promise.resolve([]),
      isVendorLike
        ? this.vendorInvoiceRepository.count({ where: { vendorId: id } })
        : Promise.resolve(0),

      isVendorLike
        ? this.accountPayableRepository.find({
            where: { vendorId: id },
            order: { dueDate: 'ASC', updatedAt: 'DESC' },
            take: 10,
          })
        : Promise.resolve([]),
      isVendorLike
        ? this.accountPayableRepository.count({ where: { vendorId: id } })
        : Promise.resolve(0),

      isVendorLike
        ? this.qualityCheckRepository
            .createQueryBuilder('qc')
            .leftJoinAndSelect('qc.product', 'product')
            .leftJoinAndSelect('qc.purchaseOrder', 'purchaseOrder')
            .leftJoinAndSelect('qc.purchaseReturn', 'purchaseReturn')
            .where('purchaseOrder.vendorId = :id', { id })
            .andWhere(
              '(qc.result != :passed OR qc.claimStatus != :none OR qc.claimNumber IS NOT NULL)',
              {
                passed: QCResult.PASSED,
                none: QCClaimStatus.NONE,
              },
            )
            .orderBy('qc.updatedAt', 'DESC')
            .take(10)
            .getMany()
        : Promise.resolve([]),
      isVendorLike
        ? this.qualityCheckRepository
            .createQueryBuilder('qc')
            .leftJoin('qc.purchaseOrder', 'purchaseOrder')
            .where('purchaseOrder.vendorId = :id', { id })
            .andWhere(
              '(qc.result != :passed OR qc.claimStatus != :none OR qc.claimNumber IS NOT NULL)',
              {
                passed: QCResult.PASSED,
                none: QCClaimStatus.NONE,
              },
            )
            .getCount()
        : Promise.resolve(0),

      this.buildBuyerSnapshot(partner),
    ]);

    const getLatestDate = (...dates: (Date | undefined)[]) => {
      const validDates = dates.filter((d): d is Date => !!d);
      return validDates.length
        ? new Date(Math.max(...validDates.map((d) => d.getTime())))
        : null;
    };

    const lastActivityAt = getLatestDate(
      quotations[0]?.updatedAt,
      piItems[0]?.updatedAt,
      shipmentsRaw[0]?.updatedAt,
      purchaseOrders[0]?.updatedAt,
      vendorInvoices[0]?.updatedAt,
      payables[0]?.updatedAt,
      qualityClaims[0]?.updatedAt,
    );

    const payableSummary = payables.reduce(
      (acc, item) => {
        if (item.status === APStatus.VOID) {
          return acc;
        }

        const amount = this.toNumber(item.amount);
        const paid = this.toNumber(item.paidAmount);
        const remaining = Math.max(amount - paid, 0);
        acc.totalAmount += amount;
        acc.paidAmount += paid;
        acc.remainingAmount += remaining;

        if (item.status !== APStatus.PAID) {
          acc.openCount += 1;
        }
        if (
          item.dueDate &&
          new Date(item.dueDate).getTime() < Date.now() &&
          item.status !== APStatus.PAID
        ) {
          acc.overdueCount += 1;
        }

        return acc;
      },
      {
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        openCount: 0,
        overdueCount: 0,
      },
    );

    return {
      partner: { ...partner, ...snapshot },
      quotations: { total: quotationTotal, items: quotations },
      proformaInvoices: { total: piTotal, items: piItems },
      shipments: { total: shipmentTotal, items: shipmentsRaw },
      purchaseOrders: { total: poTotal, items: purchaseOrders },
      vendorInvoices: { total: vendorInvoiceTotal, items: vendorInvoices },
      payables: {
        total: payableTotal,
        items: payables,
        summary: payableSummary,
      },
      qualityClaims: {
        total: qualityClaimTotal,
        items: qualityClaims,
        summary: {
          openClaims: qualityClaims.filter(
            (item) =>
              item.claimStatus === QCClaimStatus.OPEN ||
              item.claimStatus === QCClaimStatus.SENT,
          ).length,
          failedChecks: qualityClaims.filter(
            (item) => item.result !== QCResult.PASSED,
          ).length,
          rejectedQuantity: qualityClaims.reduce(
            (sum, item) => sum + this.toNumber(item.rejectedQuantity),
            0,
          ),
          quarantineQuantity: qualityClaims.reduce(
            (sum, item) => sum + this.toNumber(item.quarantineQuantity),
            0,
          ),
        },
      },
      lastActivityAt,
    };
  }

  async update(
    id: string,
    updatePartnerDto: UpdatePartnerDto,
    requestRole?: string,
  ) {
    const existingPartner = await this.partnerRepository.findOneBy({ _id: id });
    if (!existingPartner) throw new NotFoundException('Không tìm thấy đối tác');

    // Logic kiểm tra TaxCode
    if (
      updatePartnerDto.taxCode &&
      updatePartnerDto.taxCode !== existingPartner.taxCode
    ) {
      const exists = await this.partnerRepository.count({
        where: { taxCode: updatePartnerDto.taxCode },
      });
      if (exists > 0)
        throw new BadRequestException('Đối tác đã tồn tại với mã số thuế này');
    }

    // Logic kiểm tra hạn mức tín dụng (Credit Limit)
    const currentSnapshot = await this.buildBuyerSnapshot(existingPartner);
    const existingLimit = this.toNumber(existingPartner.creditLimit);
    const newLimit =
      updatePartnerDto.creditLimit !== undefined
        ? Number(updatePartnerDto.creditLimit)
        : existingLimit;

    // Logic check canApprove linh hoạt hơn
    let roleStr = '';
    if (typeof requestRole === 'string') {
      roleStr = requestRole.toUpperCase();
    } else if (
      requestRole &&
      typeof requestRole === 'object' &&
      (requestRole as any).name
    ) {
      roleStr = (requestRole as any).name.toUpperCase();
    }

    const canApprove = ['MANAGER', 'DIRECTOR', 'ADMIN'].includes(roleStr);

    if (
      newLimit > existingLimit &&
      currentSnapshot.riskLevel === BuyerRiskLevel.HIGH &&
      !canApprove
    ) {
      throw new BadRequestException(
        'Khách hàng rủi ro cao: Chỉ Quản lý mới được tăng hạn mức tín dụng',
      );
    }

    // Update payload
    const payload = Object.fromEntries(
      Object.entries(updatePartnerDto).filter(
        ([, value]) => value !== undefined,
      ),
    );
    const nextCountryCode =
      updatePartnerDto.countryCode !== undefined
        ? this.normalizeSubmittedCountryCode(
            updatePartnerDto.countryCode,
            updatePartnerDto.country,
          )
        : updatePartnerDto.country !== undefined
          ? normalizeCountryCode(updatePartnerDto.country)
          : existingPartner.countryCode;

    const nextPartnerType =
      updatePartnerDto.partnerType || existingPartner.partnerType;
    const nextRegion =
      updatePartnerDto.region !== undefined
        ? updatePartnerDto.region
        : nextPartnerType === PartnerType.CUSTOMER
          ? existingPartner.region ||
            toBuyerRegion(resolveRegionByCountry(nextCountryCode))
          : null;
    payload.countryCode = nextCountryCode;
    if (updatePartnerDto.country !== undefined) {
      payload.country = updatePartnerDto.country || null;
    }
    payload.region = nextRegion;

    // Sử dụng merge + save để kích hoạt đầy đủ Transformer và Listener
    this.partnerRepository.merge(existingPartner, payload);
    const updatedPartner = await this.partnerRepository.save(existingPartner);

    const updatedSnapshot = await this.buildBuyerSnapshot(updatedPartner);

    return {
      message: 'Cập nhật đối tác thành công',
      data: { ...updatedPartner, ...updatedSnapshot },
    };
  }

  async remove(id: string) {
    // Soft delete để giữ lại lịch sử giao dịch trong DB
    const result = await this.partnerRepository.softDelete({ _id: id });

    if (result.affected === 0)
      throw new NotFoundException('Không tìm thấy đối tác');
    return { message: 'Xoá đối tác thành công', deletedCount: result.affected };
  }

  async bulkRemove(ids: string[]) {
    const result = await this.partnerRepository.softDelete(ids);
    return {
      message: `Xoá thành công ${result.affected} đối tác`,
      deletedCount: result.affected,
    };
  }

  async exportExcel(query: any) {
    const aqp = (await import('api-query-params')).default;
    const { filter, sort } = aqp(query);
    ['current', 'pageSize', 'limit', 'skip'].forEach(
      (key) => delete filter[key],
    );
    const searchTerm = this.consumeSearchTerm(filter);
    const riskLevelFilter = this.consumeRiskLevelFilter(filter);
    const sortConfig = this.getPrimarySort(sort);
    const shouldSortAfterSnapshot =
      !!sortConfig && PARTNER_DYNAMIC_SORT_COLUMNS.has(sortConfig.field);

    const queryBuilder = this.partnerRepository.createQueryBuilder('partner');

    this.applyFilters(queryBuilder, filter);
    this.applySearch(queryBuilder, searchTerm);
    this.applySort(queryBuilder, sort);

    const resultsRaw = await queryBuilder.getMany();
    const results =
      riskLevelFilter || shouldSortAfterSnapshot
        ? this.sortPartnerRows(
            (await this.buildPartnerRows(resultsRaw)).filter(
              (item) => !riskLevelFilter || item.riskLevel === riskLevelFilter,
            ),
            sortConfig,
          )
        : resultsRaw;

    // Map dữ liệu sang format Excel
    const data = results.map((p) => ({
      ID: p._id,
      'Tên Đối Tác': p.name,
      'Loại Đối Tác':
        p.partnerType === 'CUSTOMER'
          ? 'Khách hàng (Buyer)'
          : p.partnerType === 'SUPPLIER'
            ? 'Nhà cung cấp (Vendor)'
            : 'Đơn vị vận chuyển (Logistics)',
      'Quốc Gia': p.country || 'Việt Nam',
      'Khu Vực': p.region || 'N/A',
      'Mã Số Thuế': p.taxCode || 'N/A',
      'Tiền Tệ Mặc Định': p.defaultCurrency || 'USD',
      'Hạn Mức Tín Dụng': p.creditLimit || 0,
      'Điều Khoản Thanh Toán': p.defaultPaymentTerm || 'N/A',
      'Trạng Thái': p.isActive ? 'Hoạt động' : 'Đang khóa',
      'Ngày Cập Nhật': p.updatedAt
        ? new Date(p.updatedAt).toLocaleDateString('vi-VN')
        : 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh Sách Đối Tác');

    // Thiết lập độ rộng cột cơ bản
    const wscols = [
      { wch: 10 },
      { wch: 30 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 20 },
      { wch: 25 },
      { wch: 15 },
      { wch: 20 },
    ];
    worksheet['!cols'] = wscols;

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }
}
