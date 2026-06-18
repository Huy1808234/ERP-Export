import { Module } from '@nestjs/common';
import { GoodsReceiptsService } from './goods-receipts.service';
import { GoodsReceiptsController } from './goods-receipts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoodsReceipt } from './entities/goods-receipt.entity';
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { ProductsModule } from '../products/products.module';
import { InventoryModule } from '../inventory/inventory.module';

import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-orders/entities/purchase-order-item.entity';
import { Product } from '../products/entities/product.entity';
import { VendorInvoice } from '../vendor-invoices/entities/vendor-invoice.entity';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GoodsReceipt,
      GoodsReceiptItem,
      PurchaseOrder,
      PurchaseOrderItem,
      Product,
      VendorInvoice,
    ]),
    PurchaseOrdersModule,
    ProductsModule,
    InventoryModule,
    AccountingModule,
  ],
  controllers: [GoodsReceiptsController],
  providers: [GoodsReceiptsService],
  exports: [GoodsReceiptsService],
})
export class GoodsReceiptsModule {}
