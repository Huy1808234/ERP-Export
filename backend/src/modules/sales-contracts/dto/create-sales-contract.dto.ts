import { Transform, Type } from 'class-transformer';
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
import { IsEntityId } from '@/common/ids/entity-id.validator';
import { Incoterm } from '@/modules/quotations/entities/quotation.entity';

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

const optionalEntityId = ({
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

export class SalesContractItemDto {
  @IsEntityId()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateSalesContractDto {
  @IsString()
  @IsNotEmpty()
  @Transform(optionalText)
  contractNumber: string;

  @IsEntityId()
  @IsNotEmpty()
  buyerId: string;

  @IsEntityId()
  @IsOptional()
  @Transform(optionalEntityId)
  proformaInvoiceId?: string | null;

  @IsEnum(Incoterm)
  incoterm: Incoterm;

  @IsString()
  @IsNotEmpty()
  @Transform(optionalText)
  currencyCode: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  exchangeRate?: number;

  @IsDateString()
  @IsOptional()
  @Transform(optionalText)
  deliveryDate?: string | null;

  @IsDateString()
  @IsOptional()
  @Transform(optionalText)
  validUntil?: string | null;

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

  @IsNumber()
  @Min(0)
  @IsOptional()
  logisticsFee?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  otherFee?: number;

  @IsString()
  @IsOptional()
  @Transform(optionalText)
  paymentTerms?: string | null;

  @IsString()
  @IsOptional()
  @Transform(optionalText)
  notes?: string | null;

  @IsEntityId()
  @IsOptional()
  @Transform(optionalEntityId)
  logisticsPartnerId?: string | null;

  @IsString()
  @IsOptional()
  @Transform(optionalText)
  bookingNumber?: string | null;

  @IsString()
  @IsOptional()
  @Transform(optionalText)
  pol?: string | null;

  @IsEntityId()
  @IsOptional()
  @Transform(optionalEntityId)
  pol_port_id?: string | null;

  @IsString()
  @IsOptional()
  @Transform(optionalText)
  pod?: string | null;

  @IsEntityId()
  @IsOptional()
  @Transform(optionalEntityId)
  pod_port_id?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesContractItemDto)
  items: SalesContractItemDto[];
}
