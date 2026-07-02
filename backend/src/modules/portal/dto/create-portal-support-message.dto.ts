import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PortalAttachment } from '../entities/portal-support-ticket.entity';
import { PortalMessageVisibility } from '../entities/portal-support-message.entity';

export class CreatePortalSupportMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsArray()
  @IsOptional()
  attachments?: PortalAttachment[];

  @IsEnum(PortalMessageVisibility)
  @IsOptional()
  visibility?: PortalMessageVisibility;
}
