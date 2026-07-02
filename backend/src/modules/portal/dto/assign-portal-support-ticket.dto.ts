import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

const trimOptional = ({ value }: { value: unknown }): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class AssignPortalSupportTicketDto {
  @IsString()
  @IsOptional()
  @Transform(trimOptional)
  assignedToUsername?: string;

  @IsString()
  @IsOptional()
  @Transform(trimOptional)
  note?: string;
}
