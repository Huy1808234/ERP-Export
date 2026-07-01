import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ContainerType } from '../entities/container.entity';
import { ShipmentStatus } from '../entities/shipment.entity';
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

export type ShipmentDocumentChecklist = Record<
  string,
  'PENDING' | 'DONE' | 'NA'
>;

export class ShipmentContainerDto {
  @IsString()
  @IsOptional()
  containerNumber?: string;

  @IsString()
  @IsOptional()
  sealNumber?: string;

  @IsEnum(ContainerType)
  @IsOptional()
  type?: ContainerType;

  @IsEnum(ContainerType)
  @IsOptional()
  containerType?: ContainerType;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  weightKg?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  grossWeightKg?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  cbm?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  volumeCbm?: number;
}

export class CreateShipmentDto {
  @IsEntityId()
  @IsOptional()
  salesContractId: string;

  @IsEntityId()
  @IsOptional()
  proformaInvoiceId: string;

  @IsEntityId()
  @IsOptional()
  logisticsPartnerId: string;

  @IsString()
  @IsOptional()
  bookingNumber: string;

  @IsString()
  @IsOptional()
  shippingLine: string;

  @IsString()
  @IsOptional()
  vesselName: string;

  @IsString()
  @IsOptional()
  voyageNumber: string;

  @IsString()
  @IsOptional()
  @Transform(optionalText)
  pol: string | null;

  @IsEntityId()
  @IsOptional()
  @Transform(optionalText)
  pol_port_id?: string | null;

  @IsString()
  @IsOptional()
  @Transform(optionalText)
  pod: string | null;

  @IsEntityId()
  @IsOptional()
  @Transform(optionalText)
  pod_port_id?: string | null;

  @IsDateString()
  @IsOptional()
  etd: string;

  @IsDateString()
  @IsOptional()
  eta: string;

  @IsString()
  @IsOptional()
  blNumber: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ShipmentContainerDto)
  containers?: ShipmentContainerDto[];

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  freightCost?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  insuranceCost?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  localChargesVnd?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  truckingCostVnd?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  customsFeeVnd?: number;

  @IsString()
  @IsOptional()
  note: string;

  @IsEnum(ShipmentStatus)
  @IsOptional()
  status: ShipmentStatus;

  @IsObject()
  @IsOptional()
  documentChecklist?: ShipmentDocumentChecklist;
}
