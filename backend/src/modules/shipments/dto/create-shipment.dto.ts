import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ContainerType } from '../entities/container.entity';
import { ShipmentStatus } from '../entities/shipment.entity';
import { IsEntityId } from '@/common/ids/entity-id.validator';

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
  pol: string;

  @IsString()
  @IsOptional()
  pod: string;

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
