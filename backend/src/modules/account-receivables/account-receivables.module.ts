import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { AccountReceivablesController } from './account-receivables.controller';
import { AccountReceivablesService } from './account-receivables.service';
import { AccountReceivable } from './entities/account-receivable.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import { PaymentReceipt } from './entities/payment-receipt.entity';
import { PaymentReceiptsController } from './payment-receipts.controller';
import { PaymentReceiptsService } from './payment-receipts.service';
import { TradeFinanceTransaction } from '../trade-finance/entities/trade-finance-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountReceivable,
      PaymentAllocation,
      PaymentReceipt,
      Partner,
      TradeFinanceTransaction,
    ]),
  ],
  controllers: [AccountReceivablesController, PaymentReceiptsController],
  providers: [AccountReceivablesService, PaymentReceiptsService],
  exports: [AccountReceivablesService, PaymentReceiptsService],
})
export class AccountReceivablesModule {}
