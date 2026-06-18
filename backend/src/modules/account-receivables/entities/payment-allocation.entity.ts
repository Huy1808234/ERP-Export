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
import { AccountReceivable } from './account-receivable.entity';

@Entity('payment_allocations')
@Index('idx_payment_allocations_ar', ['accountReceivableId'])
@Index('idx_payment_allocations_trade_finance', ['tradeFinanceTransactionId'])
export class PaymentAllocation {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('payalloc');
    }
  }

  @Column()
  accountReceivableId: string;

  @ManyToOne(() => AccountReceivable, (ar) => ar.allocations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'accountReceivableId' })
  accountReceivable: AccountReceivable;

  @Column({ type: 'varchar', length: 40, nullable: true })
  tradeFinanceTransactionId: string | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  allocatedAmountForeign: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  allocatedAmountVnd: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 6,
    default: 1,
    transformer: new ColumnNumericTransformer(),
  })
  exchangeRate: number;

  @Column({ type: 'timestamp' })
  allocatedAt: Date;

  @Column()
  allocatedByUsername: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
