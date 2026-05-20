import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PortalReceiptStatus } from '../entities/portal-payment-receipt.entity';

export class ReviewPortalPaymentReceiptDto {
  @IsEnum(PortalReceiptStatus)
  status: PortalReceiptStatus.CONFIRMED | PortalReceiptStatus.REJECTED;

  @IsString()
  @IsOptional()
  note?: string;
}
