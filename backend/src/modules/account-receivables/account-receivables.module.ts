import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { AccountReceivablesController } from './account-receivables.controller';
import { AccountReceivablesService } from './account-receivables.service';
import { AccountReceivable } from './entities/account-receivable.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import { TradeFinanceTransaction } from '../trade-finance/entities/trade-finance-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountReceivable,
      PaymentAllocation,
      Partner,
      TradeFinanceTransaction,
    ]),
  ],
  controllers: [AccountReceivablesController],
  providers: [AccountReceivablesService],
  exports: [AccountReceivablesService],
})
export class AccountReceivablesModule {}
