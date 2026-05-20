import { BeforeInsert, Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { GoodsReceiptItem } from './goods-receipt-item.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/entities/purchase-order.entity';
import { User } from '@/modules/users/entities/user.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('goods_receipts')
export class GoodsReceipt {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('grn');
    }
  }

  @Column({ unique: true })
  grNumber: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  purchaseOrderId: string | null;

  @ManyToOne(() => PurchaseOrder, { nullable: true })
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder | null;

  @Column({ type: 'timestamp' })
  receivedDate: Date;

  @Column({ type: 'varchar', nullable: true })
  deliveryNoteNumber: string | null; // Số phiếu giao hàng của NCC

  @Column({ type: 'varchar', nullable: true })
  warehouseName: string | null;

  @Column({ type: 'varchar', nullable: true })
  warehouseLocation: string | null;

  @Column({ type: 'text', nullable: true })
  attachmentUrl: string | null;

  @Column()
  receivedByUsername: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'receivedByUsername', referencedColumnName: 'username' })
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
