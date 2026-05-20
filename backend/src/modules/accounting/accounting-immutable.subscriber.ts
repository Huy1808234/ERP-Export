import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  RemoveEvent,
  SoftRemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { AccountingAuditEvent } from './entities/accounting-audit-event.entity';
import { AccountingPeriodClosePacket } from './entities/accounting-period-close-packet.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { TaxReportRun } from './entities/tax-report-run.entity';

const IMMUTABLE_ENTITY_NAMES = new Set([
  AccountingAuditEvent.name,
  AccountingPeriodClosePacket.name,
  JournalEntry.name,
  LedgerEntry.name,
  TaxReportRun.name,
]);

@Injectable()
@EventSubscriber()
export class AccountingImmutableSubscriber implements EntitySubscriberInterface {
  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  beforeUpdate(event: UpdateEvent<object>) {
    this.assertMutable(event.metadata.name, 'update');
  }

  beforeRemove(event: RemoveEvent<object>) {
    this.assertMutable(event.metadata.name, 'delete');
  }

  beforeSoftRemove(event: SoftRemoveEvent<object>) {
    this.assertMutable(event.metadata.name, 'soft-delete');
  }

  private assertMutable(entityName: string, action: string) {
    if (!IMMUTABLE_ENTITY_NAMES.has(entityName)) return;

    throw new BadRequestException(
      `Accounting artifact ${entityName} is immutable; use reversal/correction workflow instead of ${action}.`,
    );
  }
}
