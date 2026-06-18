import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type { JsonRecord } from '@/common/types/authenticated-user.type';
import { ApprovalDocumentType } from '../entities/approval-rule.entity';

export class CreateApprovalWorkflowRequestDto {
  @IsEnum(ApprovalDocumentType)
  documentType: ApprovalDocumentType;

  @IsString()
  documentId: string;

  @IsOptional()
  @IsString()
  documentNumber?: string | null;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsNumber()
  @Min(0)
  amountVnd: number;

  @IsOptional()
  @IsString()
  ruleId?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: JsonRecord;
}

export class ApprovalActionDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
