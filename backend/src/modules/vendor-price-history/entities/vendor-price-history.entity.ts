import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('vendor_price_histories')
@Index('idx_vendor_price_history_vendor', ['vendorId'])
@Index('idx_vendor_price_history_product', ['productId'])
export class VendorPriceHistory {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('vendor_price');
    }
  }

  @Column()
  vendorId: string;

  @ManyToOne(() => Partner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Partner;

  @Column()
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  price: number;

  @Column({ type: 'varchar', default: 'VND' })
  currency: string;

  @Column({ type: 'date', nullable: true })
  effectiveDate: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
