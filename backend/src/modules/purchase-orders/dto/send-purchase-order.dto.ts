import { IsBoolean, IsOptional } from 'class-validator';

export class SendPurchaseOrderDto {
  @IsOptional()
  @IsBoolean()
  confirmNoApprovalRule?: boolean;
}
