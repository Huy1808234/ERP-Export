import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { IsEntityId } from '@/common/ids/entity-id.validator';
import { BuyerRegion } from '@/modules/partners/entities/partner.entity';
import { Incoterm } from '@/modules/quotations/entities/quotation.entity';

export class CreatePricingPolicyDto {
  @IsEntityId()
  productId: string;

  @IsOptional()
  @IsEntityId()
  buyerId?: string | null;

  @IsOptional()
  @IsEnum(BuyerRegion)
  marketRegion?: BuyerRegion | null;

  @IsOptional()
  @IsString()
  countryCode?: string | null;

  @IsOptional()
  @IsString()
  country?: string | null;

  @IsOptional()
  @IsEntityId()
  origin_port_id?: string | null;

  @IsOptional()
  @IsEntityId()
  destination_port_id?: string | null;

  @IsEnum(Incoterm)
  incoterm: Incoterm;

  @IsString()
  currency: string;

  @IsNumber()
  @Min(0)
  minQuantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxQuantity?: number | null;

  @IsNumber()
  @Min(0.0001)
  unitPrice: number;

  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inlandCostPerUnit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  portChargePerUnit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freightCostPerUnit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  insuranceCostPerUnit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  destinationDeliveryCostPerUnit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  customsCostPerUnit?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
