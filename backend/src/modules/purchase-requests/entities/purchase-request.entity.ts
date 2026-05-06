import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn, DeleteDateColumn } from 'typeorm';
import { PurchaseRequestItem } from './purchase-request-item.entity';
import { User } from '@/modules/users/entities/user.entity';

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
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ type: 'timestamp', nullable: true })
  requiredDate: Date | null;

  @Column()
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ nullable: true })
  approvedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approvedById' })
  approvedBy: User | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @OneToMany(() => PurchaseRequestItem, (item) => item.purchaseRequest, { cascade: true })
  items: PurchaseRequestItem[];

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
