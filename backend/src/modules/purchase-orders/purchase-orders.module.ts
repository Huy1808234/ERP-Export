import { Module } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { PurchaseRequest } from '../purchase-requests/entities/purchase-request.entity';
import { Partner } from '../partners/entities/partner.entity';
import { ProformaInvoice } from '../proforma-invoices/entities/proforma-invoice.entity';
import { CurrenciesModule } from '../currencies/currencies.module';
import { SettingsModule } from '../settings/settings.module';
import { ApprovalMatrixModule } from '../approval-matrix/approval-matrix.module';
import { PurchaseOrderApprovalListener } from './purchase-order-approval.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseOrder,
      PurchaseOrderItem,
      PurchaseRequest,
      Partner,
      ProformaInvoice,
    ]),
    CurrenciesModule,
    SettingsModule,
    ApprovalMatrixModule,
  ],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, PurchaseOrderApprovalListener],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
