import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { JournalEntry } from './entities/journal-entry.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { AccountingListener } from './accounting.listener';
import { CurrenciesModule } from '../currencies/currencies.module';
import { LedgerEntrySubscriber } from './ledger-entry.subscriber';

@Module({
  imports: [
    TypeOrmModule.forFeature([JournalEntry, LedgerEntry]),
    CurrenciesModule,
  ],
  controllers: [AccountingController],
  providers: [AccountingService, AccountingListener, LedgerEntrySubscriber],
  exports: [AccountingService],
})
export class AccountingModule {}
