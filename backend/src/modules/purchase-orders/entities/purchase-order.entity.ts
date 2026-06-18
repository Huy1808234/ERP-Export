import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { User } from '@/modules/users/entities/user.entity';
import { PurchaseRequest } from '@/modules/purchase-requests/entities/purchase-request.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SENT = 'SENT',
  PARTIAL_RECEIPT = 'PARTIAL_RECEIPT',
  RECEIVED = 'RECEIVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export type PurchaseOrderAuditEvent = {
  action: string;
  username: string;
  at: string;
  fromStatus?: PurchaseOrderStatus;
  toStatus?: PurchaseOrderStatus;
  reason?: string | null;
};

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('po');
    }
  }

  @Index('UDX_po_number_active', ['poNumber'], {
    unique: true,
    where: '"deletedAt" IS NULL',
  })
  @Column()
  poNumber: string;

  @Column({ type: 'varchar', nullable: true })
  purchaseRequestId: string | null;

  @ManyToOne(() => PurchaseRequest, { nullable: true })
  @JoinColumn({ name: 'purchaseRequestId' })
  purchaseRequest: PurchaseRequest | null;

  @Column({ type: 'varchar', nullable: true })
  proformaInvoiceId: string | null;

  @Column()
  vendorId: string;

  @ManyToOne(() => Partner)
  @JoinColumn({ name: 'vendorId' })
  vendor: Partner;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.DRAFT,
  })
  status: PurchaseOrderStatus;

  @Column({ type: 'timestamp' })
  orderDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  expectedDeliveryDate: Date | null;

  @Column({ type: 'varchar', default: 'VND' })
  currency: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  subTotal: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  taxAmount: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalAmount: number;

  @Column()
  createdByUsername: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdByUsername', referencedColumnName: 'username' })
  createdBy: User;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, {
    cascade: true,
  })
  items: PurchaseOrderItem[];

  @Column({ type: 'text', nullable: true })
  note: string | null;

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

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  cancelledByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  auditTrail: PurchaseOrderAuditEvent[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
