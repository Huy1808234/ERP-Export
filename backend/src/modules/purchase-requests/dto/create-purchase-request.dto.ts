import {
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PurchaseRequestStatus,
  PurchaseRequestPriority,
} from '../entities/purchase-request.entity';

class PurchaseRequestItemDto {
  @IsOptional()
  @IsString()
  _id?: string;

  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNotEmpty()
  quantity: number;

  @IsOptional()
  estimatedPrice?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreatePurchaseRequestDto {
  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsEnum(PurchaseRequestPriority)
  priority?: PurchaseRequestPriority;

  @IsOptional()
  @IsString()
  project?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  requiredDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expectedDate?: Date;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestItemDto)
  items: PurchaseRequestItemDto[];
}
