import { Module } from '@nestjs/common';
import { PurchaseReturnsService } from './purchase-returns.service';
import { PurchaseReturnsController } from './purchase-returns.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PurchaseReturn,
  PurchaseReturnItem,
} from './entities/purchase-return.entity';
import { Product } from '../products/entities/product.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { AccountingModule } from '../accounting/accounting.module';
import { VendorInvoice } from '../vendor-invoices/entities/vendor-invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseReturn,
      PurchaseReturnItem,
      Product,
      PurchaseOrder,
      VendorInvoice,
    ]),
    InventoryModule,
    AccountingModule,
  ],
  controllers: [PurchaseReturnsController],
  providers: [PurchaseReturnsService],
})
export class PurchaseReturnsModule {}
