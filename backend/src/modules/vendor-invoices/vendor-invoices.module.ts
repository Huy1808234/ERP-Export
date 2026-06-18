import { Module } from '@nestjs/common';
import { VendorInvoicesService } from './vendor-invoices.service';
import { VendorInvoicesController } from './vendor-invoices.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorInvoice } from './entities/vendor-invoice.entity';
import { VendorInvoiceItem } from './entities/vendor-invoice-item.entity';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { AccountingModule } from '../accounting/accounting.module';

import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { AccountPayable } from '../account-payables/entities/account-payable.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VendorInvoice,
      VendorInvoiceItem,
      PurchaseOrder,
      AccountPayable,
    ]),
    PurchaseOrdersModule,
    AccountingModule,
  ],
  controllers: [VendorInvoicesController],
  providers: [VendorInvoicesService],
  exports: [VendorInvoicesService],
})
export class VendorInvoicesModule {}
