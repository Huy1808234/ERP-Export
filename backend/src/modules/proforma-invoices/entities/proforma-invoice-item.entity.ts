import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '@/modules/products/entities/product.entity';
import { ProformaInvoice } from './proforma-invoice.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('proforma_invoice_items')
export class ProformaInvoiceItem {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('pi_item');
    }
  }

  @Column()
  proformaInvoiceId: string;

  @ManyToOne(() => ProformaInvoice, (pi) => pi.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proformaInvoiceId' })
  proformaInvoice: ProformaInvoice;

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

  @Column({ nullable: true })
  unit: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  unitPrice: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  totalAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
