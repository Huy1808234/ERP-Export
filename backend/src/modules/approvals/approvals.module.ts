import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsController } from '@/modules/approvals/approvals.controller';
import { ApprovalsService } from '@/modules/approvals/approvals.service';
import { PurchaseRequest } from '@/modules/purchase-requests/entities/purchase-request.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/entities/purchase-order.entity';

import { Quotation } from '@/modules/quotations/entities/quotation.entity';
import { ProformaInvoice } from '@/modules/proforma-invoices/entities/proforma-invoice.entity';
import { TradeFinanceTransaction } from '@/modules/trade-finance/entities/trade-finance-transaction.entity';
import { TradeFinanceModule } from '@/modules/trade-finance/trade-finance.module';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { SalesContractsModule } from '@/modules/sales-contracts/sales-contracts.module';
import { InventoryModule } from '@/modules/inventory/inventory.module';
import { InventoryCount } from '@/modules/inventory/entities/inventory-count.entity';
import { ApprovalMatrixModule } from '@/modules/approval-matrix/approval-matrix.module';
import { ProductChangeRequest } from '@/modules/products/entities/product-change-request.entity';
import { ProductsModule } from '@/modules/products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseRequest, PurchaseOrder, Quotation, ProformaInvoice, TradeFinanceTransaction, SalesContract, InventoryCount, ProductChangeRequest]),
    TradeFinanceModule,
    SalesContractsModule,
    InventoryModule,
    ApprovalMatrixModule,
    ProductsModule,
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}
