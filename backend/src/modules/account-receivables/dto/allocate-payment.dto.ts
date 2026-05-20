import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { IsEntityId } from '@/common/ids/entity-id.validator';

export class AllocatePaymentDto {
  @IsNumber()
  @Min(0.01)
  amountForeign: number;

  @IsNumber()
  @Min(0.000001)
  exchangeRate: number;

  @IsOptional()
  @IsEntityId()
  tradeFinanceTransactionId?: string;

  @IsOptional()
  @IsDateString()
  allocatedAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
