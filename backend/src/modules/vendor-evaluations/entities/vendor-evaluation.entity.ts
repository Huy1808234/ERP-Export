import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { User } from '@/modules/users/entities/user.entity';

export enum VendorEvaluationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum VendorGrade {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
}

@Entity('vendor_evaluations')
export class VendorEvaluation {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('vendor_eval');
    }
  }

  @Column()
  vendorId: string;

  @ManyToOne(() => Partner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Partner;

  @Column({ nullable: true })
  purchaseOrderId: string;

  @Column({ nullable: true })
  goodsReceiptId: string;

  @Column({ nullable: true })
  vendorInvoiceId: string;

  @Column({ type: 'date', nullable: true })
  periodStart: Date;

  @Column({ type: 'date', nullable: true })
  periodEnd: Date;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  qualityScore: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  deliveryScore: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  priceScore: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 80,
    transformer: new ColumnNumericTransformer(),
  })
  communicationScore: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  defectRate: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 100,
    transformer: new ColumnNumericTransformer(),
  })
  onTimeDeliveryRate: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  overallScore: number;

  @Column({ type: 'varchar', default: VendorGrade.C })
  grade: VendorGrade;

  @Column({ type: 'varchar', default: VendorEvaluationStatus.DRAFT })
  status: VendorEvaluationStatus;

  @Column()
  evaluatedByUsername: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'evaluatedByUsername', referencedColumnName: 'username' })
  evaluatedBy: User;

  @Column({ nullable: true })
  submittedByUsername: string;

  @Column({ nullable: true })
  approvedByUsername: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approvedByUsername', referencedColumnName: 'username' })
  approvedBy: User;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'text', nullable: true })
  approvalNote: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
