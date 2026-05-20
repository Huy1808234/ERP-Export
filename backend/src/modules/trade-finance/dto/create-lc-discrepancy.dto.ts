import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { IsEntityId } from '@/common/ids/entity-id.validator';
import { LCDiscrepancySeverity } from '../entities/lc-discrepancy.entity';

export class CreateLCDiscrepancyDto {
  @IsOptional()
  @IsEntityId()
  exportDocumentId?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsEnum(LCDiscrepancySeverity)
  severity?: LCDiscrepancySeverity;

  @IsString()
  description: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
