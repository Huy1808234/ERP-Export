import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PortalAttachment } from '../entities/portal-support-ticket.entity';

export class CreatePortalSupportMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsArray()
  @IsOptional()
  attachments?: PortalAttachment[];
}
