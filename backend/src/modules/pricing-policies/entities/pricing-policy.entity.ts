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
import { createEntityId } from '@/common/ids/entity-id.util';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { Product } from '@/modules/products/entities/product.entity';
import {
  Partner,
  BuyerRegion,
} from '@/modules/partners/entities/partner.entity';
import { Port } from '@/modules/ports/entities/port.entity';
import { Incoterm } from '@/modules/quotations/entities/quotation.entity';

export enum PricingPolicyStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity('pricing_policies')
@Index('idx_pricing_policy_lookup', [
  'productId',
  'incoterm',
  'currency',
  'isActive',
])
export class PricingPolicy {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('price_policy');
    }
  }

  @Column()
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'varchar', length: 40, nullable: true })
  buyerId: string | null;

  @ManyToOne(() => Partner, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyerId' })
  buyer: Partner | null;

  @Column({ type: 'enum', enum: BuyerRegion, nullable: true })
  marketRegion: BuyerRegion | null;

  @Column({ type: 'varchar', nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  countryCode: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  origin_port_id: string | null;

  @ManyToOne(() => Port, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'origin_port_id' })
  originPort: Port | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  destination_port_id: string | null;

  @ManyToOne(() => Port, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'destination_port_id' })
  destinationPort: Port | null;

  @Column({ type: 'enum', enum: Incoterm })
  incoterm: Incoterm;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  minQuantity: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  maxQuantity: number | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 4,
    transformer: new ColumnNumericTransformer(),
  })
  unitPrice: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 4,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  inlandCostPerUnit: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 4,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  portChargePerUnit: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 4,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  freightCostPerUnit: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 4,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  insuranceCostPerUnit: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 4,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  destinationDeliveryCostPerUnit: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 4,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  customsCostPerUnit: number;

  @Column({ type: 'date' })
  effectiveFrom: Date;

  @Column({ type: 'date', nullable: true })
  effectiveTo: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  createdByUsername: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({
    type: 'enum',
    enum: PricingPolicyStatus,
    default: PricingPolicyStatus.DRAFT,
  })
  status: PricingPolicyStatus;

  @Column({ type: 'varchar', nullable: true })
  approvalWorkflowRequestId: string | null;

  @Column({ type: 'varchar', nullable: true })
  approvedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
