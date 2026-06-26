import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class SepayWebhookDto {
  // SePay sometimes sends `id` as a number (sandbox) and sometimes as a string
  // (production). Accept both and coerce to string at the service layer.
  @IsOptional()
  @Type(() => String)
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  gateway?: string;

  @IsOptional()
  @IsString()
  transactionDate?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  subAccount?: string;

  @IsOptional()
  @IsIn(['in', 'out'])
  transferType?: 'in' | 'out';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  transferAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  accumulated?: number;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  referenceCode?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
