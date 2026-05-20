import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApprovalDocumentType } from '../entities/approval-rule.entity';

export class ApprovalRuleStepDto {
  @IsInt()
  @Min(1)
  stepOrder: number;

  @IsString()
  approverRoleName: string;

  @IsOptional()
  @IsString()
  approverUsername?: string | null;

  @IsOptional()
  @IsString()
  label?: string | null;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class CreateApprovalRuleDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  name: string;

  @IsEnum(ApprovalDocumentType)
  documentType: ApprovalDocumentType;

  @IsOptional()
  @IsString()
  currency?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmountVnd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmountVnd?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApprovalRuleStepDto)
  steps: ApprovalRuleStepDto[];
}

export class UpdateApprovalRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  currency?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmountVnd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmountVnd?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApprovalRuleStepDto)
  steps?: ApprovalRuleStepDto[];
}
