import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum FileAssetAuditAction {
  UPLOADED = 'UPLOADED',
  LINKED = 'LINKED',
}

export type FileAssetAuditEvent = {
  action: FileAssetAuditAction;
  username: string;
  at: string;
  note?: string | null;
  linkedModule?: string | null;
  linkedDocumentType?: string | null;
  linkedDocument_id?: string | null;
  fileName?: string | null;
  url?: string | null;
};

@Entity('file_assets')
@Index('idx_file_assets_folder_created', ['folder', 'createdAt'])
@Index('idx_file_assets_linked_document', ['linkedModule', 'linkedDocumentType', 'linkedDocument_id'])
export class FileAsset {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('file_asset');
    }
  }

  @Column({ type: 'varchar' })
  folder: string;

  @Column({ type: 'varchar' })
  fileName: string;

  @Column({ type: 'varchar' })
  originalName: string;

  @Column({ type: 'varchar' })
  mimeType: string;

  @Column({ type: 'integer', default: 0 })
  size: number;

  @Column({ type: 'varchar' })
  url: string;

  @Column({ type: 'text' })
  storagePath: string;

  @Column({ type: 'varchar', nullable: true })
  uploadedByUsername: string | null;

  @Column({ type: 'varchar', nullable: true })
  linkedModule: string | null;

  @Column({ type: 'varchar', nullable: true })
  linkedDocumentType: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  linkedDocument_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  auditTrail: FileAssetAuditEvent[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
