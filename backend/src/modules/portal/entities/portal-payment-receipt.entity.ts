import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { AccountReceivable } from '@/modules/account-receivables/entities/account-receivable.entity';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { FileAsset } from '@/modules/files/entities/file-asset.entity';
import { TradeFinanceTransaction } from '@/modules/trade-finance/entities/trade-finance-transaction.entity';

export enum PortalReceiptType {
  TT_ADVANCE = 'TT_ADVANCE',
  TT_BALANCE = 'TT_BALANCE',
  SWIFT = 'SWIFT',
  VIETQR = 'VIETQR',
}

export enum PortalReceiptStatus {
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
}

export type PortalReceiptAuditEvent = {
  action: 'SUBMITTED' | 'CONFIRMED' | 'REJECTED';
  username: string;
  at: string;
  note?: string | null;
  fileAsset_id?: string | null;
  transferReference?: string | null;
  tradeFinanceTransactionId?: string | null;
};

@Entity('portal_payment_receipts')
@Index('idx_portal_payment_receipts_buyer', ['buyerId'])
@Index('idx_portal_payment_receipts_ar', ['accountReceivableId'])
@Index('idx_portal_payment_receipts_contract', ['salesContractId'])
export class PortalPaymentReceipt {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('portal_receipt');
    }
  }

  @Column({ unique: true })
  receiptNumber: string;

  @Column({ type: 'varchar', length: 40 })
  buyerId: string;

  @ManyToOne(() => Partner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyerId' })
  buyer: Partner;

  @Column({ type: 'varchar', length: 40, nullable: true })
  accountReceivableId: string | null;

  @ManyToOne(() => AccountReceivable, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'accountReceivableId' })
  accountReceivable: AccountReceivable | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  salesContractId: string | null;

  @ManyToOne(() => SalesContract, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'salesContractId' })
  salesContract: SalesContract | null;

  @Column({ type: 'enum', enum: PortalReceiptType, nullable: true })
  receiptType: PortalReceiptType | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 6,
    default: 1,
    transformer: new ColumnNumericTransformer(),
  })
  exchangeRate: number;

  @Column({ type: 'varchar', nullable: true })
  bankReference: string | null;

  @Column({ type: 'varchar', nullable: true })
  remittingBank: string | null;

  @Column({ type: 'timestamp', nullable: true })
  transactionDate: Date | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  fileAsset_id: string | null;

  @ManyToOne(() => FileAsset, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fileAsset_id' })
  fileAsset: FileAsset | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  tradeFinanceTransactionId: string | null;

  @ManyToOne(() => TradeFinanceTransaction, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'tradeFinanceTransactionId' })
  tradeFinanceTransaction: TradeFinanceTransaction | null;

  @Column({
    type: 'enum',
    enum: PortalReceiptStatus,
    default: PortalReceiptStatus.SUBMITTED,
  })
  status: PortalReceiptStatus;

  @Column({ type: 'varchar' })
  submittedByUsername: string;

  @Column({ type: 'timestamp' })
  submittedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  reviewedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'jsonb', nullable: true })
  auditTrail: PortalReceiptAuditEvent[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
