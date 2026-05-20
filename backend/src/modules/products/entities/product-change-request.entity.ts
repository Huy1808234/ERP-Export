import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum ProductChangeRequestStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export type ProductChangedField = {
  field: string;
  before: unknown;
  after: unknown;
  approvedByUsername?: string | null;
  approvedAt?: string | null;
  rejectedByUsername?: string | null;
  rejectedAt?: string | null;
  decisionNote?: string | null;
  approvalWorkflowRequestId?: string | null;
};

export type ProductFieldDecisionAudit = ProductChangedField & {
  decision: 'APPROVED' | 'REJECTED';
  decidedByUsername: string;
  decidedAt: string;
  approvalWorkflowRequestId?: string | null;
  approvalSteps?: Array<{
    stepOrder: number;
    approverRoleName: string;
    approverUsername?: string | null;
    status: string;
    actedByUsername?: string | null;
    actedAt?: string | null;
    note?: string | null;
  }>;
};

@Entity('product_change_requests')
@Index('idx_product_change_requests_product_status', ['productId', 'status'])
export class ProductChangeRequest {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('pcr');
    }
  }

  @Column({ type: 'varchar', length: 40 })
  productId: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'varchar', length: 60, unique: true })
  requestNumber: string;

  @Column({
    type: 'enum',
    enum: ProductChangeRequestStatus,
    default: ProductChangeRequestStatus.PENDING_APPROVAL,
  })
  status: ProductChangeRequestStatus;

  @Column({ type: 'jsonb' })
  proposedPatch: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  changedFields: ProductChangedField[];

  @Column({ type: 'varchar', length: 40, nullable: true })
  approvalWorkflowRequestId: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  fieldDecisionAudit: ProductFieldDecisionAudit[];

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 120 })
  requestedByUsername: string;

  @Column({ type: 'timestamptz' })
  requestedAt: Date;

  @Column({ type: 'varchar', length: 120, nullable: true })
  approvedByUsername: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  rejectedByUsername: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  decisionNote: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
