import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Incoterm } from '../entities/quotation.entity';
import { IsEntityId } from '@/common/ids/entity-id.validator';

const optionalText = ({
  value,
}: {
  value: unknown;
}): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return value as string;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

class QuotationItemDto {
  @IsEntityId()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  quantity: number;

  @IsString()
  @IsOptional()
  unit: string;

  @IsNumber()
  @Min(0)
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
  @Transform(optionalText)
  portOfLoading?: string | null;

  @IsEntityId()
  @IsOptional()
  @Transform(optionalText)
  portOfLoading_port_id?: string | null;

  @IsString()
  @IsOptional()
  @Transform(optionalText)
  portOfDischarge?: string | null;

  @IsEntityId()
  @IsOptional()
  @Transform(optionalText)
  portOfDischarge_port_id?: string | null;

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
  @Min(0)
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
  @Min(0)
  @IsOptional()
  logisticsFee?: number;

  @IsString()
  @IsOptional()
  logisticsFeeCurrency?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  otherFee?: number;

  @IsString()
  @IsOptional()
  otherFeeCurrency?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  domesticTransportCost?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  portCharges?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  seaFreight?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  insuranceCost?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  items: QuotationItemDto[];
}
