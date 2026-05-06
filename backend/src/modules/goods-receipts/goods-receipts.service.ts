import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { GoodsReceipt } from './entities/goods-receipt.entity';
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-orders/entities/purchase-order-item.entity';
import { Product } from '../products/entities/product.entity';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryTransactionType } from '../inventory/entities/inventory-ledger.entity';
import type { IUser } from '../users/users.interface';

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
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private inventoryService: InventoryService,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(createGoodsReceiptDto: CreateGoodsReceiptDto, user: IUser) {
    const { items, purchaseOrderId, ...grData } = createGoodsReceiptDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
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
        receivedById: user.id || (user as any)._id,
      });

      const savedGr = await queryRunner.manager.save(gr);

      // 3. Process Items and update Stock / PO items
      for (const item of items) {
        // Create GR Item
        const grItem = queryRunner.manager.create(GoodsReceiptItem, {
          ...item,
          goodsReceiptId: savedGr.id,
        });
        await queryRunner.manager.save(grItem);

        // Update PO Item received quantity
        const poItem = await queryRunner.manager.findOne(PurchaseOrderItem, {
          where: { purchaseOrderId, productId: item.productId },
        });

        if (poItem) {
          const totalAfter = Number(poItem.receivedQuantity) + Number(item.quantityReceived);
          if (totalAfter > Number(poItem.quantity)) {
            throw new BadRequestException(
              `Sản phẩm ${item.productId} vượt quá số lượng đặt hàng. Đã nhận: ${poItem.receivedQuantity}, Đặt: ${poItem.quantity}, Yêu cầu thêm: ${item.quantityReceived}`
            );
          }
          poItem.receivedQuantity = totalAfter;
          await queryRunner.manager.save(poItem);
        }

        // Update Inventory Ledger and Product currentStock via InventoryService
        const acceptedQty = Number(item.quantityReceived) - Number(item.quantityRejected || 0);
        
        if (acceptedQty > 0) {
          const po = await queryRunner.manager.findOne(PurchaseOrder, { where: { id: purchaseOrderId } });
          await this.inventoryService.executeInventoryTransaction(
            item.productId,
            acceptedQty,
            InventoryTransactionType.GRN,
            savedGr.id,
            Number(poItem?.unitPrice || 0),
            `Nhập kho từ PO: ${po?.poNumber || purchaseOrderId} (Đã trừ ${item.quantityRejected || 0} hàng hỏng)`,
            queryRunner.manager,
            undefined, // lotNumber
            po?.vendorId,
            savedGr.grNumber,
            user.email
          );
        }
      }

      // 4. Update PO Status
      const po = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id: purchaseOrderId },
        relations: ['items'],
      });

      if (po) {
        const allReceived = po.items.every(
          (i) => Number(i.receivedQuantity) >= Number(i.quantity),
        );
        const someReceived = po.items.some((i) => Number(i.receivedQuantity) > 0);

        if (allReceived) {
          po.status = PurchaseOrderStatus.RECEIVED;
        } else if (someReceived) {
          po.status = PurchaseOrderStatus.PARTIAL_RECEIPT;
        }
        await queryRunner.manager.save(po);
      }

      await queryRunner.commitTransaction();
      
      // Emit event for accounting
      const grWithDetails = await this.findOne(savedGr.id);
      await this.eventEmitter.emitAsync('goods-receipt.created', { grn: grWithDetails });
      
      return savedGr;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query: any) {
    const { current = 1, pageSize = 10, ...filters } = query;
    
    const cleanFilters: any = {};
    // Chấp nhận cả grNumber và grnNumber (ánh xạ về grNumber)
    if (filters.grNumber) cleanFilters.grNumber = filters.grNumber;
    if (filters.grnNumber) cleanFilters.grNumber = filters.grnNumber;
    if (filters.purchaseOrderId) cleanFilters.purchaseOrderId = filters.purchaseOrderId;
    if (filters.receivedById) cleanFilters.receivedById = filters.receivedById;

    // Xử lý tìm kiếm mờ (Like) nếu giá trị là string và không phải UUID
    Object.keys(cleanFilters).forEach(key => {
      if (typeof cleanFilters[key] === 'string' && cleanFilters[key].includes('/')) {
        // Loại bỏ ký tự regex từ frontend nếu có
        const val = cleanFilters[key].replace(/\//g, '').replace(/i$/, '');
        const { Like } = require('typeorm');
        cleanFilters[key] = Like(`%${val}%`);
      }
    });

    const [results, total] = await this.grRepository.findAndCount({
      where: cleanFilters,
      relations: ['purchaseOrder', 'receivedBy', 'items', 'items.product'],
      skip: (Number(current) - 1) * Number(pageSize),
      take: Number(pageSize),
      order: { createdAt: 'DESC' }
    });

    return {
      results,
      meta: {
        current: Number(current),
        pageSize: Number(pageSize),
        pages: Math.ceil(total / pageSize),
        total: total,
      },
    };
  }

  async findOne(id: string) {
    const gr = await this.grRepository.findOne({
      where: { id },
      relations: ['items', 'items.product', 'purchaseOrder', 'receivedBy'],
    });
    if (!gr) throw new NotFoundException('Goods Receipt not found');
    return gr;
  }
}
