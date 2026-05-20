import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsEntityId } from '@/common/ids/entity-id.validator';
import {
  PortalAttachment,
  PortalTicketCategory,
  PortalTicketPriority,
} from '../entities/portal-support-ticket.entity';

export class CreatePortalSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsEnum(PortalTicketCategory)
  @IsOptional()
  category?: PortalTicketCategory;

  @IsEnum(PortalTicketPriority)
  @IsOptional()
  priority?: PortalTicketPriority;

  @IsEntityId()
  @IsOptional()
  shipmentId?: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsArray()
  @IsOptional()
  attachments?: PortalAttachment[];
}
