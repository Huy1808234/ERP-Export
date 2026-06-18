import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { IsEntityId } from '@/common/ids/entity-id.validator';
import { PortalReceiptType } from '../entities/portal-payment-receipt.entity';

export class CreatePortalPaymentReceiptDto {
  @IsEnum(PortalReceiptType)
  receiptType: PortalReceiptType;

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @IsEntityId()
  @IsOptional()
  accountReceivableId?: string;

  @IsEntityId()
  @IsOptional()
  salesContractId?: string;

  @IsEntityId()
  @IsNotEmpty()
  fileAsset_id: string;

  @IsString()
  @IsOptional()
  bankReference?: string;

  @IsString()
  @IsOptional()
  remittingBank?: string;

  @IsDateString()
  @IsOptional()
  transactionDate?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
