import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LCDiscrepancyStatus } from '../entities/lc-discrepancy.entity';

export class ResolveLCDiscrepancyDto {
  @IsEnum(LCDiscrepancyStatus)
  status: LCDiscrepancyStatus;

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
