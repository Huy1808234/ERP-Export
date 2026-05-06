import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Shipment } from './shipment.entity';

export enum DocumentType {
  COMMERCIAL_INVOICE = 'COMMERCIAL_INVOICE',
  PACKING_LIST = 'PACKING_LIST',
  BILL_OF_LADING = 'BILL_OF_LADING',
  CERTIFICATE_OF_ORIGIN = 'CERTIFICATE_OF_ORIGIN',
  PHYTOSANITARY = 'PHYTOSANITARY',
  CUSTOMS_DECLARATION = 'CUSTOMS_DECLARATION',
  OTHER = 'OTHER'
}

@Entity('shipment_documents')
export class ShipmentDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shipmentId: string;

  @ManyToOne(() => Shipment, (shipment) => shipment.id)
  @JoinColumn({ name: 'shipmentId' })
  shipment: Shipment;

  @Column({ type: 'enum', enum: DocumentType })
  documentType: DocumentType;

  @Column({ nullable: true })
  documentNumber: string;

  @Column({ type: 'timestamp', nullable: true })
  issueDate: Date;

  @Column({ nullable: true })
  fileUrl: string;

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'DONE' | 'NA';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
