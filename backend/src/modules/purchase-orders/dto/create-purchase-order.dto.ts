import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class PurchaseOrderItemDto {
  @IsOptional()
  @IsString()
  _id?: string;

  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreatePurchaseOrderDto {
  @IsNotEmpty()
  @IsString()
  vendorId: string;

  @IsOptional()
  @IsString()
  purchaseRequestId?: string;

  @IsOptional()
  @IsString()
  proformaInvoiceId?: string;

  @IsDateString()
  @IsNotEmpty()
  orderDate: string;

  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}
