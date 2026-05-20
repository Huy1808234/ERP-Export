import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum VatRefundStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

@Entity('vat_refund_dossiers')
@Index('idx_vat_refund_dossiers_period', ['periodStart', 'periodEnd'])
@Index('idx_vat_refund_dossiers_status', ['status'])
export class VatRefundDossier {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('vat_refund');
    }
  }

  @Column({ unique: true })
  dossierNumber: string;

  @Column({ type: 'date' })
  periodStart: Date;

  @Column({ type: 'date' })
  periodEnd: Date;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  exportRevenueVnd: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  inputVatAmount: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  outputVatAmount: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  refundAmount: number;

  @Column({ type: 'varchar', nullable: true })
  taxReportHash: string | null;

  @Column({ type: 'jsonb', nullable: true })
  taxReportSnapshot: Record<string, unknown> | null;

  @Column({ type: 'enum', enum: VatRefundStatus, default: VatRefundStatus.DRAFT })
  status: VatRefundStatus;

  @Column({ type: 'varchar' })
  createdByUsername: string;

  @Column({ type: 'varchar', nullable: true })
  submittedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  approvedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  approvalWorkflowRequestId: string | null;

  @Column({ type: 'varchar', nullable: true })
  rejectedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  paidByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  receivableJournalEntryId: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  paymentJournalEntryId: string | null;

  @Column({ type: 'varchar', nullable: true })
  paymentReference: string | null;

  @Column({ type: 'text', nullable: true })
  approvalNote: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
