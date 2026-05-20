import { BeforeInsert, Column, Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { VendorInvoice } from './vendor-invoice.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { GoodsReceiptItem } from '@/modules/goods-receipts/entities/goods-receipt-item.entity';
import { PurchaseOrderItem } from '@/modules/purchase-orders/entities/purchase-order-item.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('vendor_invoice_items')
export class VendorInvoiceItem {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('vii');
    }
  }

  @Column({ type: 'varchar', length: 40, nullable: true })
  vendorInvoiceId: string | null;

  @ManyToOne(() => VendorInvoice, (invoice) => invoice.items, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'vendorInvoiceId' })
  vendorInvoice: VendorInvoice | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  purchaseOrderItem_id: string | null;

  @ManyToOne(() => PurchaseOrderItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'purchaseOrderItem_id' })
  purchaseOrderItem: PurchaseOrderItem | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  goodsReceiptItem_id: string | null;

  @ManyToOne(() => GoodsReceiptItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'goodsReceiptItem_id' })
  goodsReceiptItem: GoodsReceiptItem | null;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  quantity: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  unitPrice: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  amount: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
