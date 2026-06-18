import {
  BeforeInsert,
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum AccountingPeriodStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  LOCKED = 'LOCKED',
}

@Entity('accounting_periods')
export class AccountingPeriod {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('period');
    }
  }

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'varchar', default: AccountingPeriodStatus.OPEN })
  status: AccountingPeriodStatus;

  @Column({ type: 'integer', default: 0 })
  reopenCount: number;

  @Column({ type: 'text', nullable: true })
  closeReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  closedByUsername: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  closedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  reopenedByUsername: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  reopenedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  reopenReason: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  closingJournalEntryId: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  reopenApprovalWorkflowRequest_id: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  lockApprovalWorkflowRequest_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  lockedByUsername: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  lockedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lockReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  periodHash: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
