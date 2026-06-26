import {
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BankChargeType, PaymentReceiptSource } from '../entities/payment-receipt.entity';

export class CreatePaymentReceiptDto {
  @IsString()
  accountReceivableId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountPaidForeign: number;

  @IsString()
  @IsOptional()
  currency?: string = 'USD';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  exchangeRate?: number = 1;

  @IsDateString()
  paymentDate: string;

  @IsEnum(BankChargeType)
  @IsOptional()
  bankChargeType?: BankChargeType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  bankChargeForeign?: number = 0;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;

  @IsString()
  @IsOptional()
  attachmentFilename?: string;

  @IsString()
  @IsOptional()
  senderBankName?: string;

  @IsString()
  @IsOptional()
  senderAccountNumber?: string;

  @IsString()
  @IsOptional()
  senderName?: string;

  @IsString()
  @IsOptional()
  swiftCode?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsEnum(PaymentReceiptSource)
  @IsOptional()
  source?: PaymentReceiptSource = PaymentReceiptSource.CUSTOMER_PORTAL_UPLOAD;

  @IsString()
  @IsOptional()
  transferReference?: string;
}

export class ApprovePaymentReceiptDto {
  @IsString()
  @IsOptional()
  note?: string;
}

export class RejectPaymentReceiptDto {
  @IsString()
  rejectionReason: string;
}
