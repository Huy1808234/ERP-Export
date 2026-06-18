import {
  Column,
  BeforeInsert,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum APStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  VOID = 'VOID',
}

@Entity('account_payables')
@Index('idx_account_payables_vendor', ['vendorId'])
export class AccountPayable {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('ap');
    }
  }

  @Column()
  vendorId: string;

  @ManyToOne(() => Partner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Partner;

  @Column({ type: 'varchar', length: 40, nullable: true })
  vendorInvoiceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  invoiceNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  invoiceSeries: string | null;

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
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  paidAmount: number;

  @Column({ type: 'varchar', default: 'VND' })
  currency: string;

  @Column({ type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'enum', enum: APStatus, default: APStatus.UNPAID })
  status: APStatus;

  @Column({ type: 'boolean', default: false })
  isApprovedForPayment: boolean;

  @Column({ type: 'varchar', nullable: true })
  approvedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  paidByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  voidedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  voidedByUsername: string | null;

  @Column({ type: 'text', nullable: true })
  voidReason: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
