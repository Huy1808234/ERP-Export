import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Shipment } from '../../shipments/entities/shipment.entity';

export enum DocumentType {
  COMMERCIAL_INVOICE = 'COMMERCIAL_INVOICE',
  PACKING_LIST = 'PACKING_LIST',
  PROFORMA_INVOICE = 'PROFORMA_INVOICE',
  BILL_OF_LADING = 'BILL_OF_LADING',
  CERTIFICATE_OF_ORIGIN = 'CERTIFICATE_OF_ORIGIN'
}

@Entity('export_documents')
export class ExportDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: DocumentType })
  documentType: DocumentType;

  @Column()
  shipmentId: string;

  @ManyToOne(() => Shipment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shipmentId' })
  shipment: Shipment;

  @Column()
  fileName: string;

  @Column()
  fileUrl: string;

  // Lấy dữ liệu dạng JSON Snapshot để render PDF, tránh bị thay đổi nếu dữ liệu gốc (Hợp đồng/Sản phẩm) thay đổi
  @Column({ type: 'jsonb', nullable: true })
  snapshotData: any; 

  @Column({ default: false })
  isGenerated: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
