import { IsArray, IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class GoodsReceiptItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0)
  quantityOrdered: number;

  @IsNumber()
  @Min(0)
  quantityReceived: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityRejected?: number;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateGoodsReceiptDto {
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderId: string;

  @IsDateString()
  @IsNotEmpty()
  receivedDate: string;

  @IsOptional()
  @IsString()
  deliveryNoteNumber?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptItemDto)
  items: GoodsReceiptItemDto[];
}
