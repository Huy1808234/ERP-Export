import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Partner } from '../../partners/entities/partner.entity';
import { SalesContractItem } from './sales-contract-item.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { Incoterm } from '../../quotations/entities/quotation.entity';
import { createEntityId } from '@/common/ids/entity-id.util';
import { ContractSignature } from './contract-signature.entity';
import { ContractSignatureInvitation } from './contract-signature-invitation.entity';
import { Port } from '@/modules/ports/entities/port.entity';

export enum SalesContractStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  PENDING_BUYER_SIGNATURE = 'PENDING_BUYER_SIGNATURE',
  BUYER_SIGNED = 'BUYER_SIGNED',
  PENDING_CANCEL_APPROVAL = 'PENDING_CANCEL_APPROVAL',
  REJECTED = 'REJECTED',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum SalesContractSignatureStatus {
  NOT_SENT = 'NOT_SENT',
  PENDING_BUYER = 'PENDING_BUYER',
  BUYER_SIGNED = 'BUYER_SIGNED',
  COUNTER_SIGNED = 'COUNTER_SIGNED',
  COMPLETED = 'COMPLETED',
}

@Entity('sales_contracts')
export class SalesContract {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('sc');
    }
  }

  @Column({ unique: true })
  contractNumber: string;

  @Column()
  buyerId: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  proformaInvoiceId: string | null;

  @ManyToOne('ProformaInvoice', { nullable: true })
  @JoinColumn({ name: 'proformaInvoiceId' })
  proformaInvoice: any;

  @ManyToOne(() => Partner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyerId' })
  buyer: Partner;

  @Column({
    type: 'enum',
    enum: SalesContractStatus,
    default: SalesContractStatus.DRAFT,
  })
  status: SalesContractStatus;

  @Column({ type: 'enum', enum: Incoterm })
  incoterm: Incoterm;

  @Column()
  currencyCode: string;

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
  totalAmountVnd: number;

  @Column({ type: 'date', nullable: true })
  deliveryDate: string | null;

  @Column({ type: 'date', nullable: true })
  validUntil: string | null;

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

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  logisticsFee: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  otherFee: number;

  @Column({ type: 'text', nullable: true })
  paymentTerms: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => SalesContractItem, (item) => item.salesContract, {
    cascade: true,
  })
  items: SalesContractItem[];

  @OneToMany(() => ContractSignature, (signature) => signature.contract)
  signatures: ContractSignature[];

  @OneToMany(
    () => ContractSignatureInvitation,
    (invitation) => invitation.contract,
  )
  signatureInvitations: ContractSignatureInvitation[];

  @Column({ type: 'varchar', nullable: true })
  createdByUsername: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  approvalWorkflowRequestId: string | null;

  @Column({ type: 'varchar', nullable: true })
  submittedForApprovalByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  submittedForApprovalAt: Date | null;

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

  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  cancelledByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'varchar', default: SalesContractSignatureStatus.NOT_SENT })
  signatureStatus: SalesContractSignatureStatus;

  @Column({ type: 'varchar', nullable: true })
  signatureRequestedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  signatureRequestedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  buyerSignedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  counterSignedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  signatureDocumentHash: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  logisticsPartnerId: string | null;

  @ManyToOne('Partner', { nullable: true })
  @JoinColumn({ name: 'logisticsPartnerId' })
  logisticsPartner: any;

  @Column({ type: 'varchar', nullable: true })
  bookingNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  pol: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  pol_port_id: string | null;

  @ManyToOne(() => Port, { nullable: true })
  @JoinColumn({ name: 'pol_port_id' })
  polPort: Port | null;

  @Column({ type: 'varchar', nullable: true })
  pod: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  pod_port_id: string | null;

  @ManyToOne(() => Port, { nullable: true })
  @JoinColumn({ name: 'pod_port_id' })
  podPort: Port | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
