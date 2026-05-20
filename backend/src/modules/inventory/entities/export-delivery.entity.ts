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
import { Partner } from '@/modules/partners/entities/partner.entity';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';

export enum ExportDeliveryStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
}

export type ExportDeliveryAuditEvent = {
  eventType: 'CREATED' | 'ISSUED' | 'CANCELLED';
  actorUsername: string;
  occurredAt: string;
  note?: string | null;
  metadata?: Record<string, unknown>;
};

@Entity('export_deliveries')
@Index('idx_export_deliveries_shipment', ['shipmentId'])
@Index('idx_export_deliveries_status_date', ['status', 'deliveryDate'])
export class ExportDelivery {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('exdel');
    }
  }

  @Column({ type: 'varchar', length: 60, unique: true })
  deliveryNumber: string;

  @Column({ type: 'varchar', length: 40 })
  shipmentId: string;

  @ManyToOne(() => Shipment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'shipmentId' })
  shipment: Shipment;

  @Column({ type: 'varchar', length: 40 })
  salesContractId: string;

  @ManyToOne(() => SalesContract, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'salesContractId' })
  salesContract: SalesContract;

  @Column({ type: 'varchar', length: 40 })
  buyerId: string;

  @ManyToOne(() => Partner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyerId' })
  buyer: Partner;

  @Column({ type: 'date' })
  deliveryDate: string;

  @Column({
    type: 'enum',
    enum: ExportDeliveryStatus,
    default: ExportDeliveryStatus.DRAFT,
  })
  status: ExportDeliveryStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  createdByUsername: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  issuedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  issuedAt: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  cancelledByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'jsonb', nullable: true })
  auditTrail: ExportDeliveryAuditEvent[] | null;

  @OneToMany(() => ExportDeliveryItem, (item) => item.exportDelivery, {
    cascade: true,
  })
  items: ExportDeliveryItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('export_delivery_items')
@Index('idx_export_delivery_items_delivery_product', [
  'exportDeliveryId',
  'productId',
])
export class ExportDeliveryItem {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('exdel_item');
    }
  }

  @Column({ type: 'varchar', length: 40 })
  exportDeliveryId: string;

  @ManyToOne(() => ExportDelivery, (delivery) => delivery.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'exportDeliveryId' })
  exportDelivery: ExportDelivery;

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
  quantity: number;

  @Column({ type: 'varchar', nullable: true })
  unit: string | null;

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
  totalCost: number;

  @Column({ type: 'varchar', nullable: true })
  lotNumber: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
