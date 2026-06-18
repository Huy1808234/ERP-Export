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
import { Inquiry } from '@/modules/inquiries/entities/inquiry.entity';
import { PricingPolicy } from '@/modules/pricing-policies/entities/pricing-policy.entity';
import { GoodsReceipt } from '@/modules/goods-receipts/entities/goods-receipt.entity';
import { VendorInvoice } from '@/modules/vendor-invoices/entities/vendor-invoice.entity';
import { PurchaseReturn } from '@/modules/purchase-returns/entities/purchase-return.entity';
import { InventoryCount } from '@/modules/inventory/entities/inventory-count.entity';
import { ExportDelivery } from '@/modules/inventory/entities/export-delivery.entity';
import { CustomerReturn } from '@/modules/inventory/entities/customer-return.entity';
import { LetterOfCredit } from '@/modules/trade-finance/entities/letter-of-credit.entity';
import { CollectionOrder } from '@/modules/trade-finance/entities/collection-order.entity';
import { TradeFinanceTransaction } from '@/modules/trade-finance/entities/trade-finance-transaction.entity';
import { JournalEntry } from '@/modules/accounting/entities/journal-entry.entity';
import { RedisCacheModule } from '@/common/cache/redis-cache.module';
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
      Inquiry,
      PricingPolicy,
      GoodsReceipt,
      VendorInvoice,
      PurchaseReturn,
      InventoryCount,
      ExportDelivery,
      CustomerReturn,
      LetterOfCredit,
      CollectionOrder,
      TradeFinanceTransaction,
      JournalEntry,
    ]),
    RedisCacheModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
