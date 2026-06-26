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
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';
import { Product } from '../../products/entities/product.entity';
import { createEntityId } from '@/common/ids/entity-id.util';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';

export enum PurchaseReturnStatus {
  DRAFT = 'DRAFT',
  PENDING_VENDOR = 'PENDING_VENDOR',
  SENT = 'SENT',
  CREDITED = 'CREDITED',
  REPLACED = 'REPLACED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum PurchaseReturnReasonCode {
  DEFECTIVE = 'DEFECTIVE',
  EXPIRED = 'EXPIRED',
  WRONG_SPEC = 'WRONG_SPEC',
  DAMAGED_IN_TRANSIT = 'DAMAGED_IN_TRANSIT',
  OVERSUPPLY = 'OVERSUPPLY',
  QUALITY_REJECT = 'QUALITY_REJECT',
  OTHER = 'OTHER',
}

export enum PurchaseReturnLineCondition {
  GOOD = 'GOOD',
  DAMAGED = 'DAMAGED',
  DEFECTIVE = 'DEFECTIVE',
  EXPIRED = 'EXPIRED',
  WRONG_SPEC = 'WRONG_SPEC',
}

@Entity()
export class PurchaseReturn {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('pret');
    }
  }

  @Column()
  returnNumber: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  purchaseOrderId: string | null;

  @ManyToOne(() => PurchaseOrder)
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  qualityCheckId: string | null;

  @Column({ type: 'varchar', nullable: true })
  claimNumber: string | null;

  @Column({ type: 'varchar', default: PurchaseReturnStatus.DRAFT })
  status: PurchaseReturnStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  sentByUsername: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  resolvedByUsername: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  settlementType: string | null;

  @Column({ type: 'text', nullable: true })
  settlementNote: string | null;

  @Column({ type: 'timestamp' })
  returnDate: Date;

  @Column({ type: 'varchar', length: 40, nullable: true })
  reasonCode: PurchaseReturnReasonCode | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column()
  createdByUsername: string;

  /** Total refundable amount (VND) = sum(items.unitPrice * quantity). */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalRefundableAmount: number;

  /** Currency of totalRefundableAmount (e.g. VND, USD). */
  @Column({ type: 'varchar', length: 8, default: 'VND' })
  currency: string;

  /** Vendor credit-note number, set when status moves to CREDITED. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  creditNoteNumber: string | null;

  /** Link to replacement shipment (or replacement PO) when status moves to REPLACED. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  replacementPurchaseOrderId: string | null;

  @ManyToOne(() => PurchaseOrder)
  @JoinColumn({ name: 'replacementPurchaseOrderId' })
  replacementPurchaseOrder: PurchaseOrder | null;

  /** Optional shipping/tracking reference for sending the goods back. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  carrierTrackingRef: string | null;

  /** Estimated date vendor commits to receive the goods. */
  @Column({ type: 'timestamptz', nullable: true })
  expectedPickupAt: Date | null;

  @OneToMany(() => PurchaseReturnItem, (item) => item.purchaseReturn, {
    cascade: true,
  })
  items: PurchaseReturnItem[];

  @OneToMany(() => PurchaseReturnAttachment, (a) => a.purchaseReturn, {
    cascade: true,
  })
  attachments: PurchaseReturnAttachment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity()
export class PurchaseReturnItem {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('pret_item');
    }
  }

  @Column()
  purchaseReturnId: string;

  @ManyToOne(() => PurchaseReturn, (pr) => pr.items)
  @JoinColumn({ name: 'purchaseReturnId' })
  purchaseReturn: PurchaseReturn;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  quantity: number;

  @Column({ type: 'varchar', nullable: true })
  unit: string | null;

  /** Unit price (in PO currency) snapshotted at return creation. */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  unitPrice: number;

  /** line refund = unitPrice * quantity */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  lineRefundAmount: number;

  /** Free-text condition code: GOOD / DAMAGED / DEFECTIVE / EXPIRED / WRONG_SPEC. */
  @Column({ type: 'varchar', length: 30, default: 'DAMAGED' })
  condition: PurchaseReturnLineCondition;

  /** Optional batch / lot number from the received PO. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  batchNumber: string | null;

  /** Optional expiry date for the returned batch. */
  @Column({ type: 'timestamptz', nullable: true })
  expiryDate: Date | null;

  /** Per-line note (e.g. "box crushed on arrival"). */
  @Column({ type: 'text', nullable: true })
  note: string | null;
}

@Entity()
export class PurchaseReturnAttachment {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('pret_attach');
    }
  }

  @Column()
  purchaseReturnId: string;

  @ManyToOne(() => PurchaseReturn, (pr) => pr.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'purchaseReturnId' })
  purchaseReturn: PurchaseReturn;

  @Column({ type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  fileName: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  mimeType: string | null;

  @Column({ type: 'int', nullable: true })
  fileSize: number | null;

  @Column({ type: 'varchar', length: 30, default: 'EVIDENCE' })
  category: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  uploadedByUsername: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
