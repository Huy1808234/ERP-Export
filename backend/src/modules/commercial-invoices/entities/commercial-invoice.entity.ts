import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';
import { ExportDocument } from '@/modules/export-documents/entities/export-document.entity';
import { CommercialInvoiceItem } from './commercial-invoice-item.entity';

export enum CommercialInvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
}

export enum CommercialInvoiceAuditAction {
  CREATED = 'CREATED',
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
  EXPORT_DOCUMENT_CREATED = 'EXPORT_DOCUMENT_CREATED',
  ACCOUNT_RECEIVABLE_CREATED = 'ACCOUNT_RECEIVABLE_CREATED',
}

export type CommercialInvoiceAuditEvent = {
  action: CommercialInvoiceAuditAction;
  username: string;
  at: string;
  note?: string | null;
  referenceType?: string | null;
  reference_id?: string | null;
};

@Entity('commercial_invoices')
@Index('idx_commercial_invoices_status_date', ['status', 'invoiceDate'])
@Index('idx_commercial_invoices_shipment', ['shipment_id'])
@Index('idx_commercial_invoices_contract', ['salesContract_id'])
@Index('idx_commercial_invoices_buyer', ['buyer_id'])
export class CommercialInvoice {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('ci');
    }
  }

  @Column({ unique: true })
  invoiceNumber: string;

  @Column({ type: 'varchar', length: 40 })
  salesContract_id: string;

  @ManyToOne(() => SalesContract, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'salesContract_id' })
  salesContract: SalesContract;

  @Column({ type: 'varchar', length: 40 })
  shipment_id: string;

  @ManyToOne(() => Shipment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'shipment_id' })
  shipment: Shipment;

  @Column({ type: 'varchar', length: 40 })
  buyer_id: string;

  @ManyToOne(() => Partner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyer_id' })
  buyer: Partner;

  @Column({ type: 'varchar', length: 40, nullable: true })
  accountReceivable_id: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  exportDocument_id: string | null;

  @ManyToOne(() => ExportDocument, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'exportDocument_id' })
  exportDocument: ExportDocument | null;

  @Column({ type: 'date' })
  invoiceDate: Date;

  @Column({ type: 'date', nullable: true })
  dueDate: Date | null;

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
  subtotalForeign: number;

  @Column({
    type: 'numeric',
    precision: 7,
    scale: 4,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  taxRatePercent: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  taxAmountForeign: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalAmountForeign: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalAmountVnd: number;

  @Column({ type: 'varchar', nullable: true })
  incoterm: string | null;

  @Column({ type: 'text', nullable: true })
  paymentTerms: string | null;

  @Column({ type: 'varchar', default: CommercialInvoiceStatus.DRAFT })
  status: CommercialInvoiceStatus;

  @Column({ type: 'jsonb', nullable: true })
  sourceSnapshot: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  auditTrail: CommercialInvoiceAuditEvent[] | null;

  @Column({ type: 'varchar' })
  createdByUsername: string;

  @Column({ type: 'varchar', nullable: true })
  issuedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  issuedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  cancelledByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @OneToMany(() => CommercialInvoiceItem, (item) => item.commercialInvoice, {
    cascade: true,
  })
  items: CommercialInvoiceItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
