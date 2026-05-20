import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { FxRevaluationSourceType } from '../entities/fx-revaluation.entity';

export class RunFxRevaluationDto {
  @IsOptional()
  @IsString()
  periodId?: string;

  @IsDateString()
  revaluationDate: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNumber()
  @IsPositive()
  closingRate: number;

  @IsOptional()
  @IsEnum(FxRevaluationSourceType)
  sourceType?: FxRevaluationSourceType;

  @IsOptional()
  @IsBoolean()
  postJournal?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
