import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsController } from '@/modules/approvals/approvals.controller';
import { ApprovalsService } from '@/modules/approvals/approvals.service';
import { PurchaseRequest } from '@/modules/purchase-requests/entities/purchase-request.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/entities/purchase-order.entity';

import { Quotation } from '@/modules/quotations/entities/quotation.entity';
import { ProformaInvoice } from '@/modules/proforma-invoices/entities/proforma-invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseRequest, PurchaseOrder, Quotation, ProformaInvoice]),
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}
