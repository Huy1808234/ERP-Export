import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrder } from '@/modules/purchase-orders/entities/purchase-order.entity';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';

export enum VendorInvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED'
}

@Entity('vendor_invoices')
export class VendorInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  invoiceNumber: string; // Số hóa đơn GTGT

  @Column()
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder)
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder;

  @Column()
  vendorId: string;

  @ManyToOne(() => Partner)
  @JoinColumn({ name: 'vendorId' })
  vendor: Partner;

  @Column({ type: 'timestamp' })
  invoiceDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  amount: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  taxAmount: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: VendorInvoiceStatus,
    default: VendorInvoiceStatus.PENDING
  })
  status: VendorInvoiceStatus;

  @Column({ type: 'varchar', default: 'VND' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
