import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class CreateVendorInvoiceItemDto {
  @IsOptional()
  @IsString()
  purchaseOrderItem_id?: string;

  @IsOptional()
  @IsString()
  goodsReceiptItem_id?: string;

  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateVendorInvoiceDto {
  @IsString()
  @IsNotEmpty()
  invoiceNumber: string;

  @IsOptional()
  @IsString()
  invoiceSeries?: string;

  @IsNotEmpty()
  @IsString()
  purchaseOrderId: string;

  @IsNotEmpty()
  @IsString()
  vendorId: string;

  @IsDateString()
  @IsNotEmpty()
  invoiceDate: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  exchangeRate?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString({ each: true })
  attachments?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVendorInvoiceItemDto)
  items: CreateVendorInvoiceItemDto[];
}
