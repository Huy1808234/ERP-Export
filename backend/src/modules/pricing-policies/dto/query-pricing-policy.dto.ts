import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { IsEntityId } from '@/common/ids/entity-id.validator';
import { BuyerRegion } from '@/modules/partners/entities/partner.entity';
import { Incoterm } from '@/modules/quotations/entities/quotation.entity';
import { SalesPriceSourceType } from '../entities/sales-price-history.entity';

export class PricingPolicyPaginationDto {
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
}

export class FindPricingPoliciesQueryDto extends PricingPolicyPaginationDto {
  @IsOptional()
  @IsEntityId()
  productId?: string;

  @IsOptional()
  @IsEntityId()
  buyerId?: string;

  @IsOptional()
  @IsEnum(BuyerRegion)
  marketRegion?: BuyerRegion;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsEntityId()
  origin_port_id?: string;

  @IsOptional()
  @IsEntityId()
  destination_port_id?: string;

  @IsOptional()
  @IsEnum(Incoterm)
  incoterm?: Incoterm;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @IsOptional()
  @IsDateString()
  effectiveOn?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class FindSalesPriceHistoryQueryDto extends PricingPolicyPaginationDto {
  @IsOptional()
  @IsEntityId()
  productId?: string;

  @IsOptional()
  @IsEntityId()
  buyerId?: string;

  @IsOptional()
  @IsEnum(SalesPriceSourceType)
  sourceType?: SalesPriceSourceType;

  @IsOptional()
  @IsEnum(Incoterm)
  incoterm?: Incoterm;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
