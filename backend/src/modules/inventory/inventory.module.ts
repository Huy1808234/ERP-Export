import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryLedger } from './entities/inventory-ledger.entity';
import { InventoryCount, InventoryCountItem } from './entities/inventory-count.entity';
import { CustomerReturn, CustomerReturnItem } from './entities/customer-return.entity';
import { ExportDelivery, ExportDeliveryItem } from './entities/export-delivery.entity';
import { InventoryAdjustment } from './entities/inventory-adjustment.entity';
import { InventoryPeriodSnapshot } from './entities/inventory-period-snapshot.entity';
import { Product } from '../products/entities/product.entity';
import { AccountingModule } from '../accounting/accounting.module';
import { LotsModule } from '../lots/lots.module';
import { ApprovalMatrixModule } from '../approval-matrix/approval-matrix.module';
import { InventoryAdjustmentApprovalListener } from './inventory-adjustment-approval.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryLedger,
      InventoryCount,
      InventoryCountItem,
      CustomerReturn,
      CustomerReturnItem,
      ExportDelivery,
      ExportDeliveryItem,
      InventoryAdjustment,
      InventoryPeriodSnapshot,
      Product,
    ]),
    AccountingModule,
    LotsModule,
    ApprovalMatrixModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryAdjustmentApprovalListener],
  exports: [InventoryService],
})
export class InventoryModule {}
