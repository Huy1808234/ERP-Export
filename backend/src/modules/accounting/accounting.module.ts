import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { JournalEntry } from './entities/journal-entry.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { AccountingPeriod } from './entities/accounting-period.entity';
import { FxRevaluation } from './entities/fx-revaluation.entity';
import { VatRefundDossier } from './entities/vat-refund-dossier.entity';
import { AccountingAuditEvent } from './entities/accounting-audit-event.entity';
import { TaxReportRun } from './entities/tax-report-run.entity';
import { AccountingPeriodClosePacket } from './entities/accounting-period-close-packet.entity';
import { AccountingListener } from './accounting.listener';
import { AccountingClosePolicyService } from './accounting-close-policy.service';
import { AccountingPeriodGuardService } from './accounting-period-guard.service';
import { CurrenciesModule } from '../currencies/currencies.module';
import { LedgerEntrySubscriber } from './ledger-entry.subscriber';
import { ApprovalMatrixModule } from '../approval-matrix/approval-matrix.module';
import { AccountingImmutableSubscriber } from './accounting-immutable.subscriber';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JournalEntry,
      LedgerEntry,
      AccountingPeriod,
      FxRevaluation,
      VatRefundDossier,
      AccountingAuditEvent,
      TaxReportRun,
      AccountingPeriodClosePacket,
    ]),
    CurrenciesModule,
    ApprovalMatrixModule,
  ],
  controllers: [AccountingController],
  providers: [
    AccountingService,
    AccountingClosePolicyService,
    AccountingPeriodGuardService,
    AccountingListener,
    LedgerEntrySubscriber,
    AccountingImmutableSubscriber,
  ],
  exports: [AccountingService, AccountingPeriodGuardService],
})
export class AccountingModule {}
