import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { User } from '@/modules/users/entities/user.entity';
import { QuotationItem } from './quotation-item.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';
import { Port } from '@/modules/ports/entities/port.entity';

export enum QuotationStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CONVERTED = 'CONVERTED', // Chuyển thành PI
}

export enum Incoterm {
  EXW = 'EXW',
  FOB = 'FOB',
  CIF = 'CIF',
  CFR = 'CFR',
  DDP = 'DDP',
  DAP = 'DAP',
}

@Entity('quotations')
export class Quotation {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('quote');
    }
  }

  @Column({ unique: true })
  quotationNumber: string;

  @Column()
  customerId: string;

  @ManyToOne(() => Partner)
  @JoinColumn({ name: 'customerId' })
  customer: Partner;

  @Column({
    type: 'enum',
    enum: QuotationStatus,
    default: QuotationStatus.DRAFT,
  })
  status: QuotationStatus;

  @Column({ type: 'varchar', length: 40, nullable: true })
  approvalWorkflowRequestId: string | null;

  @Column({ type: 'varchar', nullable: true })
  submittedForApprovalByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  submittedForApprovalAt: Date | null;

  @Column({ type: 'enum', enum: Incoterm, default: Incoterm.FOB })
  incoterm: Incoterm;

  @Column({ type: 'varchar', nullable: true })
  incotermLocation: string; // e.g. "Cát Lái Port"

  @Column({ type: 'varchar', nullable: true })
  portOfLoading: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  portOfLoading_port_id: string | null;

  @ManyToOne(() => Port, { nullable: true })
  @JoinColumn({ name: 'portOfLoading_port_id' })
  portOfLoadingPort: Port | null;

  @Column({ type: 'varchar', nullable: true })
  portOfDischarge: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  portOfDischarge_port_id: string | null;

  @ManyToOne(() => Port, { nullable: true })
  @JoinColumn({ name: 'portOfDischarge_port_id' })
  portOfDischargePort: Port | null;

  @Column({ type: 'timestamp' })
  issueDate: Date;

  @Column({ type: 'timestamp' })
  expiryDate: Date;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 6,
    default: 1,
    transformer: new ColumnNumericTransformer(),
  })
  exchangeRate: number; // Tỷ giá chốt tại thời điểm lập báo giá (quy đổi ra VND)

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalAmount: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  logisticsFee: number;

  // Granular Fees matching Sales Contract
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  domesticTransportCost: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  portCharges: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  seaFreight: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  insuranceCost: number;

  @Column({ type: 'varchar', default: 'USD' })
  logisticsFeeCurrency: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  otherFee: number;

  @Column({ type: 'varchar', default: 'USD' })
  otherFeeCurrency: string;

  @Column({ type: 'text', nullable: true })
  paymentTerms: string;

  @Column({ type: 'text', nullable: true })
  deliveryTerms: string;

  @Column()
  createdByUsername: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdByUsername', referencedColumnName: 'username' })
  createdBy: User;

  @Column({ type: 'varchar', nullable: true })
  approvedByUsername: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approvedByUsername', referencedColumnName: 'username' })
  approvedBy: User | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  rejectedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @OneToMany(() => QuotationItem, (item) => item.quotation, { cascade: true })
  items: QuotationItem[];

  @OneToMany('ProformaInvoice', 'quotation')
  proformaInvoices: any[];

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'text', nullable: true })
  bankInfo: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
