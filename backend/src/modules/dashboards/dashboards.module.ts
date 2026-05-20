import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardsService } from './dashboards.service';
import { KpiDashboardsController } from './dashboards.controller';
import { ProformaInvoice } from '../proforma-invoices/entities/proforma-invoice.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { Partner } from '../partners/entities/partner.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { Product } from '../products/entities/product.entity';
import { LetterOfCredit } from '../trade-finance/entities/letter-of-credit.entity';
import { SalesContract } from '../sales-contracts/entities/sales-contract.entity';
import { AccountReceivable } from '../account-receivables/entities/account-receivable.entity';
import { AccountPayable } from '../account-payables/entities/account-payable.entity';
import { AccountingModule } from '../accounting/accounting.module';
import { TradeFinanceModule } from '../trade-finance/trade-finance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProformaInvoice, 
      SalesContract,
      PurchaseOrder, 
      Partner, 
      Shipment,
      Product,
      LetterOfCredit,
      AccountReceivable,
      AccountPayable,
    ]),
    AccountingModule,
    TradeFinanceModule,
  ],
  controllers: [KpiDashboardsController],
  providers: [DashboardsService],
  exports: [DashboardsService],
})
export class DashboardsModule {}
