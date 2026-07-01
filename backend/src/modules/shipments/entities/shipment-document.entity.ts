import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Shipment } from './shipment.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum DocumentType {
  SALES_CONTRACT = 'SALES_CONTRACT',
  COMMERCIAL_INVOICE = 'COMMERCIAL_INVOICE',
  PACKING_LIST = 'PACKING_LIST',
  BILL_OF_LADING = 'BILL_OF_LADING',
  CERTIFICATE_OF_ORIGIN = 'CERTIFICATE_OF_ORIGIN',
  PHYTOSANITARY = 'PHYTOSANITARY',
  CUSTOMS_DECLARATION = 'CUSTOMS_DECLARATION',
  OTHER = 'OTHER',
}

@Entity('shipment_documents')
export class ShipmentDocument {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('shp_doc');
    }
  }

  @Column()
  shipmentId: string;

  @ManyToOne(() => Shipment)
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
