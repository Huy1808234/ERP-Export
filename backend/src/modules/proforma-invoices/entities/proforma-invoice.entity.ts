import { BeforeInsert, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Quotation, Incoterm } from '@/modules/quotations/entities/quotation.entity';
import { ProformaInvoiceItem } from './proforma-invoice-item.entity';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum PIStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

@Entity('proforma_invoices')
export class ProformaInvoice {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('pi');
    }
  }

  @Column({ unique: true })
  piNumber: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  quotationId: string | null;

  @ManyToOne(() => Quotation, { nullable: true })
  @JoinColumn({ name: 'quotationId' })
  quotation: Quotation | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  salesContractId: string | null;

  @ManyToOne('SalesContract', { nullable: true })
  @JoinColumn({ name: 'salesContractId' })
  salesContract: any;

  @Column()
  customerId: string;

  @ManyToOne(() => Partner)
  @JoinColumn({ name: 'customerId' })
  customer: Partner;

  @Column({ type: 'enum', enum: PIStatus, default: PIStatus.DRAFT })
  status: PIStatus;

  @Column({ type: 'varchar', length: 40, nullable: true })
  approvalWorkflowRequestId: string | null;

  @Column({ type: 'varchar', nullable: true })
  submittedForApprovalByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  submittedForApprovalAt: Date | null;

  @Column({ type: 'enum', enum: Incoterm, default: Incoterm.FOB })
  incoterm: Incoterm;

  @Column({ type: 'varchar', nullable: true })
  incotermLocation: string;

  @Column({ type: 'varchar', nullable: true })
  portOfLoading: string;

  @Column({ type: 'varchar', nullable: true })
  portOfDischarge: string;

  @Column({ type: 'boolean', default: false })
  isPaid: boolean;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'timestamp' })
  issueDate: Date;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({ type: 'numeric', precision: 15, scale: 6, default: 1, transformer: new ColumnNumericTransformer() })
  exchangeRate: number; // Tỷ giá chốt tại thời điểm phát hành PI

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  totalAmount: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  totalAmountVnd: number; // Giá trị quy đổi VND tại thời điểm chốt PI

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  logisticsFee: number;

  @Column({ type: 'varchar', default: 'USD' })
  logisticsFeeCurrency: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  otherFee: number;

  @Column({ type: 'varchar', default: 'USD' })
  otherFeeCurrency: string;

  // Granular Fees matching Sales Contract
  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  domesticTransportCost: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  portCharges: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  seaFreight: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  insuranceCost: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  depositAmount: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  depositPercent: number;

  @Column({ type: 'text', nullable: true })
  paymentTerms: string;

  @Column()
  createdByUsername: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdByUsername', referencedColumnName: 'username' })
  createdBy: User;

  @Column({ type: 'varchar', nullable: true })
  approvedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  rejectedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @OneToMany(() => ProformaInvoiceItem, (item) => item.proformaInvoice, { cascade: true })
  items: ProformaInvoiceItem[];

  @Column({ type: 'text', nullable: true })
  bankInfo: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
