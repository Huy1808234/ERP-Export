import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  Repository,
  Brackets,
  MoreThanOrEqual,
  LessThanOrEqual,
  SelectQueryBuilder,
} from 'typeorm';
import {
  Partner,
  PartnerType,
} from '@/modules/partners/entities/partner.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import {
  ProductChangeRequest,
  ProductChangeRequestStatus,
  ProductChangedField,
  ProductFieldDecisionAudit,
} from './entities/product-change-request.entity';
import { ProductVersion } from './entities/product-version.entity';
import { CreateProductChangeRequestDto } from './dto/create-product-change-request.dto';
import { ProductChangeDecisionDto } from './dto/product-change-decision.dto';
import * as XLSX from 'xlsx';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryTransactionType } from '../inventory/entities/inventory-ledger.entity';
import { DataSource, EntityManager } from 'typeorm';
import { Decimal } from 'decimal.js';
import {
  assertCanWriteCostFields,
  canReadCostFields,
  maskCostFields,
} from '@/common/field-access.util';
import { randomBytes } from 'crypto';
import { ApprovalMatrixService } from '@/modules/approval-matrix/approval-matrix.service';
import { ApprovalDocumentType } from '@/modules/approval-matrix/entities/approval-rule.entity';
import { CurrenciesService } from '@/modules/currencies/currencies.service';

type ProductSortDirection = 'ASC' | 'DESC';
type ProductSortValue = 1 | -1;

const PRODUCT_PRICE_RATE_TO_VND: Record<string, number> = {
  VND: 1,
  USD: 26128,
  EUR: 28400,
  CNY: 3610,
  JPY: 181,
  KRW: 19,
};

@Injectable()
export class ProductsService {
  private readonly productSortColumns: Record<string, string> = {
    sku: 'product.sku',
    vietnameseName: 'product.vietnameseName',
    englishName: 'product.englishName',
    category: 'product.category',
    hsCode: 'product.hsCode',
    unitOfMeasure: 'product.unitOfMeasure',
    defaultExportPrice: 'product.defaultExportPrice',
    isActive: 'product.isActive',
    currentStock: 'product.currentStock',
    reservedStock: 'product.reservedStock',
    createdAt: 'product.createdAt',
    updatedAt: 'product.updatedAt',
  };

  private readonly approvalControlledFields = new Set([
    'purchasePriceVnd',
    'defaultExportPrice',
    'exportCurrency',
    'hsCode',
    'englishName',
    'description',
    'unitOfMeasure',
    'packingType',
    'piecesPerCarton',
    'cartonsPerPallet',
    'cartonLengthCm',
    'cartonWidthCm',
    'cartonHeightCm',
    'cbmPerCarton',
    'netWeightPerCarton',
    'grossWeightPerCarton',
    'palletLayers',
    'cartonsPerLayer',
  ]);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    @InjectRepository(ProductChangeRequest)
    private readonly productChangeRequestRepository: Repository<ProductChangeRequest>,
    @InjectRepository(ProductVersion)
    private readonly productVersionRepository: Repository<ProductVersion>,
    private readonly inventoryService: InventoryService,
    private readonly dataSource: DataSource,
    private readonly approvalMatrixService: ApprovalMatrixService,
    private readonly currenciesService: CurrenciesService,
  ) {}

  private async validateSupplier(preferredSupplierId?: string | null) {
    if (!preferredSupplierId) return;

    const supplier = await this.partnerRepository.findOneBy({
      _id: preferredSupplierId,
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

  private getPriceVndSortExpression(): string {
    const cases = Object.entries(PRODUCT_PRICE_RATE_TO_VND)
      .map(
        ([currency, rate]) =>
          `WHEN '${currency}' THEN COALESCE(product."defaultExportPrice", 0) * ${rate}`,
      )
      .join(' ');

    return `(CASE UPPER(COALESCE(product."exportCurrency", 'VND')) ${cases} ELSE COALESCE(product."defaultExportPrice", 0) END)`;
  }

  private applyProductSort(
    qb: SelectQueryBuilder<Product>,
    sort?: Record<string, ProductSortValue>,
  ): void {
    let applied = false;

    if (sort) {
      Object.entries(sort).forEach(([field, value]) => {
        const direction: ProductSortDirection = value === 1 ? 'ASC' : 'DESC';

        if (field === 'priceVnd' || field === 'defaultExportPrice') {
          qb.addOrderBy(this.getPriceVndSortExpression(), direction);
          applied = true;
          return;
        }

        const column = this.productSortColumns[field];
        if (column) {
          qb.addOrderBy(column, direction);
          applied = true;
        }
      });
    }

    if (!applied) {
      qb.orderBy('product.updatedAt', 'DESC');
      return;
    }

    if (!sort?.updatedAt) {
      qb.addOrderBy('product.updatedAt', 'DESC');
    }
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

  private getUsername(user?: any) {
    return user?.username || user?.name || 'system';
  }

  private getRoleName(user?: any) {
    const role = typeof user?.role === 'string' ? user.role : user?.role?.name;
    return String(role || '').toUpperCase();
  }

  private createRequestNumber(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const random = randomBytes(4).toString('hex').toUpperCase();
    return `PCR-${yyyy}${mm}${dd}-${random}`;
  }

  private normalizeCompareValue(value: unknown) {
    if (value === undefined || value === '') return null;
    if (typeof value === 'number') return Number(value.toFixed(6));
    if (typeof value === 'string') return value.trim();
    return value;
  }

  private valuesAreDifferent(before: unknown, after: unknown) {
    return (
      JSON.stringify(this.normalizeCompareValue(before)) !==
      JSON.stringify(this.normalizeCompareValue(after))
    );
  }

  private extractChangedFields(
    product: Product,
    patch: Record<string, unknown>,
  ): ProductChangedField[] {
    return Object.entries(patch)
      .filter(([field, after]) =>
        this.valuesAreDifferent((product as any)[field], after),
      )
      .map(([field, after]) => ({
        field,
        before: (product as any)[field] ?? null,
        after: after ?? null,
      }));
  }

  private splitApprovalControlledPatch(
    product: Product,
    payload: Record<string, unknown>,
  ) {
    const directPatch: Record<string, unknown> = {};
    const controlledPatch: Record<string, unknown> = {};
    const changedFields = this.extractChangedFields(product, payload);

    for (const change of changedFields) {
      if (this.approvalControlledFields.has(change.field)) {
        controlledPatch[change.field] = change.after;
      } else {
        directPatch[change.field] = change.after;
      }
    }

    return { directPatch, controlledPatch };
  }

  private async assertNoPendingProductChange(productId: string) {
    const pending = await this.productChangeRequestRepository.findOne({
      where: { productId, status: ProductChangeRequestStatus.PENDING_APPROVAL },
    });
    if (pending) {
      throw new BadRequestException(
        `Sáº£n pháº©m Ä‘ang cÃ³ yÃªu cáº§u thay Ä‘á»•i chá» duyá»‡t: ${pending.requestNumber}`,
      );
    }
  }

  private async createProductVersion(
    product: Product,
    changedFields: ProductChangedField[],
    changedByUsername: string,
    approvedByUsername: string | null,
    changeRequestId: string | null,
    note?: string | null,
    manager?: EntityManager,
  ) {
    if (changedFields.length === 0) return null;

    const repo = manager
      ? manager.getRepository(ProductVersion)
      : this.productVersionRepository;
    const previousCount = await repo.count({
      where: { productId: product._id },
    });
    const beforeSnapshot = Object.fromEntries(
      changedFields.map((change) => [change.field, change.before]),
    );
    const afterSnapshot = Object.fromEntries(
      changedFields.map((change) => [change.field, change.after]),
    );

    return repo.save(
      repo.create({
        productId: product._id,
        changeRequestId,
        versionNumber: previousCount + 1,
        changedFields,
        beforeSnapshot,
        afterSnapshot,
        changedByUsername,
        approvedByUsername,
        note: note ?? null,
      }),
    );
  }

  private resolveChangeCurrency(
    product: Product,
    patch: Record<string, unknown>,
  ) {
    return String(
      patch.exportCurrency || product.exportCurrency || 'VND',
    ).toUpperCase();
  }

  private async calculateChangeApprovalAmountVnd(
    product: Product,
    changedFields: ProductChangedField[],
    patch: Record<string, unknown>,
  ) {
    const currency = this.resolveChangeCurrency(product, patch);
    let amountVnd = 0;

    for (const change of changedFields) {
      const values = [change.before, change.after]
        .map((value) => this.toNumber(value))
        .filter((value): value is number => value !== null);

      if (!values.length) continue;
      const maxValue = Math.max(...values.map((value) => Math.abs(value)));

      if (change.field === 'purchasePriceVnd') {
        amountVnd = Math.max(amountVnd, maxValue);
      }

      if (change.field === 'defaultExportPrice') {
        const converted = await this.currenciesService.convertToBase(
          maxValue,
          currency,
        );
        amountVnd = Math.max(amountVnd, converted);
      }
    }

    return Number(new Decimal(amountVnd).toFixed(2));
  }

  private buildChangeTitle(
    product: Product,
    requestNumber: string,
    changedFields: ProductChangedField[],
  ) {
    const sensitiveFields = changedFields
      .map((change) => change.field)
      .join(', ');
    return `Approve product change ${requestNumber} - ${product.sku} (${sensitiveFields})`;
  }

  private buildWorkflowStepAudit(workflowRequest: any) {
    return (workflowRequest?.steps || []).map((step: any) => ({
      stepOrder: step.stepOrder,
      approverRoleName: step.approverRoleName,
      approverUsername: step.approverUsername || null,
      status: step.status,
      actedByUsername: step.actedByUsername || null,
      actedAt: step.actedAt || null,
      note: step.note || null,
    }));
  }

  private buildFieldDecisionAudit(
    changedFields: ProductChangedField[],
    decision: ProductFieldDecisionAudit['decision'],
    actorUsername: string,
    decisionNote: string | null,
    approvalWorkflowRequestId: string | null,
    approvalSteps: ProductFieldDecisionAudit['approvalSteps'] = [],
  ): ProductFieldDecisionAudit[] {
    const decidedAt = new Date().toISOString();

    return changedFields.map((change) => ({
      ...change,
      decision,
      decidedByUsername: actorUsername,
      decidedAt,
      approvedByUsername: decision === 'APPROVED' ? actorUsername : null,
      approvedAt: decision === 'APPROVED' ? decidedAt : null,
      rejectedByUsername: decision === 'REJECTED' ? actorUsername : null,
      rejectedAt: decision === 'REJECTED' ? decidedAt : null,
      decisionNote,
      approvalWorkflowRequestId,
      approvalSteps,
    }));
  }

  private maskCostPrice<T extends Partial<Product>>(product: T, user?: any) {
    return maskCostFields(product, user) as Omit<T, 'purchasePriceVnd'>;
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
      if (
        ['pcs', 'piece', 'pieces', 'cái', 'chiếc', 'unit', 'units'].includes(
          unit,
        )
      )
        return q;
      if (['kg', 'kgs', 'kilogram'].includes(unit)) return q; // Nếu mặt hàng tính bằng KG

      // 2. Nhóm đơn vị khối lượng lớn
      if (['ton', 'tons', 'tấn'].includes(unit)) return q.times(1000); // 1 Tấn = 1000 KG

      // 3. Nhóm đơn vị đóng gói (Dựa trên piecesPerCarton)
      if (
        [
          'carton',
          'ctn',
          'thùng',
          'box',
          'boxes',
          'hộp',
          'bag',
          'bags',
          'bao',
          'túi',
        ].includes(unit)
      ) {
        if (!piecesPerCarton)
          throw new BadRequestException(
            `Sản phẩm chưa cấu hình số lượng quy đổi cho đơn vị ${unit}`,
          );
        return q.times(new Decimal(piecesPerCarton));
      }

      // 4. Nhóm đơn vị Pallet
      if (['pallet', 'plt'].includes(unit)) {
        if (!piecesPerCarton || !cartonsPerPallet)
          throw new BadRequestException(
            'Thiếu dữ liệu Pallet/Carton để quy đổi',
          );
        return q
          .times(new Decimal(piecesPerCarton))
          .times(new Decimal(cartonsPerPallet));
      }

      throw new BadRequestException(
        `Đơn vị tính '${unit}' chưa được hỗ trợ quy đổi tự động`,
      );
    };

    const fromPieces = toPieces(quantity, from);

    if (to === 'pcs' || to === 'piece' || to === 'pieces')
      return fromPieces.toNumber();
    if (to === 'carton' || to === 'ctn') {
      if (!piecesPerCarton)
        throw new BadRequestException('Thiếu số lượng/thùng để quy đổi');
      return fromPieces.div(new Decimal(piecesPerCarton)).toNumber();
    }
    if (to === 'pallet' || to === 'plt') {
      if (!piecesPerCarton || !cartonsPerPallet)
        throw new BadRequestException('Thiếu dữ liệu pallet để quy đổi');
      return fromPieces
        .div(new Decimal(piecesPerCarton))
        .div(new Decimal(cartonsPerPallet))
        .toNumber();
    }

    throw new BadRequestException('Đơn vị tính không được hỗ trợ');
  }

  async create(createProductDto: CreateProductDto, user?: any) {
    console.log('[ProductsService] Create DTO:', createProductDto);
    assertCanWriteCostFields(createProductDto, user);
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
    return this.findOne(saved._id, user);
  }

  async findAll(query: any, current: number, pageSize: number, user?: any) {
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
          qb.andWhere(`product.${key} >= :${key}_gte`, {
            [`${key}_gte`]: value.$gte,
          });
        }
        if (value.$lte !== undefined) {
          qb.andWhere(`product.${key} <= :${key}_lte`, {
            [`${key}_lte`]: value.$lte,
          });
        }
        if (value.$ne !== undefined) {
          qb.andWhere(`product.${key} != :${key}_ne`, {
            [`${key}_ne`]: value.$ne,
          });
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

    this.applyProductSort(
      qb,
      sort as Record<string, ProductSortValue> | undefined,
    );

    qb.skip(skip).take(pageSize);

    const [results, totalItems] = await qb.getManyAndCount();

    // ✅ TÍNH TOÁN SUMMARY DYNAMICALY TRÊN TẤT CẢ FILTER (KHÔNG CHỈ TRANG HIỆN TẠI)
    const getBaseSummaryQb = () => {
      const sqb = this.productRepository.createQueryBuilder('product');
      if (searchTerm) {
        sqb.andWhere(
          new Brackets((s) => {
            s.where('product.sku ILIKE :s', { s: `%${searchTerm}%` })
              .orWhere('product.vietnameseName ILIKE :s', {
                s: `%${searchTerm}%`,
              })
              .orWhere('product.englishName ILIKE :s', {
                s: `%${searchTerm}%`,
              });
          }),
        );
      }
      Object.keys(filter).forEach((key) => {
        const value = filter[key];
        if (typeof value === 'object' && value !== null) {
          if (value.$gte !== undefined)
            sqb.andWhere(`product.${key} >= :${key}_sgte`, {
              [`${key}_sgte`]: value.$gte,
            });
          if (value.$lte !== undefined)
            sqb.andWhere(`product.${key} <= :${key}_slte`, {
              [`${key}_slte`]: value.$lte,
            });
        } else {
          sqb.andWhere(`product.${key} = :${key}_s`, { [`${key}_s`]: value });
        }
      });
      return sqb;
    };

    const summaryData = await getBaseSummaryQb()
      .select('COUNT(product._id)', 'total')
      .addSelect(
        'SUM(CASE WHEN product.isActive = true THEN 1 ELSE 0 END)',
        'activeCount',
      )
      .addSelect('AVG(CAST(product.defaultExportPrice AS NUMERIC))', 'avgPrice')
      .getRawOne();

    const unitCounts = await getBaseSummaryQb()
      .select('product.unitOfMeasure', 'unit')
      .addSelect('COUNT(product._id)', 'count')
      .groupBy('product.unitOfMeasure')
      .getRawMany();

    const categoryCountRes = await getBaseSummaryQb()
      .select('COUNT(DISTINCT product.category)', 'count')
      .getRawOne();

    const categoriesRaw = await getBaseSummaryQb()
      .select('DISTINCT product.category', 'name')
      .where('product.category IS NOT NULL')
      .getRawMany();
    const categories = categoriesRaw.map((c) => c.name);

    return {
      results: results.map((item) => this.maskCostPrice(item, user)),
      totalPages: Math.ceil(totalItems / pageSize),
      totalItems,
      summary: {
        total: +summaryData.total || 0,
        activeCount: +summaryData.activeCount || 0,
        avgPrice: +summaryData.avgPrice || 0,
        categoryCount: +categoryCountRes.count || 0,
        categories: categories.map((c) => c.name),
        unitCounts: unitCounts.map((u) => ({
          unit: u.unit || 'N/A',
          count: +u.count || 0,
        })),
      },
    };
  }

  async findOne(id: string, user?: any) {
    const product = await this.productRepository.findOne({
      where: { _id: id },
      relations: { preferredSupplier: true },
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    return this.maskCostPrice(product, user);
  }

  async update(id: string, updateProductDto: UpdateProductDto, user?: any) {
    const existing = await this.productRepository.findOne({
      where: { _id: id },
      relations: { preferredSupplier: true },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    await this.validateSupplier(updateProductDto.preferredSupplierId);

    const rawPayload = Object.fromEntries(
      Object.entries(updateProductDto).filter(
        ([, value]) => value !== undefined,
      ),
    );
    assertCanWriteCostFields(rawPayload, user);
    console.log('[ProductsService] Update payload:', rawPayload);

    const dimensionKeys = ['cartonLengthCm', 'cartonWidthCm', 'cartonHeightCm'];
    const hasDimensionChange = dimensionKeys.some((key) => key in rawPayload);

    if (rawPayload.cbmPerCarton === undefined && hasDimensionChange) {
      const merged = { ...existing, ...rawPayload } as Product;
      const computedCbm = this.computeCbmFromDimensions(
        merged.cartonLengthCm,
        merged.cartonWidthCm,
        merged.cartonHeightCm,
      );
      if (computedCbm !== null) {
        rawPayload.cbmPerCarton = computedCbm;
      }
    }

    const { directPatch, controlledPatch } = this.splitApprovalControlledPatch(
      existing,
      rawPayload,
    );

    if (Object.keys(controlledPatch).length > 0) {
      await this.assertNoPendingProductChange(id);
    }

    let savedProduct = existing;
    if (Object.keys(directPatch).length > 0) {
      const directChangedFields = this.extractChangedFields(
        existing,
        directPatch,
      );
      savedProduct = Object.assign(existing, directPatch);
      await this.productRepository.save(savedProduct);
      await this.createProductVersion(
        savedProduct,
        directChangedFields,
        this.getUsername(user),
        null,
        null,
        'Direct product update',
      );
    }

    if (Object.keys(controlledPatch).length > 0) {
      const changeRequest = await this.createChangeRequest(
        id,
        {
          patch: controlledPatch,
          reason: 'Sensitive product fields changed from admin form',
        },
        user,
      );
      return {
        requiresApproval: true,
        product: this.maskCostPrice(savedProduct, user),
        changeRequest: maskCostFields(changeRequest, user),
      };
    }

    return this.findOne(id, user);
  }

  async createChangeRequest(
    productId: string,
    dto: CreateProductChangeRequestDto,
    user?: any,
  ) {
    assertCanWriteCostFields(dto.patch || {}, user);
    const product = await this.productRepository.findOne({
      where: { _id: productId },
      relations: { preferredSupplier: true },
    });
    if (!product) {
      throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m');
    }

    await this.assertNoPendingProductChange(productId);

    const allowedPatch = Object.fromEntries(
      Object.entries(dto.patch || {}).filter(
        ([field, value]) =>
          this.approvalControlledFields.has(field) && value !== undefined,
      ),
    );

    if (Object.keys(allowedPatch).length === 0) {
      throw new BadRequestException(
        'KhÃ´ng cÃ³ thay Ä‘á»•i nháº¡y cáº£m nÃ o cáº§n duyá»‡t',
      );
    }

    const dimensionKeys = ['cartonLengthCm', 'cartonWidthCm', 'cartonHeightCm'];
    const hasDimensionChange = dimensionKeys.some((key) => key in allowedPatch);
    if (allowedPatch.cbmPerCarton === undefined && hasDimensionChange) {
      const merged = { ...product, ...allowedPatch } as Product;
      const computedCbm = this.computeCbmFromDimensions(
        merged.cartonLengthCm,
        merged.cartonWidthCm,
        merged.cartonHeightCm,
      );
      if (computedCbm !== null) {
        allowedPatch.cbmPerCarton = computedCbm;
      }
    }

    const changedFields = this.extractChangedFields(product, allowedPatch);
    if (changedFields.length === 0) {
      throw new BadRequestException(
        'GiÃ¡ trá»‹ Ä‘á» xuáº¥t khÃ´ng khÃ¡c dá»¯ liá»‡u hiá»‡n táº¡i',
      );
    }

    const currency = this.resolveChangeCurrency(product, allowedPatch);
    const amountVnd = await this.calculateChangeApprovalAmountVnd(
      product,
      changedFields,
      allowedPatch,
    );
    const matchingRule = await this.approvalMatrixService.findMatchingRule(
      ApprovalDocumentType.PRODUCT_CHANGE_REQUEST,
      amountVnd,
      currency,
    );

    if (!matchingRule) {
      throw new BadRequestException(
        'Chua cau hinh approval matrix cho thay doi gia/HS code san pham',
      );
    }

    const request = this.productChangeRequestRepository.create({
      productId,
      requestNumber: this.createRequestNumber(),
      status: ProductChangeRequestStatus.PENDING_APPROVAL,
      proposedPatch: Object.fromEntries(
        changedFields.map((change) => [change.field, change.after]),
      ),
      changedFields,
      approvalWorkflowRequestId: null,
      fieldDecisionAudit: [],
      reason: dto.reason ?? null,
      requestedByUsername: this.getUsername(user),
      requestedAt: new Date(),
    });

    return this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(ProductChangeRequest);
      const savedRequest = await requestRepo.save(request);
      const approvalRequest =
        await this.approvalMatrixService.createRequestInTransaction(
          manager,
          {
            ruleId: matchingRule._id,
            documentType: ApprovalDocumentType.PRODUCT_CHANGE_REQUEST,
            documentId: savedRequest._id,
            documentNumber: savedRequest.requestNumber,
            title: this.buildChangeTitle(
              product,
              savedRequest.requestNumber,
              changedFields,
            ),
            currency,
            amount: amountVnd,
            amountVnd,
            metadata: {
              productId: product._id,
              sku: product.sku,
              productName: product.vietnameseName || product.englishName || null,
              changedFields,
              reason: dto.reason || null,
              source: 'products.change_request',
            },
          },
          user,
        );

      savedRequest.approvalWorkflowRequestId = approvalRequest?._id || null;
      const requestWithWorkflow = await requestRepo.save(savedRequest);

      return {
        ...requestWithWorkflow,
        approvalRequest,
      };
    });
  }

  async findChangeRequests(
    query: any,
    current: number,
    pageSize: number,
    user?: any,
  ) {
    const curr = +current || 1;
    const pSize = +pageSize || 10;
    const qb = this.productChangeRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.product', 'product')
      .orderBy('request.createdAt', 'DESC');

    if (query?.productId) {
      qb.andWhere('request.productId = :productId', {
        productId: query.productId,
      });
    }

    if (query?.status) {
      qb.andWhere('request.status = :status', { status: query.status });
    }

    const [results, totalItems] = await qb
      .skip((curr - 1) * pSize)
      .take(pSize)
      .getManyAndCount();

    return {
      results: maskCostFields(results, user),
      totalItems,
      totalPages: Math.ceil(totalItems / pSize),
    };
  }

  async findProductVersions(productId: string, user?: any) {
    const versions = await this.productVersionRepository.find({
      where: { productId },
      order: { versionNumber: 'DESC' },
    });
    return maskCostFields(versions, user);
  }

  async findPendingChangeRequests() {
    return this.productChangeRequestRepository.find({
      where: { status: ProductChangeRequestStatus.PENDING_APPROVAL },
      relations: { product: true },
      order: { createdAt: 'DESC' },
    });
  }

  async approveChangeRequest(
    requestId: string,
    dto: ProductChangeDecisionDto,
    user?: any,
  ) {
    const existingRequest = await this.productChangeRequestRepository.findOne({
      where: {
        _id: requestId,
        status: ProductChangeRequestStatus.PENDING_APPROVAL,
      },
    });
    if (!existingRequest) {
      throw new NotFoundException(
        'Khong tim thay yeu cau thay doi dang cho duyet',
      );
    }
    if (existingRequest.approvalWorkflowRequestId) {
      return this.approvalMatrixService.approveRequest(
        existingRequest.approvalWorkflowRequestId,
        { note: dto.note || 'Approved from product admin' },
        user,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(ProductChangeRequest);
      const productRepo = manager.getRepository(Product);
      const request = await requestRepo.findOne({
        where: {
          _id: requestId,
          status: ProductChangeRequestStatus.PENDING_APPROVAL,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException(
          'KhÃ´ng tÃ¬m tháº¥y yÃªu cáº§u thay Ä‘á»•i Ä‘ang chá» duyá»‡t',
        );
      }

      const approverUsername = this.getUsername(user);
      const approverRole = this.getRoleName(user);
      if (
        request.requestedByUsername === approverUsername &&
        !['ADMIN', 'SUPER ADMIN', 'SUPER_ADMIN'].includes(approverRole)
      ) {
        throw new ForbiddenException(
          'NgÆ°á»i táº¡o yÃªu cáº§u khÃ´ng Ä‘Æ°á»£c tá»± duyá»‡t thay Ä‘á»•i sáº£n pháº©m',
        );
      }

      const product = await productRepo.findOne({
        where: { _id: request.productId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) {
        throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m');
      }

      const latestChangedFields = this.extractChangedFields(
        product,
        request.proposedPatch,
      );
      const legacyFieldAudit = this.buildFieldDecisionAudit(
        latestChangedFields.length
          ? latestChangedFields
          : request.changedFields,
        'APPROVED',
        approverUsername,
        dto.note ?? request.reason ?? null,
        request.approvalWorkflowRequestId || null,
        [],
      );
      if (latestChangedFields.length === 0) {
        request.status = ProductChangeRequestStatus.APPROVED;
        request.approvedByUsername = approverUsername;
        request.approvedAt = new Date();
        request.decisionNote =
          dto.note ?? 'No-op approval: product already has proposed values';
        request.fieldDecisionAudit = legacyFieldAudit;
        request.changedFields = legacyFieldAudit;
        return requestRepo.save(request);
      }

      Object.assign(product, request.proposedPatch);
      await productRepo.save(product);

      request.status = ProductChangeRequestStatus.APPROVED;
      request.approvedByUsername = approverUsername;
      request.approvedAt = new Date();
      request.decisionNote = dto.note ?? null;
      request.fieldDecisionAudit = legacyFieldAudit;
      request.changedFields = legacyFieldAudit;
      const savedRequest = await requestRepo.save(request);

      await this.createProductVersion(
        product,
        legacyFieldAudit,
        request.requestedByUsername,
        approverUsername,
        request._id,
        dto.note ?? request.reason,
        manager,
      );

      return savedRequest;
    });
  }

  async completeChangeRequestFromApprovalWorkflow(
    requestId: string,
    approvalWorkflowRequestId: string,
    approverUsername: string,
    note?: string | null,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(ProductChangeRequest);
      const productRepo = manager.getRepository(Product);
      const request = await requestRepo.findOne({
        where: {
          _id: requestId,
          status: ProductChangeRequestStatus.PENDING_APPROVAL,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException(
          'Khong tim thay yeu cau thay doi dang cho duyet',
        );
      }

      const product = await productRepo.findOne({
        where: { _id: request.productId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) {
        throw new NotFoundException('Khong tim thay san pham');
      }

      const workflow = await this.approvalMatrixService.findRequest(
        approvalWorkflowRequestId,
      );
      const approvalSteps = this.buildWorkflowStepAudit(workflow);
      const latestChangedFields = this.extractChangedFields(
        product,
        request.proposedPatch,
      );
      const auditedFields = this.buildFieldDecisionAudit(
        latestChangedFields.length
          ? latestChangedFields
          : request.changedFields,
        'APPROVED',
        approverUsername,
        note ?? request.reason ?? null,
        approvalWorkflowRequestId,
        approvalSteps,
      );

      if (latestChangedFields.length > 0) {
        Object.assign(product, request.proposedPatch);
        await productRepo.save(product);
      }

      request.status = ProductChangeRequestStatus.APPROVED;
      request.approvedByUsername = approverUsername;
      request.approvedAt = new Date();
      request.decisionNote = note ?? null;
      request.approvalWorkflowRequestId = approvalWorkflowRequestId;
      request.fieldDecisionAudit = auditedFields;
      request.changedFields = auditedFields;
      const savedRequest = await requestRepo.save(request);

      if (latestChangedFields.length > 0) {
        await this.createProductVersion(
          product,
          auditedFields,
          request.requestedByUsername,
          approverUsername,
          request._id,
          note ?? request.reason,
          manager,
        );
      }

      return savedRequest;
    });
  }

  async rejectChangeRequest(
    requestId: string,
    dto: ProductChangeDecisionDto,
    user?: any,
  ) {
    const request = await this.productChangeRequestRepository.findOne({
      where: {
        _id: requestId,
        status: ProductChangeRequestStatus.PENDING_APPROVAL,
      },
    });
    if (!request) {
      throw new NotFoundException(
        'KhÃ´ng tÃ¬m tháº¥y yÃªu cáº§u thay Ä‘á»•i Ä‘ang chá» duyá»‡t',
      );
    }

    if (request.approvalWorkflowRequestId) {
      return this.approvalMatrixService.rejectRequest(
        request.approvalWorkflowRequestId,
        { reason: dto.reason || dto.note || 'Rejected from product admin' },
        user,
      );
    }

    return this.rejectChangeRequestFromApprovalWorkflow(
      requestId,
      null,
      this.getUsername(user),
      dto.reason || dto.note || null,
    );
  }

  async rejectChangeRequestFromApprovalWorkflow(
    requestId: string,
    approvalWorkflowRequestId: string | null,
    rejectedByUsername: string,
    reason?: string | null,
  ) {
    const request = await this.productChangeRequestRepository.findOne({
      where: {
        _id: requestId,
        status: ProductChangeRequestStatus.PENDING_APPROVAL,
      },
    });
    if (!request) {
      throw new NotFoundException(
        'Khong tim thay yeu cau thay doi dang cho duyet',
      );
    }

    const workflowRequestId =
      approvalWorkflowRequestId || request.approvalWorkflowRequestId || null;
    const workflow = workflowRequestId
      ? await this.approvalMatrixService.findRequest(workflowRequestId)
      : null;
    const approvalSteps = this.buildWorkflowStepAudit(workflow);

    request.status = ProductChangeRequestStatus.REJECTED;
    request.rejectedByUsername = rejectedByUsername;
    request.rejectedAt = new Date();
    request.decisionNote = reason || null;
    request.approvalWorkflowRequestId = workflowRequestId;
    request.fieldDecisionAudit = this.buildFieldDecisionAudit(
      request.changedFields || [],
      'REJECTED',
      rejectedByUsername,
      reason || null,
      workflowRequestId,
      approvalSteps,
    );
    request.changedFields = request.fieldDecisionAudit;
    return this.productChangeRequestRepository.save(request);
  }

  async convertUom(
    id: string,
    quantity: string | number,
    fromUom: string,
    toUom: string,
  ) {
    const product = await this.productRepository.findOneBy({ _id: id });
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
    const result = await this.productRepository.softDelete({ _id: id });
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

  async exportExcel(query: any, user?: any) {
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
            .orWhere('product.vietnameseName ILIKE :search', {
              search: `%${searchTerm}%`,
            })
            .orWhere('product.englishName ILIKE :search', {
              search: `%${searchTerm}%`,
            });
        }),
      );
    }

    Object.keys(filter).forEach((key) => {
      if (filter[key] instanceof RegExp) {
        qb.andWhere(`product.${key} ILIKE :${key}`, {
          [key]: `%${filter[key].source}%`,
        });
      } else {
        qb.andWhere(`product.${key} = :${key}`, { [key]: filter[key] });
      }
    });

    this.applyProductSort(
      qb,
      sort as Record<string, ProductSortValue> | undefined,
    );

    const results = await qb.getMany();

    const includeCost = canReadCostFields(user);
    const data = results.map((p) => ({
      SKU: p.sku,
      'Danh mục': p.category || 'Chưa phân loại',
      'Tên hàng (VN)': p.vietnameseName,
      'Tên hàng (EN)': p.englishName || 'N/A',
      'HS Code': p.hsCode || 'N/A',
      ĐVT: p.unitOfMeasure,
      ...(includeCost ? { 'Giá mua (VND)': p.purchasePriceVnd || 0 } : {}),
      'Giá bán': `${p.defaultExportPrice?.toLocaleString() || 0} ${p.exportCurrency || 'USD'}`,
      'Logistics (CBM)': p.cbmPerCarton || 0,
      'Bán chạy': p.isBestseller ? 'Yes' : 'No',
      Mới: p.isNew ? 'Yes' : 'No',
      'Nhà cung cấp': p.preferredSupplier?.name || 'N/A',
      'Trạng thái': p.isActive ? 'Đang kinh doanh' : 'Tạm ngưng',
      'Ngày cập nhật': p.updatedAt
        ? new Date(p.updatedAt).toLocaleDateString('vi-VN')
        : 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh Sách Sản Phẩm');
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 35 },
      { wch: 35 },
      { wch: 15 },
      { wch: 10 },
      { wch: 20 },
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 20 },
    ];

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async importExcel(fileBuffer: Buffer, user?: any) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);
    assertCanWriteCostFields(data, user);

    const productsToCreate = data.map((item) => ({
      sku: item['SKU'] || item['sku'],
      category: item['Danh mục'] || item['category'],
      vietnameseName: item['Tên hàng (VN)'] || item['vietnameseName'],
      englishName: item['Tên hàng (EN)'] || item['englishName'],
      hsCode: item['HS Code'] || item['hsCode'],
      unitOfMeasure: item['ĐVT'] || item['unitOfMeasure'] || 'pcs',
      defaultExportPrice: Number(
        item['Giá bán'] || item['defaultExportPrice'] || 0,
      ),
      purchasePriceVnd: Number(
        item['Giá mua (VND)'] || item['purchasePriceVnd'] || 0,
      ),
      isBestseller: item['Bán chạy'] === 'Yes',
      isNew: item['Mới'] === 'Yes',
      isActive: true,
    }));

    // Bắt đầu transaction để đảm bảo an toàn
    const results = await this.productRepository.save(productsToCreate);
    return {
      message: `Đã nhập thành công ${results.length} sản phẩm`,
      count: results.length,
    };
  }

  async reserveStock(
    id: string,
    quantity: number,
    referenceId: string,
    manager: EntityManager,
  ) {
    return this.inventoryService.reserveStock(
      id,
      quantity,
      referenceId,
      manager,
    );
  }

  async releaseStock(
    id: string,
    quantity: number,
    referenceId: string,
    manager: EntityManager,
  ) {
    return this.inventoryService.releaseStock(
      id,
      quantity,
      referenceId,
      manager,
    );
  }

  async deductStock(
    id: string,
    quantity: number,
    referenceId?: string,
    manager?: EntityManager,
    lotNumber?: string,
  ) {
    // Sử dụng InventoryService để xử lý FIFO/Lot và chốt giá vốn (COGS)
    return this.inventoryService.executeInventoryTransaction(
      id,
      -quantity, // Số âm để trừ kho
      InventoryTransactionType.SALES,
      referenceId || 'MANUAL-DEDUCT',
      0, // Unit price sẽ được FIFO tự tính
      `Xuất hàng cho đơn ${referenceId || 'thủ công'}`,
      manager,
      lotNumber,
    );
  }
  async findAllPublic(query: any, current: number, pageSize: number) {
    console.log('[ProductsService] findAllPublic query:', query);
    const curr = +current || 1;
    const pSize = +pageSize || 12;
    const skip = (curr - 1) * pSize;

    const searchTerm = query.search || query.q;
    const category = query.category;
    console.log('[ProductsService] Filter:', { searchTerm, category });

    const qb = this.productRepository.createQueryBuilder('product');

    // Show active products (handle null as active for safety if not explicitly false)
    qb.where(
      new Brackets((sqb) => {
        sqb
          .where('product.isActive = :active', { active: true })
          .orWhere('product.isActive IS NULL');
      }),
    );

    if (searchTerm) {
      qb.andWhere(
        new Brackets((sqb) => {
          sqb
            .where('product.vietnameseName ILIKE :s', { s: `%${searchTerm}%` })
            .orWhere('product.englishName ILIKE :s', { s: `%${searchTerm}%` })
            .orWhere('product.sku ILIKE :s', { s: `%${searchTerm}%` })
            .orWhere('product.category ILIKE :s', { s: `%${searchTerm}%` });
        }),
      );
    }

    if (category) {
      qb.andWhere('product.category ILIKE :category', {
        category: `%${category}%`,
      });
    }

    qb.orderBy('product.isBestseller', 'DESC')
      .addOrderBy('product.isNew', 'DESC')
      .addOrderBy('product.updatedAt', 'DESC');

    const [results, totalItems] = await qb
      .skip(skip)
      .take(pSize)
      .getManyAndCount();

    return {
      results: results.map((p) => ({
        _id: p._id,
        sku: p.sku,
        vietnameseName: p.vietnameseName,
        englishName: p.englishName,
        category: p.category,
        defaultExportPrice: p.defaultExportPrice,
        exportCurrency: p.exportCurrency,
        imageUrl: p.imageUrl,
        isBestseller: p.isBestseller,
        isNew: p.isNew,
        description: p.description,
        unitOfMeasure: p.unitOfMeasure,
      })),
      totalPages: Math.ceil(totalItems / pSize),
      totalItems,
    };
  }
}
