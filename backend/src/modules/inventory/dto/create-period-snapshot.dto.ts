import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateInventoryPeriodSnapshotDto {
  @IsString()
  @MinLength(3)
  periodKey: string;

  @IsDateString()
  periodStartDate: string;

  @IsDateString()
  periodEndDate: string;

  @IsOptional()
  @IsIn(['FIFO', 'AVG'])
  valuationMethod?: 'FIFO' | 'AVG';

  @IsOptional()
  @IsString()
  note?: string;
}
