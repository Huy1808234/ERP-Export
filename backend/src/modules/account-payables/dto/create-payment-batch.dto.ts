import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsEntityId } from '@/common/ids/entity-id.validator';

const toOptionalNumber = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  });

const trimString = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null) return value;
    return typeof value === 'string' ? value.trim() : value;
  });

export class CreatePaymentBatchItemDto {
  @IsEntityId({ message: 'accountPayableId phai la _id hop le' })
  accountPayableId: string;

  @toOptionalNumber()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  amount: number;

  @trimString()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreatePaymentBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentBatchItemDto)
  items: CreatePaymentBatchItemDto[];

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @trimString()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @trimString()
  @IsOptional()
  @IsString()
  bankReference?: string;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.000001)
  exchangeRate?: number;

  @trimString()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdatePaymentBatchDto {
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @trimString()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @trimString()
  @IsOptional()
  @IsString()
  bankReference?: string;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.000001)
  exchangeRate?: number;

  @trimString()
  @IsOptional()
  @IsString()
  note?: string;
}

export class ReviewPaymentBatchDto {
  @trimString()
  @IsOptional()
  @IsString()
  note?: string;

  @trimString()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class MarkPaymentBatchPaidDto {
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @trimString()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @trimString()
  @IsOptional()
  @IsString()
  bankReference?: string;

  @trimString()
  @IsOptional()
  @IsString()
  bankProofFileId?: string;

  @trimString()
  @IsOptional()
  @IsString()
  bankProofUrl?: string;

  @IsOptional()
  @IsDateString()
  bankTransferAt?: string;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.000001)
  exchangeRate?: number;

  @trimString()
  @IsOptional()
  @IsString()
  settlementNote?: string;

  @trimString()
  @IsOptional()
  @IsString()
  note?: string;
}

export class ReverseSettlementAuditDto {
  @trimString()
  @IsString()
  @MinLength(3)
  reason: string;

  @IsOptional()
  @IsDateString()
  reversalDate?: string;
}
