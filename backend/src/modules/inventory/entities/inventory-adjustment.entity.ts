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
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';
import { Product } from '@/modules/products/entities/product.entity';
import { InventoryLedger } from './inventory-ledger.entity';

export enum InventoryAdjustmentStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export type InventoryAdjustmentAuditEvent = {
  eventType: 'REQUESTED' | 'APPROVED' | 'REJECTED';
  actorUsername: string;
  occurredAt: string;
  note?: string | null;
  metadata?: Record<string, unknown>;
};

export type InventoryAdjustmentValuationSnapshot = {
  productId: string;
  capturedAt: string;
  stockBefore: number;
  reservedBefore: number;
  quantityDelta: number;
  unitCost: number;
  stockValueBefore: number;
  stockAfter: number;
  stockValueAfter: number;
  valuationMethod: 'FIFO';
};

@Entity('inventory_adjustments')
@Index('idx_inventory_adjustments_status_date', ['status', 'requestedAt'])
@Index('idx_inventory_adjustments_product', ['productId'])
export class InventoryAdjustment {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('inv_adj');
    }
  }

  @Column({ type: 'varchar', length: 60, unique: true })
  adjustmentNumber: string;

  @Column({ type: 'varchar', length: 40 })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  adjustmentQuantity: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  unitPrice: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  amountVnd: number;

  @Column({ type: 'varchar', nullable: true })
  lotNumber: string | null;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'jsonb', nullable: true })
  valuationSnapshot: InventoryAdjustmentValuationSnapshot | null;

  @Column({ type: 'jsonb', nullable: true })
  appliedValuationSnapshot: InventoryAdjustmentValuationSnapshot | null;

  @Column({
    type: 'enum',
    enum: InventoryAdjustmentStatus,
    default: InventoryAdjustmentStatus.PENDING_APPROVAL,
  })
  status: InventoryAdjustmentStatus;

  @Column({ type: 'varchar', length: 40, nullable: true })
  approvalWorkflowRequestId: string | null;

  @Column({ type: 'varchar', length: 120 })
  requestedByUsername: string;

  @Column({ type: 'timestamp' })
  requestedAt: Date;

  @Column({ type: 'varchar', length: 120, nullable: true })
  approvedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  rejectedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  ledgerEntryId: string | null;

  @ManyToOne(() => InventoryLedger, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ledgerEntryId' })
  ledgerEntry: InventoryLedger | null;

  @Column({ type: 'jsonb', nullable: true })
  auditTrail: InventoryAdjustmentAuditEvent[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
