import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { AccountPayablesController } from './account-payables.controller';
import { AccountPayablesService } from './account-payables.service';
import { AccountPayable } from './entities/account-payable.entity';
import {
  AccountPayablePaymentBatch,
  AccountPayablePaymentBatchItem,
} from './entities/account-payable-payment-batch.entity';
import { AccountPayableSettlementAudit } from './entities/account-payable-settlement-audit.entity';
import { AccountingModule } from '@/modules/accounting/accounting.module';
import { VendorInvoice } from '@/modules/vendor-invoices/entities/vendor-invoice.entity';
import { ApprovalMatrixModule } from '@/modules/approval-matrix/approval-matrix.module';
import { AccountPayableApprovalListener } from './account-payable-approval.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountPayable,
      AccountPayablePaymentBatch,
      AccountPayablePaymentBatchItem,
      AccountPayableSettlementAudit,
      Partner,
      VendorInvoice,
    ]),
    AccountingModule,
    ApprovalMatrixModule,
  ],
  controllers: [AccountPayablesController],
  providers: [AccountPayablesService, AccountPayableApprovalListener],
  exports: [AccountPayablesService],
})
export class AccountPayablesModule {}
