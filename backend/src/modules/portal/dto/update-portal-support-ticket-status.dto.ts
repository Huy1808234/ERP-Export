import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PortalTicketStatus } from '../entities/portal-support-ticket.entity';

export class UpdatePortalSupportTicketStatusDto {
  @IsEnum(PortalTicketStatus)
  status: PortalTicketStatus;

  @IsString()
  @IsOptional()
  note?: string;
}
