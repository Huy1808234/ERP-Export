import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Incoterm } from '@/modules/quotations/entities/quotation.entity';

export class CreatePortalInquiryLineItemDto {
  @IsString()
  product_id: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetPrice?: number | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}

export class CreatePortalInquiryDto {
  @IsOptional()
  @IsString()
  product_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePortalInquiryLineItemDto)
  lineItems?: CreatePortalInquiryLineItemDto[];

  @IsOptional()
  @IsEnum(Incoterm)
  incoterm?: Incoterm;

  @IsOptional()
  @IsString()
  destinationPort?: string | null;

  @IsOptional()
  @IsDateString()
  expectedShipmentDate?: string | null;

  @IsOptional()
  @IsString()
  targetPriceCurrency?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsString()
  customerPhone?: string | null;

  @IsOptional()
  @IsString()
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  idempotencyKey?: string | null;
}
