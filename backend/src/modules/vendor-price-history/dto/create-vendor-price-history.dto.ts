import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
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

export class CreateVendorPriceHistoryDto {
  @IsEntityId({ message: 'vendorId phai la _id hop le' })
  vendorId: string;

  @IsEntityId({ message: 'productId phai la _id hop le' })
  productId: string;

  @toOptionalNumber()
  @IsNotEmpty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  price: number;

  @trimString()
  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @trimString()
  @IsOptional()
  @IsString()
  note?: string;
}
