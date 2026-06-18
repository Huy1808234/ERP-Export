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
import { PurchaseOrder } from './purchase-order.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('poitem');
    }
  }

  @Column({ type: 'varchar', length: 40, nullable: true })
  purchaseOrderId: string | null;

  @ManyToOne(() => PurchaseOrder, (po) => po.items, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder | null;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  quantity: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  receivedQuantity: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  rejectedQuantity: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  backorderQuantity: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  unitPrice: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  taxRate: number; // VAT %

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  totalAmount: number;

  @Column({ type: 'varchar', nullable: true })
  unit: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
