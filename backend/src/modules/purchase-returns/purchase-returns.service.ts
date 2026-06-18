import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import {
  PurchaseReturn,
  PurchaseReturnItem,
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
  sort?: string;
};

type ReturnedQuantityRow = {
  productId: string;
  returnedQuantity: string | number | null;
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

  private async findOneInManager(
    manager: EntityManager,
    recordId: string,
  ): Promise<PurchaseReturn> {
    const purchaseReturn = await manager.findOne(PurchaseReturn, {
      where: { _id: recordId },
      relations: ['items', 'items.product', 'purchaseOrder'],
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

      const returnNumber = `RET-${Date.now()}`;
      const purchaseReturn = manager.create(PurchaseReturn, {
        returnNumber,
        purchaseOrderId: createDto.purchaseOrderId ?? null,
        qualityCheckId: createDto.qualityCheckId ?? null,
        claimNumber: createDto.claimNumber ?? null,
        status: PurchaseReturnStatus.DRAFT,
        returnDate: this.parseReturnDate(createDto.returnDate),
        reason: createDto.reason?.trim() || null,
        createdByUsername: user.username,
      });

      const savedReturn = await manager.save(PurchaseReturn, purchaseReturn);

      const returnItems = createDto.items.map((item) =>
        manager.create(PurchaseReturnItem, {
          purchaseReturnId: savedReturn._id,
          productId: item.productId,
          quantity: Number(item.quantity),
          unit: item.unit || null,
        }),
      );
      await manager.save(PurchaseReturnItem, returnItems);

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

        const poItem = this.getSinglePoItemForProduct(
          purchaseReturn.purchaseOrder,
          item.productId,
        );
        const partnerId =
          purchaseReturn.purchaseOrder?.vendorId ||
          product.preferredSupplierId ||
          undefined;
        const unitPrice = Number(
          poItem?.unitPrice ?? product.purchasePriceVnd ?? 0,
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
    const where: FindOptionsWhere<PurchaseReturn> = {};
    if (query.status) where.status = query.status as PurchaseReturnStatus;
    if (query.purchaseOrderId) where.purchaseOrderId = query.purchaseOrderId;
    if (query.qualityCheckId) where.qualityCheckId = query.qualityCheckId;
    if (query.claimNumber) where.claimNumber = query.claimNumber;

    const normalizedCurrent = Number(current || 1);
    const normalizedPageSize = Number(pageSize || 10);
    const offset = (normalizedCurrent - 1) * normalizedPageSize;
    const order =
      query.sort === 'returnDate'
        ? { returnDate: 'ASC' as const }
        : { createdAt: 'DESC' as const };

    const [result, total] = await this.purchaseReturnRepository.findAndCount({
      where,
      take: normalizedPageSize,
      skip: offset,
      order,
      relations: ['items', 'items.product', 'purchaseOrder'],
    });

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
