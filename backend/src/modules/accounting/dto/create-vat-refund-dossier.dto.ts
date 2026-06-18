import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateVatRefundDossierDto {
  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  exportRevenueVnd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inputVatAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  outputVatAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
