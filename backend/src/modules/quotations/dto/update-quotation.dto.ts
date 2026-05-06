import { PartialType } from '@nestjs/mapped-types';
import { CreateQuotationDto } from './create-quotation.dto';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateQuotationDto extends PartialType(CreateQuotationDto) {
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
