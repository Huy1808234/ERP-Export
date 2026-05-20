import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeFinanceService } from './trade-finance.service';
import { TradeFinanceController } from './trade-finance.controller';
import { LetterOfCredit } from './entities/letter-of-credit.entity';
import { CollectionOrder } from './entities/collection-order.entity';
import { TradeFinanceTransaction } from './entities/trade-finance-transaction.entity';
import { LCDiscrepancy } from './entities/lc-discrepancy.entity';
import { SalesContract } from '../sales-contracts/entities/sales-contract.entity';
import { VendorInvoice } from '../vendor-invoices/entities/vendor-invoice.entity';
import { AccountReceivable } from '../account-receivables/entities/account-receivable.entity';
import { ProformaInvoicesModule } from '../proforma-invoices/proforma-invoices.module';
import { AccountingModule } from '../accounting/accounting.module';
import { TradeFinanceCron } from './trade-finance.cron';
import { AccountReceivablesModule } from '../account-receivables/account-receivables.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LetterOfCredit,
      CollectionOrder,
      TradeFinanceTransaction,
      LCDiscrepancy,
      SalesContract,
      VendorInvoice,
      AccountReceivable,
    ]),
    ProformaInvoicesModule,
    AccountingModule,
    AccountReceivablesModule,
  ],
  controllers: [TradeFinanceController],
  providers: [TradeFinanceService, TradeFinanceCron],
  exports: [TradeFinanceService],
})
export class TradeFinanceModule {}
