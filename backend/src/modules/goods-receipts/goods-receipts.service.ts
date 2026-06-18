import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  Like,
  Repository,
} from 'typeorm';
import { GoodsReceipt } from './entities/goods-receipt.entity';
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { ReverseGoodsReceiptDto } from './dto/reverse-goods-receipt.dto';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-orders/entities/purchase-order-item.entity';
import { Lot } from '../lots/entities/lot.entity';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryTransactionType } from '../inventory/entities/inventory-ledger.entity';
import type { IUser } from '../users/users.interface';
import {
  VendorInvoice,
  VendorInvoiceStatus,
} from '../vendor-invoices/entities/vendor-invoice.entity';
import { AccountingService } from '../accounting/accounting.service';

type GoodsReceiptListQuery = {
  current?: string | number;
  pageSize?: string | number;
  grNumber?: string;
  grnNumber?: string;
  purchaseOrderId?: string;
  receivedByUsername?: string;
};

@Injectable()
export class GoodsReceiptsService {
  constructor(
    @InjectRepository(GoodsReceipt)
    private grRepository: Repository<GoodsReceipt>,
    @InjectRepository(GoodsReceiptItem)
    private grItemRepository: Repository<GoodsReceiptItem>,
    @InjectRepository(PurchaseOrder)
    private poRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private poItemRepository: Repository<PurchaseOrderItem>,
    private inventoryService: InventoryService,
    private accountingService: AccountingService,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {}

  private resolvePurchaseOrderItemForReceiptLine(
    poItems: PurchaseOrderItem[],
    productId: string,
    purchaseOrderItem_id?: string | null,
  ) {
    if (purchaseOrderItem_id) {
      const poItem = poItems.find((item) => item._id === purchaseOrderItem_id);
      if (!poItem) {
        throw new BadRequestException(
          `Dong PO ${purchaseOrderItem_id} khong thuoc PO nay`,
        );
      }
      if (poItem.productId !== productId) {
        throw new BadRequestException(
          `Product tren GRN line khong khop dong PO ${purchaseOrderItem_id}`,
        );
      }
      return poItem;
    }

    const candidates = poItems.filter((item) => item.productId === productId);
    if (candidates.length === 0) {
      throw new BadRequestException(`San pham ${productId} khong co trong PO`);
    }
    if (candidates.length > 1) {
      throw new BadRequestException(
        `PO co nhieu dong cho san pham ${productId}; can truyen purchaseOrderItem_id de nhap kho dung dong`,
      );
    }
    return candidates[0];
  }

  private async findPurchaseOrderForReceipt(
    manager: EntityManager,
    purchaseOrderId: string,
  ): Promise<PurchaseOrder> {
    const po = await manager.findOne(PurchaseOrder, {
      where: { _id: purchaseOrderId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!po) throw new NotFoundException('Purchase Order not found');

    // PostgreSQL does not allow FOR UPDATE on the nullable side of a LEFT JOIN.
    // Lock the PO header first, then lock its lines separately in the same transaction.
    po.items = await manager
      .getRepository(PurchaseOrderItem)
      .createQueryBuilder('item')
      .where('item."purchaseOrderId" = :purchaseOrderId', { purchaseOrderId })
      .setLock('pessimistic_write')
      .getMany();

    return po;
  }

  private applyPurchaseOrderReceiptStatus(po: PurchaseOrder): void {
    const allReceived = po.items.every(
      (item) =>
        Number(item.receivedQuantity || 0) >= Number(item.quantity || 0),
    );
    const someReceived = po.items.some(
      (item) => Number(item.receivedQuantity || 0) > 0,
    );

    if (allReceived) {
      po.status = PurchaseOrderStatus.RECEIVED;
      return;
    }
    if (someReceived) {
      po.status = PurchaseOrderStatus.PARTIAL_RECEIPT;
      return;
    }
    if (
      [
        PurchaseOrderStatus.RECEIVED,
        PurchaseOrderStatus.PARTIAL_RECEIPT,
      ].includes(po.status)
    ) {
      po.status = PurchaseOrderStatus.SENT;
    }
  }

  private appendReceiptNote(
    currentNote: string | null,
    action: string,
    username: string,
    reason: string,
  ): string {
    const entry = `[${new Date().toISOString()}] ${action} by ${username}: ${reason}`;
    return currentNote ? `${currentNote}\n${entry}` : entry;
  }

  private async assertNoActiveVendorInvoice(
    manager: EntityManager,
    purchaseOrderId: string,
  ): Promise<void> {
    const activeInvoiceCount = await manager
      .getRepository(VendorInvoice)
      .createQueryBuilder('invoice')
      .where('invoice."purchaseOrderId" = :purchaseOrderId', {
        purchaseOrderId,
      })
      .andWhere('invoice.status != :status', {
        status: VendorInvoiceStatus.CANCELLED,
      })
      .getCount();

    if (activeInvoiceCount > 0) {
      throw new BadRequestException(
        'PO already has an active vendor invoice; cancel/credit the invoice before reversing GRN',
      );
    }
  }

  private async findReceiptInManager(
    manager: EntityManager,
    recordId: string,
  ): Promise<GoodsReceipt> {
    const gr = await manager.findOne(GoodsReceipt, {
      where: { _id: recordId },
      relations: [
        'items',
        'items.product',
        'items.purchaseOrderItem',
        'purchaseOrder',
        'purchaseOrder.vendor',
        'receivedBy',
      ],
    });
    if (!gr) throw new NotFoundException('Goods Receipt not found');
    return gr;
  }

  async create(createGoodsReceiptDto: CreateGoodsReceiptDto, user: IUser) {
    const { items, purchaseOrderId, ...grData } = createGoodsReceiptDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const po = await this.findPurchaseOrderForReceipt(
        queryRunner.manager,
        purchaseOrderId,
      );

      if (
        ![
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.SENT,
          PurchaseOrderStatus.PARTIAL_RECEIPT,
        ].includes(po.status)
      ) {
        throw new BadRequestException(
          'Chi duoc nhap kho cho PO da duyet/gui NCC va chua hoan tat',
        );
      }

      // 1. Generate GR Number (GR-YYYYMMDD-XXXX)
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const count = await queryRunner.manager.count(GoodsReceipt);
      const grNumber = `GR-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

      // 2. Create Goods Receipt
      const gr = queryRunner.manager.create(GoodsReceipt, {
        ...grData,
        grNumber,
        purchaseOrderId,
        receivedByUsername: user.username,
      });

      const savedGr = await queryRunner.manager.save(gr);

      // 3. Process Items and update Stock / PO items
      for (const item of items) {
        const poItem = this.resolvePurchaseOrderItemForReceiptLine(
          po.items,
          item.productId,
          item.purchaseOrderItem_id,
        );

        if (
          Number(item.quantityRejected || 0) >
          Number(item.quantityReceived || 0)
        ) {
          throw new BadRequestException(
            `Rejected quantity cannot exceed received quantity for product ${item.productId}`,
          );
        }

        // Create GR Item
        const grItem = queryRunner.manager.create(GoodsReceiptItem, {
          ...item,
          quantityOrdered: Number(poItem.quantity),
          purchaseOrderItem_id: poItem._id,
          qualityStatus: item.qualityStatus || 'PASS',
          goodsReceiptId: savedGr._id,
        });
        await queryRunner.manager.save(grItem);

        const acceptedQty =
          Number(item.quantityReceived) - Number(item.quantityRejected || 0);

        // Only accepted quantity can fulfill PO. Rejected quantity remains in
        // QC/quarantine and is handled through claim/backorder workflow.
        // Update PO Item received quantity
        const totalAfter = Number(poItem.receivedQuantity) + acceptedQty;
        if (totalAfter > Number(poItem.quantity)) {
          throw new BadRequestException(
            `Sản phẩm ${item.productId} vượt quá số lượng đặt hàng. Đã nhận: ${poItem.receivedQuantity}, Đặt: ${poItem.quantity}, Yêu cầu thêm: ${item.quantityReceived}`,
          );
        }
        poItem.receivedQuantity = totalAfter;
        poItem.rejectedQuantity =
          Number(poItem.rejectedQuantity || 0) +
          Number(item.quantityRejected || 0);
        poItem.backorderQuantity = Math.max(
          Number(poItem.quantity) - totalAfter,
          Number(poItem.rejectedQuantity || 0),
        );
        await queryRunner.manager.save(poItem);

        // Update Inventory Ledger and Product currentStock via InventoryService
        if (acceptedQty > 0) {
          const lotNumber = item.lotNumber?.trim() || undefined;

          if (lotNumber) {
            const lotRepo = queryRunner.manager.getRepository(Lot);
            const existingLot = await lotRepo.findOne({ where: { lotNumber } });

            if (!existingLot) {
              await lotRepo.save(
                lotRepo.create({
                  lotNumber,
                  productId: item.productId,
                  supplierId: po?.vendorId,
                  unitPrice: Number(poItem?.unitPrice || 0),
                  initialQuantity: 0,
                  currentQuantity: 0,
                  notes: `Auto-created from goods receipt ${savedGr.grNumber}`,
                }),
              );
            }
          }

          const qualityNote =
            item.qualityStatus && item.qualityStatus !== 'PASS'
              ? ` Quality: ${item.qualityStatus}.`
              : '';
          const lineNote = item.lineNote ? ` Note: ${item.lineNote}.` : '';
          const locationNote = grData.warehouseLocation
            ? ` Location: ${grData.warehouseLocation}.`
            : '';

          await this.inventoryService.executeInventoryTransaction(
            item.productId,
            acceptedQty,
            InventoryTransactionType.GRN,
            savedGr._id,
            Number(poItem?.unitPrice || 0),
            `Nhập kho từ PO: ${po?.poNumber || purchaseOrderId} (đã trừ ${item.quantityRejected || 0} hàng không đạt).${qualityNote}${lineNote}${locationNote}`,
            queryRunner.manager,
            lotNumber,
            po?.vendorId,
            savedGr.grNumber,
            user.username,
          );
        }
      }

      // 4. Update PO Status
      const refreshedPo = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { _id: purchaseOrderId },
        relations: ['items'],
      });

      if (refreshedPo) {
        this.applyPurchaseOrderReceiptStatus(refreshedPo);
        await queryRunner.manager.save(refreshedPo);
      }

      await queryRunner.commitTransaction();

      // Emit event for accounting
      const grWithDetails = await this.findOne(savedGr._id);
      await this.eventEmitter.emitAsync('goods-receipt.created', {
        grn: grWithDetails,
      });

      return savedGr;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      const message =
        err instanceof Error ? err.message : 'Failed to create goods receipt';
      throw new BadRequestException(message);
    } finally {
      await queryRunner.release();
    }
  }

  async reverse(
    recordId: string,
    dto: ReverseGoodsReceiptDto,
    user: IUser,
  ): Promise<GoodsReceipt> {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Reverse reason is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const gr = await manager.findOne(GoodsReceipt, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!gr) throw new NotFoundException('Goods Receipt not found');
      if (gr.status === 'CANCELLED') {
        return this.findReceiptInManager(manager, gr._id);
      }
      if (gr.status !== 'COMPLETED') {
        throw new BadRequestException('Only completed GRNs can be reversed');
      }
      if (!gr.purchaseOrderId) {
        throw new BadRequestException('GRN is not linked to a Purchase Order');
      }

      await this.assertNoActiveVendorInvoice(manager, gr.purchaseOrderId);

      const po = await this.findPurchaseOrderForReceipt(
        manager,
        gr.purchaseOrderId,
      );
      const items = await manager.find(GoodsReceiptItem, {
        where: { goodsReceiptId: gr._id },
        relations: ['purchaseOrderItem', 'product'],
      });
      if (!items.length) {
        throw new BadRequestException('GRN has no items to reverse');
      }

      let reversedInventoryValue = 0;
      for (const item of items) {
        const acceptedQty =
          Number(item.quantityReceived || 0) -
          Number(item.quantityRejected || 0);
        const rejectedQty = Number(item.quantityRejected || 0);
        const poItem = this.resolvePurchaseOrderItemForReceiptLine(
          po.items,
          item.productId,
          item.purchaseOrderItem_id,
        );

        poItem.receivedQuantity = Math.max(
          0,
          Number(poItem.receivedQuantity || 0) - Math.max(acceptedQty, 0),
        );
        poItem.rejectedQuantity = Math.max(
          0,
          Number(poItem.rejectedQuantity || 0) - rejectedQty,
        );
        poItem.backorderQuantity = Math.max(
          Number(poItem.quantity || 0) - Number(poItem.receivedQuantity || 0),
          Number(poItem.rejectedQuantity || 0),
        );
        await manager.save(PurchaseOrderItem, poItem);

        if (acceptedQty > 0) {
          const ledger =
            await this.inventoryService.executeInventoryTransaction(
              item.productId,
              -acceptedQty,
              InventoryTransactionType.ADJUSTMENT,
              gr._id,
              Number(poItem.unitPrice || 0),
              `Reverse GRN ${gr.grNumber}: ${reason}`,
              manager,
              item.lotNumber || undefined,
              po.vendorId,
              gr.grNumber,
              user.username,
              false,
              false,
            );
          reversedInventoryValue +=
            Math.abs(Number(ledger.quantityChange || 0)) *
            Number(ledger.unitPrice || 0);
        }
      }

      this.applyPurchaseOrderReceiptStatus(po);
      await manager.save(PurchaseOrder, po);

      if (reversedInventoryValue > 0) {
        await this.accountingService.createJournalEntry(
          {
            description: `Reverse GRN ${gr.grNumber}`,
            entryDate: new Date(),
            referenceType: 'GOODS_RECEIPT_REVERSAL',
            referenceId: gr._id,
            createdByUsername: user.username,
            items: [
              {
                accountCode: '3388',
                debit: reversedInventoryValue,
                credit: 0,
                partnerId: po.vendorId,
              },
              {
                accountCode: '156',
                debit: 0,
                credit: reversedInventoryValue,
                partnerId: po.vendorId,
              },
            ],
          },
          manager,
        );
      }

      gr.status = 'CANCELLED';
      gr.note = this.appendReceiptNote(
        gr.note,
        'REVERSED',
        user.username,
        reason,
      );
      await manager.save(GoodsReceipt, gr);
      return this.findReceiptInManager(manager, gr._id);
    });
  }

  async findAll(query: GoodsReceiptListQuery) {
    const { current = 1, pageSize = 10, ...filters } = query;

    const cleanFilters: FindOptionsWhere<GoodsReceipt> = {};
    // Chấp nhận cả grNumber và grnNumber (ánh xạ về grNumber)
    if (filters.grNumber) cleanFilters.grNumber = filters.grNumber;
    if (filters.grnNumber) cleanFilters.grNumber = filters.grnNumber;
    if (filters.purchaseOrderId)
      cleanFilters.purchaseOrderId = filters.purchaseOrderId;
    if (filters.receivedByUsername)
      cleanFilters.receivedByUsername = filters.receivedByUsername;

    // Xử lý tìm kiếm mờ (Like) nếu giá trị là string và không phải UUID
    if (
      typeof cleanFilters.grNumber === 'string' &&
      cleanFilters.grNumber.includes('/')
    ) {
      const value = cleanFilters.grNumber.replace(/\//g, '').replace(/i$/, '');
      cleanFilters.grNumber = Like(`%${value}%`);
    }

    const [results, total] = await this.grRepository.findAndCount({
      where: cleanFilters,
      relations: [
        'purchaseOrder',
        'purchaseOrder.vendor',
        'receivedBy',
        'items',
        'items.product',
        'items.purchaseOrderItem',
      ],
      skip: (Number(current) - 1) * Number(pageSize),
      take: Number(pageSize),
      order: { createdAt: 'DESC' },
    });

    return {
      results,
      meta: {
        current: Number(current),
        pageSize: Number(pageSize),
        pages: Math.ceil(total / Number(pageSize)),
        total: total,
      },
    };
  }

  async findOne(goodsReceiptRef: string) {
    return this.findReceiptInManager(this.dataSource.manager, goodsReceiptRef);
  }
}
