import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum TaxReportRunStatus {
  FROZEN = 'FROZEN',
}

@Entity('tax_report_runs')
@Index('idx_tax_report_runs_period', ['periodStart', 'periodEnd'])
@Index('idx_tax_report_runs_accounting_period', ['accountingPeriod_id'])
@Index('idx_tax_report_runs_hash', ['runHash'], { unique: true })
export class TaxReportRun {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('tax_run');
    }
  }

  @Column({ unique: true })
  runNumber: string;

  @Column({ type: 'date' })
  periodStart: Date;

  @Column({ type: 'date' })
  periodEnd: Date;

  @Column({ type: 'varchar', length: 40, nullable: true })
  accountingPeriod_id: string | null;

  @Column({ type: 'varchar', default: TaxReportRunStatus.FROZEN })
  status: TaxReportRunStatus;

  @Column({ type: 'varchar' })
  generatedByUsername: string;

  @Column({ type: 'timestamp' })
  generatedAt: Date;

  @Column({ type: 'varchar' })
  reportHash: string;

  @Column({ type: 'varchar' })
  runHash: string;

  @Column({ type: 'jsonb' })
  summary: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  accountBreakdown: Record<string, unknown>[];

  @Column({ type: 'jsonb' })
  journalLines: Record<string, unknown>[];

  @Column({ type: 'jsonb' })
  warnings: string[];

  @Column({ type: 'jsonb', nullable: true })
  documentTrace: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  reconciliation: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
