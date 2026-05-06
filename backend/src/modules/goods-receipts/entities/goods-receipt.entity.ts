import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { GoodsReceiptItem } from './goods-receipt-item.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/entities/purchase-order.entity';
import { User } from '@/modules/users/entities/user.entity';

@Entity('goods_receipts')
export class GoodsReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  grNumber: string;

  @Column()
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder)
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder;

  @Column({ type: 'timestamp' })
  receivedDate: Date;

  @Column({ type: 'varchar', nullable: true })
  deliveryNoteNumber: string | null; // Số phiếu giao hàng của NCC

  @Column()
  receivedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'receivedById' })
  receivedBy: User;

  @OneToMany(() => GoodsReceiptItem, (item) => item.goodsReceipt, { cascade: true })
  items: GoodsReceiptItem[];

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', default: 'COMPLETED' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
