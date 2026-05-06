import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { InventoryLedger, InventoryTransactionType } from './entities/inventory-ledger.entity';
import { AccountingService } from '../accounting/accounting.service';
import { LotsService } from '../lots/lots.service';

@Injectable()
export class InventoryService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(InventoryLedger)
    private ledgerRepository: Repository<InventoryLedger>,
    private accountingService: AccountingService,
    private lotsService: LotsService,
  ) {}

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
    createdBy?: string
  ): Promise<InventoryLedger> {
    const runInTransaction = async (manager: EntityManager) => {
      // 1. Pessimistic Write Lock: Khóa dòng Product này lại, các request khác phải chờ
      const product = await manager.findOne(Product, {
        where: { id: productId },
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
        referenceNumber,
        createdBy,
        notes,
      });

      const savedLedger = await manager.save(ledgerEntry);

      // 6. AUTO-POSTING TO ACCOUNTING (Mục tiêu: Đạt chuẩn Senior ERP)
      const totalValue = Math.abs(quantityChange) * calculatedUnitPrice;
      if (totalValue > 0) {
        const journalItems: { accountCode: string; debit: number; credit: number; partnerId?: string }[] = [];
        if (quantityChange > 0) {
          // Nhập kho: Nợ 156 (Hàng hóa), Có 3388 (Hàng mua chưa có hóa đơn - provisional)
          journalItems.push({ accountCode: '156', debit: totalValue, credit: 0 });
          journalItems.push({ accountCode: '3388', debit: 0, credit: totalValue, partnerId });
        } else {
          // Xuất kho: Nợ 632 (Giá vốn), Có 156 (Hàng hóa)
          journalItems.push({ accountCode: '632', debit: totalValue, credit: 0 });
          journalItems.push({ accountCode: '156', debit: 0, credit: totalValue, partnerId });
        }

        await this.accountingService.createJournalEntry({
          description: `Auto-post from Inventory: ${transactionType} - ${product.sku} (${quantityChange})`,
          referenceType: 'INVENTORY_LEDGER',
          referenceId: savedLedger.id,
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
      where: { id: productId },
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
      where: { id: productId },
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

  /**
   * Điều chỉnh tồn kho (Adjustment) - Mục 5.3.3 PRD
   */
  async adjustStock(productId: string, adjustmentQty: number, reason: string, user: any, lotNumber?: string, unitPrice: number = 0) {
    return this.executeInventoryTransaction(
      productId,
      adjustmentQty,
      InventoryTransactionType.ADJUSTMENT,
      `ADJ-${Date.now()}`,
      unitPrice,
      reason,
      undefined,
      lotNumber,
      undefined, // partner
      `ADJ-${Date.now()}`,
      user.email
    );
  }

  /**
   * Truy xuất Nhật ký kho (Audit Trail) với đầy đủ filter và phân trang
   */
  async findAllAuditTrail(query: any) {
    const { current = 1, pageSize = 10, referenceNumber, transactionType, startDate, endDate } = query;
    const offset = (current - 1) * pageSize;

    const qb = this.ledgerRepository.createQueryBuilder('ledger')
      .leftJoinAndSelect('ledger.product', 'product')
      .orderBy('ledger.createdAt', 'DESC')
      .skip(offset)
      .take(pageSize);

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

    const [results, total] = await qb.getManyAndCount();

    return {
      meta: {
        current,
        pageSize,
        pages: Math.ceil(total / pageSize),
        total
      },
      results
    };
  }
}
