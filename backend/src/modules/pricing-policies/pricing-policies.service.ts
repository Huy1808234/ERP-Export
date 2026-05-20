import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '@/modules/products/entities/product.entity';
import { Partner, PartnerType } from '@/modules/partners/entities/partner.entity';
import { PricingPolicy } from './entities/pricing-policy.entity';
import { SalesPriceHistory, SalesPriceSourceType } from './entities/sales-price-history.entity';
import { CreatePricingPolicyDto } from './dto/create-pricing-policy.dto';
import { UpdatePricingPolicyDto } from './dto/update-pricing-policy.dto';
import { ResolvePriceDto } from './dto/resolve-price.dto';
import { Incoterm } from '../quotations/entities/quotation.entity';

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
  exchangeRate?: number;
  createdByUsername?: string;
  occurredAt?: Date;
  items: PriceHistoryLine[];
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
  ) {}

  private getActorUsername(user?: { username?: string }) {
    return user?.username || 'system';
  }

  private normalizeCountry(country?: string | null) {
    return country?.trim().toUpperCase() || null;
  }

  private async validateProduct(productId: string) {
    const product = await this.productRepository.findOneBy({ _id: productId });
    if (!product) throw new BadRequestException('Sản phẩm không tồn tại');
    return product;
  }

  private async validateBuyer(buyerId?: string | null) {
    if (!buyerId) return null;
    const buyer = await this.partnerRepository.findOneBy({ _id: buyerId });
    if (!buyer) throw new BadRequestException('Buyer không tồn tại');
    if (buyer.partnerType !== PartnerType.CUSTOMER) {
      throw new BadRequestException('Pricing policy buyer phải là khách hàng nước ngoài');
    }
    return buyer;
  }

  private validateQuantityRange(minQuantity: number, maxQuantity?: number | null) {
    if (maxQuantity !== undefined && maxQuantity !== null && Number(maxQuantity) < Number(minQuantity)) {
      throw new BadRequestException('maxQuantity phải lớn hơn hoặc bằng minQuantity');
    }
  }

  private isPolicyEffective(policy: PricingPolicy, priceDate: Date) {
    const from = new Date(policy.effectiveFrom);
    const to = policy.effectiveTo ? new Date(policy.effectiveTo) : null;
    return from <= priceDate && (!to || to >= priceDate);
  }

  private scorePolicy(policy: PricingPolicy, context: { buyerId?: string | null; country?: string | null; marketRegion?: string | null }) {
    let score = 0;
    if (policy.buyerId && context.buyerId && policy.buyerId === context.buyerId) score += 100;
    if (policy.country && context.country && this.normalizeCountry(policy.country) === context.country) score += 40;
    if (policy.marketRegion && context.marketRegion && policy.marketRegion === context.marketRegion) score += 20;
    score += Number(policy.minQuantity || 0) / 100000;
    return score;
  }

  async create(dto: CreatePricingPolicyDto, user?: { username?: string }) {
    await this.validateProduct(dto.productId);
    await this.validateBuyer(dto.buyerId);
    this.validateQuantityRange(dto.minQuantity, dto.maxQuantity);

    const entity = this.pricingPolicyRepository.create({
      ...dto,
      country: this.normalizeCountry(dto.country),
      maxQuantity: dto.maxQuantity ?? null,
      effectiveFrom: new Date(dto.effectiveFrom),
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      isActive: dto.isActive ?? true,
      createdByUsername: this.getActorUsername(user),
      note: dto.note || null,
    });

    return this.pricingPolicyRepository.save(entity);
  }

  async findAll(query: any = {}) {
    const qb = this.pricingPolicyRepository
      .createQueryBuilder('policy')
      .leftJoinAndSelect('policy.product', 'product')
      .leftJoinAndSelect('policy.buyer', 'buyer')
      .orderBy('policy.updatedAt', 'DESC');

    if (query.productId) qb.andWhere('policy.productId = :productId', { productId: query.productId });
    if (query.buyerId) qb.andWhere('policy.buyerId = :buyerId', { buyerId: query.buyerId });
    if (query.incoterm) qb.andWhere('policy.incoterm = :incoterm', { incoterm: query.incoterm });
    if (query.currency) qb.andWhere('policy.currency = :currency', { currency: query.currency });
    if (query.isActive !== undefined) qb.andWhere('policy.isActive = :isActive', { isActive: query.isActive === 'true' || query.isActive === true });
    if (query.search) {
      qb.andWhere('(product.sku ILIKE :search OR product.vietnameseName ILIKE :search OR buyer.name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    return qb.getMany();
  }

  async findOne(recordId: string) {
    const policy = await this.pricingPolicyRepository.findOne({
      where: { _id: recordId },
      relations: ['product', 'buyer'],
    });
    if (!policy) throw new NotFoundException('Không tìm thấy pricing policy');
    return policy;
  }

  async update(recordId: string, dto: UpdatePricingPolicyDto) {
    const policy = await this.findOne(recordId);
    if (dto.productId) await this.validateProduct(dto.productId);
    if (dto.buyerId) await this.validateBuyer(dto.buyerId);

    const minQuantity = dto.minQuantity ?? policy.minQuantity;
    const maxQuantity = dto.maxQuantity ?? policy.maxQuantity;
    this.validateQuantityRange(minQuantity, maxQuantity);

    const payload: any = Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined));
    if (payload.country !== undefined) payload.country = this.normalizeCountry(payload.country);
    if (payload.effectiveFrom) payload.effectiveFrom = new Date(payload.effectiveFrom);
    if (payload.effectiveTo) payload.effectiveTo = new Date(payload.effectiveTo);
    if (payload.maxQuantity === null || payload.maxQuantity === '') payload.maxQuantity = null;

    await this.pricingPolicyRepository.update({ _id: recordId }, payload);
    return this.findOne(recordId);
  }

  async remove(recordId: string) {
    const result = await this.pricingPolicyRepository.delete({ _id: recordId });
    if (!result.affected) throw new NotFoundException('Không tìm thấy pricing policy');
    return { _id: recordId, deletedCount: result.affected };
  }

  async resolvePrice(dto: ResolvePriceDto) {
    const product = await this.validateProduct(dto.productId);
    const buyer = await this.validateBuyer(dto.buyerId);
    const priceDate = dto.priceDate ? new Date(dto.priceDate) : new Date();
    const context = {
      buyerId: buyer?._id || dto.buyerId || null,
      country: this.normalizeCountry(dto.country || buyer?.country),
      marketRegion: dto.marketRegion || buyer?.region || null,
    };

    const policies = await this.pricingPolicyRepository.find({
      where: {
        productId: dto.productId,
        incoterm: dto.incoterm,
        currency: dto.currency,
        isActive: true,
      },
      relations: ['product', 'buyer'],
    });

    const candidates = policies.filter((policy) => {
      if (!this.isPolicyEffective(policy, priceDate)) return false;
      if (policy.buyerId && policy.buyerId !== context.buyerId) return false;
      if (policy.country && this.normalizeCountry(policy.country) !== context.country) return false;
      if (policy.marketRegion && policy.marketRegion !== context.marketRegion) return false;
      if (Number(policy.minQuantity || 0) > Number(dto.quantity)) return false;
      if (policy.maxQuantity !== null && Number(policy.maxQuantity) < Number(dto.quantity)) return false;
      return true;
    });

    candidates.sort((a, b) => {
      const scoreDiff = this.scorePolicy(b, context) - this.scorePolicy(a, context);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const matched = candidates[0];
    if (matched) {
      return {
        source: 'PRICING_POLICY',
        pricingPolicyId: matched._id,
        unitPrice: Number(matched.unitPrice),
        currency: matched.currency,
        product,
        policy: matched,
      };
    }

    const fallbackCurrency = product.exportCurrency || dto.currency;
    if (Number(product.defaultExportPrice || 0) > 0 && fallbackCurrency === dto.currency) {
      return {
        source: 'PRODUCT_DEFAULT',
        pricingPolicyId: null,
        unitPrice: Number(product.defaultExportPrice),
        currency: fallbackCurrency,
        product,
        policy: null,
      };
    }

    throw new NotFoundException('Không tìm thấy bảng giá phù hợp cho sản phẩm/market/incoterm/quantity');
  }

  async recordDocumentHistory(input: RecordDocumentHistoryInput) {
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
          currency: input.currency,
          country: buyer?.country || undefined,
          marketRegion: buyer?.region || undefined,
        });
        pricingPolicyId = resolved.pricingPolicyId;
      } catch {
        pricingPolicyId = null;
      }

      histories.push(this.salesPriceHistoryRepository.create({
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
        currency: input.currency,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        exchangeRate: Number(input.exchangeRate || 1),
        createdByUsername: input.createdByUsername || 'system',
        occurredAt: input.occurredAt || new Date(),
      }));
    }

    if (!histories.length) return [];
    return this.salesPriceHistoryRepository.save(histories);
  }

  async findHistory(query: any = {}) {
    const qb = this.salesPriceHistoryRepository
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.product', 'product')
      .leftJoinAndSelect('history.buyer', 'buyer')
      .leftJoinAndSelect('history.pricingPolicy', 'pricingPolicy')
      .orderBy('history.occurredAt', 'DESC');

    if (query.productId) qb.andWhere('history.productId = :productId', { productId: query.productId });
    if (query.buyerId) qb.andWhere('history.buyerId = :buyerId', { buyerId: query.buyerId });
    if (query.sourceType) qb.andWhere('history.sourceType = :sourceType', { sourceType: query.sourceType });
    if (query.search) {
      qb.andWhere('(product.sku ILIKE :search OR product.vietnameseName ILIKE :search OR buyer.name ILIKE :search OR history.sourceNumber ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    return qb.getMany();
  }
}
