import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { APStatus } from '../entities/account-payable.entity';
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

export class CreateAccountPayableDto {
  @IsEntityId({ message: 'vendorId phai la _id hop le' })
  vendorId: string;

  @IsEntityId({ message: 'vendorInvoiceId phai la _id hop le' })
  @IsOptional()
  vendorInvoiceId?: string;

  @trimString()
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @toOptionalNumber()
  @IsNotEmpty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  amount: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  paidAmount?: number;

  @trimString()
  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(APStatus)
  status?: APStatus;

  @trimString()
  @IsOptional()
  @IsString()
  note?: string;
}
