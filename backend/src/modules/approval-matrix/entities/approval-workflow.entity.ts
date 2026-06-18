import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';
import type { JsonRecord } from '@/common/types/authenticated-user.type';
import { ApprovalDocumentType, ApprovalRule } from './approval-rule.entity';

export enum ApprovalRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum ApprovalStepStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SKIPPED = 'SKIPPED',
}

@Entity('approval_workflow_requests')
@Index('idx_approval_requests_document', ['documentType', 'documentId'])
@Index('idx_approval_requests_status', ['status', 'currentStepOrder'])
export class ApprovalWorkflowRequest {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('approval_req');
    }
  }

  @Column({ type: 'varchar', length: 40, nullable: true })
  ruleId: string | null;

  @ManyToOne(() => ApprovalRule, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ruleId' })
  rule: ApprovalRule | null;

  @Column({ type: 'varchar' })
  documentType: ApprovalDocumentType;

  @Column({ type: 'varchar', length: 40 })
  documentId: string;

  @Column({ type: 'varchar', nullable: true })
  documentNumber: string | null;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar', default: 'VND' })
  currency: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
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
  amountVnd: number;

  @Column({ type: 'varchar', default: ApprovalRequestStatus.PENDING })
  status: ApprovalRequestStatus;

  @Column({ type: 'integer', default: 1 })
  currentStepOrder: number;

  @Column({ type: 'varchar' })
  requesterUsername: string;

  @Column({ type: 'varchar', nullable: true })
  completedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: JsonRecord;

  @OneToMany(() => ApprovalWorkflowStep, (step) => step.request, {
    cascade: true,
  })
  steps: ApprovalWorkflowStep[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('approval_workflow_steps')
@Index('idx_approval_steps_request_order', ['requestId', 'stepOrder'], {
  unique: true,
})
@Index('idx_approval_steps_assignee', [
  'status',
  'approverRoleName',
  'approverUsername',
])
export class ApprovalWorkflowStep {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('approval_step');
    }
  }

  @Column({ type: 'varchar', length: 40 })
  requestId: string;

  @ManyToOne(() => ApprovalWorkflowRequest, (request) => request.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'requestId' })
  request: ApprovalWorkflowRequest;

  @Column({ type: 'integer' })
  stepOrder: number;

  @Column({ type: 'varchar' })
  approverRoleName: string;

  @Column({ type: 'varchar', nullable: true })
  approverUsername: string | null;

  @Column({ type: 'varchar', default: ApprovalStepStatus.PENDING })
  status: ApprovalStepStatus;

  @Column({ type: 'varchar', nullable: true })
  actedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  actedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
