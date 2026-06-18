import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PortType } from '../entities/port.entity';

const trimOptional = ({ value }: { value: unknown }): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toOptionalBoolean = ({
  value,
}: {
  value: unknown;
}): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

const toPositiveInt = ({ value }: { value: unknown }): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
};

export class QueryPortDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptional)
  search?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : undefined,
  )
  countryCode?: string;

  @IsOptional()
  @IsEnum(PortType)
  type?: PortType;

  @IsOptional()
  @IsBoolean()
  @Transform(toOptionalBoolean)
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(toPositiveInt)
  current?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(toPositiveInt)
  pageSize?: number;
}
