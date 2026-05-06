import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, DeleteDateColumn } from 'typeorm';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { User } from '@/modules/users/entities/user.entity';
import { QuotationItem } from './quotation-item.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';

export enum QuotationStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CONVERTED = 'CONVERTED' // Chuyển thành PI
}

export enum Incoterm {
  EXW = 'EXW',
  FOB = 'FOB',
  CIF = 'CIF',
  CFR = 'CFR',
  DDP = 'DDP',
  DAP = 'DAP'
}

@Entity('quotations')
export class Quotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  quotationNumber: string;

  @Column()
  customerId: string;

  @ManyToOne(() => Partner)
  @JoinColumn({ name: 'customerId' })
  customer: Partner;

  @Column({ type: 'enum', enum: QuotationStatus, default: QuotationStatus.DRAFT })
  status: QuotationStatus;

  @Column({ type: 'enum', enum: Incoterm, default: Incoterm.FOB })
  incoterm: Incoterm;

  @Column({ type: 'varchar', nullable: true })
  incotermLocation: string; // e.g. "Cát Lái Port"

  @Column({ type: 'varchar', nullable: true })
  portOfLoading: string;

  @Column({ type: 'varchar', nullable: true })
  portOfDischarge: string;

  @Column({ type: 'timestamp' })
  issueDate: Date;

  @Column({ type: 'timestamp' })
  expiryDate: Date;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({ type: 'numeric', precision: 15, scale: 6, default: 1, transformer: new ColumnNumericTransformer() })
  exchangeRate: number; // Tỷ giá chốt tại thời điểm lập báo giá (quy đổi ra VND)

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  totalAmount: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  logisticsFee: number;

  @Column({ type: 'varchar', default: 'USD' })
  logisticsFeeCurrency: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  otherFee: number;

  @Column({ type: 'varchar', default: 'USD' })
  otherFeeCurrency: string;

  @Column({ type: 'text', nullable: true })
  paymentTerms: string;

  @Column({ type: 'text', nullable: true })
  deliveryTerms: string;

  @Column()
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ nullable: true })
  approvedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approvedById' })
  approvedBy: User;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @OneToMany(() => QuotationItem, (item) => item.quotation, { cascade: true })
  items: QuotationItem[];

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