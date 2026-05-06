import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn, DeleteDateColumn, Index } from 'typeorm';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { User } from '@/modules/users/entities/user.entity';
import { PurchaseRequest } from '@/modules/purchase-requests/entities/purchase-request.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';

export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PARTIAL_RECEIPT = 'PARTIAL_RECEIPT',
  RECEIVED = 'RECEIVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UDX_po_number_active', ['poNumber'], { unique: true, where: '"deletedAt" IS NULL' })
  @Column()
  poNumber: string;

  @Column({ type: 'varchar', nullable: true })
  purchaseRequestId: string | null;

  @ManyToOne(() => PurchaseRequest, { nullable: true })
  @JoinColumn({ name: 'purchaseRequestId' })
  purchaseRequest: PurchaseRequest | null;

  @Column({ type: 'varchar', nullable: true })
  proformaInvoiceId: string | null;

  @Column()
  vendorId: string;

  @ManyToOne(() => Partner)
  @JoinColumn({ name: 'vendorId' })
  vendor: Partner;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.DRAFT
  })
  status: PurchaseOrderStatus;

  @Column({ type: 'timestamp' })
  orderDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  expectedDeliveryDate: Date | null;

  @Column({ type: 'varchar', default: 'VND' })
  currency: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  subTotal: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  taxAmount: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  totalAmount: number;

  @Column()
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, { cascade: true })
  items: PurchaseOrderItem[];

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
