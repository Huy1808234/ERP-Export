import {
  BeforeInsert,
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum InventoryTransactionType {
  GRN = 'GOODS_RECEIPT',
  SALES = 'SALES_DISPATCH',
  ADJUSTMENT = 'ADJUSTMENT',
  RETURN = 'RETURN',
  REJECTION = 'REJECTION',
  RESERVE = 'RESERVE',
  RELEASE = 'RELEASE',
}

@Entity('inventory_ledger')
@Index(['productId', 'createdAt'])
export class InventoryLedger {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('invled');
    }
  }

  @Column({ default: false })
  isQuarantine: boolean; // Đánh dấu hàng nằm ở khu cách ly (hỏng, lỗi...)

  @Column()
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'enum', enum: InventoryTransactionType })
  transactionType: InventoryTransactionType;

  // Positive for in, Negative for out
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  quantityChange: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  balanceAfter: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  unitPrice: number;

  @Column()
  referenceId: string; // Internal technical _id for relations

  @Column({ nullable: true })
  @Index()
  partnerId: string; // Buyer/vendor _id for movement tracing

  @Column({ nullable: true })
  referenceNumber: string; // Human-readable ID (e.g. GRN-20260502-0001)

  @Column({ nullable: true })
  createdBy: string; // Username of the actor

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  remainingQuantity: number;

  @Column({ nullable: true })
  @Index()
  lotNumber: string;

  @CreateDateColumn()
  createdAt: Date;
}
