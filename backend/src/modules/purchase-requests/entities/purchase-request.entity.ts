import { BeforeInsert, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { PurchaseRequestItem } from './purchase-request-item.entity';
import { User } from '@/modules/users/entities/user.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum PurchaseRequestStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PARTIAL_PO = 'PARTIAL_PO',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum PurchaseRequestPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

@Entity('purchase_requests')
export class PurchaseRequest {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @Column({ unique: true })
  prNumber: string;

  @Column({ type: 'text', nullable: true })
  purpose: string | null;

  @Column({ type: 'varchar', nullable: true })
  department: string | null;

  @Column({
    type: 'enum',
    enum: PurchaseRequestPriority,
    default: PurchaseRequestPriority.MEDIUM
  })
  priority: PurchaseRequestPriority;

  @Column({ type: 'varchar', nullable: true })
  project: string | null;

  @Column({
    type: 'enum',
    enum: PurchaseRequestStatus,
    default: PurchaseRequestStatus.DRAFT
  })
  status: PurchaseRequestStatus;

  @Column({ type: 'varchar', length: 40, nullable: true })
  approvalWorkflowRequestId: string | null;

  @Column({ type: 'varchar', nullable: true })
  submittedForApprovalByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  submittedForApprovalAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  requiredDate: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expectedDate: Date | null;

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

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @OneToMany(() => PurchaseRequestItem, (item) => item.purchaseRequest, { cascade: true, orphanedRowAction: 'delete' })
  items: PurchaseRequestItem[];

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('pr');
    }
  }
}
