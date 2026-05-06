import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partner, PartnerType } from '@/modules/partners/entities/partner.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { CreateVendorPriceHistoryDto } from './dto/create-vendor-price-history.dto';
import { UpdateVendorPriceHistoryDto } from './dto/update-vendor-price-history.dto';
import { VendorPriceHistory } from './entities/vendor-price-history.entity';

@Injectable()
export class VendorPriceHistoryService {
  constructor(
    @InjectRepository(VendorPriceHistory)
    private readonly vendorPriceHistoryRepository: Repository<VendorPriceHistory>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  private async validateVendor(vendorId: string) {
    const vendor = await this.partnerRepository.findOneBy({ id: vendorId });
    if (!vendor) throw new BadRequestException('Nha cung cap khong ton tai');
    if (vendor.partnerType !== PartnerType.SUPPLIER) {
      throw new BadRequestException('Doi tac khong phai nha cung cap');
    }
  }

  private async validateProduct(productId: string) {
    const product = await this.productRepository.findOneBy({ id: productId });
    if (!product) throw new BadRequestException('San pham khong ton tai');
  }

  async create(dto: CreateVendorPriceHistoryDto) {
    await this.validateVendor(dto.vendorId);
    await this.validateProduct(dto.productId);

    const entity = this.vendorPriceHistoryRepository.create({
      ...dto,
      currency: dto.currency ?? 'VND',
      effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : null,
    });

    return this.vendorPriceHistoryRepository.save(entity);
  }

  async findAll(vendorId?: string, productId?: string) {
    const qb = this.vendorPriceHistoryRepository
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.vendor', 'vendor')
      .leftJoinAndSelect('history.product', 'product');

    if (vendorId) qb.andWhere('history.vendorId = :vendorId', { vendorId });
    if (productId) qb.andWhere('history.productId = :productId', { productId });

    qb.orderBy('history.createdAt', 'DESC');

    return qb.getMany();
  }

  async findOne(id: string) {
    const history = await this.vendorPriceHistoryRepository.findOne({
      where: { id },
      relations: { vendor: true, product: true },
    });

    if (!history) throw new NotFoundException('Khong tim thay lich su gia');
    return history;
  }

  async update(id: string, dto: UpdateVendorPriceHistoryDto) {
    const history = await this.findOne(id);

    const payload = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );

    if (payload.vendorId) await this.validateVendor(payload.vendorId);
    if (payload.productId) await this.validateProduct(payload.productId);

    if (payload.effectiveDate) {
      payload.effectiveDate = new Date(payload.effectiveDate as any) as any;
    }

    await this.vendorPriceHistoryRepository.update({ id: history.id }, payload);
    return this.findOne(id);
  }

  async remove(id: string) {
    const result = await this.vendorPriceHistoryRepository.delete({ id });
    if (result.affected === 0) throw new NotFoundException('Khong tim thay lich su gia');
    return { id, deletedCount: result.affected };
  }
}
