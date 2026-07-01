import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsEntityId } from '@/common/ids/entity-id.validator';
import { PortalReceiptType } from '../entities/portal-payment-receipt.entity';

export enum PortalPaymentSource {
  SEPAY_WEBHOOK = 'SEPAY_WEBHOOK',
  CUSTOMER_PORTAL_UPLOAD = 'CUSTOMER_PORTAL_UPLOAD',
  CUSTOMER_QR_INITIATED = 'CUSTOMER_QR_INITIATED',
  MANUAL_ENTRY = 'MANUAL_ENTRY',
}

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

  @IsString()
  @IsOptional()
  fileAsset_id?: string;

  @ValidateIf((dto: CreatePortalPaymentReceiptDto) => !dto.transferReference)
  @IsString()
  @IsNotEmpty()
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

  @IsEnum(PortalPaymentSource)
  @IsOptional()
  source?: PortalPaymentSource;

  @IsString()
  @IsOptional()
  transferReference?: string;

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

  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  autoApprove?: boolean;
}
