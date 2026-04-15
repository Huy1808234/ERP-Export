import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import aqp from 'api-query-params';
import { Repository } from 'typeorm';
import { Partner, PartnerType } from '@/modules/partners/entities/partner.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Partner)
    private partnerRepository: Repository<Partner>,
  ) {}

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  async create(createProductDto: CreateProductDto) {
    const isSkuExists = await this.productRepository.existsBy({ sku: createProductDto.sku });
    if (isSkuExists) {
      throw new BadRequestException(`SKU đã tồn tại: ${createProductDto.sku}`);
    }

    let preferredSupplier: Partner | null = null;
    if (createProductDto.preferredSupplierId) {
      preferredSupplier = await this.partnerRepository.findOneBy({ _id: createProductDto.preferredSupplierId });

      if (!preferredSupplier) {
        throw new BadRequestException('Nhà cung cấp không tồn tại');
      }

      if (preferredSupplier.partnerType !== PartnerType.SUPPLIER) {
        throw new BadRequestException('Đối tác được chọn phải có loại SUPPLIER');
      }
    }

    const product = this.productRepository.create({
      sku: createProductDto.sku,
      vietnameseName: createProductDto.vietnameseName,
      englishName: createProductDto.englishName ?? null,
      hsCode: createProductDto.hsCode ?? null,
      category: createProductDto.category ?? null,
      brand: createProductDto.brand ?? null,
      originCountry: createProductDto.originCountry ?? null,
      unitOfMeasure: createProductDto.unitOfMeasure ?? null,
      packingType: createProductDto.packingType ?? null,
      piecesPerCarton: createProductDto.piecesPerCarton ?? null,
      cartonsPerPallet: createProductDto.cartonsPerPallet ?? null,
      cbmPerCarton: createProductDto.cbmPerCarton?.toString() ?? null,
      netWeightPerCarton: createProductDto.netWeightPerCarton?.toString() ?? null,
      grossWeightPerCarton: createProductDto.grossWeightPerCarton?.toString() ?? null,
      palletLayers: createProductDto.palletLayers ?? null,
      cartonsPerLayer: createProductDto.cartonsPerLayer ?? null,
      description: createProductDto.description ?? null,
      note: createProductDto.note ?? null,
      isActive: createProductDto.isActive ?? true,
      preferredSupplierId: preferredSupplier?._id ?? null,
    });

    return await this.productRepository.save(product);
  }

  async findAll(query: string, current: number, pageSize: number) {
    const { filter, sort } = aqp(query);

    if (filter.current) delete filter.current;
    if (filter.pageSize) delete filter.pageSize;
    if (filter.limit) delete filter.limit;

    if (!current) current = 1;
    if (!pageSize) pageSize = 10;

    const skip = (current - 1) * pageSize;
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.preferredSupplier', 'preferredSupplier');

    for (const key in filter) {
      if (filter[key] instanceof RegExp) {
        queryBuilder.andWhere(`product.${key} ILIKE :${key}`, { [key]: `%${filter[key].source}%` });
      } else {
        queryBuilder.andWhere(`product.${key} = :${key}`, { [key]: filter[key] });
      }
    }

    if (sort) {
      for (const key in sort) {
        queryBuilder.addOrderBy(`product.${key}`, (sort as any)[key] === 1 ? 'ASC' : 'DESC');
      }
    }

    queryBuilder.skip(skip).take(pageSize);

    const [resultsRaw, totalItems] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      results: resultsRaw,
      totalPages,
    };
  }

  async findOne(id: string) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException(`ID không hợp lệ: ${id}`);
    }

    const product = await this.productRepository.findOne({
      where: { _id: id },
      relations: ['preferredSupplier'],
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException(`ID không hợp lệ: ${id}`);
    }

    const existingProduct = await this.productRepository.findOne({
      where: { _id: id },
      relations: ['preferredSupplier'],
    });

    if (!existingProduct) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    if (updateProductDto.sku && updateProductDto.sku !== existingProduct.sku) {
      const isSkuExists = await this.productRepository.existsBy({ sku: updateProductDto.sku });
      if (isSkuExists) {
        throw new BadRequestException(`SKU đã tồn tại: ${updateProductDto.sku}`);
      }
    }

    let preferredSupplier = existingProduct.preferredSupplier;
    if (updateProductDto.preferredSupplierId !== undefined) {
      if (updateProductDto.preferredSupplierId === null) {
        preferredSupplier = null;
      } else {
        preferredSupplier = await this.partnerRepository.findOneBy({ _id: updateProductDto.preferredSupplierId });

        if (!preferredSupplier) {
          throw new BadRequestException('Nhà cung cấp không tồn tại');
        }

        if (preferredSupplier.partnerType !== PartnerType.SUPPLIER) {
          throw new BadRequestException('Đối tác được chọn phải có loại SUPPLIER');
        }
      }
    }

    await this.productRepository.update(
      { _id: id },
      {
        sku: updateProductDto.sku ?? existingProduct.sku,
        vietnameseName: updateProductDto.vietnameseName ?? existingProduct.vietnameseName,
        englishName: updateProductDto.englishName ?? existingProduct.englishName,
        hsCode: updateProductDto.hsCode ?? existingProduct.hsCode,
        category: updateProductDto.category ?? existingProduct.category,
        brand: updateProductDto.brand ?? existingProduct.brand,
        originCountry: updateProductDto.originCountry ?? existingProduct.originCountry,
        unitOfMeasure: updateProductDto.unitOfMeasure ?? existingProduct.unitOfMeasure,
        packingType: updateProductDto.packingType ?? existingProduct.packingType,
        piecesPerCarton: updateProductDto.piecesPerCarton ?? existingProduct.piecesPerCarton,
        cartonsPerPallet: updateProductDto.cartonsPerPallet ?? existingProduct.cartonsPerPallet,
        cbmPerCarton: updateProductDto.cbmPerCarton !== undefined ? updateProductDto.cbmPerCarton.toString() : existingProduct.cbmPerCarton,
        netWeightPerCarton: updateProductDto.netWeightPerCarton !== undefined ? updateProductDto.netWeightPerCarton.toString() : existingProduct.netWeightPerCarton,
        grossWeightPerCarton: updateProductDto.grossWeightPerCarton !== undefined ? updateProductDto.grossWeightPerCarton.toString() : existingProduct.grossWeightPerCarton,
        palletLayers: updateProductDto.palletLayers ?? existingProduct.palletLayers,
        cartonsPerLayer: updateProductDto.cartonsPerLayer ?? existingProduct.cartonsPerLayer,
        description: updateProductDto.description ?? existingProduct.description,
        note: updateProductDto.note ?? existingProduct.note,
        isActive: updateProductDto.isActive ?? existingProduct.isActive,
        preferredSupplierId: preferredSupplier?._id ?? null,
      },
    );

    const updatedProduct = await this.productRepository.findOne({
      where: { _id: id },
      relations: ['preferredSupplier'],
    });

    return {
      message: 'Cập nhật sản phẩm thành công',
      data: updatedProduct,
    };
  }

  async remove(id: string) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException(`ID không hợp lệ: ${id}`);
    }

    const result = await this.productRepository.delete({ _id: id });

    if (result.affected === 0) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    return {
      message: 'Xoá sản phẩm thành công',
      deletedCount: result.affected,
    };
  }
}