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

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column()
  createdByUsername: string;

  @OneToMany(() => PurchaseReturnItem, (item) => item.purchaseReturn, {
    cascade: true,
  })
  items: PurchaseReturnItem[];

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
}
