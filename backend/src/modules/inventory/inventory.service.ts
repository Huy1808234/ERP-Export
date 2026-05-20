import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager, In, SelectQueryBuilder } from 'typeorm';
import { createHash } from 'crypto';
import { Product } from '../products/entities/product.entity';
import { InventoryLedger, InventoryTransactionType } from './entities/inventory-ledger.entity';
import { CustomerReturn, CustomerReturnItem, CustomerReturnStatus } from './entities/customer-return.entity';
import { Partner, PartnerType } from '../partners/entities/partner.entity';
import { Shipment, ShipmentStatus } from '../shipments/entities/shipment.entity';
import { SalesContract } from '../sales-contracts/entities/sales-contract.entity';
import { AccountingService } from '../accounting/accounting.service';
import { LotsService } from '../lots/lots.service';
import {
  InventoryCount,
  InventoryCountItem,
  InventoryCountStatus,
} from './entities/inventory-count.entity';
import {
  ApproveInventoryCountDto,
  CreateInventoryCountDto,
  InventoryCountLineDto,
  SubmitInventoryCountDto,
} from './dto/create-inventory-count.dto';
import { createOpaqueCode } from '@/common/ids/entity-id.util';
import {
  CreateCustomerReturnDto,
  CustomerReturnDecisionDto,
} from './dto/create-customer-return.dto';
import {
  ExportDelivery,
  ExportDeliveryAuditEvent,
  ExportDeliveryItem,
  ExportDeliveryStatus,
} from './entities/export-delivery.entity';
import {
  InventoryAdjustment,
  InventoryAdjustmentAuditEvent,
  InventoryAdjustmentValuationSnapshot,
  InventoryAdjustmentStatus,
} from './entities/inventory-adjustment.entity';
import { InventoryPeriodSnapshot } from './entities/inventory-period-snapshot.entity';
import { ApprovalMatrixService } from '../approval-matrix/approval-matrix.service';
import { ApprovalDocumentType } from '../approval-matrix/entities/approval-rule.entity';
import {
  CancelExportDeliveryDto,
  CreateExportDeliveryFromShipmentDto,
  IssueExportDeliveryDto,
} from './dto/create-export-delivery.dto';
import { CreateInventoryPeriodSnapshotDto } from './dto/create-period-snapshot.dto';

type InventoryValuationMethod = 'FIFO' | 'AVG';
type InventorySortDirection = 'ASC' | 'DESC';

const AUDIT_TRAIL_SORT_COLUMNS: Record<string, string> = {
  createdAt: 'ledger.createdAt',
  productSku: 'product.sku',
  productName: 'product.vietnameseName',
  lotNumber: 'ledger.lotNumber',
  transactionType: 'ledger.transactionType',
  referenceNumber: 'ledger.referenceNumber',
  quantityChange: 'ledger.quantityChange',
  balanceAfter: 'ledger.balanceAfter',
};

@Injectable()
export class InventoryService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(InventoryLedger)
    private ledgerRepository: Repository<InventoryLedger>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(InventoryCount)
    private countRepository: Repository<InventoryCount>,
    @InjectRepository(CustomerReturn)
    private customerReturnRepository: Repository<CustomerReturn>,
    @InjectRepository(CustomerReturnItem)
    private customerReturnItemRepository: Repository<CustomerReturnItem>,
    @InjectRepository(ExportDelivery)
    private exportDeliveryRepository: Repository<ExportDelivery>,
    @InjectRepository(InventoryAdjustment)
    private adjustmentRepository: Repository<InventoryAdjustment>,
    @InjectRepository(InventoryPeriodSnapshot)
    private periodSnapshotRepository: Repository<InventoryPeriodSnapshot>,
    private accountingService: AccountingService,
    private lotsService: LotsService,
    private approvalMatrixService: ApprovalMatrixService,
  ) {}

  private createCountNumber(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const suffix = createOpaqueCode('ic').split('_').pop()?.toUpperCase();
    return `IC-${yyyy}${mm}${dd}-${suffix}`;
  }

  private applyAuditTrailSort(
    qb: SelectQueryBuilder<InventoryLedger>,
    sort: unknown,
  ): void {
    const rawSort = typeof sort === 'string' && sort.trim() ? sort.trim() : '-createdAt';
    const direction: InventorySortDirection = rawSort.startsWith('-') ? 'DESC' : 'ASC';
    const field = rawSort.replace(/^-/, '');
    const column = AUDIT_TRAIL_SORT_COLUMNS[field] || AUDIT_TRAIL_SORT_COLUMNS.createdAt;

    qb.orderBy(column, direction);

    if (field !== 'createdAt') {
      qb.addOrderBy('ledger.createdAt', 'DESC');
    }
  }

  private createReturnNumber(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const suffix = createOpaqueCode('cr').split('_').pop()?.toUpperCase();
    return `CR-${yyyy}${mm}${dd}-${suffix}`;
  }

  private createExportDeliveryNumber(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const suffix = createOpaqueCode('exdel').split('_').pop()?.toUpperCase();
    return `ED-${yyyy}${mm}${dd}-${suffix}`;
  }

  private createAdjustmentNumber(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const suffix = createOpaqueCode('adj').split('_').pop()?.toUpperCase();
    return `ADJ-${yyyy}${mm}${dd}-${suffix}`;
  }

  private createPeriodSnapshotNumber(periodKey: string, date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const suffix = createOpaqueCode('inv_snap').split('_').pop()?.toUpperCase();
    return `INV-SNAP-${periodKey}-${yyyy}${mm}${dd}-${suffix}`;
  }

  private getActorUsername(user: any) {
    return user?.username || user?.name || 'system';
  }

  private getActorRoleName(user: any) {
    const role = typeof user?.role === 'string' ? user.role : user?.role?.name;
    return String(role || '').toUpperCase();
  }

  private appendExportDeliveryAudit(
    delivery: ExportDelivery,
    eventType: ExportDeliveryAuditEvent['eventType'],
    actorUsername: string,
    note?: string | null,
    metadata?: Record<string, unknown>,
  ) {
    const auditTrail = Array.isArray(delivery.auditTrail) ? [...delivery.auditTrail] : [];
    auditTrail.push({
      eventType,
      actorUsername,
      occurredAt: new Date().toISOString(),
      note: note || null,
      metadata,
    });
    delivery.auditTrail = auditTrail;
  }

  private appendAdjustmentAudit(
    adjustment: InventoryAdjustment,
    eventType: InventoryAdjustmentAuditEvent['eventType'],
    actorUsername: string,
    note?: string | null,
    metadata?: Record<string, unknown>,
  ) {
    const auditTrail = Array.isArray(adjustment.auditTrail) ? [...adjustment.auditTrail] : [];
    auditTrail.push({
      eventType,
      actorUsername,
      occurredAt: new Date().toISOString(),
      note: note || null,
      metadata,
    });
    adjustment.auditTrail = auditTrail;
  }

  private async buildAdjustmentValuationSnapshot(
    manager: EntityManager,
    product: Product,
    quantityDelta: number,
    unitCost: number,
  ): Promise<InventoryAdjustmentValuationSnapshot> {
    const costMap = await this.getRemainingCostMap(manager, [product._id]);
    const remainingCost = costMap.get(product._id);
    const stockBefore = Number(product.currentStock || 0);
    const reservedBefore = Number(product.reservedStock || 0);
    const stockValueBefore = Number(remainingCost?.stockValue || 0);
    const fallbackValueBefore = stockBefore * Number(unitCost || product.purchasePriceVnd || 0);
    const resolvedStockValueBefore = stockValueBefore > 0 ? stockValueBefore : fallbackValueBefore;
    const stockAfter = stockBefore + Number(quantityDelta || 0);

    return {
      productId: product._id,
      capturedAt: new Date().toISOString(),
      stockBefore,
      reservedBefore,
      quantityDelta: Number(quantityDelta || 0),
      unitCost: Number(unitCost || 0),
      stockValueBefore: resolvedStockValueBefore,
      stockAfter,
      stockValueAfter: resolvedStockValueBefore + Number(quantityDelta || 0) * Number(unitCost || 0),
      valuationMethod: 'FIFO',
    };
  }

  private async findInventoryCountForUpdate(
    manager: EntityManager,
    recordId: string,
    withProduct = false,
  ) {
    const count = await manager.findOne(InventoryCount, {
      where: { _id: recordId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!count) {
      throw new NotFoundException('Inventory count not found');
    }

    // PostgreSQL does not allow FOR UPDATE on the nullable side of a LEFT JOIN.
    // Lock the count header first, then load its lines in the same transaction.
    count.items = await manager.find(InventoryCountItem, {
      where: { countId: recordId },
      relations: withProduct ? ['product'] : [],
    });

    return count;
  }

  private async getRemainingCostMap(manager: EntityManager, productIds: string[]) {
    if (!productIds.length) return new Map<string, { remainingQuantity: number; stockValue: number }>();

    const rows = await manager
      .createQueryBuilder(InventoryLedger, 'ledger')
      .select('ledger.productId', 'productId')
      .addSelect('COALESCE(SUM(ledger.remainingQuantity), 0)', 'remainingQuantity')
      .addSelect('COALESCE(SUM(ledger.remainingQuantity * ledger.unitPrice), 0)', 'stockValue')
      .where('ledger.productId IN (:...productIds)', { productIds })
      .andWhere('ledger.remainingQuantity > 0')
      .groupBy('ledger.productId')
      .getRawMany();

    return new Map(
      rows.map((row) => [
        row.productId,
        {
          remainingQuantity: Number(row.remainingQuantity || 0),
          stockValue: Number(row.stockValue || 0),
        },
      ]),
    );
  }

  private buildCountItem(
    product: Product,
    countedQuantity: number,
    unitCost: number,
    note?: string,
  ) {
    const systemQuantity = Number(product.currentStock || 0);
    const varianceQuantity = Number(countedQuantity || 0) - systemQuantity;

    return {
      productId: product._id,
      systemQuantity,
      countedQuantity: Number(countedQuantity || 0),
      varianceQuantity,
      unitCost,
      varianceValue: varianceQuantity * unitCost,
      note: note || null,
    };
  }

  private async resolveCountSnapshotItems(
    manager: EntityManager,
    lines?: InventoryCountLineDto[],
  ) {
    let products: Product[] = [];
    const lineByProduct = new Map<string, InventoryCountLineDto>();

    if (lines?.length) {
      for (const line of lines) {
        lineByProduct.set(line.productId, line);
      }

      products = await manager.find(Product, {
        where: { _id: In([...lineByProduct.keys()]) },
        order: { sku: 'ASC' },
      });

      if (products.length !== lineByProduct.size) {
        throw new BadRequestException('Một hoặc nhiều sản phẩm kiểm kê không tồn tại');
      }
    } else {
      products = await manager.find(Product, {
        where: { isActive: true },
        order: { sku: 'ASC' },
      });
    }

    if (!products.length) {
      throw new BadRequestException('Không có sản phẩm để tạo phiếu kiểm kê');
    }

    const costMap = await this.getRemainingCostMap(manager, products.map((product) => product._id));

    return products.map((product) => {
      const line = lineByProduct.get(product._id);
      const remainingCost = costMap.get(product._id);
      const fallbackCost = Number(product.purchasePriceVnd || 0);
      const unitCost = remainingCost?.remainingQuantity
        ? Number(remainingCost.stockValue) / Number(remainingCost.remainingQuantity)
        : fallbackCost;

      return this.buildCountItem(
        product,
        line ? Number(line.countedQuantity) : Number(product.currentStock || 0),
        unitCost,
        line?.note,
      );
    });
  }

  /**
   * Cốt lõi của Kho: Cập nhật tồn kho an toàn tuyệt đối với Pessimistic Write Lock.
   * Chống Race Condition khi 2 request xuất kho cùng lúc.
   */
  async executeInventoryTransaction(
    productId: string,
    quantityChange: number,
    transactionType: InventoryTransactionType,
    referenceId: string,
    unitPrice: number = 0,
    notes?: string,
    transactionManager?: EntityManager,
    lotNumber?: string,
    partnerId?: string,
    referenceNumber?: string,
    createdBy?: string,
    isQuarantine = false,
  ): Promise<InventoryLedger> {
    const runInTransaction = async (manager: EntityManager) => {
      // 1. Pessimistic Write Lock: Khóa dòng Product này lại, các request khác phải chờ
      const product = await manager.findOne(Product, {
        where: { _id: productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) {
        throw new BadRequestException(`Product ${productId} not found`);
      }

      const newStock = Number(product.currentStock) + quantityChange;

      // 2. Business Logic: Không cho phép tồn kho âm
      if (newStock < 0) {
        throw new BadRequestException(
          `Tồn kho không đủ cho sản phẩm ${product.sku}. Hiện tại: ${product.currentStock}, Yêu cầu: ${Math.abs(quantityChange)}`
        );
      }

      // 3. FIFO Logic: Bóc tách lô hàng (Cost-Picking)
      let calculatedUnitPrice = unitPrice;
      
      if (quantityChange > 0) {
        // Nhập kho: Đây là một lô mới
        // remainingQuantity được set bằng quantityChange
      } else if (quantityChange < 0) {
        // Xuất kho: Cần tìm lô để trừ
        let neededQty = Math.abs(quantityChange);
        let totalCost = 0;

        // TypeORM logic fix: use Raw or MoreThan
        const batches = await manager.createQueryBuilder(InventoryLedger, 'ledger')
          .where('ledger.productId = :productId', { productId })
          .andWhere('ledger.remainingQuantity > 0')
          .orderBy('ledger.createdAt', 'ASC')
          .setLock('pessimistic_write')
          .getMany();

        for (const batch of batches) {
          if (neededQty <= 0) break;

          const consumeQty = Math.min(batch.remainingQuantity, neededQty);
          batch.remainingQuantity = Number(batch.remainingQuantity) - consumeQty;
          totalCost += consumeQty * Number(batch.unitPrice);
          neededQty -= consumeQty;

          await manager.save(batch);
        }

        if (neededQty > 0) {
          // Trường hợp hi hữu: Tổng remainingQuantity không khớp với currentStock
          // Có thể do dữ liệu cũ chưa có FIFO. Ta lấy giá hiện tại của sản phẩm.
          totalCost += neededQty * unitPrice;
        }

        calculatedUnitPrice = totalCost / Math.abs(quantityChange);
      }

      // 4. Cập nhật tồn kho
      product.currentStock = newStock;
      await manager.save(product);

      // 5. Ghi Sổ cái (Ledger) để làm Audit Trail
      const ledgerEntry = manager.create(InventoryLedger, {
        productId,
        transactionType,
        quantityChange,
        unitPrice: calculatedUnitPrice,
        balanceAfter: newStock,
        remainingQuantity: quantityChange > 0 ? quantityChange : 0,
        lotNumber: lotNumber || (quantityChange > 0 ? `LOT-${Date.now()}` : undefined),
        referenceId,
        partnerId,
        referenceNumber,
        createdBy,
        isQuarantine,
        notes,
      });

      const savedLedger = await manager.save(ledgerEntry);

      // 6. AUTO-POSTING TO ACCOUNTING (Mục tiêu: Đạt chuẩn Senior ERP)
      const totalValue = Math.abs(quantityChange) * calculatedUnitPrice;
      if (totalValue > 0) {
        const journalItems: { accountCode: string; debit: number; credit: number; partnerId?: string }[] = [];
        if (quantityChange > 0) {
          if (transactionType === InventoryTransactionType.RETURN) {
            // Customer returns reverse COGS; they are not supplier receipts or provisional AP.
            journalItems.push({ accountCode: '156', debit: totalValue, credit: 0 });
            journalItems.push({ accountCode: '632', debit: 0, credit: totalValue, partnerId });
          } else {
            // Nhập kho: Nợ 156 (Hàng hóa), Có 3388 (Hàng mua chưa có hóa đơn - provisional)
            journalItems.push({ accountCode: '156', debit: totalValue, credit: 0 });
            journalItems.push({ accountCode: '3388', debit: 0, credit: totalValue, partnerId });
          }
        } else {
          // Xuất kho: Nợ 632 (Giá vốn), Có 156 (Hàng hóa)
          journalItems.push({ accountCode: '632', debit: totalValue, credit: 0 });
          journalItems.push({ accountCode: '156', debit: 0, credit: totalValue, partnerId });
        }

        await this.accountingService.createJournalEntry({
          description: `Auto-post from Inventory: ${transactionType} - ${product.sku} (${quantityChange})`,
          referenceType: 'INVENTORY_LEDGER',
          referenceId: savedLedger._id,
          entryDate: new Date(),
          items: journalItems,
        }, manager);
      }

      // 7. UPDATE LOT QUANTITY (Mục tiêu: Đạt chuẩn Module 10)
      if (lotNumber) {
        await this.lotsService.updateQuantity(lotNumber, quantityChange, manager);
      }

      return savedLedger;
    };

    if (transactionManager) {
      return runInTransaction(transactionManager);
    } else {
      return this.dataSource.transaction(runInTransaction);
    }
  }

  /**
   * Giữ hàng (Reservation) khi chốt Sales Contract
   */
  async reserveStock(productId: string, reserveQty: number, referenceId: string, manager: EntityManager) {
    const product = await manager.findOne(Product, {
      where: { _id: productId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!product) throw new BadRequestException(`Product not found`);

    const availableQty = Number(product.currentStock) - Number(product.reservedStock);
    if (availableQty < reserveQty) {
      throw new BadRequestException(
        `Không đủ hàng khả dụng (Available Qty) để giữ chỗ. Khả dụng: ${availableQty}, Yêu cầu giữ: ${reserveQty}`
      );
    }

    product.reservedStock = Number(product.reservedStock) + reserveQty;
    await manager.save(product);
    
    // Ghi log reserve
    const ledgerEntry = manager.create(InventoryLedger, {
      productId,
      transactionType: InventoryTransactionType.RESERVE,
      quantityChange: 0,
      balanceAfter: product.currentStock,
      referenceId,
      notes: `Reserved ${reserveQty} for Contract`,
    });
    await manager.save(ledgerEntry);
  }

  /**
   * Giải phóng hàng (Release) khi hủy PI/Contract
   */
  async releaseStock(productId: string, releaseQty: number, referenceId: string, manager: EntityManager) {
    const product = await manager.findOne(Product, {
      where: { _id: productId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!product) throw new BadRequestException(`Product not found`);

    product.reservedStock = Math.max(0, Number(product.reservedStock) - releaseQty);
    await manager.save(product);
    
    // Ghi log release
    const ledgerEntry = manager.create(InventoryLedger, {
      productId,
      transactionType: InventoryTransactionType.RELEASE,
      quantityChange: 0,
      balanceAfter: product.currentStock,
      referenceId,
      notes: `Released ${releaseQty} from Contract`,
    });
    await manager.save(ledgerEntry);
  }

  private async loadShipmentForExportDelivery(
    manager: EntityManager,
    shipmentRef: string,
  ) {
    const shipment = await manager.findOne(Shipment, {
      where: { _id: shipmentRef },
      relations: [
        'salesContract',
        'salesContract.items',
        'salesContract.items.product',
      ],
      lock: { mode: 'pessimistic_write' },
    });

    if (!shipment) throw new NotFoundException('Shipment not found');
    if (!shipment.salesContract || !shipment.salesContract.items?.length) {
      throw new BadRequestException('Shipment has no Sales Contract lines for export delivery');
    }

    return shipment;
  }

  private async findActiveExportDeliveryForShipment(
    manager: EntityManager,
    shipmentRef: string,
  ) {
    return manager
      .createQueryBuilder(ExportDelivery, 'delivery')
      .where('delivery.shipmentId = :shipmentRef', { shipmentRef })
      .andWhere('delivery.status != :cancelled', {
        cancelled: ExportDeliveryStatus.CANCELLED,
      })
      .setLock('pessimistic_write')
      .getOne();
  }

  private async createExportDeliveryDraftInTransaction(
    manager: EntityManager,
    shipmentRef: string,
    dto: CreateExportDeliveryFromShipmentDto,
    actorUsername: string,
  ) {
    const shipment = await this.loadShipmentForExportDelivery(manager, shipmentRef);
    if (shipment.isStockIssued) {
      throw new BadRequestException('Shipment stock was already issued');
    }

    const existing = await this.findActiveExportDeliveryForShipment(manager, shipment._id);
    if (existing) {
      throw new BadRequestException(
        `Shipment ${shipment.shipmentNumber} already has export delivery ${existing.deliveryNumber}`,
      );
    }

    const now = new Date();
    const delivery = manager.create(ExportDelivery, {
      deliveryNumber: this.createExportDeliveryNumber(now),
      shipmentId: shipment._id,
      salesContractId: shipment.salesContractId,
      buyerId: shipment.salesContract.buyerId,
      deliveryDate: dto.deliveryDate || now.toISOString().slice(0, 10),
      status: ExportDeliveryStatus.DRAFT,
      createdByUsername: actorUsername,
      issuedByUsername: null,
      issuedAt: null,
      cancelledByUsername: null,
      cancelledAt: null,
      cancellationReason: null,
      note: dto.note || `Export delivery draft for shipment ${shipment.shipmentNumber}`,
      auditTrail: null,
    });
    this.appendExportDeliveryAudit(delivery, 'CREATED', actorUsername, dto.note || null, {
      shipmentNumber: shipment.shipmentNumber,
    });

    const savedDelivery = await manager.save(delivery);
    const deliveryItems = shipment.salesContract.items
      .map((item) => {
        const quantity = Math.abs(Number(item.quantity || 0));
        if (quantity <= 0) return null;
        const fallbackCost = Number(item.product?.purchasePriceVnd || 0);

        return manager.create(ExportDeliveryItem, {
          exportDeliveryId: savedDelivery._id,
          productId: item.productId,
          quantity,
          unit: item.product?.unitOfMeasure || null,
          unitCost: fallbackCost,
          totalCost: quantity * fallbackCost,
          lotNumber: null,
          note: null,
        });
      })
      .filter((item): item is ExportDeliveryItem => item !== null);

    if (!deliveryItems.length) {
      throw new BadRequestException(
        `Shipment ${shipment.shipmentNumber} has no valid quantity for export delivery`,
      );
    }

    await manager.save(ExportDeliveryItem, deliveryItems);
    return manager.findOne(ExportDelivery, {
      where: { _id: savedDelivery._id },
      relations: ['buyer', 'shipment', 'salesContract', 'items', 'items.product'],
    });
  }

  private async issueExportDeliveryInTransaction(
    manager: EntityManager,
    deliveryRef: string,
    dto: IssueExportDeliveryDto,
    actorUsername: string,
  ) {
    const delivery = await manager.findOne(ExportDelivery, {
      where: { _id: deliveryRef },
      lock: { mode: 'pessimistic_write' },
    });
    if (!delivery) throw new NotFoundException('Export delivery not found');
    if (delivery.status === ExportDeliveryStatus.ISSUED) {
      throw new BadRequestException(`Export delivery ${delivery.deliveryNumber} was already issued`);
    }
    if (delivery.status === ExportDeliveryStatus.CANCELLED) {
      throw new BadRequestException(`Export delivery ${delivery.deliveryNumber} was cancelled`);
    }

    const shipment = await manager.findOne(Shipment, {
      where: { _id: delivery.shipmentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!shipment) throw new NotFoundException('Shipment not found for export delivery');
    if (shipment.isStockIssued) {
      throw new BadRequestException('Shipment stock was already issued');
    }

    const items = await manager.find(ExportDeliveryItem, {
      where: { exportDeliveryId: delivery._id },
      relations: ['product'],
    });
    if (!items.length) {
      throw new BadRequestException('Export delivery has no lines to issue');
    }

    for (const item of items) {
      const quantity = Math.abs(Number(item.quantity || 0));
      if (quantity <= 0) continue;

      await this.releaseStock(
        item.productId,
        quantity,
        delivery.salesContractId,
        manager,
      );

      const ledger = await this.executeInventoryTransaction(
        item.productId,
        -quantity,
        InventoryTransactionType.SALES,
        delivery._id,
        Number(item.unitCost || item.product?.purchasePriceVnd || 0),
        `Export delivery ${delivery.deliveryNumber} for shipment ${shipment.shipmentNumber}`,
        manager,
        undefined,
        delivery.buyerId,
        delivery.deliveryNumber,
        actorUsername,
      );

      item.unitCost = Number(ledger.unitPrice || 0);
      item.totalCost = quantity * Number(ledger.unitPrice || 0);
      item.lotNumber = ledger.lotNumber || item.lotNumber || null;
    }

    await manager.save(ExportDeliveryItem, items);

    const issuedAt = dto.issueDate ? new Date(dto.issueDate) : new Date();
    delivery.status = ExportDeliveryStatus.ISSUED;
    delivery.issuedByUsername = actorUsername;
    delivery.issuedAt = issuedAt;
    delivery.note = dto.note || delivery.note;
    this.appendExportDeliveryAudit(delivery, 'ISSUED', actorUsername, dto.note || null, {
      shipmentNumber: shipment.shipmentNumber,
      lineCount: items.length,
    });
    await manager.save(delivery);

    shipment.isStockIssued = true;
    shipment.stockIssuedAt = issuedAt;
    shipment.status = ShipmentStatus.LOADING;
    await manager.save(shipment);

    return manager.findOne(ExportDelivery, {
      where: { _id: delivery._id },
      relations: ['buyer', 'shipment', 'salesContract', 'items', 'items.product'],
    });
  }

  async createExportDeliveryFromShipment(
    shipmentRef: string,
    dto: CreateExportDeliveryFromShipmentDto,
    user: any,
  ) {
    const username = this.getActorUsername(user);
    return this.dataSource.transaction((manager) =>
      this.createExportDeliveryDraftInTransaction(manager, shipmentRef, dto, username),
    );
  }

  async issueExportDelivery(
    deliveryRef: string,
    dto: IssueExportDeliveryDto,
    user: any,
  ) {
    const username = this.getActorUsername(user);
    return this.dataSource.transaction((manager) =>
      this.issueExportDeliveryInTransaction(manager, deliveryRef, dto, username),
    );
  }

  async cancelExportDelivery(
    deliveryRef: string,
    dto: CancelExportDeliveryDto,
    user: any,
  ) {
    const username = this.getActorUsername(user);
    return this.dataSource.transaction(async (manager) => {
      const delivery = await manager.findOne(ExportDelivery, {
        where: { _id: deliveryRef },
        lock: { mode: 'pessimistic_write' },
      });
      if (!delivery) throw new NotFoundException('Export delivery not found');
      if (delivery.status === ExportDeliveryStatus.ISSUED) {
        throw new BadRequestException('Issued export delivery cannot be cancelled; create a reversal workflow instead');
      }
      if (delivery.status === ExportDeliveryStatus.CANCELLED) return delivery;

      delivery.status = ExportDeliveryStatus.CANCELLED;
      delivery.cancelledByUsername = username;
      delivery.cancelledAt = new Date();
      delivery.cancellationReason = dto.reason.trim();
      this.appendExportDeliveryAudit(delivery, 'CANCELLED', username, dto.reason);
      await manager.save(delivery);

      return manager.findOne(ExportDelivery, {
        where: { _id: delivery._id },
        relations: ['buyer', 'shipment', 'salesContract', 'items', 'items.product'],
      });
    });
  }

  async issueExportDeliveryForShipment(
    shipment: Shipment,
    user: any,
    transactionManager?: EntityManager,
  ) {
    const runInTransaction = async (manager: EntityManager) => {
      const username = this.getActorUsername(user);
      const existing = await this.findActiveExportDeliveryForShipment(manager, shipment._id);
      if (existing) {
        return this.issueExportDeliveryInTransaction(manager, existing._id, {}, username);
      }

      const draft = await this.createExportDeliveryDraftInTransaction(
        manager,
        shipment._id,
        { note: `Export delivery draft for shipment ${shipment.shipmentNumber}` },
        username,
      );
      if (!draft) throw new BadRequestException('Cannot create export delivery draft');
      return this.issueExportDeliveryInTransaction(manager, draft._id, {}, username);
    };

    if (transactionManager) {
      return runInTransaction(transactionManager);
    }

    return this.dataSource.transaction(runInTransaction);
  }

  async findAllExportDeliveries(query: any) {
    const current = Number(query.current || 1);
    const pageSize = Number(query.pageSize || 10);
    const offset = (current - 1) * pageSize;

    const qb = this.exportDeliveryRepository
      .createQueryBuilder('delivery')
      .leftJoinAndSelect('delivery.buyer', 'buyer')
      .leftJoinAndSelect('delivery.shipment', 'shipment')
      .leftJoinAndSelect('delivery.salesContract', 'salesContract')
      .leftJoinAndSelect('delivery.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('delivery.createdAt', 'DESC')
      .skip(offset)
      .take(pageSize);

    if (query.status) qb.andWhere('delivery.status = :status', { status: query.status });
    if (query.shipmentId) qb.andWhere('delivery.shipmentId = :shipmentId', { shipmentId: query.shipmentId });
    if (query.buyerId) qb.andWhere('delivery.buyerId = :buyerId', { buyerId: query.buyerId });
    if (query.search) {
      qb.andWhere('(delivery.deliveryNumber ILIKE :search OR shipment.shipmentNumber ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [results, total] = await qb.getManyAndCount();
    return {
      meta: { current, pageSize, pages: Math.ceil(total / pageSize), total },
      results,
    };
  }

  async findExportDelivery(recordId: string) {
    const delivery = await this.exportDeliveryRepository.findOne({
      where: { _id: recordId },
      relations: [
        'buyer',
        'shipment',
        'salesContract',
        'items',
        'items.product',
      ],
    });
    if (!delivery) throw new NotFoundException('Không tìm thấy phiếu xuất kho');
    return delivery;
  }

  /**
   * Điều chỉnh tồn kho (Adjustment) - Mục 5.3.3 PRD
   */
  async adjustStock(productId: string, adjustmentQty: number, reason: string, user: any, lotNumber?: string, unitPrice: number = 0) {
    const username = this.getActorUsername(user);

    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { _id: productId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new BadRequestException(`Product ${productId} not found`);

      const resolvedUnitPrice = Number(unitPrice || product.purchasePriceVnd || 0);
      const amountVnd = Math.abs(Number(adjustmentQty || 0)) * resolvedUnitPrice;
      const valuationSnapshot = await this.buildAdjustmentValuationSnapshot(
        manager,
        product,
        Number(adjustmentQty),
        resolvedUnitPrice,
      );
      const matchingRule = await this.approvalMatrixService.findMatchingRule(
        ApprovalDocumentType.INVENTORY_ADJUSTMENT,
        amountVnd,
        'VND',
      );
      if (!matchingRule) {
        throw new BadRequestException(
          'Chua co approval rule cho inventory adjustment; khong duoc dieu chinh kho truc tiep',
        );
      }

      const adjustment = manager.create(InventoryAdjustment, {
        adjustmentNumber: this.createAdjustmentNumber(),
        productId,
        adjustmentQuantity: Number(adjustmentQty),
        unitPrice: resolvedUnitPrice,
        amountVnd,
        lotNumber: lotNumber || null,
        reason,
        status: InventoryAdjustmentStatus.PENDING_APPROVAL,
        approvalWorkflowRequestId: null,
        requestedByUsername: username,
        requestedAt: new Date(),
        approvedByUsername: null,
        approvedAt: null,
        rejectedByUsername: null,
        rejectedAt: null,
        rejectionReason: null,
        ledgerEntryId: null,
        valuationSnapshot,
        appliedValuationSnapshot: null,
        auditTrail: null,
      });
      this.appendAdjustmentAudit(adjustment, 'REQUESTED', username, reason, {
        amountVnd,
        valuationSnapshot,
      });

      const savedAdjustment = await manager.save(adjustment);

      const approvalRequest =
        await this.approvalMatrixService.createRequestInTransaction(
          manager,
          {
            ruleId: matchingRule._id,
            documentType: ApprovalDocumentType.INVENTORY_ADJUSTMENT,
            documentId: savedAdjustment._id,
            documentNumber: savedAdjustment.adjustmentNumber,
            title: `Approve Inventory Adjustment ${savedAdjustment.adjustmentNumber}`,
            currency: 'VND',
            amount: amountVnd,
            amountVnd,
            metadata: {
              productId,
              sku: product.sku,
              adjustmentQuantity: Number(adjustmentQty),
              lotNumber: lotNumber || null,
              valuationSnapshot,
              source: 'inventory.adjustStock',
            },
          },
          user,
        );

      savedAdjustment.approvalWorkflowRequestId = approvalRequest?._id || null;
      const updatedAdjustment = await manager.save(savedAdjustment);

      return {
        ...updatedAdjustment,
        product,
        approvalRequest,
      };
    });
  }

  private async applyInventoryAdjustmentInTransaction(
    manager: EntityManager,
    adjustment: InventoryAdjustment,
    actorUsername: string,
  ) {
    if (adjustment.ledgerEntryId) {
      throw new BadRequestException(
        `Inventory adjustment ${adjustment.adjustmentNumber} was already applied`,
      );
    }

    const product = await manager.findOne(Product, {
      where: { _id: adjustment.productId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!product) throw new BadRequestException(`Product ${adjustment.productId} not found`);
    const appliedValuationSnapshot = await this.buildAdjustmentValuationSnapshot(
      manager,
      product,
      Number(adjustment.adjustmentQuantity),
      Number(adjustment.unitPrice || 0),
    );

    const ledger = await this.executeInventoryTransaction(
      adjustment.productId,
      Number(adjustment.adjustmentQuantity),
      InventoryTransactionType.ADJUSTMENT,
      adjustment._id,
      Number(adjustment.unitPrice || 0),
      `Adjustment ${adjustment.adjustmentNumber}: ${adjustment.reason}`,
      manager,
      adjustment.lotNumber || undefined,
      undefined,
      adjustment.adjustmentNumber,
      actorUsername,
    );

    adjustment.status = InventoryAdjustmentStatus.APPROVED;
    adjustment.approvedByUsername = actorUsername;
    adjustment.approvedAt = new Date();
    adjustment.rejectedByUsername = null;
    adjustment.rejectedAt = null;
    adjustment.rejectionReason = null;
    adjustment.ledgerEntryId = ledger._id;
    adjustment.appliedValuationSnapshot = appliedValuationSnapshot;
    this.appendAdjustmentAudit(adjustment, 'APPROVED', actorUsername, null, {
      ledgerEntryId: ledger._id,
      appliedValuationSnapshot,
    });

    await manager.save(adjustment);
    return manager.findOne(InventoryAdjustment, {
      where: { _id: adjustment._id },
      relations: ['product', 'ledgerEntry'],
    });
  }

  async approveInventoryAdjustmentFromWorkflow(
    recordId: string,
    actorUsername: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const adjustment = await manager.findOne(InventoryAdjustment, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!adjustment) throw new NotFoundException('Inventory adjustment not found');
      if (adjustment.status !== InventoryAdjustmentStatus.PENDING_APPROVAL) {
        return adjustment;
      }

      return this.applyInventoryAdjustmentInTransaction(
        manager,
        adjustment,
        actorUsername,
      );
    });
  }

  async rejectInventoryAdjustmentFromWorkflow(
    recordId: string,
    actorUsername: string,
    reason?: string | null,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const adjustment = await manager.findOne(InventoryAdjustment, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!adjustment) throw new NotFoundException('Inventory adjustment not found');
      if (adjustment.status !== InventoryAdjustmentStatus.PENDING_APPROVAL) {
        return adjustment;
      }

      adjustment.status = InventoryAdjustmentStatus.REJECTED;
      adjustment.rejectedByUsername = actorUsername;
      adjustment.rejectedAt = new Date();
      adjustment.rejectionReason = reason || 'Rejected by approval workflow';
      this.appendAdjustmentAudit(adjustment, 'REJECTED', actorUsername, adjustment.rejectionReason);
      return manager.save(adjustment);
    });
  }

  async findAllInventoryAdjustments(query: any) {
    const current = Number(query.current || 1);
    const pageSize = Number(query.pageSize || 10);
    const offset = (current - 1) * pageSize;

    const qb = this.adjustmentRepository
      .createQueryBuilder('adjustment')
      .leftJoinAndSelect('adjustment.product', 'product')
      .leftJoinAndSelect('adjustment.ledgerEntry', 'ledgerEntry')
      .orderBy('adjustment.createdAt', 'DESC')
      .skip(offset)
      .take(pageSize);

    if (query.status) qb.andWhere('adjustment.status = :status', { status: query.status });
    if (query.productId) qb.andWhere('adjustment.productId = :productId', { productId: query.productId });
    if (query.search) {
      qb.andWhere('(adjustment.adjustmentNumber ILIKE :search OR product.sku ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [results, total] = await qb.getManyAndCount();
    return {
      meta: { current, pageSize, pages: Math.ceil(total / pageSize), total },
      results,
    };
  }

  async findInventoryAdjustment(recordId: string) {
    const adjustment = await this.adjustmentRepository.findOne({
      where: { _id: recordId },
      relations: ['product', 'ledgerEntry'],
    });
    if (!adjustment) throw new NotFoundException('Inventory adjustment not found');
    return adjustment;
  }

  /**
   * Truy xuất Nhật ký kho (Audit Trail) với đầy đủ filter và phân trang
   */
  async createInventoryCount(dto: CreateInventoryCountDto, user: any) {
    const username = this.getActorUsername(user);

    return this.dataSource.transaction(async (manager) => {
      const countDate = dto.countDate ? new Date(dto.countDate) : new Date();
      const count = manager.create(InventoryCount, {
        countNumber: this.createCountNumber(countDate),
        countDate,
        warehouseName: dto.warehouseName || 'Main Warehouse',
        status: InventoryCountStatus.DRAFT,
        createdByUsername: username,
      });

      const savedCount = await manager.save(count);
      const snapshotItems = await this.resolveCountSnapshotItems(manager, dto.items);
      const items = snapshotItems.map((item) =>
        manager.create(InventoryCountItem, {
          ...item,
          countId: savedCount._id,
        }),
      );

      await manager.save(InventoryCountItem, items);

      return manager.findOne(InventoryCount, {
        where: { _id: savedCount._id },
        relations: ['items', 'items.product'],
      });
    });
  }

  async findAllInventoryCounts(query: any) {
    const current = Number(query.current || 1);
    const pageSize = Number(query.pageSize || 10);
    const offset = (current - 1) * pageSize;

    const qb = this.countRepository
      .createQueryBuilder('count')
      .leftJoinAndSelect('count.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('count.createdAt', 'DESC')
      .skip(offset)
      .take(pageSize);

    if (query.status) {
      qb.andWhere('count.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere('count.countNumber ILIKE :search', { search: `%${query.search}%` });
    }

    const [results, total] = await qb.getManyAndCount();

    return {
      meta: {
        current,
        pageSize,
        pages: Math.ceil(total / pageSize),
        total,
      },
      results,
    };
  }

  async findInventoryCount(recordId: string) {
    const count = await this.countRepository.findOne({
      where: { _id: recordId },
      relations: ['items', 'items.product'],
    });

    if (!count) {
      throw new NotFoundException('Không tìm thấy phiếu kiểm kê');
    }

    return count;
  }

  async submitInventoryCount(recordId: string, dto: SubmitInventoryCountDto, user: any) {
    const username = this.getActorUsername(user);

    return this.dataSource.transaction(async (manager) => {
      const count = await this.findInventoryCountForUpdate(manager, recordId);

      if (!count) {
        throw new NotFoundException('Không tìm thấy phiếu kiểm kê');
      }

      if (count.status !== InventoryCountStatus.DRAFT) {
        throw new BadRequestException('Chỉ phiếu kiểm kê nháp mới được gửi duyệt');
      }

      if (dto.items?.length) {
        const itemByProduct = new Map(count.items.map((item) => [item.productId, item]));

        for (const line of dto.items) {
          const item = itemByProduct.get(line.productId);
          if (!item) {
            throw new BadRequestException(`Sản phẩm ${line.productId} không thuộc phiếu kiểm kê này`);
          }

          item.countedQuantity = Number(line.countedQuantity);
          item.varianceQuantity = Number(line.countedQuantity) - Number(item.systemQuantity);
          item.varianceValue = Number(item.varianceQuantity) * Number(item.unitCost || 0);
          item.note = line.note || item.note;
        }

        await manager.save(InventoryCountItem, count.items);
      }

      count.status = InventoryCountStatus.SUBMITTED;
      count.submittedByUsername = username;
      count.submittedAt = new Date();

      await manager.save(count);

      return manager.findOne(InventoryCount, {
        where: { _id: count._id },
        relations: ['items', 'items.product'],
      });
    });
  }

  async approveInventoryCount(recordId: string, dto: ApproveInventoryCountDto, user: any) {
    const username = this.getActorUsername(user);
    const roleName = this.getActorRoleName(user);

    return this.dataSource.transaction(async (manager) => {
      const count = await this.findInventoryCountForUpdate(manager, recordId);

      if (!count) {
        throw new NotFoundException('Không tìm thấy phiếu kiểm kê');
      }

      if (count.status !== InventoryCountStatus.SUBMITTED) {
        throw new BadRequestException('Chỉ phiếu kiểm kê đã gửi duyệt mới được phê duyệt');
      }

      if (count.submittedByUsername === username && roleName !== 'ADMIN' && roleName !== 'SUPER ADMIN') {
        throw new BadRequestException('Người gửi duyệt không được tự phê duyệt phiếu kiểm kê');
      }

      for (const item of count.items) {
        const varianceQuantity = Number(item.varianceQuantity || 0);
        if (varianceQuantity === 0) continue;

        // Khi duyệt kiểm kê, chênh lệch mới được ghi vào ledger và hạch toán.
        // Đây là điểm kiểm soát để số tồn kho không đổi chỉ vì dữ liệu đếm nháp.
        await this.executeInventoryTransaction(
          item.productId,
          varianceQuantity,
          InventoryTransactionType.ADJUSTMENT,
          count._id,
          Number(item.unitCost || 0),
          `Inventory count ${count.countNumber}: ${item.note || dto.approvalNote || 'Approved variance'}`,
          manager,
          undefined,
          undefined,
          count.countNumber,
          username,
        );
      }

      count.status = InventoryCountStatus.APPROVED;
      count.approvedByUsername = username;
      count.approvedAt = new Date();
      count.approvalNote = dto.approvalNote || null;

      await manager.save(count);

      return manager.findOne(InventoryCount, {
        where: { _id: count._id },
        relations: ['items', 'items.product'],
      });
    });
  }

  async rejectInventoryCount(recordId: string, reason: string, user: any) {
    const username = this.getActorUsername(user);
    const roleName = this.getActorRoleName(user);

    return this.dataSource.transaction(async (manager) => {
      const count = await this.findInventoryCountForUpdate(manager, recordId);

      if (count.status !== InventoryCountStatus.SUBMITTED) {
        throw new BadRequestException('Chỉ phiếu kiểm kê đã gửi duyệt mới được từ chối');
      }

      if (count.submittedByUsername === username && roleName !== 'ADMIN' && roleName !== 'SUPER ADMIN') {
        throw new BadRequestException('Người gửi duyệt không được tự từ chối phiếu kiểm kê');
      }

      count.status = InventoryCountStatus.CANCELLED;
      count.approvedByUsername = username;
      count.approvedAt = new Date();
      count.approvalNote = reason || 'Rejected from approval center';

      await manager.save(count);

      return manager.findOne(InventoryCount, {
        where: { _id: count._id },
        relations: ['items', 'items.product'],
      });
    });
  }

  async createCustomerReturn(dto: CreateCustomerReturnDto, user: any) {
    const username = this.getActorUsername(user);

    return this.dataSource.transaction(async (manager) => {
      const buyer = await manager.findOne(Partner, { where: { _id: dto.buyerId } });
      if (!buyer || buyer.partnerType !== PartnerType.CUSTOMER) {
        throw new BadRequestException('Buyer không tồn tại hoặc không phải đối tác mua hàng');
      }

      let salesContractId = dto.salesContractId || null;
      if (dto.shipmentId) {
        const shipment = await manager.findOne(Shipment, {
          where: { _id: dto.shipmentId },
          relations: ['salesContract'],
        });
        if (!shipment) throw new BadRequestException('Shipment không tồn tại');
        salesContractId = salesContractId || shipment.salesContractId;
        if (shipment.salesContract?.buyerId && shipment.salesContract.buyerId !== dto.buyerId) {
          throw new BadRequestException('Shipment không thuộc buyer đã chọn');
        }
      }

      if (salesContractId) {
        const contract = await manager.findOne(SalesContract, { where: { _id: salesContractId } });
        if (!contract) throw new BadRequestException('Sales contract không tồn tại');
        if (contract.buyerId !== dto.buyerId) {
          throw new BadRequestException('Sales contract không thuộc buyer đã chọn');
        }
      }

      const productIds = [...new Set(dto.items.map((item) => item.productId))];
      const products = await manager.find(Product, { where: { _id: In(productIds) } });
      if (products.length !== productIds.length) {
        throw new BadRequestException('Một hoặc nhiều sản phẩm trả hàng không tồn tại');
      }
      const productById = new Map(products.map((product) => [product._id, product]));

      const returnDoc = manager.create(CustomerReturn, {
        returnNumber: this.createReturnNumber(dto.returnDate ? new Date(dto.returnDate) : new Date()),
        buyerId: dto.buyerId,
        shipmentId: dto.shipmentId || null,
        salesContractId,
        reason: dto.reason,
        returnDate: dto.returnDate || new Date().toISOString().slice(0, 10),
        note: dto.note || null,
        status: CustomerReturnStatus.DRAFT,
        createdByUsername: username,
      });

      const savedReturn = await manager.save(returnDoc);
      const items = dto.items.map((line) => {
        const product = productById.get(line.productId);
        return manager.create(CustomerReturnItem, {
          customerReturnId: savedReturn._id,
          productId: line.productId,
          quantity: Number(line.quantity),
          unit: line.unit || product?.unitOfMeasure || null,
          unitCost: Number(line.unitCost ?? product?.purchasePriceVnd ?? 0),
          lotNumber: line.lotNumber || null,
          quarantine: line.quarantine ?? true,
          note: line.note || null,
        });
      });

      await manager.save(CustomerReturnItem, items);
      return manager.findOne(CustomerReturn, {
        where: { _id: savedReturn._id },
        relations: ['buyer', 'shipment', 'salesContract', 'items', 'items.product'],
      });
    });
  }

  async findAllCustomerReturns(query: any) {
    const current = Number(query.current || 1);
    const pageSize = Number(query.pageSize || 10);
    const offset = (current - 1) * pageSize;

    const qb = this.customerReturnRepository
      .createQueryBuilder('returnDoc')
      .leftJoinAndSelect('returnDoc.buyer', 'buyer')
      .leftJoinAndSelect('returnDoc.shipment', 'shipment')
      .leftJoinAndSelect('returnDoc.salesContract', 'salesContract')
      .leftJoinAndSelect('returnDoc.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('returnDoc.createdAt', 'DESC')
      .skip(offset)
      .take(pageSize);

    if (query.status) qb.andWhere('returnDoc.status = :status', { status: query.status });
    if (query.buyerId) qb.andWhere('returnDoc.buyerId = :buyerId', { buyerId: query.buyerId });
    if (query.shipmentId) qb.andWhere('returnDoc.shipmentId = :shipmentId', { shipmentId: query.shipmentId });
    if (query.search) {
      qb.andWhere('(returnDoc.returnNumber ILIKE :search OR buyer.name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [results, total] = await qb.getManyAndCount();
    return {
      meta: { current, pageSize, pages: Math.ceil(total / pageSize), total },
      results,
    };
  }

  async findCustomerReturn(recordId: string) {
    const returnDoc = await this.customerReturnRepository.findOne({
      where: { _id: recordId },
      relations: ['buyer', 'shipment', 'salesContract', 'items', 'items.product'],
    });
    if (!returnDoc) throw new NotFoundException('Không tìm thấy phiếu trả hàng');
    return returnDoc;
  }

  async submitCustomerReturn(recordId: string, user: any) {
    const returnDoc = await this.findCustomerReturn(recordId);
    if (returnDoc.status !== CustomerReturnStatus.DRAFT) {
      throw new BadRequestException('Chỉ phiếu nháp mới được gửi duyệt');
    }
    returnDoc.status = CustomerReturnStatus.SUBMITTED;
    returnDoc.submittedByUsername = this.getActorUsername(user);
    returnDoc.submittedAt = new Date();
    return this.customerReturnRepository.save(returnDoc);
  }

  async approveCustomerReturn(recordId: string, dto: CustomerReturnDecisionDto, user: any) {
    const username = this.getActorUsername(user);
    const roleName = this.getActorRoleName(user);
    const returnDoc = await this.findCustomerReturn(recordId);
    if (returnDoc.status !== CustomerReturnStatus.SUBMITTED) {
      throw new BadRequestException('Chỉ phiếu đã gửi duyệt mới được phê duyệt');
    }
    if (returnDoc.submittedByUsername === username && !['ADMIN', 'SUPER ADMIN', 'SUPER_ADMIN'].includes(roleName)) {
      throw new BadRequestException('Người gửi duyệt không được tự duyệt phiếu trả hàng');
    }
    returnDoc.status = CustomerReturnStatus.APPROVED;
    returnDoc.approvedByUsername = username;
    returnDoc.approvedAt = new Date();
    returnDoc.decisionNote = dto.note || null;
    return this.customerReturnRepository.save(returnDoc);
  }

  async rejectCustomerReturn(recordId: string, dto: CustomerReturnDecisionDto, user: any) {
    const returnDoc = await this.findCustomerReturn(recordId);
    if (![CustomerReturnStatus.SUBMITTED, CustomerReturnStatus.APPROVED].includes(returnDoc.status)) {
      throw new BadRequestException('Chỉ phiếu đã gửi duyệt hoặc đã duyệt mới được từ chối');
    }
    returnDoc.status = CustomerReturnStatus.REJECTED;
    returnDoc.approvedByUsername = this.getActorUsername(user);
    returnDoc.approvedAt = new Date();
    returnDoc.decisionNote = dto.reason || dto.note || null;
    return this.customerReturnRepository.save(returnDoc);
  }

  async receiveCustomerReturn(recordId: string, dto: CustomerReturnDecisionDto, user: any) {
    const username = this.getActorUsername(user);

    return this.dataSource.transaction(async (manager) => {
      const returnDoc = await manager.findOne(CustomerReturn, {
        where: { _id: recordId },
        relations: ['items', 'items.product'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!returnDoc) throw new NotFoundException('Không tìm thấy phiếu trả hàng');
      if (returnDoc.status !== CustomerReturnStatus.APPROVED) {
        throw new BadRequestException('Chỉ phiếu đã duyệt mới được nhập lại kho');
      }

      for (const item of returnDoc.items || []) {
        await this.executeInventoryTransaction(
          item.productId,
          Math.abs(Number(item.quantity)),
          InventoryTransactionType.RETURN,
          returnDoc._id,
          Number(item.unitCost || item.product?.purchasePriceVnd || 0),
          `Return from customer ${returnDoc.returnNumber}: ${item.note || dto.note || returnDoc.reason}`,
          manager,
          item.lotNumber || undefined,
          returnDoc.buyerId,
          returnDoc.returnNumber,
          username,
          item.quarantine,
        );
      }

      returnDoc.status = CustomerReturnStatus.RECEIVED;
      returnDoc.receivedByUsername = username;
      returnDoc.receivedAt = new Date();
      returnDoc.decisionNote = dto.note || returnDoc.decisionNote;
      await manager.save(returnDoc);

      return manager.findOne(CustomerReturn, {
        where: { _id: returnDoc._id },
        relations: ['buyer', 'shipment', 'salesContract', 'items', 'items.product'],
      });
    });
  }

  async findLotMovements(query: any) {
    const current = Number(query.current || 1);
    const pageSize = Number(query.pageSize || 20);
    const offset = (current - 1) * pageSize;

    const qb = this.ledgerRepository
      .createQueryBuilder('ledger')
      .leftJoinAndSelect('ledger.product', 'product')
      .orderBy('ledger.createdAt', 'DESC')
      .skip(offset)
      .take(pageSize);

    if (query.productId) qb.andWhere('ledger.productId = :productId', { productId: query.productId });
    if (query.lotNumber) qb.andWhere('ledger.lotNumber ILIKE :lotNumber', { lotNumber: `%${query.lotNumber}%` });
    if (query.shipmentId) qb.andWhere('ledger.referenceId = :shipmentId', { shipmentId: query.shipmentId });
    if (query.buyerId) qb.andWhere('ledger.partnerId = :buyerId', { buyerId: query.buyerId });
    if (query.transactionType) qb.andWhere('ledger.transactionType = :transactionType', { transactionType: query.transactionType });

    const [results, total] = await qb.getManyAndCount();
    return {
      meta: { current, pageSize, pages: Math.ceil(total / pageSize), total },
      results,
    };
  }

  async getValuationReport(method: 'FIFO' | 'AVG' = 'FIFO') {
    const products = await this.productRepository.find({
      where: { isActive: true },
      order: { sku: 'ASC' },
    });

    const costMap = await this.getRemainingCostMap(
      this.dataSource.manager,
      products.map((product) => product._id),
    );

    const lines = products.map((product) => {
      const currentStock = Number(product.currentStock || 0);
      const reservedStock = Number(product.reservedStock || 0);
      const remainingCost = costMap.get(product._id);
      const fallbackCost = Number(product.purchasePriceVnd || 0);

      let stockValue = Number(remainingCost?.stockValue || 0);
      const remainingQuantity = Number(remainingCost?.remainingQuantity || 0);

      if (currentStock > remainingQuantity) {
        stockValue += (currentStock - remainingQuantity) * fallbackCost;
      }

      const fifoUnitCost = currentStock ? stockValue / currentStock : fallbackCost;
      const avgUnitCost = remainingQuantity
        ? Number(remainingCost?.stockValue || 0) / remainingQuantity
        : fallbackCost;
      const unitCost = method === 'AVG' ? avgUnitCost : fifoUnitCost;
      const inventoryValue = currentStock * unitCost;

      return {
        productId: product._id,
        sku: product.sku,
        productName: product.vietnameseName,
        currentStock,
        reservedStock,
        availableStock: currentStock - reservedStock,
        unitCost,
        inventoryValue,
        valuationMethod: method,
      };
    });

    return {
      method,
      generatedAt: new Date(),
      totalQuantity: lines.reduce((sum, line) => sum + line.currentStock, 0),
      totalValue: lines.reduce((sum, line) => sum + line.inventoryValue, 0),
      lines,
    };
  }

  async createPeriodSnapshot(dto: CreateInventoryPeriodSnapshotDto, user: any) {
    const username = this.getActorUsername(user);
    const valuationMethod: InventoryValuationMethod = dto.valuationMethod || 'FIFO';
    const periodKey = dto.periodKey.trim().toUpperCase();

    if (new Date(dto.periodStartDate) > new Date(dto.periodEndDate)) {
      throw new BadRequestException('Period start date must be before end date');
    }

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(InventoryPeriodSnapshot, {
        where: { periodKey, valuationMethod },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing) {
        throw new BadRequestException(
          `Inventory snapshot already exists for ${periodKey}/${valuationMethod}`,
        );
      }

      const report = await this.getValuationReport(valuationMethod);
      const snapshotData = report.lines.map((line) => ({
        productId: line.productId,
        sku: line.sku,
        productName: line.productName || null,
        currentStock: Number(line.currentStock || 0),
        reservedStock: Number(line.reservedStock || 0),
        availableStock: Number(line.availableStock || 0),
        unitCost: Number(line.unitCost || 0),
        inventoryValue: Number(line.inventoryValue || 0),
        valuationMethod,
      }));

      const hashPayload = JSON.stringify({
        periodKey,
        periodStartDate: dto.periodStartDate,
        periodEndDate: dto.periodEndDate,
        valuationMethod,
        totalQuantity: report.totalQuantity,
        totalValue: report.totalValue,
        snapshotData,
      });

      const snapshot = manager.create(InventoryPeriodSnapshot, {
        snapshotNumber: this.createPeriodSnapshotNumber(periodKey),
        periodKey,
        periodStartDate: dto.periodStartDate,
        periodEndDate: dto.periodEndDate,
        valuationMethod,
        totalQuantity: Number(report.totalQuantity || 0),
        totalValue: Number(report.totalValue || 0),
        lineCount: snapshotData.length,
        snapshotData,
        createdByUsername: username,
        immutableHash: createHash('sha256').update(hashPayload).digest('hex'),
        note: dto.note || null,
      });

      return manager.save(snapshot);
    });
  }

  async findAllPeriodSnapshots(query: any) {
    const current = Number(query.current || 1);
    const pageSize = Number(query.pageSize || 10);
    const offset = (current - 1) * pageSize;

    const qb = this.periodSnapshotRepository
      .createQueryBuilder('snapshot')
      .orderBy('snapshot.periodEndDate', 'DESC')
      .addOrderBy('snapshot.createdAt', 'DESC')
      .skip(offset)
      .take(pageSize);

    if (query.periodKey) {
      qb.andWhere('snapshot.periodKey ILIKE :periodKey', {
        periodKey: `%${query.periodKey}%`,
      });
    }
    if (query.valuationMethod) {
      qb.andWhere('snapshot.valuationMethod = :valuationMethod', {
        valuationMethod: query.valuationMethod,
      });
    }

    const [results, total] = await qb.getManyAndCount();
    return {
      meta: { current, pageSize, pages: Math.ceil(total / pageSize), total },
      results,
    };
  }

  async findPeriodSnapshot(recordId: string) {
    const snapshot = await this.periodSnapshotRepository.findOne({
      where: { _id: recordId },
    });
    if (!snapshot) throw new NotFoundException('Inventory period snapshot not found');
    return snapshot;
  }

  async findAllAuditTrail(query: any) {
    const { current = 1, pageSize = 10, referenceNumber, transactionType, startDate, endDate, sort } = query;
    const normalizedCurrent = Number(current) || 1;
    const normalizedPageSize = Number(pageSize) || 10;
    const offset = (normalizedCurrent - 1) * normalizedPageSize;

    const qb = this.ledgerRepository.createQueryBuilder('ledger')
      .leftJoinAndSelect('ledger.product', 'product');

    if (referenceNumber) {
      qb.andWhere('ledger.referenceNumber ILIKE :ref', { ref: `%${referenceNumber}%` });
    }

    if (transactionType) {
      qb.andWhere('ledger.transactionType = :type', { type: transactionType });
    }

    if (startDate && endDate) {
      qb.andWhere('ledger.createdAt BETWEEN :start AND :end', { 
        start: new Date(startDate), 
        end: new Date(endDate) 
      });
    }

    this.applyAuditTrailSort(qb, sort);
    qb.skip(offset).take(normalizedPageSize);

    const [results, total] = await qb.getManyAndCount();

    return {
      meta: {
        current: normalizedCurrent,
        pageSize: normalizedPageSize,
        pages: Math.ceil(total / normalizedPageSize),
        total
      },
      results
    };
  }
}
