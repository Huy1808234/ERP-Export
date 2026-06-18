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
import { Product } from '@/modules/products/entities/product.entity';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum CustomerReturnStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  RECEIVED = 'RECEIVED',
  REJECTED = 'REJECTED',
}

export enum CustomerReturnReason {
  DAMAGED = 'DAMAGED',
  WRONG_ITEM = 'WRONG_ITEM',
  QUALITY_CLAIM = 'QUALITY_CLAIM',
  OVER_SHIPPED = 'OVER_SHIPPED',
  COMMERCIAL_RETURN = 'COMMERCIAL_RETURN',
  OTHER = 'OTHER',
}

@Entity('customer_returns')
@Index('idx_customer_returns_buyer_status', ['buyerId', 'status'])
export class CustomerReturn {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('cret');
    }
  }

  @Column({ type: 'varchar', length: 60, unique: true })
  returnNumber: string;

  @Column({ type: 'varchar', length: 40 })
  buyerId: string;

  @ManyToOne(() => Partner, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyerId' })
  buyer: Partner;

  @Column({ type: 'varchar', length: 40, nullable: true })
  shipmentId: string | null;

  @ManyToOne(() => Shipment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'shipmentId' })
  shipment: Shipment | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  salesContractId: string | null;

  @ManyToOne(() => SalesContract, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'salesContractId' })
  salesContract: SalesContract | null;

  @Column({
    type: 'enum',
    enum: CustomerReturnReason,
    default: CustomerReturnReason.OTHER,
  })
  reason: CustomerReturnReason;

  @Column({
    type: 'enum',
    enum: CustomerReturnStatus,
    default: CustomerReturnStatus.DRAFT,
  })
  status: CustomerReturnStatus;

  @Column({ type: 'date' })
  returnDate: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 120 })
  createdByUsername: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  submittedByUsername: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  approvedByUsername: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  receivedByUsername: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  receivedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  decisionNote: string | null;

  @OneToMany(() => CustomerReturnItem, (item) => item.customerReturn, {
    cascade: true,
  })
  items: CustomerReturnItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('customer_return_items')
@Index('idx_customer_return_items_return', ['customerReturnId'])
export class CustomerReturnItem {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('cretitem');
    }
  }

  @Column({ type: 'varchar', length: 40 })
  customerReturnId: string;

  @ManyToOne(() => CustomerReturn, (returnDoc) => returnDoc.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customerReturnId' })
  customerReturn: CustomerReturn;

  @Column({ type: 'varchar', length: 40 })
  productId: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
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

  @Column({ type: 'varchar', nullable: true })
  lotNumber: string | null;

  @Column({ type: 'boolean', default: false })
  quarantine: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
