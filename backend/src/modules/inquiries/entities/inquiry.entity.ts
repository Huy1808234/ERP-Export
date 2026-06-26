import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum InquiryStatus {
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  QUOTED = 'QUOTED',
  CLOSED = 'CLOSED',
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  REJECTED = 'REJECTED',
}

export type InquiryLineItemSnapshot = {
  product_id: string;
  productSnapshotName: string | null;
  productSnapshotCode: string | null;
  unitOfMeasure: string | null;
  quantity: number;
  targetPrice: number | null;
  note: string | null;
};

export type InquiryAuditEvent = {
  action: 'SUBMITTED' | 'STATUS_CHANGED';
  username: string;
  at: string;
  ipAddress?: string | null;
  fromStatus?: InquiryStatus;
  toStatus?: InquiryStatus;
};

@Entity('product_inquiries')
export class Inquiry {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('inquiry');
    }
  }

  @Column({ type: 'varchar', unique: true, nullable: true })
  inquiryNumber: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  buyer_id: string | null;

  @Column()
  customerName: string;

  @Column()
  customerEmail: string;

  @Column({ nullable: true })
  customerPhone: string;

  @Column({ type: 'varchar', length: 40 })
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ nullable: true })
  productSnapshotName: string;

  @Column({ nullable: true })
  productSnapshotCode: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  lineItems: InquiryLineItemSnapshot[];

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 1 })
  quantity: number;

  @Column({ type: 'varchar', nullable: true })
  incoterm: string | null;

  @Column({ type: 'varchar', nullable: true })
  destinationPort: string | null;

  @Column({ type: 'timestamp', nullable: true })
  expectedShipmentDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  targetPriceCurrency: string | null;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({
    type: 'enum',
    enum: InquiryStatus,
    default: InquiryStatus.SUBMITTED,
  })
  status: InquiryStatus;

  @Column({ type: 'varchar', nullable: true })
  assigned_sales_username: string | null;

  @Column({ type: 'varchar', nullable: true })
  created_by_username: string | null;

  @Column({ type: 'varchar', nullable: true })
  sourceIp: string | null;

  @Column({ type: 'varchar', nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'jsonb', nullable: true })
  requestSnapshot: Record<string, unknown> | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  auditTrail: InquiryAuditEvent[];

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
