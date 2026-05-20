import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { PurchaseOrder } from '@/modules/purchase-orders/entities/purchase-order.entity';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { TradeFinanceTransaction } from '@/modules/trade-finance/entities/trade-finance-transaction.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { VendorInvoiceItem } from './vendor-invoice-item.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum VendorInvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED'
}

@Entity('vendor_invoices')
@Index('UDX_vendor_invoice_vendor_number', ['vendorId', 'invoiceNumber'], { unique: true })
export class VendorInvoice {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('vinv');
    }
  }

  @Column()
  invoiceNumber: string; // Số hóa đơn GTGT

  @Column({ type: 'varchar', nullable: true })
  invoiceSeries: string; // Ký hiệu hóa đơn (VD: 1C23TML)

  @Column({ type: 'varchar', length: 40, nullable: true })
  purchaseOrderId: string | null;

  @ManyToOne(() => PurchaseOrder, { nullable: true })
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder | null;

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

  @Column({ type: 'integer', default: 10 })
  taxRate: number; // Thuế suất (%)

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

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 1, transformer: new ColumnNumericTransformer() })
  exchangeRate: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'simple-array', nullable: true })
  attachments: string[]; // Lưu danh sách URL file đính kèm

  @Column({ type: 'varchar', length: 40, nullable: true })
  paymentTransactionId: string | null;

  @ManyToOne(() => TradeFinanceTransaction, { nullable: true })
  @JoinColumn({ name: 'paymentTransactionId' })
  paymentTransaction: TradeFinanceTransaction | null;

  @OneToMany(() => VendorInvoiceItem, (item) => item.vendorInvoice)
  items: VendorInvoiceItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
