import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, DeleteDateColumn } from 'typeorm';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { User } from '@/modules/users/entities/user.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';

export enum TradeFinanceType {
  TT_ADVANCE = 'TT_ADVANCE',
  TT_BALANCE = 'TT_BALANCE',
  DP = 'DP',
  DA = 'DA'
}

export enum TradeFinanceStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  ACCEPTED = 'ACCEPTED', // For D/A
  PAID = 'PAID',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

@Entity('trade_finance_transactions')
export class TradeFinanceTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TradeFinanceType })
  type: TradeFinanceType;

  @Column()
  salesContractId: string;

  @ManyToOne(() => SalesContract)
  @JoinColumn({ name: 'salesContractId' })
  salesContract: SalesContract;

  @Column({ type: 'enum', enum: TradeFinanceStatus, default: TradeFinanceStatus.PENDING })
  status: TradeFinanceStatus;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  amount: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 1, transformer: new ColumnNumericTransformer() })
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

  @Column({ nullable: true })
  journalEntryId: string;

  @Column()
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
