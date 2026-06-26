import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Repository,
} from 'typeorm';
import {
  PurchaseReturn,
  PurchaseReturnAttachment,
  PurchaseReturnItem,
  PurchaseReturnLineCondition,
  PurchaseReturnReasonCode,
  PurchaseReturnStatus,
} from './entities/purchase-return.entity';
import { Product } from '../products/entities/product.entity';
import { IUser } from '../users/users.interface';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-orders/entities/purchase-order-item.entity';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryTransactionType } from '../inventory/entities/inventory-ledger.entity';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import {
  CancelPurchaseReturnDto,
  ResolvePurchaseReturnDto,
} from './dto/purchase-return-actions.dto';
import { AccountingService } from '../accounting/accounting.service';
import {
  VendorInvoice,
  VendorInvoiceStatus,
} from '../vendor-invoices/entities/vendor-invoice.entity';

type PurchaseReturnListQuery = {
  status?: string;
  purchaseOrderId?: string;
  qualityCheckId?: string;
  claimNumber?: string;
  vendorId?: string;
  reasonCode?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sort?: string;
};

type ReturnedQuantityRow = {
  productId: string;
  returnedQuantity: string | number | null;
};

type ReturnTotals = {
  totalQuantity: number;
  totalRefundableAmount: number;
  byProduct: Map<string, number>;
};

@Injectable()
export class PurchaseReturnsService {
  constructor(
    @InjectRepository(PurchaseReturn)
    private purchaseReturnRepository: Repository<PurchaseReturn>,
    private dataSource: DataSource,
    private inventoryService: InventoryService,
    private accountingService: AccountingService,
  ) {}

  private buildWorkflowNote(
    currentNote: string | null,
    action: string,
    username: string,
    note?: string | null,
  ): string {
    const suffix = note ? `: ${note}` : '';
    const entry = `[${new Date().toISOString()}] ${action} by ${username}${suffix}`;
    return currentNote ? `${currentNote}\n${entry}` : entry;
  }

  private parseReturnDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid returnDate');
    }
    return date;
  }

  private ensureHasItems(dto: CreatePurchaseReturnDto): void {
    if (!dto.items?.length) {
      throw new BadRequestException(
        'Purchase return must have at least one item',
      );
    }
  }

  private async loadPurchaseOrderWithItems(
    manager: EntityManager,
    purchaseOrderId?: string | null,
  ): Promise<PurchaseOrder | null> {
    if (!purchaseOrderId) return null;

    const purchaseOrder = await manager.findOne(PurchaseOrder, {
      where: { _id: purchaseOrderId },
      relations: ['vendor'],
    });
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase Order not found');
    }

    purchaseOrder.items = await manager.find(PurchaseOrderItem, {
      where: { purchaseOrderId: purchaseOrder._id },
    });
    return purchaseOrder;
  }

  private getSinglePoItemForProduct(
    purchaseOrder: PurchaseOrder | null,
    productId: string,
  ): PurchaseOrderItem | null {
    if (!purchaseOrder?.items?.length) return null;

    const matches = purchaseOrder.items.filter(
      (item) => item.productId === productId,
    );
    if (matches.length === 0) {
      throw new BadRequestException(
        `Product ${productId} is not on the selected PO`,
      );
    }
    if (matches.length > 1) {
      throw new BadRequestException(
        `PO has multiple lines for product ${productId}; return from the quality exception workflow instead`,
      );
    }
    return matches[0];
  }

  private async getPriorReturnedQuantities(
    manager: EntityManager,
    purchaseOrderId: string,
    productIds: string[],
  ): Promise<Map<string, number>> {
    if (!productIds.length) {
      return new Map<string, number>();
    }

    const rows = await manager
      .getRepository(PurchaseReturnItem)
      .createQueryBuilder('item')
      .innerJoin(
        PurchaseReturn,
        'purchaseReturn',
        'purchaseReturn._id = item.purchaseReturnId',
      )
      .select('item.productId', 'productId')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'returnedQuantity')
      .where('purchaseReturn.purchaseOrderId = :purchaseOrderId', {
        purchaseOrderId,
      })
      .andWhere('purchaseReturn.status != :cancelledStatus', {
        cancelledStatus: PurchaseReturnStatus.CANCELLED,
      })
      .andWhere('item.productId IN (:...productIds)', { productIds })
      .groupBy('item.productId')
      .getRawMany<ReturnedQuantityRow>();

    return new Map(
      rows.map((row) => [row.productId, Number(row.returnedQuantity || 0)]),
    );
  }

  private async validateReturnItems(
    manager: EntityManager,
    dto: CreatePurchaseReturnDto,
    purchaseOrder: PurchaseOrder | null,
  ): Promise<void> {
    if (!purchaseOrder) {
      throw new BadRequestException(
        'Purchase return must be linked to a Purchase Order',
      );
    }

    const requestedByProductId = new Map<string, number>();

    for (const item of dto.items) {
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(
          `Quantity must be greater than 0 for product ${item.productId}`,
        );
      }

      const product = await manager.findOne(Product, {
        where: { _id: item.productId },
      });
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }

      this.getSinglePoItemForProduct(purchaseOrder, item.productId);
      requestedByProductId.set(
        item.productId,
        (requestedByProductId.get(item.productId) || 0) + quantity,
      );
    }

    const priorReturnedByProductId = await this.getPriorReturnedQuantities(
      manager,
      purchaseOrder._id,
      Array.from(requestedByProductId.keys()),
    );

    for (const [productId, requestedQuantity] of requestedByProductId) {
      const poItem = this.getSinglePoItemForProduct(purchaseOrder, productId);
      const receivedQuantity = Number(poItem?.receivedQuantity || 0);
      const priorReturnedQuantity =
        priorReturnedByProductId.get(productId) || 0;
      const remainingReturnableQuantity = Math.max(
        receivedQuantity - priorReturnedQuantity,
        0,
      );

      if (requestedQuantity > remainingReturnableQuantity) {
        throw new BadRequestException(
          `Return quantity for product ${productId} cannot exceed remaining returnable quantity (${remainingReturnableQuantity})`,
        );
      }
    }
  }

  private computeRefundTotals(
    dto: CreatePurchaseReturnDto,
    purchaseOrder: PurchaseOrder | null,
  ): ReturnTotals {
    let totalQuantity = 0;
    let totalRefundableAmount = 0;
    const byProduct = new Map<string, number>();

    for (const item of dto.items) {
      const quantity = Number(item.quantity);
      totalQuantity += quantity;

      let unitPrice = Number(item.unitPrice ?? 0);
      if (!unitPrice && purchaseOrder) {
        const poItem = this.getSinglePoItemForProduct(
          purchaseOrder,
          item.productId,
        );
        unitPrice = Number(poItem?.unitPrice ?? 0);
      }
      const lineRefund = +(unitPrice * quantity).toFixed(2);
      totalRefundableAmount += lineRefund;
      byProduct.set(
        item.productId,
        (byProduct.get(item.productId) || 0) + quantity,
      );
    }

    return {
      totalQuantity: +totalQuantity.toFixed(2),
      totalRefundableAmount: +totalRefundableAmount.toFixed(2),
      byProduct,
    };
  }

  private async findOneInManager(
    manager: EntityManager,
    recordId: string,
  ): Promise<PurchaseReturn> {
    const purchaseReturn = await manager.findOne(PurchaseReturn, {
      where: { _id: recordId },
      relations: [
        'items',
        'items.product',
        'attachments',
        'purchaseOrder',
        'purchaseOrder.vendor',
        'replacementPurchaseOrder',
      ],
    });
    if (!purchaseReturn) {
      throw new NotFoundException('Purchase return not found');
    }
    return purchaseReturn;
  }

  private async findOneForUpdate(
    manager: EntityManager,
    recordId: string,
  ): Promise<PurchaseReturn> {
    const purchaseReturn = await manager.findOne(PurchaseReturn, {
      where: { _id: recordId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!purchaseReturn) {
      throw new NotFoundException('Purchase return not found');
    }

    purchaseReturn.items = await manager.find(PurchaseReturnItem, {
      where: { purchaseReturnId: purchaseReturn._id },
      relations: ['product'],
    });
    purchaseReturn.attachments = await manager.find(PurchaseReturnAttachment, {
      where: { purchaseReturnId: purchaseReturn._id },
    });
    purchaseReturn.purchaseOrder = await this.loadPurchaseOrderWithItems(
      manager,
      purchaseReturn.purchaseOrderId,
    );
    return purchaseReturn;
  }

  private async hasActiveVendorInvoice(
    manager: EntityManager,
    purchaseOrderId?: string | null,
  ): Promise<boolean> {
    if (!purchaseOrderId) return false;

    const count = await manager
      .getRepository(VendorInvoice)
      .createQueryBuilder('invoice')
      .where('invoice."purchaseOrderId" = :purchaseOrderId', {
        purchaseOrderId,
      })
      .andWhere('invoice.status != :status', {
        status: VendorInvoiceStatus.CANCELLED,
      })
      .getCount();
    return count > 0;
  }

  /**
   * Aggregated stats used by dashboard tiles / list filters.
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<PurchaseReturnStatus, number>;
    totalRefundableAmount: number;
    pendingVendorValue: number;
    inTransitValue: number;
    byReasonCode: Record<PurchaseReturnReasonCode, number>;
  }> {
    const all = await this.purchaseReturnRepository.find({
      select: ['status', 'totalRefundableAmount', 'reasonCode'],
    });
    const byStatus = Object.values(PurchaseReturnStatus).reduce(
      (acc, s) => ({ ...acc, [s]: 0 }),
      {} as Record<PurchaseReturnStatus, number>,
    );
    const byReasonCode = Object.values(PurchaseReturnReasonCode).reduce(
      (acc, c) => ({ ...acc, [c]: 0 }),
      {} as Record<PurchaseReturnReasonCode, number>,
    );
    let totalRefundableAmount = 0;
    let pendingVendorValue = 0;
    let inTransitValue = 0;

    for (const row of all) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      if (row.reasonCode) byReasonCode[row.reasonCode] += 1;
      const amount = Number(row.totalRefundableAmount || 0);
      totalRefundableAmount += amount;
      if (row.status === PurchaseReturnStatus.PENDING_VENDOR) {
        pendingVendorValue += amount;
      }
      if (row.status === PurchaseReturnStatus.SENT) {
        inTransitValue += amount;
      }
    }

    return {
      total: all.length,
      byStatus,
      totalRefundableAmount: +totalRefundableAmount.toFixed(2),
      pendingVendorValue: +pendingVendorValue.toFixed(2),
      inTransitValue: +inTransitValue.toFixed(2),
      byReasonCode,
    };
  }

  async create(
    createDto: CreatePurchaseReturnDto,
    user: IUser,
  ): Promise<PurchaseReturn> {
    this.ensureHasItems(createDto);
    if (!createDto.purchaseOrderId) {
      throw new BadRequestException(
        'Purchase return must be linked to a Purchase Order',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const purchaseOrder = await this.loadPurchaseOrderWithItems(
        manager,
        createDto.purchaseOrderId,
      );
      await this.validateReturnItems(manager, createDto, purchaseOrder);

      const totals = this.computeRefundTotals(createDto, purchaseOrder);

      const returnNumber = `RET-${Date.now()}`;
      const purchaseReturn = manager.create(PurchaseReturn, {
        returnNumber,
        purchaseOrderId: createDto.purchaseOrderId ?? null,
        qualityCheckId: createDto.qualityCheckId ?? null,
        claimNumber: createDto.claimNumber ?? null,
        status: PurchaseReturnStatus.DRAFT,
        returnDate: this.parseReturnDate(createDto.returnDate),
        reasonCode: createDto.reasonCode ?? null,
        reason: createDto.reason?.trim() || null,
        carrierTrackingRef: createDto.carrierTrackingRef?.trim() || null,
        expectedPickupAt: createDto.expectedPickupAt
          ? new Date(createDto.expectedPickupAt)
          : null,
        currency: purchaseOrder?.currency || 'VND',
        totalRefundableAmount: totals.totalRefundableAmount,
        createdByUsername: user.username,
      });

      const savedReturn = await manager.save(PurchaseReturn, purchaseReturn);

      const returnItems: PurchaseReturnItem[] = [];
      for (const item of createDto.items) {
        const poItem = this.getSinglePoItemForProduct(
          purchaseOrder,
          item.productId,
        );
        const unitPrice = Number(
          item.unitPrice ?? poItem?.unitPrice ?? 0,
        );
        const quantity = Number(item.quantity);
        returnItems.push(
          manager.create(PurchaseReturnItem, {
            purchaseReturnId: savedReturn._id,
            productId: item.productId,
            quantity,
            unit: item.unit || poItem?.unit || null,
            unitPrice,
            lineRefundAmount: +(unitPrice * quantity).toFixed(2),
            condition:
              item.condition || PurchaseReturnLineCondition.DAMAGED,
            batchNumber: item.batchNumber?.trim() || null,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            note: item.note?.trim() || null,
          }),
        );
      }
      await manager.save(PurchaseReturnItem, returnItems);

      if (createDto.attachments?.length) {
        const attachments = createDto.attachments.map((a) =>
          manager.create(PurchaseReturnAttachment, {
            purchaseReturnId: savedReturn._id,
            fileUrl: a.fileUrl,
            fileName: a.fileName ?? null,
            mimeType: a.mimeType ?? null,
            fileSize: a.fileSize ?? null,
            category: a.category || 'EVIDENCE',
            uploadedByUsername: user.username,
          }),
        );
        await manager.save(PurchaseReturnAttachment, attachments);
      }

      return this.findOneInManager(manager, savedReturn._id);
    });
  }

  async submit(recordId: string, user: IUser): Promise<PurchaseReturn> {
    return this.dataSource.transaction(async (manager) => {
      const purchaseReturn = await this.findOneForUpdate(manager, recordId);
      if (purchaseReturn.status !== PurchaseReturnStatus.DRAFT) {
        throw new BadRequestException(
          'Only draft purchase returns can be submitted',
        );
      }
      if (!purchaseReturn.items?.length) {
        throw new BadRequestException(
          'Purchase return must have at least one item before submitting',
        );
      }
      // Each line must have a positive quantity and a known product.
      for (const item of purchaseReturn.items) {
        const qty = Number(item.quantity || 0);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new BadRequestException(
            `Item ${item.productId} has invalid quantity ${qty}`,
          );
        }
        if (!item.productId) {
          throw new BadRequestException(
            'Every line must reference a product before submitting',
          );
        }
      }

      purchaseReturn.status = PurchaseReturnStatus.PENDING_VENDOR;
      purchaseReturn.settlementNote = this.buildWorkflowNote(
        purchaseReturn.settlementNote,
        'SUBMITTED',
        user.username,
      );
      await manager.save(PurchaseReturn, purchaseReturn);
      return this.findOneInManager(manager, purchaseReturn._id);
    });
  }

  async send(recordId: string, user: IUser): Promise<PurchaseReturn> {
    return this.dataSource.transaction(async (manager) => {
      const purchaseReturn = await this.findOneForUpdate(manager, recordId);
      if (
        ![
          PurchaseReturnStatus.DRAFT,
          PurchaseReturnStatus.PENDING_VENDOR,
        ].includes(purchaseReturn.status)
      ) {
        throw new BadRequestException(
          'Only draft or pending purchase returns can be sent',
        );
      }
      if (!purchaseReturn.items?.length) {
        throw new BadRequestException('Purchase return has no items');
      }
      for (const item of purchaseReturn.items) {
        const qty = Number(item.quantity || 0);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new BadRequestException(
            `Item ${item.productId} has invalid quantity ${qty}`,
          );
        }
      }
      if (!purchaseReturn.purchaseOrder) {
        throw new BadRequestException(
          'Purchase return must be linked to a Purchase Order before sending',
        );
      }

      let inventoryValue = 0;
      for (const item of purchaseReturn.items) {
        const product =
          item.product ||
          (await manager.findOne(Product, {
            where: { _id: item.productId },
          }));
        if (!product) {
          throw new BadRequestException(`Product ${item.productId} not found`);
        }

        const partnerId =
          purchaseReturn.purchaseOrder?.vendorId ||
          product.preferredSupplierId ||
          undefined;
        // Prefer the snapshot stored at creation time so accounting matches
        // the document the user signed off on. Fall back to the live PO
        // price only for legacy rows written before this column existed.
        const lineRefund = Number(item.lineRefundAmount || 0);
        const unitPrice =
          lineRefund > 0
            ? +(lineRefund / Number(item.quantity || 1)).toFixed(4)
            : Number(
                item.unitPrice ||
                  this.getSinglePoItemForProduct(
                    purchaseReturn.purchaseOrder,
                    item.productId,
                  )?.unitPrice ||
                  product.purchasePriceVnd ||
                  0,
              );

        const ledger = await this.inventoryService.executeInventoryTransaction(
          item.productId,
          -Number(item.quantity),
          InventoryTransactionType.REJECTION,
          purchaseReturn._id,
          unitPrice,
          `Purchase return ${purchaseReturn.returnNumber}: ${purchaseReturn.reason || 'Return to vendor'}`,
          manager,
          undefined,
          partnerId,
          purchaseReturn.returnNumber,
          user.username,
          false,
          false,
        );
        inventoryValue +=
          Math.abs(Number(ledger.quantityChange)) *
          Number(ledger.unitPrice || 0);
      }

      if (inventoryValue > 0) {
        const hasInvoice = await this.hasActiveVendorInvoice(
          manager,
          purchaseReturn.purchaseOrderId,
        );
        const clearingAccount = hasInvoice ? '331' : '3388';
        const partnerId = purchaseReturn.purchaseOrder?.vendorId || undefined;
        await this.accountingService.createJournalEntry(
          {
            description: `Purchase return ${purchaseReturn.returnNumber}`,
            entryDate: new Date(),
            referenceType: 'PURCHASE_RETURN',
            referenceId: purchaseReturn._id,
            createdByUsername: user.username,
            items: [
              {
                accountCode: clearingAccount,
                debit: inventoryValue,
                credit: 0,
                partnerId,
              },
              {
                accountCode: '156',
                debit: 0,
                credit: inventoryValue,
                partnerId,
              },
            ],
          },
          manager,
        );
      }

      purchaseReturn.status = PurchaseReturnStatus.SENT;
      purchaseReturn.sentByUsername = user.username;
      purchaseReturn.sentAt = new Date();
      purchaseReturn.settlementNote = this.buildWorkflowNote(
        purchaseReturn.settlementNote,
        'SENT',
        user.username,
      );
      await manager.save(PurchaseReturn, purchaseReturn);
      return this.findOneInManager(manager, purchaseReturn._id);
    });
  }

  async resolve(
    recordId: string,
    dto: ResolvePurchaseReturnDto,
    user: IUser,
  ): Promise<PurchaseReturn> {
    return this.dataSource.transaction(async (manager) => {
      const purchaseReturn = await this.findOneForUpdate(manager, recordId);
      if (purchaseReturn.status !== PurchaseReturnStatus.SENT) {
        throw new BadRequestException(
          'Only sent purchase returns can be resolved',
        );
      }

      // Type-specific requirements for downstream audit/reporting.
      if (dto.settlementType === 'CREDITED' && !dto.creditNoteNumber) {
        throw new BadRequestException(
          'creditNoteNumber is required when settlementType is CREDITED',
        );
      }
      if (
        dto.settlementType === 'REPLACED' &&
        !dto.replacementPurchaseOrderId
      ) {
        throw new BadRequestException(
          'replacementPurchaseOrderId is required when settlementType is REPLACED',
        );
      }
      if (dto.settlementType === 'REPLACED' && dto.replacementPurchaseOrderId) {
        const replacementPo = await manager.findOne(PurchaseOrder, {
          where: { _id: dto.replacementPurchaseOrderId },
        });
        if (!replacementPo) {
          throw new NotFoundException('Replacement Purchase Order not found');
        }
        // Guard: a return cannot be replaced by the same PO it returns from.
        if (replacementPo._id === purchaseReturn.purchaseOrderId) {
          throw new BadRequestException(
            'Replacement PO must be different from the original PO',
          );
        }
        // Guard: the replacement PO must belong to the same vendor as the
        // original (otherwise the cross-vendor return has no accounting
        // story).
        if (
          purchaseReturn.purchaseOrder?.vendorId &&
          replacementPo.vendorId &&
          purchaseReturn.purchaseOrder.vendorId !== replacementPo.vendorId
        ) {
          throw new BadRequestException(
            'Replacement PO must reference the same vendor as the original PO',
          );
        }
        // Guard: do not let a single replacement PO be linked to two
        // different returns.
        const conflict = await manager.findOne(PurchaseReturn, {
          where: {
            replacementPurchaseOrderId: replacementPo._id,
            status: PurchaseReturnStatus.REPLACED,
          },
        });
        if (conflict && conflict._id !== purchaseReturn._id) {
          throw new BadRequestException(
            `Replacement PO ${replacementPo.poNumber} is already linked to return ${conflict.returnNumber}`,
          );
        }
        purchaseReturn.replacementPurchaseOrderId = replacementPo._id;
      }
      if (dto.settlementType === 'CREDITED' && dto.creditNoteNumber) {
        // Guard: credit note number must be unique across all CREDITED returns.
        const duplicate = await manager.findOne(PurchaseReturn, {
          where: {
            creditNoteNumber: dto.creditNoteNumber.trim(),
            status: PurchaseReturnStatus.CREDITED,
          },
        });
        if (duplicate && duplicate._id !== purchaseReturn._id) {
          throw new BadRequestException(
            `Credit note ${dto.creditNoteNumber} is already linked to return ${duplicate.returnNumber}`,
          );
        }
        purchaseReturn.creditNoteNumber = dto.creditNoteNumber.trim();
      }

      purchaseReturn.status = dto.settlementType as PurchaseReturnStatus;
      purchaseReturn.settlementType = dto.settlementType;
      purchaseReturn.settlementNote = this.buildWorkflowNote(
        purchaseReturn.settlementNote,
        dto.settlementType,
        user.username,
        dto.settlementNote,
      );
      purchaseReturn.resolvedByUsername = user.username;
      purchaseReturn.resolvedAt = new Date();
      await manager.save(PurchaseReturn, purchaseReturn);
      return this.findOneInManager(manager, purchaseReturn._id);
    });
  }

  async cancel(
    recordId: string,
    dto: CancelPurchaseReturnDto,
    user: IUser,
  ): Promise<PurchaseReturn> {
    return this.dataSource.transaction(async (manager) => {
      const purchaseReturn = await this.findOneForUpdate(manager, recordId);
      if (purchaseReturn.status === PurchaseReturnStatus.CANCELLED) {
        return purchaseReturn;
      }
      if (
        ![
          PurchaseReturnStatus.DRAFT,
          PurchaseReturnStatus.PENDING_VENDOR,
        ].includes(purchaseReturn.status)
      ) {
        throw new BadRequestException(
          'Sent or resolved purchase returns cannot be cancelled',
        );
      }

      purchaseReturn.status = PurchaseReturnStatus.CANCELLED;
      purchaseReturn.resolvedByUsername = user.username;
      purchaseReturn.resolvedAt = new Date();
      purchaseReturn.settlementNote = this.buildWorkflowNote(
        purchaseReturn.settlementNote,
        'CANCELLED',
        user.username,
        dto.reason,
      );
      await manager.save(PurchaseReturn, purchaseReturn);
      return this.findOneInManager(manager, purchaseReturn._id);
    });
  }

  async findAll(
    query: PurchaseReturnListQuery = {},
    current = 1,
    pageSize = 10,
  ): Promise<{
    meta: { current: number; pageSize: number; pages: number; total: number };
    results: PurchaseReturn[];
  }> {
    const baseQb = this.purchaseReturnRepository.createQueryBuilder('pr');

    if (query.status) {
      baseQb.andWhere('pr.status = :status', { status: query.status });
    }
    if (query.purchaseOrderId) {
      baseQb.andWhere('pr.purchaseOrderId = :purchaseOrderId', {
        purchaseOrderId: query.purchaseOrderId,
      });
    }
    if (query.qualityCheckId) {
      baseQb.andWhere('pr.qualityCheckId = :qualityCheckId', {
        qualityCheckId: query.qualityCheckId,
      });
    }
    if (query.claimNumber) {
      baseQb.andWhere('pr.claimNumber = :claimNumber', {
        claimNumber: query.claimNumber,
      });
    }
    if (query.vendorId) {
      baseQb.andWhere(
        'pr.purchaseOrderId IN (SELECT _id FROM purchase_orders WHERE "vendorId" = :vendorId)',
        { vendorId: query.vendorId },
      );
    }
    if (query.reasonCode) {
      baseQb.andWhere('pr.reasonCode = :reasonCode', {
        reasonCode: query.reasonCode,
      });
    }
    if (query.dateFrom) {
      baseQb.andWhere('pr.returnDate >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      baseQb.andWhere('pr.returnDate <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.search) {
      const keyword = `%${query.search.trim()}%`;
      baseQb.andWhere(
        '(pr.returnNumber ILIKE :kw OR pr.reason ILIKE :kw OR pr.claimNumber ILIKE :kw OR pr.purchaseOrderId IN (SELECT _id FROM purchase_orders WHERE "poNumber" ILIKE :kw) OR pr.purchaseOrderId IN (SELECT _id FROM purchase_orders WHERE "vendorId" IN (SELECT _id FROM partners WHERE name ILIKE :kw)))',
        { kw: keyword },
      );
    }

    // Count must be done on a SEPARATE query (no joins) to avoid
    // cartesian-product duplicates inflating the total.
    const total = await baseQb.clone().getCount();

    const normalizedCurrent = Number(current || 1);
    const normalizedPageSize = Number(pageSize || 10);
    const offset = (normalizedCurrent - 1) * normalizedPageSize;

    if (query.sort === 'returnDate') {
      baseQb.orderBy('pr.returnDate', 'ASC');
    } else if (query.sort === 'amount') {
      baseQb.orderBy('pr.totalRefundableAmount', 'DESC');
    } else {
      baseQb.orderBy('pr.createdAt', 'DESC');
    }

    // Pagination + joins on the data query. We use distinct() so the page
    // also collapses to one row per return (otherwise limit cuts mid-group).
    baseQb
      .leftJoinAndSelect('pr.purchaseOrder', 'purchaseOrder')
      .leftJoinAndSelect('purchaseOrder.vendor', 'vendor')
      .leftJoinAndSelect('pr.replacementPurchaseOrder', 'replacementPo')
      .leftJoinAndSelect('pr.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .distinct(true)
      .take(normalizedPageSize)
      .skip(offset);

    const result = await baseQb.getMany();

    return {
      meta: {
        current: normalizedCurrent,
        pageSize: normalizedPageSize,
        pages: Math.ceil(total / normalizedPageSize),
        total,
      },
      results: result,
    };
  }

  async findOne(recordId: string): Promise<PurchaseReturn> {
    return this.findOneInManager(this.dataSource.manager, recordId);
  }
}
