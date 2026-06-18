import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCommercialInvoiceFromShipmentDto {
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRatePercent?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class IssueCommercialInvoiceDto {
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CancelCommercialInvoiceDto {
  @IsString()
  reason: string;
}
