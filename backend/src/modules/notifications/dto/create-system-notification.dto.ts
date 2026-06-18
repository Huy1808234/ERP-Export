import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SystemNotificationType } from '../entities/system-notification.entity';

export class CreateSystemNotificationDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsEnum(SystemNotificationType)
  @IsOptional()
  type?: SystemNotificationType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  targetUrl?: string;
}
