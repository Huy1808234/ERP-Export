import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { VendorInvoice } from '@/modules/vendor-invoices/entities/vendor-invoice.entity';
import { User } from '@/modules/users/entities/user.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum TradeFinanceType {
  TT_ADVANCE = 'TT_ADVANCE',
  TT_BALANCE = 'TT_BALANCE',
  DP = 'DP',
  DA = 'DA',
}

export enum TradeFinanceStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  ACCEPTED = 'ACCEPTED', // For D/A
  PAID = 'PAID',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum ReconciliationStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  PARTIAL = 'PARTIAL',
  OVERPAID = 'OVERPAID',
  UNDERPAID = 'UNDERPAID',
  NOT_REQUIRED = 'NOT_REQUIRED',
  REJECTED = 'REJECTED',
}

@Entity('trade_finance_transactions')
export class TradeFinanceTransaction {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('tf');
    }
  }

  @Column({ type: 'enum', enum: TradeFinanceType })
  type: TradeFinanceType;

  @Column({ nullable: true })
  salesContractId: string;

  @ManyToOne(() => SalesContract)
  @JoinColumn({ name: 'salesContractId' })
  salesContract: SalesContract;

  @Column({ nullable: true })
  vendorInvoiceId: string;

  @ManyToOne(() => VendorInvoice)
  @JoinColumn({ name: 'vendorInvoiceId' })
  vendorInvoice: VendorInvoice;

  @Column({
    type: 'enum',
    enum: TradeFinanceStatus,
    default: TradeFinanceStatus.PENDING,
  })
  status: TradeFinanceStatus;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 1,
    transformer: new ColumnNumericTransformer(),
  })
  exchangeRate: number;

  @Column({ nullable: true })
  bankReference: string;

  @Column({ nullable: true })
  remittingBank: string;

  @Column({ nullable: true })
  receivingBank: string;

  @Column({ type: 'timestamp', nullable: true })
  transactionDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  dueDate: Date; // For D/A

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  expectedAmount: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  varianceAmount: number;

  @Column({ type: 'varchar', default: ReconciliationStatus.PENDING })
  reconciliationStatus: ReconciliationStatus;

  @Column({ nullable: true })
  reconciledByUsername: string;

  @ManyToOne(() => User)
  @JoinColumn({
    name: 'reconciledByUsername',
    referencedColumnName: 'username',
  })
  reconciledBy: User;

  @Column({ type: 'timestamp', nullable: true })
  reconciledAt: Date;

  @Column({ nullable: true })
  journalEntryId: string;

  @Column()
  createdByUsername: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdByUsername', referencedColumnName: 'username' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
