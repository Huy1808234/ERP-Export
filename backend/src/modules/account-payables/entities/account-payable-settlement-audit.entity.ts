import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { AccountPayable } from './account-payable.entity';
import { AccountPayablePaymentBatch } from './account-payable-payment-batch.entity';

export enum APSettlementAuditType {
  SETTLEMENT = 'SETTLEMENT',
  REVERSAL = 'REVERSAL',
}

@Entity('account_payable_settlement_audits')
@Index('IDX_ap_settlement_ap', ['accountPayableId'])
@Index('IDX_ap_settlement_batch', ['paymentBatchId'])
@Index('IDX_ap_settlement_vendor', ['vendorId', 'settlementDate'])
@Index('IDX_ap_settlement_reversed_audit', ['reversedSettlementAudit_id'])
export class AccountPayableSettlementAudit {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('ap_settle');
    }
  }

  @Column({ type: 'varchar', length: 40 })
  accountPayableId: string;

  @ManyToOne(() => AccountPayable, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'accountPayableId' })
  accountPayable: AccountPayable;

  @Column({ type: 'varchar', length: 40, nullable: true })
  paymentBatchId: string | null;

  @ManyToOne(() => AccountPayablePaymentBatch, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'paymentBatchId' })
  paymentBatch: AccountPayablePaymentBatch | null;

  @Column({ type: 'varchar', length: 40 })
  vendorId: string;

  @ManyToOne(() => Partner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Partner;

  @Column({ type: 'varchar', length: 40, nullable: true })
  vendorInvoiceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  invoiceNumber: string | null;

  @Column({ type: 'timestamp' })
  settlementDate: Date;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 6,
    default: 1,
    transformer: new ColumnNumericTransformer(),
  })
  exchangeRate: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  amountVnd: number;

  @Column({ type: 'varchar', default: 'VND' })
  currency: string;

  @Column({ type: 'varchar', nullable: true })
  paymentMethod: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankReference: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  bankProofFileId: string | null;

  @Column({ type: 'text', nullable: true })
  bankProofUrl: string | null;

  @Column({ type: 'text', nullable: true })
  settlementNote: string | null;

  @Column({ type: 'varchar', default: APSettlementAuditType.SETTLEMENT })
  auditType: APSettlementAuditType;

  @Column({ type: 'varchar', length: 40, nullable: true })
  reversedSettlementAudit_id: string | null;

  @ManyToOne(() => AccountPayableSettlementAudit, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'reversedSettlementAudit_id' })
  reversedSettlementAudit: AccountPayableSettlementAudit | null;

  @Column({ type: 'timestamp', nullable: true })
  reversedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  reversedByUsername: string | null;

  @Column({ type: 'text', nullable: true })
  reversalReason: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  approvalWorkflowRequestId: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  reversalJournalEntry_id: string | null;

  @Column({ type: 'varchar' })
  settledByUsername: string;

  @CreateDateColumn()
  createdAt: Date;
}
