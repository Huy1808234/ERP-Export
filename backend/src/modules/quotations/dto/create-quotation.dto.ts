import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Incoterm } from '../entities/quotation.entity';
import { IsEntityId } from '@/common/ids/entity-id.validator';

class QuotationItemDto {
  @IsEntityId()
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

export class CreateQuotationDto {
  @IsEntityId()
  @IsNotEmpty()
  customerId: string;

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

  @IsDateString()
  @IsNotEmpty()
  expiryDate: string;

  @IsString()
  @IsOptional()
  currency: string;

  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @IsString()
  @IsOptional()
  deliveryTerms?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  bankInfo?: string;

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
  domesticTransportCost?: number;

  @IsNumber()
  @IsOptional()
  portCharges?: number;

  @IsNumber()
  @IsOptional()
  seaFreight?: number;

  @IsNumber()
  @IsOptional()
  insuranceCost?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  items: QuotationItemDto[];
}
