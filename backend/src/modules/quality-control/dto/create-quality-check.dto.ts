import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { IsEntityId } from '@/common/ids/entity-id.validator';
import { QCResult } from '../entities/quality-check.entity';

const toOptionalNumber = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  });

export class CreateQualityCheckDto {
  @IsOptional()
  @IsEntityId()
  productId?: string;

  @IsOptional()
  @IsEntityId()
  lotId?: string;

  @IsOptional()
  @IsEntityId()
  goodsReceiptId?: string;

  @IsOptional()
  @IsEntityId()
  goodsReceiptItemId?: string;

  @IsOptional()
  @IsEntityId()
  purchaseOrderId?: string;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  moisture?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber()
  @Min(0)
  nutCount?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defectRate?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber()
  @Min(0)
  receivedQuantity?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber()
  @Min(0)
  rejectedQuantity?: number;

  @IsEnum(QCResult)
  result: QCResult;

  @IsOptional()
  @IsString()
  inspectorNotes?: string;

  @IsOptional()
  @IsString()
  correctiveAction?: string;
}
