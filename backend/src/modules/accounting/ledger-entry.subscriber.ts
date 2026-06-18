import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
} from 'typeorm';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Injectable } from '@nestjs/common';

/**
 * TECH LEAD NOTE:
 * Subscriber này chỉ nên dùng để log hoặc trigger các side-effect không liên quan đến ACID.
 * Việc cập nhật số dư đối tác đã được chuyển hoàn toàn sang AccountingService
 * để đảm bảo tính nhất quán của giao dịch (Transaction Integrity).
 */
@Injectable()
@EventSubscriber()
export class LedgerEntrySubscriber implements EntitySubscriberInterface<LedgerEntry> {
  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return LedgerEntry;
  }

  async afterInsert(event: InsertEvent<LedgerEntry>) {
    // Không thực hiện cập nhật số dư tại đây để tránh Double-Update và Race Condition.
    // Logic đã được chuyển sang AccountingService.syncPartnerBalance
  }
}
