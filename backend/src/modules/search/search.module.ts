import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '@/modules/products/entities/product.entity';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { Quotation } from '@/modules/quotations/entities/quotation.entity';
import { ProformaInvoice } from '@/modules/proforma-invoices/entities/proforma-invoice.entity';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { PurchaseRequest } from '@/modules/purchase-requests/entities/purchase-request.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/entities/purchase-order.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';
import { CommercialInvoice } from '@/modules/commercial-invoices/entities/commercial-invoice.entity';
import { ExportDocument } from '@/modules/export-documents/entities/export-document.entity';
import { AccountReceivable } from '@/modules/account-receivables/entities/account-receivable.entity';
import { AccountPayable } from '@/modules/account-payables/entities/account-payable.entity';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Partner,
      Quotation,
      ProformaInvoice,
      SalesContract,
      PurchaseRequest,
      PurchaseOrder,
      Shipment,
      CommercialInvoice,
      ExportDocument,
      AccountReceivable,
      AccountPayable,
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
