import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAdjustmentDto {
  @IsNotEmpty()
  @IsString()
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
