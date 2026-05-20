import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum AccountingPeriodClosePacketStatus {
  GENERATED = 'GENERATED',
}

@Entity('accounting_period_close_packets')
@Index('idx_accounting_close_packets_period', ['period_id'])
@Index('idx_accounting_close_packets_tax_run', ['taxReportRun_id'])
@Index('idx_accounting_close_packets_hash', ['packetHash'], { unique: true })
export class AccountingPeriodClosePacket {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('close_packet');
    }
  }

  @Column({ unique: true })
  packetNumber: string;

  @Column({ type: 'varchar', length: 40 })
  period_id: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  taxReportRun_id: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  closingJournalEntry_id: string | null;

  @Column({ type: 'date' })
  periodStart: Date;

  @Column({ type: 'date' })
  periodEnd: Date;

  @Column({ type: 'varchar', default: AccountingPeriodClosePacketStatus.GENERATED })
  status: AccountingPeriodClosePacketStatus;

  @Column({ type: 'varchar' })
  generatedByUsername: string;

  @Column({ type: 'timestamp' })
  generatedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  periodHash: string | null;

  @Column({ type: 'varchar' })
  preCloseTrialBalanceHash: string;

  @Column({ type: 'varchar' })
  finalTrialBalanceHash: string;

  @Column({ type: 'varchar', nullable: true })
  taxReportHash: string | null;

  @Column({ type: 'varchar', nullable: true })
  auditChainHeadHash: string | null;

  @Column({ type: 'varchar' })
  packetHash: string;

  @Column({ type: 'integer', default: 0 })
  journalCount: number;

  @Column({ type: 'integer', default: 0 })
  warningCount: number;

  @Column({ type: 'integer', default: 0 })
  failedCheckCount: number;

  @Column({ type: 'jsonb' })
  closeChecklist: Record<string, unknown>[];

  @Column({ type: 'jsonb' })
  preCloseTrialBalanceSnapshot: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  finalTrialBalanceSnapshot: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  taxReportSnapshot: Record<string, unknown> | null;

  @Column({ type: 'jsonb' })
  fxRevaluationSnapshot: Record<string, unknown>[];

  @Column({ type: 'jsonb' })
  vatRefundSnapshot: Record<string, unknown>[];

  @Column({ type: 'jsonb' })
  journalSummary: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
