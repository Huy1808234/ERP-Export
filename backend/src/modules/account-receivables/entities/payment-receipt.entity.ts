import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { Partner } from '@/modules/partners/entities/partner.entity';

export enum PaymentReceiptStatus {
  PENDING = 'PENDING',           // Chờ duyệt (mới upload)
  APPROVED = 'APPROVED',         // Đã duyệt - tiền đã vào tài khoản
  REJECTED = 'REJECTED',         // Từ chối - cần upload lại
  CANCELLED = 'CANCELLED',       // Hủy bỏ
}

export enum BankChargeType {
  SHA = 'SHA',   // Shared charges
  OUR = 'OUR',   // Sender pays all
  BEN = 'BEN',   // Beneficiary pays all
}

export enum PaymentReceiptSource {
  SEPAY_WEBHOOK = 'SEPAY_WEBHOOK',              // Từ SePay webhook (đã verify)
  CUSTOMER_PORTAL_UPLOAD = 'CUSTOMER_PORTAL_UPLOAD', // Khách upload manual
  CUSTOMER_QR_INITIATED = 'CUSTOMER_QR_INITIATED',  // Khách khởi tạo QR từ portal (chờ thanh toán)
  MANUAL_ENTRY = 'MANUAL_ENTRY',                // Kế toán nhập tay
}

@Entity('payment_receipts')
@Index('idx_payment_receipts_buyer', ['buyerId'])
@Index('idx_payment_receipts_account_receivable', ['accountReceivableId'])
@Index('idx_payment_receipts_status', ['status'])
@Index('idx_payment_receipts_source', ['source'])
export class PaymentReceipt {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('pr');
    }
  }

  @Column()
  receiptNumber: string;

  @Column({ type: 'varchar', length: 40 })
  buyerId: string;

  @ManyToOne(() => Partner, { onDelete: 'RESTRICT' })
  buyer: Partner;

  @Column({ type: 'varchar', length: 40, nullable: true })
  accountReceivableId: string | null;

  @Column({
    type: 'enum',
    enum: PaymentReceiptSource,
    default: PaymentReceiptSource.CUSTOMER_PORTAL_UPLOAD,
  })
  source: PaymentReceiptSource;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  amountPaidForeign: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 6,
    default: 1,
    transformer: new ColumnNumericTransformer(),
  })
  exchangeRate: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  amountPaidVnd: number;

  @Column({ type: 'date' })
  paymentDate: Date;

  @Column({
    type: 'enum',
    enum: BankChargeType,
    nullable: true,
  })
  bankChargeType: BankChargeType | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  bankChargeForeign: number;

  @Column({ type: 'varchar', default: PaymentReceiptStatus.PENDING })
  status: PaymentReceiptStatus;

  @Column({ type: 'varchar', nullable: true })
  attachmentUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  attachmentFilename: string | null;

  @Column({ type: 'text', nullable: true })
  senderBankName: string | null;

  @Column({ type: 'varchar', nullable: true })
  senderAccountNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  senderName: string | null;

  @Column({ type: 'varchar', nullable: true })
  swiftCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  transferReference: string | null; // SePay transaction reference

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', nullable: true })
  approvedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  rejectedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'varchar' })
  createdByUsername: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
