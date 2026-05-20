import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { IsEntityId } from '@/common/ids/entity-id.validator';

export class CreateAdjustmentDto {
  @IsNotEmpty()
  @IsString()
  @IsEntityId()
  productId: string;

  @IsNotEmpty()
  @IsNumber()
  adjustmentQuantity: number; // Positive for add, negative for remove

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  lotNumber?: string;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;
}
