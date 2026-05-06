import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';
import { Product } from '../../products/entities/product.entity';

@Entity()
export class PurchaseReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  returnNumber: string;

  @Column({ nullable: true })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder)
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder;

  @Column({ type: 'timestamp' })
  returnDate: Date;

  @Column({ nullable: true })
  reason: string;

  @Column()
  createdById: string;

  @OneToMany(() => PurchaseReturnItem, (item) => item.purchaseReturn, { cascade: true })
  items: PurchaseReturnItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity()
export class PurchaseReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity: number;

  @Column({ nullable: true })
  unit: string;
}
