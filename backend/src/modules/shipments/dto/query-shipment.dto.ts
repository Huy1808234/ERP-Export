import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { IsEntityId } from '@/common/ids/entity-id.validator';
import { ShipmentStatus } from '../entities/shipment.entity';

export class QueryShipmentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  current?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @IsOptional()
  @IsString()
  pol?: string;

  @IsOptional()
  @IsString()
  pod?: string;

  @IsOptional()
  @IsString()
  bookingNumber?: string;

  @IsOptional()
  @IsEntityId()
  salesContractId?: string;

  @IsOptional()
  @IsEntityId()
  logisticsPartnerId?: string;
}
