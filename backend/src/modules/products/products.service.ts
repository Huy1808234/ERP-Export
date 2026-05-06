import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository, Brackets, MoreThanOrEqual, LessThanOrEqual } from 'typeorm'; 
import {
  Partner,
  PartnerType,
} from '@/modules/partners/entities/partner.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import * as XLSX from 'xlsx';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryTransactionType } from '../inventory/entities/inventory-ledger.entity';
import { DataSource, EntityManager } from 'typeorm';
import { Decimal } from 'decimal.js';


@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    private readonly inventoryService: InventoryService,
    private readonly dataSource: DataSource,
  ) {}


  private async validateSupplier(preferredSupplierId?: string | null) {
    if (!preferredSupplierId) return;

    const supplier = await this.partnerRepository.findOneBy({
      id: preferredSupplierId,
    });
    if (!supplier) {
      throw new BadRequestException('Nhà cung cấp mặc định không tồn tại');
    }

    if (supplier.partnerType !== PartnerType.SUPPLIER) {
      throw new BadRequestException('Đối tác mặc định phải có loại SUPPLIER');
    }
  }

  private toNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private computeCbmFromDimensions(
    lengthCm?: number | null,
    widthCm?: number | null,
    heightCm?: number | null,
  ): number | null {
    const length = this.toNumber(lengthCm);
    const width = this.toNumber(widthCm);
    const height = this.toNumber(heightCm);

    if (length === null || width === null || height === null) return null;

    const cbm = (length / 100) * (width / 100) * (height / 100);
    if (!Number.isFinite(cbm)) return null;
    return Number(cbm.toFixed(6));
  }

  private normalizeUom(value?: string | null): string {
    return (value ?? '').trim().toLowerCase();
  }

  private convertUomValue(
    product: Product,
    quantity: number,
    fromUom: string,
    toUom: string,
  ) {
    const from = this.normalizeUom(fromUom);
    const to = this.normalizeUom(toUom);

    if (!from || !to) {
      throw new BadRequestException('Đơn vị tính quy đổi không hợp lệ');
    }

    if (from === to) {
      return quantity;
    }

    const piecesPerCarton = this.toNumber(product.piecesPerCarton);
    const cartonsPerPallet = this.toNumber(product.cartonsPerPallet);

    const toPieces = (qty: number, unit: string) => {
      const q = new Decimal(qty);
      // 1. Nhóm đơn vị cơ bản (Base Units)
      if (['pcs', 'piece', 'pieces', 'cái', 'chiếc', 'unit', 'units'].includes(unit)) return q;
      if (['kg', 'kgs', 'kilogram'].includes(unit)) return q; // Nếu mặt hàng tính bằng KG

      // 2. Nhóm đơn vị khối lượng lớn
      if (['ton', 'tons', 'tấn'].includes(unit)) return q.times(1000); // 1 Tấn = 1000 KG

      // 3. Nhóm đơn vị đóng gói (Dựa trên piecesPerCarton)
      if (['carton', 'ctn', 'thùng', 'box', 'boxes', 'hộp', 'bag', 'bags', 'bao', 'túi'].includes(unit)) {
        if (!piecesPerCarton) throw new BadRequestException(`Sản phẩm chưa cấu hình số lượng quy đổi cho đơn vị ${unit}`);
        return q.times(new Decimal(piecesPerCarton));
      }

      // 4. Nhóm đơn vị Pallet
      if (['pallet', 'plt'].includes(unit)) {
        if (!piecesPerCarton || !cartonsPerPallet) throw new BadRequestException('Thiếu dữ liệu Pallet/Carton để quy đổi');
        return q.times(new Decimal(piecesPerCarton)).times(new Decimal(cartonsPerPallet));
      }

      throw new BadRequestException(`Đơn vị tính '${unit}' chưa được hỗ trợ quy đổi tự động`);
    };

    const fromPieces = toPieces(quantity, from);

    if (to === 'pcs' || to === 'piece' || to === 'pieces') return fromPieces.toNumber();
    if (to === 'carton' || to === 'ctn') {
      if (!piecesPerCarton) throw new BadRequestException('Thiếu số lượng/thùng để quy đổi');
      return fromPieces.div(new Decimal(piecesPerCarton)).toNumber();
    }
    if (to === 'pallet' || to === 'plt') {
      if (!piecesPerCarton || !cartonsPerPallet) throw new BadRequestException('Thiếu dữ liệu pallet để quy đổi');
      return fromPieces.div(new Decimal(piecesPerCarton)).div(new Decimal(cartonsPerPallet)).toNumber();
    }

    throw new BadRequestException('Đơn vị tính không được hỗ trợ');
  }

  async create(createProductDto: CreateProductDto) {
    await this.validateSupplier(createProductDto.preferredSupplierId);

    const computedCbm =
      createProductDto.cbmPerCarton ??
      this.computeCbmFromDimensions(
        createProductDto.cartonLengthCm,
        createProductDto.cartonWidthCm,
        createProductDto.cartonHeightCm,
      );

    const entity = this.productRepository.create({
      ...createProductDto,
      cbmPerCarton: computedCbm ?? null,
      isActive: createProductDto.isActive ?? true,
    });

    const saved = await this.productRepository.save(entity);
    return this.findOne(saved.id);
  }

  async findAll(query: any, current: number, pageSize: number, user?: any) {
    const hideCost = user?.role?.name === 'SALES' || (user?.role?.permissions && !user.role.permissions.some(p => p.name === 'read:cost_price' || p.name === 'read:all'));

    const aqp = (await import('api-query-params')).default;
    const { filter, sort } = aqp(query);
    ['current', 'pageSize', 'limit', 'skip'].forEach(
      (key) => delete filter[key],
    );

    // Parse to number safely
    const curr = +current || 1;
    const pSize = +pageSize || 10;

    // ✅ TÁCH BIẾN SEARCH
    const searchTerm = filter.search;
    if (filter.search !== undefined) {
      delete filter.search;
    }

    const skip = (curr - 1) * pSize;
    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.preferredSupplier', 'preferredSupplier');

    // ✅ LOGIC TÌM KIẾM MỚI: Quét qua SKU, Tên Tiếng Việt và Tiếng Anh
    if (searchTerm) {
      qb.andWhere(
        new Brackets((sqb) => {
          sqb
            .where('product.sku ILIKE :search', { search: `%${searchTerm}%` })
            .orWhere('product.vietnameseName ILIKE :search', {
              search: `%${searchTerm}%`,
            })
            .orWhere('product.englishName ILIKE :search', {
              search: `%${searchTerm}%`,
            });
        }),
      );
    }

    // ✅ LOGIC FILTER NÂNG CAO (Hỗ trợ Range, So sánh...)
    Object.keys(filter).forEach((key) => {
      const value = filter[key];

      if (typeof value === 'object' && value !== null) {
        // Xử lý các toán tử của aqp như $gte, $lte
        if (value.$gte !== undefined) {
          qb.andWhere(`product.${key} >= :${key}_gte`, { [`${key}_gte`]: value.$gte });
        }
        if (value.$lte !== undefined) {
          qb.andWhere(`product.${key} <= :${key}_lte`, { [`${key}_lte`]: value.$lte });
        }
        if (value.$ne !== undefined) {
          qb.andWhere(`product.${key} != :${key}_ne`, { [`${key}_ne`]: value.$ne });
        }
      } else if (filter[key] instanceof RegExp) {
        qb.andWhere(`product.${key} ILIKE :${key}`, {
          [key]: `%${filter[key].source}%`,
        });
      } else {
        qb.andWhere(`product.${key} = :${key}`, {
          [key]: filter[key],
        });
      }
    });

    if (sort) {
      Object.keys(sort).forEach((key) => {
        qb.addOrderBy(
          `product.${key}`,
          (sort as any)[key] === 1 ? 'ASC' : 'DESC',
        );
      });
    } else {
      qb.orderBy('product.updatedAt', 'DESC');
    }

    qb.skip(skip).take(pageSize);

    const [results, totalItems] = await qb.getManyAndCount();

    // ✅ TÍNH TOÁN SUMMARY DYNAMICALY TRÊN TẤT CẢ FILTER (KHÔNG CHỈ TRANG HIỆN TẠI)
    const summaryQb = this.productRepository.createQueryBuilder('product');
    // Copy lại filters từ qb sang summaryQb
    if (searchTerm) {
      summaryQb.andWhere(new Brackets(sqb => {
        sqb.where('product.sku ILIKE :s', { s: `%${searchTerm}%` })
           .orWhere('product.vietnameseName ILIKE :s', { s: `%${searchTerm}%` })
           .orWhere('product.englishName ILIKE :s', { s: `%${searchTerm}%` });
      }));
    }
    Object.keys(filter).forEach(key => {
      const value = filter[key];
      if (typeof value === 'object' && value !== null) {
        if (value.$gte !== undefined) summaryQb.andWhere(`product.${key} >= :${key}_sgte`, { [`${key}_sgte`]: value.$gte });
        if (value.$lte !== undefined) summaryQb.andWhere(`product.${key} <= :${key}_slte`, { [`${key}_slte`]: value.$lte });
      } else {
        summaryQb.andWhere(`product.${key} = :${key}_s`, { [`${key}_s`]: value });
      }
    });

    const summaryData = await summaryQb
      .select('COUNT(product.id)', 'total')
      .addSelect('SUM(CASE WHEN product.isActive = true THEN 1 ELSE 0 END)', 'activeCount')
      .addSelect('AVG(CAST(product.defaultExportPrice AS NUMERIC))', 'avgPrice')
      .getRawOne();

    // Lấy danh sách các đơn vị tính và số lượng sản phẩm tương ứng
    const unitCounts = await summaryQb
      .select('product.unitOfMeasure', 'unit')
      .addSelect('COUNT(product.id)', 'count')
      .groupBy('product.unitOfMeasure')
      .getRawMany();

    return {
      results: results.map((item) => {
        if (hideCost) {
          const { purchasePriceVnd, ...rest } = item;
          return rest;
        }
        return item;
      }),
      totalPages: Math.ceil(totalItems / pageSize),
      totalItems,
      summary: {
        total: +summaryData.total || 0,
        activeCount: +summaryData.activeCount || 0,
        avgPrice: +summaryData.avgPrice || 0,
        unitCounts: unitCounts.map(u => ({
          unit: u.unit || 'N/A',
          count: +u.count || 0
        }))
      }
    };
  }

  async findOne(id: string, user?: any) {
    const hideCost = user?.role?.name === 'SALES' || (user?.role?.permissions && !user.role.permissions.some(p => p.name === 'read:cost_price' || p.name === 'read:all'));

    const product = await this.productRepository.findOne({
      where: { id },
      relations: { preferredSupplier: true },
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    if (hideCost) {
      const { purchasePriceVnd, ...rest } = product;
      return rest;
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const existing = await this.productRepository.findOne({
      where: { id },
      relations: { preferredSupplier: true },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    await this.validateSupplier(updateProductDto.preferredSupplierId);

    const payload = Object.fromEntries(
      Object.entries(updateProductDto).filter(
        ([, value]) => value !== undefined,
      ),
    );

    const dimensionKeys = ['cartonLengthCm', 'cartonWidthCm', 'cartonHeightCm'];
    const hasDimensionChange = dimensionKeys.some((key) => key in payload);

    if (payload.cbmPerCarton === undefined && hasDimensionChange) {
      const merged = { ...existing, ...payload } as Product;
      const computedCbm = this.computeCbmFromDimensions(
        merged.cartonLengthCm,
        merged.cartonWidthCm,
        merged.cartonHeightCm,
      );
      if (computedCbm !== null) {
        payload.cbmPerCarton = computedCbm;
      }
    }

    await this.productRepository.update({ id }, payload);
    return this.findOne(id);
  }

  async convertUom(
    id: string,
    quantity: string | number,
    fromUom: string,
    toUom: string,
  ) {
    const product = await this.productRepository.findOneBy({ id });
    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    const parsedQty = this.toNumber(quantity);
    if (parsedQty === null || parsedQty < 0) {
      throw new BadRequestException('Số lượng quy đổi không hợp lệ');
    }

    const convertedQuantity = this.convertUomValue(
      product,
      parsedQty,
      fromUom,
      toUom,
    );

    return {
      productId: id,
      from: fromUom,
      to: toUom,
      quantity: parsedQty,
      convertedQuantity,
    };
  }

  async remove(id: string) {
    const result = await this.productRepository.softDelete({ id });
    if (result.affected === 0) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }
    return { id, deletedCount: result.affected };
  }

  async bulkRemove(ids: string[]) {
    const result = await this.productRepository.softDelete(ids);
    return {
      message: `Xoá thành công ${result.affected} sản phẩm`,
      deletedCount: result.affected,
    };
  }

  async exportExcel(query: any) {
    const aqp = (await import('api-query-params')).default;
    const { filter, sort } = aqp(query);
    ['current', 'pageSize', 'limit', 'skip'].forEach(
      (key) => delete filter[key],
    );

    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.preferredSupplier', 'preferredSupplier');

    // Reuse filter logic from findAll
    const searchTerm = filter.search;
    if (filter.search !== undefined) delete filter.search;

    if (searchTerm) {
      qb.andWhere(
        new Brackets((sqb) => {
          sqb
            .where('product.sku ILIKE :search', { search: `%${searchTerm}%` })
            .orWhere('product.vietnameseName ILIKE :search', { search: `%${searchTerm}%` })
            .orWhere('product.englishName ILIKE :search', { search: `%${searchTerm}%` });
        }),
      );
    }

    Object.keys(filter).forEach((key) => {
      if (filter[key] instanceof RegExp) {
        qb.andWhere(`product.${key} ILIKE :${key}`, { [key]: `%${filter[key].source}%` });
      } else {
        qb.andWhere(`product.${key} = :${key}`, { [key]: filter[key] });
      }
    });

    if (sort) {
      Object.keys(sort).forEach((key) => {
        qb.addOrderBy(`product.${key}`, (sort as any)[key] === 1 ? 'ASC' : 'DESC');
      });
    }

    const results = await qb.getMany();

    const data = results.map((p) => ({
      'SKU': p.sku,
      'Tên hàng (VN)': p.vietnameseName,
      'Tên hàng (EN)': p.englishName || 'N/A',
      'HS Code': p.hsCode || 'N/A',
      'ĐVT': p.unitOfMeasure,
      'Giá bán': `${p.defaultExportPrice?.toLocaleString() || 0} ${p.exportCurrency || 'USD'}`,
      'Logistics (CBM)': p.cbmPerCarton || 0,
      'Nhà cung cấp': p.preferredSupplier?.name || 'N/A',
      'Trạng thái': p.isActive ? 'Đang kinh doanh' : 'Tạm ngưng',
      'Ngày cập nhật': p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('vi-VN') : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh Sách Sản Phẩm');
    worksheet['!cols'] = [
      { wch: 15 }, { wch: 35 }, { wch: 35 }, { wch: 15 }, { wch: 10 },
      { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 20 }
    ];

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async importExcel(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    const productsToCreate = data.map(item => ({
      sku: item['SKU'] || item['sku'],
      vietnameseName: item['Tên hàng (VN)'] || item['vietnameseName'],
      englishName: item['Tên hàng (EN)'] || item['englishName'],
      hsCode: item['HS Code'] || item['hsCode'],
      unitOfMeasure: item['ĐVT'] || item['unitOfMeasure'] || 'pcs',
      defaultExportPrice: Number(item['Giá bán'] || item['defaultExportPrice'] || 0),
      purchasePriceVnd: Number(item['Giá mua (VND)'] || item['purchasePriceVnd'] || 0),
      isActive: true
    }));

    // Bắt đầu transaction để đảm bảo an toàn
    const results = await this.productRepository.save(productsToCreate);
    return {
      message: `Đã nhập thành công ${results.length} sản phẩm`,
      count: results.length
    };
  }

  async reserveStock(id: string, quantity: number, referenceId: string, manager: EntityManager) {
    return this.inventoryService.reserveStock(id, quantity, referenceId, manager);
  }

  async releaseStock(id: string, quantity: number, referenceId: string, manager: EntityManager) {
    return this.inventoryService.releaseStock(id, quantity, referenceId, manager);
  }

  async deductStock(id: string, quantity: number, referenceId?: string, manager?: EntityManager, lotNumber?: string) {
    // Sử dụng InventoryService để xử lý FIFO/Lot và chốt giá vốn (COGS)
    return this.inventoryService.executeInventoryTransaction(
      id,
      -quantity, // Số âm để trừ kho
      InventoryTransactionType.SALES,
      referenceId || 'MANUAL-DEDUCT',
      0, // Unit price sẽ được FIFO tự tính
      `Xuất hàng cho đơn ${referenceId || 'thủ công'}`,
      manager,
      lotNumber
    );
  }
}
