import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentChecklistStatus } from '../entities/export-document.entity';

export class ReviewExportDocumentDto {
  @IsEnum(DocumentChecklistStatus)
  checklistStatus: DocumentChecklistStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
