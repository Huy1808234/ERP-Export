import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsEntityId } from '@/common/ids/entity-id.validator';
import { BuyerRegion } from '@/modules/partners/entities/partner.entity';
import { Incoterm } from '@/modules/quotations/entities/quotation.entity';

export class ResolvePriceDto {
  @IsEntityId()
  productId: string;

  @IsOptional()
  @IsEntityId()
  buyerId?: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  quantity: number;

  @IsEnum(Incoterm)
  incoterm: Incoterm;

  @IsString()
  currency: string;

  @IsOptional()
  @IsEnum(BuyerRegion)
  marketRegion?: BuyerRegion;

  @IsOptional()
  @IsString()
  countryCode?: string;

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
  @IsDateString()
  priceDate?: string;
}
