import { BeforeInsert, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { GoodsReceipt } from './goods-receipt.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { PurchaseOrderItem } from '@/modules/purchase-orders/entities/purchase-order-item.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('goods_receipt_items')
export class GoodsReceiptItem {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('gri');
    }
  }

  @Column({ type: 'varchar', length: 40, nullable: true })
  goodsReceiptId: string | null;

  @ManyToOne(() => GoodsReceipt, (gr) => gr.items, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'goodsReceiptId' })
  goodsReceipt: GoodsReceipt | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  purchaseOrderItem_id: string | null;

  @ManyToOne(() => PurchaseOrderItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'purchaseOrderItem_id' })
  purchaseOrderItem: PurchaseOrderItem | null;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: new ColumnNumericTransformer() })
  quantityOrdered: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: new ColumnNumericTransformer() })
  quantityReceived: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  quantityRejected: number;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  lotNumber: string | null;

  @Column({ type: 'varchar', default: 'PASS' })
  qualityStatus: string;

  @Column({ type: 'text', nullable: true })
  lineNote: string | null;

  @Column({ type: 'varchar', nullable: true })
  unit: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
