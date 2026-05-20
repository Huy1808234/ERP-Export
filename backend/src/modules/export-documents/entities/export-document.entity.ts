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
import { Shipment } from '../../shipments/entities/shipment.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum DocumentType {
  COMMERCIAL_INVOICE = 'COMMERCIAL_INVOICE',
  PACKING_LIST = 'PACKING_LIST',
  PROFORMA_INVOICE = 'PROFORMA_INVOICE',
  BILL_OF_LADING = 'BILL_OF_LADING',
  AIRWAY_BILL = 'AIRWAY_BILL',
  CERTIFICATE_OF_ORIGIN = 'CERTIFICATE_OF_ORIGIN',
  PACKING_DECLARATION = 'PACKING_DECLARATION',
  CUSTOMS_DECLARATION = 'CUSTOMS_DECLARATION',
  PHYTOSANITARY_CERTIFICATE = 'PHYTOSANITARY_CERTIFICATE',
  HEALTH_CERTIFICATE = 'HEALTH_CERTIFICATE',
  FUMIGATION_CERTIFICATE = 'FUMIGATION_CERTIFICATE',
  QUALITY_INSPECTION_CERTIFICATE = 'QUALITY_INSPECTION_CERTIFICATE',
  VAT_REFUND_DOSSIER = 'VAT_REFUND_DOSSIER',
  OTHER = 'OTHER',
}

export enum DocumentChecklistStatus {
  MISSING = 'MISSING',
  DRAFT = 'DRAFT',
  UPLOADED = 'UPLOADED',
  GENERATED = 'GENERATED',
  REVIEWED = 'REVIEWED',
  APPROVED = 'APPROVED',
  EXPIRED = 'EXPIRED',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export enum ExportDocumentAuditAction {
  VERSION_CREATED = 'VERSION_CREATED',
  FILE_UPLOADED = 'FILE_UPLOADED',
  GENERATED = 'GENERATED',
  REVIEWED = 'REVIEWED',
  REVIEW_REQUESTED = 'REVIEW_REQUESTED',
  REVIEW_REJECTED = 'REVIEW_REJECTED',
  SHARED = 'SHARED',
  UNSHARED = 'UNSHARED',
  DOWNLOADED = 'DOWNLOADED',
}

export type ExportDocumentAuditEvent = {
  action: ExportDocumentAuditAction;
  username: string;
  at: string;
  note?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  fileAsset_id?: string | null;
  versionNo?: number;
  checklistStatus?: DocumentChecklistStatus;
};

@Entity('export_documents')
export class ExportDocument {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('export_doc');
    }
  }

  @Column({ type: 'varchar' })
  documentType: DocumentType;

  @Column()
  shipmentId: string;

  @ManyToOne(() => Shipment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shipmentId' })
  shipment: Shipment;

  @Column({ type: 'varchar', nullable: true })
  documentNumber: string | null;

  @Column({ default: 1 })
  versionNo: number;

  @Column({ default: true })
  isCurrentVersion: boolean;

  @Column({ type: 'varchar', default: DocumentChecklistStatus.MISSING })
  checklistStatus: DocumentChecklistStatus;

  @Column({ type: 'varchar', nullable: true })
  fileName: string | null;

  @Column({ type: 'varchar', nullable: true })
  originalFileName: string | null;

  @Column({ type: 'varchar', nullable: true })
  mimeType: string | null;

  @Column({ type: 'integer', default: 0 })
  fileSize: number;

  @Column({ type: 'varchar', nullable: true })
  fileUrl: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  fileAsset_id: string | null;

  // Immutable snapshot used to render official export documents even if source data changes later.
  @Column({ type: 'jsonb', nullable: true })
  snapshotData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  businessData: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  sourceDocumentType: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  sourceDocument_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  auditTrail: ExportDocumentAuditEvent[] | null;

  @Column({ default: false })
  isGenerated: boolean;

  @Column({ type: 'timestamp', nullable: true })
  issueDate: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiryDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  customsDeclarationNumber: string | null;

  @Column({ type: 'timestamp', nullable: true })
  customsClearedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  uploadedByUsername: string | null;

  @Column({ type: 'varchar', nullable: true })
  reviewedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  approvalWorkflowRequestId: string | null;

  @Column({ default: false })
  sharedWithBuyer: boolean;

  @Column({ type: 'varchar', nullable: true })
  sharedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sharedAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  downloadCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastDownloadedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
