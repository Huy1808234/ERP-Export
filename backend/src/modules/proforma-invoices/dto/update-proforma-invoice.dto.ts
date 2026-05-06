import { PartialType } from '@nestjs/mapped-types';
import { CreateProformaInvoiceDto } from './create-proforma-invoice.dto';
import { IsNumber, IsOptional, IsString } from 'class-validator';

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
}
