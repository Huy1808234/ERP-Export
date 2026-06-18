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
import { Partner } from '@/modules/partners/entities/partner.entity';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { PaymentAllocation } from './payment-allocation.entity';

export enum ARStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum ARSourceType {
  SALES_CONTRACT = 'SALES_CONTRACT',
  COMMERCIAL_INVOICE = 'COMMERCIAL_INVOICE',
}

@Entity('account_receivables')
@Index('idx_account_receivables_buyer', ['buyerId'])
@Index('idx_account_receivables_contract', ['salesContractId'])
@Index('idx_account_receivables_commercial_invoice', ['commercialInvoice_id'])
export class AccountReceivable {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('ar');
    }
  }

  @Column()
  buyerId: string;

  @ManyToOne(() => Partner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyerId' })
  buyer: Partner;

  @Column({ type: 'varchar', length: 40, nullable: true })
  salesContractId: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  commercialInvoice_id: string | null;

  @ManyToOne(() => SalesContract, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'salesContractId' })
  salesContract: SalesContract | null;

  @Column({ unique: true })
  invoiceNumber: string;

  @Column({
    type: 'enum',
    enum: ARSourceType,
    default: ARSourceType.COMMERCIAL_INVOICE,
  })
  sourceType: ARSourceType;

  @Column({ type: 'date' })
  invoiceDate: Date;

  @Column({ type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amountForeign: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  paidAmountForeign: number;

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

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amountVnd: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  paidAmountVnd: number;

  @Column({ type: 'enum', enum: ARStatus, default: ARStatus.UNPAID })
  status: ARStatus;

  @Column({ type: 'varchar', length: 40, nullable: true })
  revenueJournalEntryId: string | null;

  @Column({ type: 'varchar', nullable: true })
  createdByUsername: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @OneToMany(
    () => PaymentAllocation,
    (allocation) => allocation.accountReceivable,
  )
  allocations: PaymentAllocation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
