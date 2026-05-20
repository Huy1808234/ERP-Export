import { PartialType } from '@nestjs/mapped-types';
import { CreateProformaInvoiceDto } from './create-proforma-invoice.dto';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateProformaInvoiceDto extends PartialType(CreateProformaInvoiceDto) {
  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @IsString()
  @IsOptional()
  logisticsFeeCurrency?: string;

  @IsString()
  @IsOptional()
  otherFeeCurrency?: string;

  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @IsDateString()
  @IsOptional()
  paidAt?: string;
}
