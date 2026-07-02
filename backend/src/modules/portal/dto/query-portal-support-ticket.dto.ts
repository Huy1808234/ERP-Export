import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  PortalTicketCategory,
  PortalTicketPriority,
  PortalTicketStatus,
} from '../entities/portal-support-ticket.entity';

const trimOptional = ({ value }: { value: unknown }): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toPositiveInt = ({ value }: { value: unknown }): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
};

export class QueryPortalSupportTicketDto {
  @IsOptional()
  @Transform(toPositiveInt)
  @IsInt()
  @Min(1)
  current?: number;

  @IsOptional()
  @Transform(toPositiveInt)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(PortalTicketStatus)
  status?: PortalTicketStatus;

  @IsOptional()
  @IsEnum(PortalTicketCategory)
  category?: PortalTicketCategory;

  @IsOptional()
  @IsEnum(PortalTicketPriority)
  priority?: PortalTicketPriority;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  assignedToUsername?: string;
}
