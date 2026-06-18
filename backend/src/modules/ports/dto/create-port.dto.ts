import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PortType } from '../entities/port.entity';

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

const normalizeCountryCode = ({
  value,
}: {
  value: unknown;
}): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
};

export class CreatePortDto {
  @IsString()
  @Length(5, 12)
  @Transform(normalizeCode)
  code: string;

  @IsString()
  @MaxLength(180)
  @Transform(normalizeOptionalText)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(normalizeOptionalText)
  localName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(normalizeOptionalText)
  city?: string;

  @IsString()
  @MaxLength(120)
  @Transform(normalizeOptionalText)
  country: string;

  @IsString()
  @Length(2, 2)
  @Transform(normalizeCountryCode)
  countryCode: string;

  @IsOptional()
  @IsEnum(PortType)
  type?: PortType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(normalizeOptionalText)
  timezone?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsString()
  @Transform(normalizeOptionalText)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
