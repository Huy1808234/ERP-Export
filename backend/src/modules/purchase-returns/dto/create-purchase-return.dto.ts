import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  IsNumber,
} from 'class-validator';

export class CreatePurchaseReturnItemDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string | null;
}

export class CreatePurchaseReturnDto {
  @IsNotEmpty()
  @IsString()
  purchaseOrderId: string;

  @IsOptional()
  @IsString()
  qualityCheckId?: string | null;

  @IsOptional()
  @IsString()
  claimNumber?: string | null;

  @IsDateString()
  returnDate: string;

  @IsOptional()
  @IsString()
  reason?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReturnItemDto)
  items: CreatePurchaseReturnItemDto[];
}
