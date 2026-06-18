import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MarketRegionCode } from '@/common/geo.util';

const normalizeOptionalText = ({
  value,
}: {
  value: unknown;
}): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeCode = ({ value }: { value: unknown }): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\s+/g, '').toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeRegion = ({
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

export class CreateCountryDto {
  @IsString()
  @Length(2, 2)
  @Transform(normalizeCode)
  code: string;

  @IsString()
  @MaxLength(180)
  @Transform(normalizeOptionalText)
  name: string;

  @IsString()
  @MaxLength(180)
  @Transform(normalizeOptionalText)
  nameVi: string;

  @IsEnum(MarketRegionCode)
  @MaxLength(50)
  @Transform(normalizeRegion)
  region: MarketRegionCode;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
