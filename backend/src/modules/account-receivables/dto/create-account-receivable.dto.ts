import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { IsEntityId } from '@/common/ids/entity-id.validator';
import { ARSourceType, ARStatus } from '../entities/account-receivable.entity';

export class CreateAccountReceivableDto {
  @IsEntityId()
  buyerId: string;

  @IsOptional()
  @IsEntityId()
  salesContractId?: string;

  @IsOptional()
  @IsEntityId()
  commercialInvoice_id?: string;

  @IsString()
  invoiceNumber: string;

  @IsOptional()
  @IsEnum(ARSourceType)
  sourceType?: ARSourceType;

  @IsDateString()
  invoiceDate: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsNumber()
  @Min(0.01)
  amountForeign: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNumber()
  @Min(0.000001)
  exchangeRate: number;

  @IsOptional()
  @IsEnum(ARStatus)
  status?: ARStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
