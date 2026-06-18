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

class ContainerDto {
  @IsString()
  @IsOptional()
  containerNumber: string;

  @IsString()
  @IsOptional()
  sealNumber: string;

  @IsEnum(ContainerType)
  @IsOptional()
  type: ContainerType;

  @IsNumber()
  @IsOptional()
  weightKg: number;

  @IsNumber()
  @IsOptional()
  cbm: number;
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
  @Type(() => ContainerDto)
  containers: ContainerDto[];

  @IsNumber()
  @IsOptional()
  freightCost: number;

  @IsNumber()
  @IsOptional()
  insuranceCost: number;

  @IsNumber()
  @IsOptional()
  localChargesVnd: number;

  @IsNumber()
  @IsOptional()
  truckingCostVnd: number;

  @IsNumber()
  @IsOptional()
  customsFeeVnd: number;

  @IsString()
  @IsOptional()
  note: string;

  @IsEnum(ShipmentStatus)
  @IsOptional()
  status: ShipmentStatus;

  @IsOptional()
  documentChecklist: any;
}
