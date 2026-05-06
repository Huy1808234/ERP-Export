import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Incoterm } from '@/modules/quotations/entities/quotation.entity';

class PIItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsString()
  @IsOptional()
  unit: string;

  @IsNumber()
  @IsNotEmpty()
  unitPrice: number;

  @IsString()
  @IsOptional()
  note: string;
}

export class CreateProformaInvoiceDto {
  @IsUUID()
  @IsNotEmpty()
  customerId: string;

  @IsUUID()
  @IsOptional()
  quotationId?: string;

  @IsEnum(Incoterm)
  @IsOptional()
  incoterm: Incoterm;

  @IsString()
  @IsOptional()
  incotermLocation?: string;

  @IsString()
  @IsOptional()
  portOfLoading?: string;

  @IsString()
  @IsOptional()
  portOfDischarge?: string;

  @IsDateString()
  @IsNotEmpty()
  issueDate: string;

  @IsString()
  @IsOptional()
  currency: string;

  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @IsNumber()
  @IsOptional()
  depositAmount?: number;

  @IsNumber()
  @IsOptional()
  depositPercent?: number;

  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsNumber()
  @IsOptional()
  logisticsFee?: number;

  @IsString()
  @IsOptional()
  logisticsFeeCurrency?: string;

  @IsNumber()
  @IsOptional()
  otherFee?: number;

  @IsString()
  @IsOptional()
  otherFeeCurrency?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PIItemDto)
  items: PIItemDto[];
}

export class ConvertQuotationToPiDto {
  @IsUUID()
  @IsNotEmpty()
  quotationId: string;

  @IsEnum(Incoterm)
  @IsOptional()
  incoterm?: Incoterm;

  @IsString()
  @IsOptional()
  incotermLocation?: string;

  @IsString()
  @IsOptional()
  portOfLoading?: string;

  @IsString()
  @IsOptional()
  portOfDischarge?: string;

  @IsDateString()
  @IsOptional()
  issueDate?: string;

  @IsNumber()
  @IsOptional()
  depositPercent?: number;

  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsNumber()
  @IsOptional()
  logisticsFee?: number;

  @IsString()
  @IsOptional()
  logisticsFeeCurrency?: string;

  @IsNumber()
  @IsOptional()
  otherFee?: number;

  @IsString()
  @IsOptional()
  otherFeeCurrency?: string;

  @IsNumber()
  @IsOptional()
  depositAmount?: number;

  @IsString()
  @IsOptional()
  bankInfo?: string;
}
