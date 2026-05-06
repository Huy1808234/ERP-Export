import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeFinanceService } from './trade-finance.service';
import { TradeFinanceController } from './trade-finance.controller';
import { LetterOfCredit } from './entities/letter-of-credit.entity';
import { TradeFinanceTransaction } from './entities/trade-finance-transaction.entity';
import { SalesContract } from '../sales-contracts/entities/sales-contract.entity';
import { ProformaInvoicesModule } from '../proforma-invoices/proforma-invoices.module';
import { AccountingModule } from '../accounting/accounting.module';
import { TradeFinanceCron } from './trade-finance.cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([LetterOfCredit, TradeFinanceTransaction, SalesContract]),
    ProformaInvoicesModule,
    AccountingModule,
  ],
  controllers: [TradeFinanceController],
  providers: [TradeFinanceService, TradeFinanceCron],
  exports: [TradeFinanceService],
})
export class TradeFinanceModule {}
