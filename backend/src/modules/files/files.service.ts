import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FileAsset,
  FileAssetAuditAction,
  FileAssetAuditEvent,
} from './entities/file-asset.entity';

export type UploadedLocalFile = {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
};

export type CreateFileAssetInput = {
  file: UploadedLocalFile;
  folder: string;
  url: string;
  uploadedByUsername?: string | null;
};

export type LinkFileAssetInput = {
  linkedModule: string;
  linkedDocumentType: string;
  linkedDocument_id: string;
  username: string;
  note?: string | null;
};

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileAsset)
    private readonly fileAssetRepository: Repository<FileAsset>,
  ) {}

  async createUploadedFile(input: CreateFileAssetInput): Promise<FileAsset> {
    const auditTrail = [
      this.createAuditEvent(
        FileAssetAuditAction.UPLOADED,
        input.uploadedByUsername || 'system',
        {
          fileName: input.file.originalname,
          url: input.url,
          note: `Uploaded to ${input.folder}`,
        },
      ),
    ];

    const asset = this.fileAssetRepository.create({
      folder: input.folder,
      fileName: input.file.filename,
      originalName: input.file.originalname,
      mimeType: input.file.mimetype,
      size: input.file.size,
      url: input.url,
      storagePath: input.file.path,
      uploadedByUsername: input.uploadedByUsername || null,
      auditTrail,
    });

    return this.fileAssetRepository.save(asset);
  }

  async findOne(recordId: string): Promise<FileAsset> {
    const asset = await this.fileAssetRepository.findOne({
      where: { _id: recordId },
    });
    if (!asset) throw new NotFoundException('File asset not found');
    return asset;
  }

  async findByLinkedDocument(recordId: string): Promise<FileAsset[]> {
    return this.fileAssetRepository.find({
      where: { linkedDocument_id: recordId },
      order: { createdAt: 'DESC' },
    });
  }

  async linkToDocument(
    recordId: string,
    input: LinkFileAssetInput,
  ): Promise<FileAsset> {
    const asset = await this.findOne(recordId);
    asset.linkedModule = input.linkedModule;
    asset.linkedDocumentType = input.linkedDocumentType;
    asset.linkedDocument_id = input.linkedDocument_id;
    asset.auditTrail = [
      ...(Array.isArray(asset.auditTrail) ? asset.auditTrail : []),
      this.createAuditEvent(FileAssetAuditAction.LINKED, input.username, {
        linkedModule: input.linkedModule,
        linkedDocumentType: input.linkedDocumentType,
        linkedDocument_id: input.linkedDocument_id,
        fileName: asset.originalName,
        url: asset.url,
        note: input.note || null,
      }),
    ];

    return this.fileAssetRepository.save(asset);
  }

  private createAuditEvent(
    action: FileAssetAuditAction,
    username: string,
    extra: Partial<
      Omit<FileAssetAuditEvent, 'action' | 'username' | 'at'>
    > = {},
  ): FileAssetAuditEvent {
    return {
      action,
      username: username || 'system',
      at: new Date().toISOString(),
      ...extra,
    };
  }
}
