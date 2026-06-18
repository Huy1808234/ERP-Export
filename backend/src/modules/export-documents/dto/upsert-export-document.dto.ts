import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { IsEntityId } from '@/common/ids/entity-id.validator';
import {
  DocumentChecklistStatus,
  DocumentType,
} from '../entities/export-document.entity';

export class UpsertExportDocumentDto {
  @IsEntityId()
  shipmentId: string;

  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  originalFileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsEntityId()
  fileAsset_id?: string;

  @IsOptional()
  @IsObject()
  snapshotData?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  businessData?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(DocumentChecklistStatus)
  checklistStatus?: DocumentChecklistStatus;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  customsDeclarationNumber?: string;

  @IsOptional()
  @IsDateString()
  customsClearedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  sharedWithBuyer?: boolean;
}
