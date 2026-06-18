import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '@/modules/products/entities/product.entity';
import {
  Partner,
  PartnerType,
  BuyerRegion,
} from '@/modules/partners/entities/partner.entity';
import {
  PricingPolicy,
  PricingPolicyStatus,
} from './entities/pricing-policy.entity';
import {
  SalesPriceHistory,
  SalesPriceSourceType,
} from './entities/sales-price-history.entity';
import { CreatePricingPolicyDto } from './dto/create-pricing-policy.dto';
import { UpdatePricingPolicyDto } from './dto/update-pricing-policy.dto';
import { ResolvePriceDto } from './dto/resolve-price.dto';
import {
  FindPricingPoliciesQueryDto,
  FindSalesPriceHistoryQueryDto,
} from './dto/query-pricing-policy.dto';
import { Incoterm } from '../quotations/entities/quotation.entity';
import { CurrenciesService } from '../currencies/currencies.service';
import { ExchangeRateType } from '../currencies/entities/exchange-rate.entity';
import { PortsService } from '../ports/ports.service';
import { Decimal } from 'decimal.js';
import {
  getCountryLookupValues,
  normalizeCountryCode,
} from '@/common/geo.util';
import { ApprovalMatrixService } from '../approval-matrix/approval-matrix.service';
import { ApprovalDocumentType } from '../approval-matrix/entities/approval-rule.entity';

type RequestUser = {
  username?: string;
};

type PaginationMeta = {
  current: number;
  pageSize: number;
  pages: number;
  total: number;
};

type PaginatedResult<T> = {
  results: T[];
  meta: PaginationMeta;
};

type PriceHistoryLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

type RecordDocumentHistoryInput = {
  sourceType: SalesPriceSourceType;
  sourceId: string;
  sourceNumber?: string | null;
  buyerId: string;
  salesContractId?: string | null;
  quotationId?: string | null;
  incoterm: Incoterm;
  currency: string;
  origin_port_id?: string | null;
  destination_port_id?: string | null;
  exchangeRate?: number;
  createdByUsername?: string;
  occurredAt?: Date;
  items: PriceHistoryLine[];
};

type PolicyMatchContext = {
  buyerId: string | null;
  countryCode: string | null;
  country: string | null;
  marketRegion: BuyerRegion | null;
  origin_port_id: string | null;
  destination_port_id: string | null;
};

type PolicyOverlapInput = {
  productId: string;
  buyerId: string | null;
  marketRegion: BuyerRegion | null;
  countryCode: string | null;
  country: string | null;
  origin_port_id: string | null;
  destination_port_id: string | null;
  incoterm: Incoterm;
  currency: string;
  minQuantity: number;
  maxQuantity: number | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
};

type PriceBreakdown = {
  baseIncoterm: Incoterm;
  targetIncoterm: Incoterm;
  baseUnitPrice: number;
  inlandCostPerUnit: number;
  portChargePerUnit: number;
  freightCostPerUnit: number;
  insuranceCostPerUnit: number;
  destinationDeliveryCostPerUnit: number;
  customsCostPerUnit: number;
  derivedUnitPrice: number;
};

type ResolvePriceResult = {
  source: 'PRICING_POLICY' | 'PRICING_POLICY_DERIVED' | 'PRODUCT_DEFAULT';
  pricingPolicyId: string | null;
  unitPrice: number;
  currency: string;
  product: Product;
  policy: PricingPolicy | null;
  priceBreakdown?: PriceBreakdown;
};

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const OPEN_END_DATE = new Date('9999-12-31T00:00:00.000Z');

const INCOTERM_ORDER: Record<Incoterm, number> = {
  [Incoterm.EXW]: 0,
  [Incoterm.FOB]: 1,
  [Incoterm.CFR]: 2,
  [Incoterm.CIF]: 3,
  [Incoterm.DAP]: 4,
  [Incoterm.DDP]: 5,
};

@Injectable()
export class PricingPoliciesService {
  constructor(
    @InjectRepository(PricingPolicy)
    private readonly pricingPolicyRepository: Repository<PricingPolicy>,
    @InjectRepository(SalesPriceHistory)
    private readonly salesPriceHistoryRepository: Repository<SalesPriceHistory>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    private readonly currenciesService: CurrenciesService,
    private readonly portsService: PortsService,
    private readonly approvalMatrixService: ApprovalMatrixService,
  ) {}

  private getActorUsername(user?: RequestUser): string {
    return user?.username || 'system';
  }

  private normalizeCountry(country?: string | null): string | null {
    return normalizeCountryCode(country);
  }

  private normalizeOptionalEntityId(value?: string | null): string | null {
    return value?.trim() || null;
  }

  private normalizeCurrency(currency?: string | null): string {
    return currency?.trim().toUpperCase() || 'USD';
  }

  private normalizeNumber(
    value: number | string | null | undefined,
    fallback = 0,
  ): number {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private normalizeOptionalNumber(
    value: number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private getPagination(query: { current?: number; pageSize?: number }): {
    current: number;
    pageSize: number;
    skip: number;
  } {
    const current = Math.max(1, Number(query.current || 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(query.pageSize || DEFAULT_PAGE_SIZE)),
    );
    return {
      current,
      pageSize,
      skip: (current - 1) * pageSize,
    };
  }

  private async validateProduct(productId: string): Promise<Product> {
    const product = await this.productRepository.findOneBy({ _id: productId });
    if (!product) throw new BadRequestException('Sản phẩm không tồn tại');
    return product;
  }

  private async validateBuyer(
    buyerId?: string | null,
  ): Promise<Partner | null> {
    if (!buyerId) return null;
    const buyer = await this.partnerRepository.findOneBy({ _id: buyerId });
    if (!buyer) throw new BadRequestException('Buyer không tồn tại');
    if (buyer.partnerType !== PartnerType.CUSTOMER) {
      throw new BadRequestException(
        'Pricing policy buyer phải là khách hàng nước ngoài',
      );
    }
    return buyer;
  }

  private async resolveActivePort_id(
    port_id?: string | null,
  ): Promise<string | null> {
    const normalized = this.normalizeOptionalEntityId(port_id);
    if (!normalized) return null;
    const snapshot = await this.portsService.resolvePortSnapshot(normalized);
    return snapshot.port_id || null;
  }

  private validateQuantityRange(
    minQuantity: number,
    maxQuantity?: number | null,
  ): void {
    if (Number(minQuantity) < 0) {
      throw new BadRequestException('minQuantity phải lớn hơn hoặc bằng 0');
    }

    if (
      maxQuantity !== undefined &&
      maxQuantity !== null &&
      Number(maxQuantity) < Number(minQuantity)
    ) {
      throw new BadRequestException(
        'maxQuantity phải lớn hơn hoặc bằng minQuantity',
      );
    }
  }

  private validateEffectiveDates(
    effectiveFrom: Date,
    effectiveTo?: Date | null,
  ): void {
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('effectiveFrom không hợp lệ');
    }

    if (effectiveTo && Number.isNaN(effectiveTo.getTime())) {
      throw new BadRequestException('effectiveTo không hợp lệ');
    }

    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException(
        'effectiveTo phải lớn hơn hoặc bằng effectiveFrom',
      );
    }
  }

  private isPolicyEffective(policy: PricingPolicy, priceDate: Date): boolean {
    const from = new Date(policy.effectiveFrom);
    const to = policy.effectiveTo ? new Date(policy.effectiveTo) : null;
    return from <= priceDate && (!to || to >= priceDate);
  }

  private nullableEquals<T>(left?: T | null, right?: T | null): boolean {
    return (left ?? null) === (right ?? null);
  }

  private dateRangesOverlap(
    leftFrom: Date,
    leftTo: Date | null,
    rightFrom: Date,
    rightTo: Date | null,
  ): boolean {
    return (
      leftFrom <= (rightTo || OPEN_END_DATE) &&
      rightFrom <= (leftTo || OPEN_END_DATE)
    );
  }

  private quantityRangesOverlap(
    leftMin: number,
    leftMax: number | null,
    rightMin: number,
    rightMax: number | null,
  ): boolean {
    return (
      Number(leftMin) <= (rightMax ?? Number.MAX_SAFE_INTEGER) &&
      Number(rightMin) <= (leftMax ?? Number.MAX_SAFE_INTEGER)
    );
  }

  private scorePolicy(
    policy: PricingPolicy,
    context: PolicyMatchContext,
  ): number {
    let score = 0;
    if (policy.buyerId && context.buyerId && policy.buyerId === context.buyerId)
      score += 100;
    if (
      policy.countryCode &&
      context.countryCode &&
      policy.countryCode === context.countryCode
    )
      score += 40;
    else if (
      policy.country &&
      context.country &&
      this.normalizeCountry(policy.country) ===
        this.normalizeCountry(context.country)
    )
      score += 20;
    if (
      policy.marketRegion &&
      context.marketRegion &&
      policy.marketRegion === context.marketRegion
    )
      score += 20;
    if (
      policy.origin_port_id &&
      context.origin_port_id &&
      policy.origin_port_id === context.origin_port_id
    )
      score += 12;
    if (
      policy.destination_port_id &&
      context.destination_port_id &&
      policy.destination_port_id === context.destination_port_id
    )
      score += 12;
    return score;
  }

  private matchesScope(
    policy: PricingPolicy,
    target: PolicyOverlapInput,
  ): boolean {
    return (
      this.nullableEquals(policy.buyerId, target.buyerId) &&
      this.nullableEquals(policy.marketRegion, target.marketRegion) &&
      this.nullableEquals(policy.countryCode, target.countryCode) &&
      this.nullableEquals(
        this.normalizeCountry(policy.country),
        this.normalizeCountry(target.country),
      ) &&
      this.nullableEquals(policy.origin_port_id, target.origin_port_id) &&
      this.nullableEquals(
        policy.destination_port_id,
        target.destination_port_id,
      )
    );
  }

  private async ensureNoActiveOverlap(
    target: PolicyOverlapInput,
    excludePolicyId?: string,
  ): Promise<void> {
    if (!target.isActive) return;

    const existingPolicies = await this.pricingPolicyRepository.find({
      where: {
        productId: target.productId,
        incoterm: target.incoterm,
        currency: target.currency,
        isActive: true,
      },
      relations: ['product', 'buyer'],
    });

    const conflict = existingPolicies.find((policy) => {
      if (excludePolicyId && policy._id === excludePolicyId) return false;
      if (!this.matchesScope(policy, target)) return false;
      if (
        !this.dateRangesOverlap(
          new Date(policy.effectiveFrom),
          policy.effectiveTo,
          target.effectiveFrom,
          target.effectiveTo,
        )
      ) {
        return false;
      }
      return this.quantityRangesOverlap(
        policy.minQuantity,
        policy.maxQuantity,
        target.minQuantity,
        target.maxQuantity,
      );
    });

    if (conflict) {
      const productLabel = conflict.product?.sku || target.productId;
      const buyerLabel =
        conflict.buyer?.name ||
        conflict.country ||
        conflict.marketRegion ||
        'GLOBAL';
      throw new BadRequestException(
        `Bảng giá bị chồng hiệu lực với ${productLabel} / ${buyerLabel} / ${conflict.incoterm} / ${conflict.currency}`,
      );
    }
  }

  private toOverlapInput(dto: CreatePricingPolicyDto): PolicyOverlapInput {
    const minQuantity = this.normalizeNumber(dto.minQuantity);
    const maxQuantity = this.normalizeOptionalNumber(dto.maxQuantity);
    const effectiveFrom = this.normalizeDate(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo
      ? this.normalizeDate(dto.effectiveTo)
      : null;

    this.validateQuantityRange(minQuantity, maxQuantity);
    this.validateEffectiveDates(effectiveFrom, effectiveTo);

    return {
      productId: dto.productId,
      buyerId: dto.buyerId || null,
      marketRegion: dto.marketRegion || null,
      countryCode:
        this.normalizeCountry(dto.countryCode) ||
        this.normalizeCountry(dto.country),
      country: dto.country || null,
      origin_port_id: this.normalizeOptionalEntityId(dto.origin_port_id),
      destination_port_id: this.normalizeOptionalEntityId(
        dto.destination_port_id,
      ),
      incoterm: dto.incoterm,
      currency: this.normalizeCurrency(dto.currency),
      minQuantity,
      maxQuantity,
      effectiveFrom,
      effectiveTo,
      isActive: dto.isActive ?? true,
    };
  }

  private toMergedOverlapInput(
    policy: PricingPolicy,
    dto: UpdatePricingPolicyDto,
  ): PolicyOverlapInput {
    const effectiveFrom = dto.effectiveFrom
      ? this.normalizeDate(dto.effectiveFrom)
      : new Date(policy.effectiveFrom);
    const effectiveTo =
      dto.effectiveTo === undefined
        ? policy.effectiveTo
          ? new Date(policy.effectiveTo)
          : null
        : dto.effectiveTo
          ? this.normalizeDate(dto.effectiveTo)
          : null;
    const minQuantity = this.normalizeNumber(
      dto.minQuantity,
      policy.minQuantity,
    );
    const maxQuantity =
      dto.maxQuantity === undefined
        ? policy.maxQuantity
        : this.normalizeOptionalNumber(dto.maxQuantity);

    this.validateQuantityRange(minQuantity, maxQuantity);
    this.validateEffectiveDates(effectiveFrom, effectiveTo);

    return {
      productId: dto.productId ?? policy.productId,
      buyerId: dto.buyerId === undefined ? policy.buyerId : dto.buyerId || null,
      marketRegion:
        dto.marketRegion === undefined
          ? policy.marketRegion
          : dto.marketRegion || null,
      countryCode:
        dto.countryCode === undefined
          ? policy.countryCode
          : this.normalizeCountry(dto.countryCode),
      country: dto.country === undefined ? policy.country : dto.country || null,
      origin_port_id:
        dto.origin_port_id === undefined
          ? policy.origin_port_id
          : this.normalizeOptionalEntityId(dto.origin_port_id),
      destination_port_id:
        dto.destination_port_id === undefined
          ? policy.destination_port_id
          : this.normalizeOptionalEntityId(dto.destination_port_id),
      incoterm: dto.incoterm ?? policy.incoterm,
      currency: this.normalizeCurrency(dto.currency ?? policy.currency),
      minQuantity,
      maxQuantity,
      effectiveFrom,
      effectiveTo,
      isActive: dto.isActive ?? policy.isActive,
    };
  }

  private matchesContextAndQuantity(
    policy: PricingPolicy,
    context: PolicyMatchContext,
    quantity: number,
    priceDate: Date,
  ): boolean {
    if (!this.isPolicyEffective(policy, priceDate)) return false;
    if (policy.buyerId && policy.buyerId !== context.buyerId) return false;
    if (policy.countryCode && policy.countryCode !== context.countryCode)
      return false;
    if (
      !policy.countryCode &&
      policy.country &&
      this.normalizeCountry(policy.country) !==
        this.normalizeCountry(context.country)
    )
      return false;
    if (policy.marketRegion && policy.marketRegion !== context.marketRegion)
      return false;
    if (
      policy.origin_port_id &&
      policy.origin_port_id !== context.origin_port_id
    )
      return false;
    if (
      policy.destination_port_id &&
      policy.destination_port_id !== context.destination_port_id
    )
      return false;
    if (Number(policy.minQuantity || 0) > quantity) return false;
    if (policy.maxQuantity !== null && Number(policy.maxQuantity) < quantity)
      return false;
    return true;
  }

  private sortCandidates(
    policies: PricingPolicy[],
    context: PolicyMatchContext,
    preferClosestIncotermTo?: Incoterm,
  ): PricingPolicy[] {
    const targetRank = preferClosestIncotermTo
      ? INCOTERM_ORDER[preferClosestIncotermTo]
      : null;

    return [...policies].sort((left, right) => {
      const scoreDiff =
        this.scorePolicy(right, context) - this.scorePolicy(left, context);
      if (scoreDiff !== 0) return scoreDiff;

      if (targetRank !== null) {
        const leftDistance = Math.abs(
          targetRank - INCOTERM_ORDER[left.incoterm],
        );
        const rightDistance = Math.abs(
          targetRank - INCOTERM_ORDER[right.incoterm],
        );
        if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      }

      const quantityDiff =
        Number(right.minQuantity || 0) - Number(left.minQuantity || 0);
      if (quantityDiff !== 0) return quantityDiff;

      return (
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
    });
  }

  private canDeriveIncoterm(
    baseIncoterm: Incoterm,
    targetIncoterm: Incoterm,
  ): boolean {
    return INCOTERM_ORDER[baseIncoterm] <= INCOTERM_ORDER[targetIncoterm];
  }

  private buildDerivedPrice(
    policy: PricingPolicy,
    targetIncoterm: Incoterm,
  ): PriceBreakdown | null {
    if (!this.canDeriveIncoterm(policy.incoterm, targetIncoterm)) return null;

    const baseRank = INCOTERM_ORDER[policy.incoterm];
    const targetRank = INCOTERM_ORDER[targetIncoterm];
    const freightTargets: Incoterm[] = [
      Incoterm.CFR,
      Incoterm.CIF,
      Incoterm.DAP,
      Incoterm.DDP,
    ];
    const destinationDeliveryTargets: Incoterm[] = [Incoterm.DAP, Incoterm.DDP];

    const inlandCostPerUnit =
      baseRank < INCOTERM_ORDER[Incoterm.FOB] &&
      targetRank >= INCOTERM_ORDER[Incoterm.FOB]
        ? this.normalizeNumber(policy.inlandCostPerUnit)
        : 0;
    const portChargePerUnit =
      baseRank < INCOTERM_ORDER[Incoterm.FOB] &&
      targetRank >= INCOTERM_ORDER[Incoterm.FOB]
        ? this.normalizeNumber(policy.portChargePerUnit)
        : 0;
    const freightCostPerUnit =
      baseRank < INCOTERM_ORDER[Incoterm.CFR] &&
      freightTargets.includes(targetIncoterm)
        ? this.normalizeNumber(policy.freightCostPerUnit)
        : 0;
    const insuranceCostPerUnit =
      targetIncoterm === Incoterm.CIF && baseRank < INCOTERM_ORDER[Incoterm.CIF]
        ? this.normalizeNumber(policy.insuranceCostPerUnit)
        : 0;
    const destinationDeliveryCostPerUnit =
      baseRank < INCOTERM_ORDER[Incoterm.DAP] &&
      destinationDeliveryTargets.includes(targetIncoterm)
        ? this.normalizeNumber(policy.destinationDeliveryCostPerUnit)
        : 0;
    const customsCostPerUnit =
      targetIncoterm === Incoterm.DDP && baseRank < INCOTERM_ORDER[Incoterm.DDP]
        ? this.normalizeNumber(policy.customsCostPerUnit)
        : 0;
    const baseUnitPrice = this.normalizeNumber(policy.unitPrice);
    const derivedUnitPrice =
      baseUnitPrice +
      inlandCostPerUnit +
      portChargePerUnit +
      freightCostPerUnit +
      insuranceCostPerUnit +
      destinationDeliveryCostPerUnit +
      customsCostPerUnit;

    return {
      baseIncoterm: policy.incoterm,
      targetIncoterm,
      baseUnitPrice,
      inlandCostPerUnit,
      portChargePerUnit,
      freightCostPerUnit,
      insuranceCostPerUnit,
      destinationDeliveryCostPerUnit,
      customsCostPerUnit,
      derivedUnitPrice,
    };
  }

  async create(
    dto: CreatePricingPolicyDto,
    user?: RequestUser,
  ): Promise<PricingPolicy> {
    await this.validateProduct(dto.productId);
    await this.validateBuyer(dto.buyerId);
    const target = this.toOverlapInput(dto);
    target.origin_port_id = await this.resolveActivePort_id(dto.origin_port_id);
    target.destination_port_id = await this.resolveActivePort_id(
      dto.destination_port_id,
    );
    await this.ensureNoActiveOverlap(target);

    const entity = this.pricingPolicyRepository.create({
      ...dto,
      buyerId: target.buyerId,
      marketRegion: target.marketRegion,
      countryCode: target.countryCode,
      country: target.country,
      origin_port_id: target.origin_port_id,
      destination_port_id: target.destination_port_id,
      currency: target.currency,
      minQuantity: target.minQuantity,
      maxQuantity: target.maxQuantity,
      inlandCostPerUnit: this.normalizeNumber(dto.inlandCostPerUnit),
      portChargePerUnit: this.normalizeNumber(dto.portChargePerUnit),
      freightCostPerUnit: this.normalizeNumber(dto.freightCostPerUnit),
      insuranceCostPerUnit: this.normalizeNumber(dto.insuranceCostPerUnit),
      destinationDeliveryCostPerUnit: this.normalizeNumber(
        dto.destinationDeliveryCostPerUnit,
      ),
      customsCostPerUnit: this.normalizeNumber(dto.customsCostPerUnit),
      effectiveFrom: target.effectiveFrom,
      effectiveTo: target.effectiveTo,
      isActive: false, // Will be set to true upon approval
      status: PricingPolicyStatus.DRAFT,
      createdByUsername: this.getActorUsername(user),
      note: dto.note || null,
    });

    return this.pricingPolicyRepository.save(entity);
  }

  async findAll(
    query: FindPricingPoliciesQueryDto = {},
  ): Promise<PaginatedResult<PricingPolicy>> {
    const { current, pageSize, skip } = this.getPagination(query);
    const qb = this.pricingPolicyRepository
      .createQueryBuilder('policy')
      .leftJoinAndSelect('policy.product', 'product')
      .leftJoinAndSelect('policy.buyer', 'buyer')
      .leftJoinAndSelect('policy.originPort', 'originPort')
      .leftJoinAndSelect('policy.destinationPort', 'destinationPort')
      .orderBy('policy.updatedAt', 'DESC');

    if (query.productId)
      qb.andWhere('policy.productId = :productId', {
        productId: query.productId,
      });
    if (query.buyerId)
      qb.andWhere('policy.buyerId = :buyerId', { buyerId: query.buyerId });
    if (query.marketRegion)
      qb.andWhere('policy.marketRegion = :marketRegion', {
        marketRegion: query.marketRegion,
      });
    if (query.country) {
      const countryValues = getCountryLookupValues(query.country);
      if (countryValues.length > 0) {
        qb.andWhere(
          '(policy.countryCode IN (:...countryValues) OR UPPER(policy.country) IN (:...countryValues))',
          {
            countryValues,
          },
        );
      }
    }
    if (query.origin_port_id)
      qb.andWhere('policy.origin_port_id = :origin_port_id', {
        origin_port_id: query.origin_port_id,
      });
    if (query.destination_port_id)
      qb.andWhere('policy.destination_port_id = :destination_port_id', {
        destination_port_id: query.destination_port_id,
      });
    if (query.incoterm)
      qb.andWhere('policy.incoterm = :incoterm', { incoterm: query.incoterm });
    if (query.currency)
      qb.andWhere('policy.currency = :currency', {
        currency: this.normalizeCurrency(query.currency),
      });
    if (query.isActive !== undefined)
      qb.andWhere('policy.isActive = :isActive', {
        isActive: query.isActive === 'true',
      });
    if (query.effectiveOn) {
      const effectiveOn = this.normalizeDate(query.effectiveOn);
      qb.andWhere('policy.effectiveFrom <= :effectiveOn', { effectiveOn });
      qb.andWhere(
        '(policy.effectiveTo IS NULL OR policy.effectiveTo >= :effectiveOn)',
        { effectiveOn },
      );
    }
    if (query.search?.trim()) {
      qb.andWhere(
        '(product.sku ILIKE :search OR product.vietnameseName ILIKE :search OR product.englishName ILIKE :search OR buyer.name ILIKE :search OR policy.country ILIKE :search OR policy.marketRegion::text ILIKE :search OR policy.incoterm::text ILIKE :search OR policy.currency ILIKE :search OR originPort.code ILIKE :search OR originPort.name ILIKE :search OR originPort.localName ILIKE :search OR destinationPort.code ILIKE :search OR destinationPort.name ILIKE :search OR destinationPort.localName ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }

    const [results, total] = await qb
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

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

  async findOne(recordId: string): Promise<PricingPolicy> {
    const policy = await this.pricingPolicyRepository.findOne({
      where: { _id: recordId },
      relations: ['product', 'buyer', 'originPort', 'destinationPort'],
    });
    if (!policy) throw new NotFoundException('Không tìm thấy pricing policy');
    return policy;
  }

  async update(
    recordId: string,
    dto: UpdatePricingPolicyDto,
  ): Promise<PricingPolicy> {
    const policy = await this.findOne(recordId);
    if (dto.productId) await this.validateProduct(dto.productId);
    if (dto.buyerId) await this.validateBuyer(dto.buyerId);

    const target = this.toMergedOverlapInput(policy, dto);
    if (dto.origin_port_id !== undefined) {
      target.origin_port_id = await this.resolveActivePort_id(
        dto.origin_port_id,
      );
    }
    if (dto.destination_port_id !== undefined) {
      target.destination_port_id = await this.resolveActivePort_id(
        dto.destination_port_id,
      );
    }
    await this.ensureNoActiveOverlap(target, recordId);

    const payload: Partial<PricingPolicy> = {};
    if (dto.productId !== undefined) payload.productId = dto.productId;
    if (dto.buyerId !== undefined) payload.buyerId = dto.buyerId || null;
    if (dto.marketRegion !== undefined)
      payload.marketRegion = dto.marketRegion || null;
    if (dto.countryCode !== undefined)
      payload.countryCode = this.normalizeCountry(dto.countryCode);
    if (dto.country !== undefined) payload.country = dto.country || null;
    if (dto.origin_port_id !== undefined)
      payload.origin_port_id = target.origin_port_id;
    if (dto.destination_port_id !== undefined)
      payload.destination_port_id = target.destination_port_id;
    if (dto.incoterm !== undefined) payload.incoterm = dto.incoterm;
    if (dto.currency !== undefined)
      payload.currency = this.normalizeCurrency(dto.currency);
    if (dto.minQuantity !== undefined) payload.minQuantity = target.minQuantity;
    if (dto.maxQuantity !== undefined) payload.maxQuantity = target.maxQuantity;
    if (dto.unitPrice !== undefined)
      payload.unitPrice = this.normalizeNumber(dto.unitPrice);
    if (dto.inlandCostPerUnit !== undefined)
      payload.inlandCostPerUnit = this.normalizeNumber(dto.inlandCostPerUnit);
    if (dto.portChargePerUnit !== undefined)
      payload.portChargePerUnit = this.normalizeNumber(dto.portChargePerUnit);
    if (dto.freightCostPerUnit !== undefined)
      payload.freightCostPerUnit = this.normalizeNumber(dto.freightCostPerUnit);
    if (dto.insuranceCostPerUnit !== undefined)
      payload.insuranceCostPerUnit = this.normalizeNumber(
        dto.insuranceCostPerUnit,
      );
    if (dto.destinationDeliveryCostPerUnit !== undefined)
      payload.destinationDeliveryCostPerUnit = this.normalizeNumber(
        dto.destinationDeliveryCostPerUnit,
      );
    if (dto.customsCostPerUnit !== undefined)
      payload.customsCostPerUnit = this.normalizeNumber(dto.customsCostPerUnit);
    if (dto.effectiveFrom !== undefined)
      payload.effectiveFrom = target.effectiveFrom;
    if (dto.effectiveTo !== undefined) payload.effectiveTo = target.effectiveTo;
    if (dto.isActive !== undefined) payload.isActive = dto.isActive;
    if (dto.note !== undefined) payload.note = dto.note || null;

    if (Object.keys(payload).length === 0) return policy;

    await this.pricingPolicyRepository.update({ _id: recordId }, payload);
    return this.findOne(recordId);
  }

  async remove(
    recordId: string,
    user?: RequestUser,
  ): Promise<{
    _id: string;
    deactivated: boolean;
    deactivatedByUsername: string;
  }> {
    const policy = await this.findOne(recordId);
    const today = new Date();
    const from = new Date(policy.effectiveFrom);
    const effectiveTo = policy.effectiveTo || (from > today ? from : today);

    await this.pricingPolicyRepository.update(
      { _id: recordId },
      { isActive: false, effectiveTo },
    );

    return {
      _id: recordId,
      deactivated: true,
      deactivatedByUsername: this.getActorUsername(user),
    };
  }

  async resolvePrice(dto: ResolvePriceDto): Promise<ResolvePriceResult> {
    const product = await this.validateProduct(dto.productId);
    const buyer = await this.validateBuyer(dto.buyerId);
    const priceDate = dto.priceDate
      ? this.normalizeDate(dto.priceDate)
      : new Date();
    const quantity = this.normalizeNumber(dto.quantity);
    const currency = this.normalizeCurrency(dto.currency);
    const context: PolicyMatchContext = {
      buyerId: buyer?._id || dto.buyerId || null,
      countryCode: this.normalizeCountry(
        dto.countryCode || dto.country || buyer?.countryCode || buyer?.country,
      ),
      country: dto.country || buyer?.country || null,
      marketRegion: dto.marketRegion || buyer?.region || null,
      origin_port_id: await this.resolveActivePort_id(dto.origin_port_id),
      destination_port_id: await this.resolveActivePort_id(
        dto.destination_port_id,
      ),
    };

    const policies = await this.pricingPolicyRepository.find({
      where: {
        productId: dto.productId,
        currency,
        isActive: true,
      },
      relations: ['product', 'buyer', 'originPort', 'destinationPort'],
    });

    const candidates = this.sortCandidates(
      policies.filter(
        (policy) =>
          this.canDeriveIncoterm(policy.incoterm, dto.incoterm) &&
          this.matchesContextAndQuantity(policy, context, quantity, priceDate),
      ),
      context,
      dto.incoterm,
    );

    for (const policy of candidates) {
      if (policy.incoterm === dto.incoterm) {
        return {
          source: 'PRICING_POLICY',
          pricingPolicyId: policy._id,
          unitPrice: Number(policy.unitPrice),
          currency: policy.currency,
          product,
          policy,
        };
      }

      const priceBreakdown = this.buildDerivedPrice(policy, dto.incoterm);
      if (!priceBreakdown) continue;

      return {
        source: 'PRICING_POLICY_DERIVED',
        pricingPolicyId: policy._id,
        unitPrice: priceBreakdown.derivedUnitPrice,
        currency: policy.currency,
        product,
        policy,
        priceBreakdown,
      };
    }

    const fallbackCurrency = this.normalizeCurrency(
      product.exportCurrency || dto.currency,
    );
    const fallbackUnitPrice = this.normalizeNumber(product.defaultExportPrice);
    if (fallbackUnitPrice > 0) {
      if (fallbackCurrency === currency) {
        return {
          source: 'PRODUCT_DEFAULT',
          pricingPolicyId: null,
          unitPrice: fallbackUnitPrice,
          currency: fallbackCurrency,
          product,
          policy: null,
        };
      }

      let crossRate: { from: string; to: string; rate: number };
      try {
        crossRate = await this.currenciesService.getCrossRate(
          fallbackCurrency,
          currency,
          ExchangeRateType.TRANSFER,
        );
      } catch {
        throw new NotFoundException(
          `Sản phẩm có giá mặc định ${fallbackCurrency}, nhưng chưa cấu hình tỷ giá ${fallbackCurrency} -> ${currency}`,
        );
      }

      return {
        source: 'PRODUCT_DEFAULT',
        pricingPolicyId: null,
        unitPrice: new Decimal(fallbackUnitPrice)
          .times(new Decimal(crossRate.rate))
          .toDecimalPlaces(6)
          .toNumber(),
        currency,
        product,
        policy: null,
      };
    }

    throw new NotFoundException(
      'Không tìm thấy bảng giá phù hợp cho sản phẩm/market/incoterm/quantity',
    );
  }

  async recordDocumentHistory(
    input: RecordDocumentHistoryInput,
  ): Promise<SalesPriceHistory[]> {
    const buyer = await this.validateBuyer(input.buyerId);
    const histories: SalesPriceHistory[] = [];

    for (const item of input.items || []) {
      let pricingPolicyId: string | null = null;
      try {
        const resolved = await this.resolvePrice({
          productId: item.productId,
          buyerId: input.buyerId,
          quantity: Number(item.quantity),
          incoterm: input.incoterm,
          currency: this.normalizeCurrency(input.currency),
          country: buyer?.country || undefined,
          marketRegion: buyer?.region || undefined,
          origin_port_id: input.origin_port_id || undefined,
          destination_port_id: input.destination_port_id || undefined,
          priceDate: input.occurredAt?.toISOString(),
        });
        pricingPolicyId = resolved.pricingPolicyId;
      } catch {
        pricingPolicyId = null;
      }

      histories.push(
        this.salesPriceHistoryRepository.create({
          productId: item.productId,
          buyerId: input.buyerId,
          pricingPolicyId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          sourceNumber: input.sourceNumber || null,
          salesContractId: input.salesContractId || null,
          quotationId: input.quotationId || null,
          marketRegion: buyer?.region || null,
          country: this.normalizeCountry(buyer?.country),
          incoterm: input.incoterm,
          currency: this.normalizeCurrency(input.currency),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          exchangeRate: Number(input.exchangeRate || 1),
          createdByUsername: input.createdByUsername || 'system',
          occurredAt: input.occurredAt || new Date(),
        }),
      );
    }

    if (!histories.length) return [];
    return this.salesPriceHistoryRepository.save(histories);
  }

  async findHistory(
    query: FindSalesPriceHistoryQueryDto = {},
  ): Promise<PaginatedResult<SalesPriceHistory>> {
    const { current, pageSize, skip } = this.getPagination(query);
    const qb = this.salesPriceHistoryRepository
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.product', 'product')
      .leftJoinAndSelect('history.buyer', 'buyer')
      .leftJoinAndSelect('history.pricingPolicy', 'pricingPolicy')
      .orderBy('history.occurredAt', 'DESC');

    if (query.productId)
      qb.andWhere('history.productId = :productId', {
        productId: query.productId,
      });
    if (query.buyerId)
      qb.andWhere('history.buyerId = :buyerId', { buyerId: query.buyerId });
    if (query.sourceType)
      qb.andWhere('history.sourceType = :sourceType', {
        sourceType: query.sourceType,
      });
    if (query.incoterm)
      qb.andWhere('history.incoterm = :incoterm', { incoterm: query.incoterm });
    if (query.currency)
      qb.andWhere('history.currency = :currency', {
        currency: this.normalizeCurrency(query.currency),
      });
    if (query.search?.trim()) {
      qb.andWhere(
        '(product.sku ILIKE :search OR product.vietnameseName ILIKE :search OR product.englishName ILIKE :search OR buyer.name ILIKE :search OR history.sourceNumber ILIKE :search OR history.incoterm::text ILIKE :search OR history.currency ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }

    const [results, total] = await qb
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

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

  async submitForApproval(
    recordId: string,
    user?: RequestUser,
  ): Promise<PricingPolicy> {
    const policy = await this.findOne(recordId);
    if (
      policy.status !== PricingPolicyStatus.DRAFT &&
      policy.status !== PricingPolicyStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Chỉ có thể gửi duyệt khi ở trạng thái nháp hoặc bị từ chối',
      );
    }

    let amountVnd = policy.unitPrice;
    if (policy.currency !== 'VND') {
      try {
        const crossRate = await this.currenciesService.getCrossRate(
          policy.currency,
          'VND',
          ExchangeRateType.TRANSFER,
        );
        amountVnd = Number(policy.unitPrice) * crossRate.rate;
      } catch {
        amountVnd = Number(policy.unitPrice) * 25000; // Fallback
      }
    }

    const request = await this.approvalMatrixService.createRequest(
      {
        documentType: ApprovalDocumentType.PRICING_POLICY,
        documentId: policy._id,
        title: `Phê duyệt chính sách giá ${policy.product?.sku || policy.productId}`,
        amountVnd,
      },
      user as any,
    );

    policy.status = PricingPolicyStatus.PENDING_APPROVAL;
    policy.approvalWorkflowRequestId = request?._id || null;
    return this.pricingPolicyRepository.save(policy);
  }

  async approve(
    recordId: string,
    user?: RequestUser,
    note?: string,
  ): Promise<PricingPolicy> {
    const policy = await this.findOne(recordId);
    if (policy.status !== PricingPolicyStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Chính sách giá không ở trạng thái chờ duyệt',
      );
    }

    policy.status = PricingPolicyStatus.APPROVED;
    policy.isActive = true;
    policy.approvedByUsername = this.getActorUsername(user);
    policy.approvedAt = new Date();

    // We should ensure no overlap again before making it active
    const target = this.toMergedOverlapInput(policy, { isActive: true });
    await this.ensureNoActiveOverlap(target, recordId);

    return this.pricingPolicyRepository.save(policy);
  }

  async reject(
    recordId: string,
    reason: string,
    user?: RequestUser,
  ): Promise<PricingPolicy> {
    const policy = await this.findOne(recordId);
    if (policy.status !== PricingPolicyStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Chính sách giá không ở trạng thái chờ duyệt',
      );
    }

    policy.status = PricingPolicyStatus.REJECTED;
    policy.isActive = false;
    policy.rejectionReason = reason;
    return this.pricingPolicyRepository.save(policy);
  }
}
