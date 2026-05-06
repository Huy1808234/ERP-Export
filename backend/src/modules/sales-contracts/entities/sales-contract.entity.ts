import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Partner } from '../../partners/entities/partner.entity';
import { SalesContractItem } from './sales-contract-item.entity';
import { ProformaInvoice } from '../../proforma-invoices/entities/proforma-invoice.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';

export enum SalesContractStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED', // Đã duyệt -> Trigger giữ hàng
  SHIPPED = 'SHIPPED', // Đã giao hàng
  PAID = 'PAID', // Đã thanh toán xong
  CANCELLED = 'CANCELLED'
}

export enum Incoterms {
  EXW = 'EXW',
  FOB = 'FOB',
  CIF = 'CIF',
  CFR = 'CFR',
  DDP = 'DDP',
  DAP = 'DAP'
}

@Entity('sales_contracts')
export class SalesContract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  contractNumber: string;

  @Column()
  buyerId: string;

  @Column({ nullable: true })
  proformaInvoiceId: string;

  @ManyToOne('ProformaInvoice', { nullable: true })
  @JoinColumn({ name: 'proformaInvoiceId' })
  proformaInvoice: any;

  @ManyToOne(() => Partner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyerId' })
  buyer: Partner;

  @Column({ type: 'enum', enum: SalesContractStatus, default: SalesContractStatus.DRAFT })
  status: SalesContractStatus;

  @Column({ type: 'enum', enum: Incoterms })
  incoterm: Incoterms;

  @Column()
  currencyCode: string;

  // Tỷ giá tại thời điểm ký hợp đồng
  @Column({ type: 'numeric', precision: 15, scale: 6, default: 1, transformer: new ColumnNumericTransformer() })
  exchangeRate: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  totalAmount: number; // Tổng giá trị ngoại tệ

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  totalAmountVnd: number; // Tổng giá trị quy đổi VND

  @Column({ type: 'date', nullable: true })
  deliveryDate: string;

  @Column({ type: 'date', nullable: true })
  validUntil: string;

  // Fields for Incoterms Calculation Logic
  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  domesticTransportCost: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  portCharges: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  seaFreight: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  insuranceCost: number;


  @Column({ type: 'text', nullable: true })
  paymentTerms: string; // T/T, L/C...

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => SalesContractItem, item => item.salesContract, { cascade: true })
  items: SalesContractItem[];

  @Column({ nullable: true })
  logisticsPartnerId: string;

  @ManyToOne('Partner', { nullable: true })
  @JoinColumn({ name: 'logisticsPartnerId' })
  logisticsPartner: any;

  @Column({ nullable: true })
  bookingNumber: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
