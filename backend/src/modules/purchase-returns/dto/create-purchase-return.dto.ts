import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PurchaseReturnLineCondition, PurchaseReturnReasonCode } from '../entities/purchase-return.entity';

export class CreatePurchaseReturnAttachmentDto {
  @IsNotEmpty()
  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsString()
  fileName?: string | null;

  @IsOptional()
  @IsString()
  mimeType?: string | null;

  @IsOptional()
  @IsNumber()
  fileSize?: number | null;

  @IsOptional()
  @IsString()
  category?: string;
}

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

  /** Unit price is optional — backend will fill from PO item when missing. */
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @IsEnum(PurchaseReturnLineCondition)
  condition?: PurchaseReturnLineCondition;

  @IsOptional()
  @IsString()
  batchNumber?: string | null;

  @IsOptional()
  @IsDateString()
  expiryDate?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
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
  @IsEnum(PurchaseReturnReasonCode)
  reasonCode?: PurchaseReturnReasonCode | null;

  @IsOptional()
  @IsString()
  reason?: string | null;

  @IsOptional()
  @IsString()
  carrierTrackingRef?: string | null;

  @IsOptional()
  @IsDateString()
  expectedPickupAt?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReturnItemDto)
  items: CreatePurchaseReturnItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReturnAttachmentDto)
  attachments?: CreatePurchaseReturnAttachmentDto[];
}
