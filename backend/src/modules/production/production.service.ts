import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProductionOrder, ProductionStatus, ProductionOutput } from './entities/production-order.entity';
import { InventoryService } from '../inventory/inventory.service';
import { LotsService } from '../lots/lots.service';
import { InventoryTransactionType } from '../inventory/entities/inventory-ledger.entity';

@Injectable()
export class ProductionService {
  constructor(
    @InjectRepository(ProductionOrder)
    private orderRepository: Repository<ProductionOrder>,
    @InjectRepository(ProductionOutput)
    private outputRepository: Repository<ProductionOutput>,
    private inventoryService: InventoryService,
    private lotsService: LotsService,
    private dataSource: DataSource,
  ) {}

  async createOrder(data: any, user: any) {
    const orderNumber = `PROD-${Date.now()}`;
    const order = this.orderRepository.create({
      ...data,
      orderNumber,
      createdById: user.id,
      status: ProductionStatus.PLANNED,
    });
    return this.orderRepository.save(order);
  }

  async startProduction(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(ProductionOrder, { where: { id }, relations: ['rawLot'] });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== ProductionStatus.PLANNED) throw new BadRequestException('Order already started or completed');

      // 1. Xuất kho nguyên liệu thô
      await this.inventoryService.executeInventoryTransaction(
        order.rawProductId,
        -Number(order.rawQuantity),
        InventoryTransactionType.ADJUSTMENT, // Hoặc định nghĩa thêm loại PRODUCTION_CONSUMPTION
        order.orderNumber,
        Number(order.rawLot.unitPrice || 0),
        `Production Start: Consuming raw materials`,
        manager,
        order.rawLot.lotNumber
      );

      order.status = ProductionStatus.IN_PROGRESS;
      order.startDate = new Date();
      return manager.save(order);
    });
  }

  async completeProduction(id: string, outputs: any[]) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(ProductionOrder, { where: { id } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== ProductionStatus.IN_PROGRESS) throw new BadRequestException('Order must be IN_PROGRESS to complete');

      for (const out of outputs) {
        // 1. Tạo Lô hàng mới cho thành phẩm
        const newLot = await this.lotsService.create({
          lotNumber: `LOT-PROD-${Date.now()}-${Math.floor(Math.random() * 100)}`,
          productId: out.productId,
          initialQuantity: out.quantity,
          currentQuantity: out.quantity,
          productionDate: new Date(),
          notes: `Output from order ${order.orderNumber}`
        });

        // 2. Nhập kho thành phẩm
        await this.inventoryService.executeInventoryTransaction(
          out.productId,
          Number(out.quantity),
          InventoryTransactionType.ADJUSTMENT,
          order.orderNumber,
          0, // Giá vốn thành phẩm sẽ được tính toán sau (Landed Cost logic)
          `Production Complete: Finished goods entry`,
          manager,
          newLot.lotNumber
        );

        // 3. Lưu thông tin Output
        const outputEntry = this.outputRepository.create({
          ...out,
          productionOrderId: order.id,
          outputLotNumber: newLot.lotNumber,
          recoveryRate: (out.quantity / order.rawQuantity) * 100
        });
        await manager.save(outputEntry);
      }

      order.status = ProductionStatus.COMPLETED;
      order.endDate = new Date();
      return manager.save(order);
    });
  }

  async findAll(query: any) {
    const { current = 1, pageSize = 10, ...filters } = query;
    return this.orderRepository.findAndCount({
      where: filters,
      relations: ['rawProduct', 'rawLot', 'outputs', 'outputs.product'],
      skip: (current - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' }
    });
  }
}
