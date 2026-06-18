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
import { MarketRegionCode } from '@/common/geo.util';

const trimOptional = ({ value }: { value: unknown }): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeOptionalRegion = ({
  value,
}: {
  value: unknown;
}): MarketRegionCode | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
  return normalized.length > 0 ? (normalized as MarketRegionCode) : undefined;
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

export class QueryCountryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptional)
  search?: string;

  @IsOptional()
  @IsEnum(MarketRegionCode)
  @Transform(normalizeOptionalRegion)
  region?: MarketRegionCode;

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
  @Max(1000)
  @Transform(toPositiveInt)
  pageSize?: number;
}
