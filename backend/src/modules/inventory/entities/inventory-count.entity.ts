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
import { Product } from '@/modules/products/entities/product.entity';

export enum InventoryCountStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  CANCELLED = 'CANCELLED',
}

export type InventoryCountAuditEventType =
  | 'CREATED'
  | 'COUNT_SAVED'
  | 'SUBMITTED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'LEDGER_POSTED';

export interface InventoryCountAuditEvent {
  eventType: InventoryCountAuditEventType;
  actorUsername: string;
  occurredAt: string;
  note?: string | null;
  metadata?: Record<string, unknown>;
}

@Entity('inventory_counts')
@Index(['status', 'countDate'])
export class InventoryCount {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('invcount');
    }
  }

  @Column({ unique: true })
  countNumber: string;

  @Column({ type: 'date' })
  countDate: Date;

  @Column({ default: 'Main Warehouse' })
  warehouseName: string;

  @Column({
    type: 'enum',
    enum: InventoryCountStatus,
    default: InventoryCountStatus.DRAFT,
  })
  status: InventoryCountStatus;

  @Column()
  createdByUsername: string;

  @Column({ type: 'varchar', nullable: true })
  submittedByUsername: string;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  approvedByUsername: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  approvalNote: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  approvalWorkflowRequestId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  auditTrail: InventoryCountAuditEvent[] | null;

  @OneToMany(() => InventoryCountItem, (item) => item.count, { cascade: true })
  items: InventoryCountItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('inventory_count_items')
@Index(['countId', 'productId'])
export class InventoryCountItem {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('count_item');
    }
  }

  @Column()
  countId: string;

  @ManyToOne(() => InventoryCount, (count) => count.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'countId' })
  count: InventoryCount;

  @Column()
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  systemQuantity: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  countedQuantity: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  varianceQuantity: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  unitCost: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  varianceValue: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
