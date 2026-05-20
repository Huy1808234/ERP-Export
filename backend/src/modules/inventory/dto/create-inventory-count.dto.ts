import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsEntityId } from '@/common/ids/entity-id.validator';

export class InventoryCountLineDto {
  @IsEntityId()
  productId: string;

  @IsNumber()
  @Min(0)
  countedQuantity: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateInventoryCountDto {
  @IsOptional()
  @IsDateString()
  countDate?: string;

  @IsOptional()
  @IsString()
  warehouseName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryCountLineDto)
  items?: InventoryCountLineDto[];
}

export class SubmitInventoryCountDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryCountLineDto)
  items?: InventoryCountLineDto[];
}

export class ApproveInventoryCountDto {
  @IsOptional()
  @IsString()
  approvalNote?: string;
}
