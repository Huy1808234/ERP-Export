import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Incoterm } from '@/modules/quotations/entities/quotation.entity';
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

class PIItemDto {
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

export class CreateProformaInvoiceDto {
  @IsEntityId()
  @IsNotEmpty()
  customerId: string;

  @IsEntityId()
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
  @Type(() => PIItemDto)
  items: PIItemDto[];
}

export class ConvertQuotationToPiDto {
  @IsEntityId()
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
}
