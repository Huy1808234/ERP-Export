import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { IsEntityId } from '@/common/ids/entity-id.validator';

const toOptionalNumber = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  });

export class CreateVendorEvaluationDto {
  @IsEntityId()
  vendorId: string;

  @IsOptional()
  @IsEntityId()
  purchaseOrderId?: string;

  @IsOptional()
  @IsEntityId()
  goodsReceiptId?: string;

  @IsOptional()
  @IsEntityId()
  vendorInvoiceId?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @toOptionalNumber()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityScore: number;

  @toOptionalNumber()
  @IsNumber()
  @Min(0)
  @Max(100)
  deliveryScore: number;

  @toOptionalNumber()
  @IsNumber()
  @Min(0)
  @Max(100)
  priceScore: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  communicationScore?: number;

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
  @Max(100)
  onTimeDeliveryRate?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
