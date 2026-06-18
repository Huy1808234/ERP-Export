import {
  BeforeInsert,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { Product } from '@/modules/products/entities/product.entity';
import { CommercialInvoice } from './commercial-invoice.entity';

@Entity('commercial_invoice_items')
export class CommercialInvoiceItem {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('ci_item');
    }
  }

  @Column({ type: 'varchar', length: 40 })
  commercialInvoice_id: string;

  @ManyToOne(() => CommercialInvoice, (invoice) => invoice.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'commercialInvoice_id' })
  commercialInvoice: CommercialInvoice;

  @Column({ type: 'varchar', length: 40, nullable: true })
  salesContractItem_id: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  product_id: string | null;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  @Column({ type: 'varchar' })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  sku: string | null;

  @Column({ type: 'varchar', nullable: true })
  hsCode: string | null;

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
    transformer: new ColumnNumericTransformer(),
  })
  unitPriceForeign: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  lineAmountForeign: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  netWeight: number | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  grossWeight: number | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  cbm: number | null;
}
