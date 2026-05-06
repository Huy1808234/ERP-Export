import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: new ColumnNumericTransformer() })
  quantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  receivedQuantity: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  unitPrice: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 10, transformer: new ColumnNumericTransformer() })
  taxRate: number; // VAT %

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  totalAmount: number;

  @Column({ type: 'varchar', nullable: true })
  unit: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
