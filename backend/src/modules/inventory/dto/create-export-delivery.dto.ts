import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateExportDeliveryFromShipmentDto {
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class IssueExportDeliveryDto {
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CancelExportDeliveryDto {
  @IsString()
  @MinLength(3)
  reason: string;
}
