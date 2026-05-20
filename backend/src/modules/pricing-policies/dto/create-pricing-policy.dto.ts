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
  buyerId?: string;

  @IsOptional()
  @IsEnum(BuyerRegion)
  marketRegion?: BuyerRegion;

  @IsOptional()
  @IsString()
  country?: string;

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
  maxQuantity?: number;

  @IsNumber()
  @Min(0.0001)
  unitPrice: number;

  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
