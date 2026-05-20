import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';
import { AccountPayable } from './account-payable.entity';
import { Partner } from '@/modules/partners/entities/partner.entity';

export enum APPaymentBatchStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED_LEVEL_1 = 'APPROVED_LEVEL_1',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

@Entity('account_payable_payment_batches')
@Index('UDX_ap_payment_batch_number', ['batchNumber'], { unique: true })
@Index('IDX_ap_payment_batch_status', ['status', 'paymentDate'])
export class AccountPayablePaymentBatch {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('ap_batch');
    }
  }

  @Column({ type: 'varchar' })
  batchNumber: string;

  @Column({ type: 'enum', enum: APPaymentBatchStatus, default: APPaymentBatchStatus.DRAFT })
  status: APPaymentBatchStatus;

  @Column({ type: 'varchar', default: 'VND' })
  currency: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  totalAmount: number;

  @Column({ type: 'numeric', precision: 15, scale: 6, default: 1, transformer: new ColumnNumericTransformer() })
  exchangeRate: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  totalAmountVnd: number;

  @Column({ type: 'date', nullable: true })
  paymentDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  paymentMethod: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankReference: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  bankProofFileId: string | null;

  @Column({ type: 'text', nullable: true })
  bankProofUrl: string | null;

  @Column({ type: 'timestamp', nullable: true })
  bankTransferAt: Date | null;

  @Column({ type: 'text', nullable: true })
  settlementNote: string | null;

  @Column({ type: 'varchar' })
  createdByUsername: string;

  @Column({ type: 'varchar', nullable: true })
  submittedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  approvalWorkflowRequestId: string | null;

  @Column({ type: 'varchar', nullable: true })
  firstApprovedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  firstApprovedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  finalApprovedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  finalApprovedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  rejectedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  paidByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  paymentJournalEntryId: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @OneToMany(() => AccountPayablePaymentBatchItem, (item) => item.batch, { cascade: true })
  items: AccountPayablePaymentBatchItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('account_payable_payment_batch_items')
@Index('IDX_ap_payment_batch_item_batch', ['batchId'])
@Index('IDX_ap_payment_batch_item_ap', ['accountPayableId'])
export class AccountPayablePaymentBatchItem {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('ap_batch_item');
    }
  }

  @Column({ type: 'varchar', length: 40 })
  batchId: string;

  @ManyToOne(() => AccountPayablePaymentBatch, (batch) => batch.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batchId' })
  batch: AccountPayablePaymentBatch;

  @Column({ type: 'varchar', length: 40 })
  accountPayableId: string;

  @ManyToOne(() => AccountPayable, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'accountPayableId' })
  accountPayable: AccountPayable;

  @Column({ type: 'varchar', length: 40 })
  vendorId: string;

  @ManyToOne(() => Partner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Partner;

  @Column({ type: 'varchar', length: 40, nullable: true })
  vendorInvoiceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  invoiceNumber: string | null;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  amount: number;

  @Column({ type: 'varchar', default: 'VND' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
