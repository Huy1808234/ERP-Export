import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, DeleteDateColumn } from 'typeorm';
import { Product } from '@/modules/products/entities/product.entity';
import { ProformaInvoice } from './proforma-invoice.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';

@Entity('proforma_invoice_items')
export class ProformaInvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: new ColumnNumericTransformer() })
  quantity: number;

  @Column({ nullable: true })
  unit: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  unitPrice: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  totalAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
