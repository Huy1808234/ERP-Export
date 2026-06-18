import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export const GOODS_RECEIPT_QUALITY_STATUSES = [
  'PASS',
  'DAMAGED',
  'WRONG_SPEC',
  'QUARANTINE',
] as const;

class GoodsReceiptItemDto {
  @IsOptional()
  @IsString()
  _id?: string;

  @IsOptional()
  @IsString()
  purchaseOrderItem_id?: string;

  @IsNotEmpty()
  @IsString()
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
  lotNumber?: string;

  @IsOptional()
  @IsIn(GOODS_RECEIPT_QUALITY_STATUSES)
  qualityStatus?: (typeof GOODS_RECEIPT_QUALITY_STATUSES)[number];

  @IsOptional()
  @IsString()
  lineNote?: string;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateGoodsReceiptDto {
  @IsNotEmpty()
  @IsString()
  purchaseOrderId: string;

  @IsDateString()
  @IsNotEmpty()
  receivedDate: string;

  @IsOptional()
  @IsString()
  deliveryNoteNumber?: string;

  @IsOptional()
  @IsString()
  warehouseName?: string;

  @IsOptional()
  @IsString()
  warehouseLocation?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptItemDto)
  items: GoodsReceiptItemDto[];
}
