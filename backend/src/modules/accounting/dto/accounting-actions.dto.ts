import { IsDateString, IsOptional, IsString } from 'class-validator';

export class OpenAccountingPeriodDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

export class CloseAccountingPeriodDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReopenAccountingPeriodDto {
  @IsString()
  reason: string;
}

export class LockAccountingPeriodDto {
  @IsString()
  reason: string;
}

export class AccountingNoteDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class VatRefundApprovalDto {
  @IsOptional()
  @IsString()
  approvalNote?: string;
}

export class VatRefundRejectionDto {
  @IsString()
  reason: string;
}

export class VatRefundPaymentDto {
  @IsOptional()
  @IsString()
  paymentReference?: string;
}
