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
import { PortalPaymentReceipt } from '@/modules/portal/entities/portal-payment-receipt.entity';

export enum SepayTransferType {
  IN = 'in',
  OUT = 'out',
}

export enum SepayTransactionStatus {
  RECEIVED = 'RECEIVED',
  MATCHED = 'MATCHED',
  CONFIRMED = 'CONFIRMED',
  IGNORED = 'IGNORED',
  FAILED = 'FAILED',
}

@Entity('sepay_transactions')
@Index('idx_sepay_transactions_reference', ['referenceCode'])
@Index('idx_sepay_transactions_code', ['code'])
export class SepayTransaction {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId(): void {
    if (!this._id) {
      this._id = createEntityId('sepay');
    }
  }

  @Column({ unique: true })
  externalTransactionId: string;

  @Column({ type: 'varchar', nullable: true })
  gateway: string | null;

  @Column({ type: 'timestamp', nullable: true })
  transactionDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  accountNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  subAccount: string | null;

  @Column({ type: 'enum', enum: SepayTransferType })
  transferType: SepayTransferType;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  transferAmount: number;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  accumulated: number | null;

  @Column({ type: 'varchar', nullable: true })
  code: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'varchar', nullable: true })
  referenceCode: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: SepayTransactionStatus })
  status: SepayTransactionStatus;

  @Column({ type: 'varchar', length: 40, nullable: true })
  matchedPortalReceiptId: string | null;

  @ManyToOne(() => PortalPaymentReceipt, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'matchedPortalReceiptId' })
  matchedPortalReceipt: PortalPaymentReceipt | null;

  @Column({ type: 'timestamp', nullable: true })
  matchedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  processingNote: string | null;

  @Column({ type: 'jsonb' })
  rawPayload: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
