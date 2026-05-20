import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Min, IsNumber } from 'class-validator';
import { QCResolutionType } from '../entities/quality-check.entity';

const toOptionalNumber = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  });

export class SendQualityClaimDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class ResolveQualityExceptionDto {
  @IsEnum(QCResolutionType)
  resolutionType: QCResolutionType;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  creditAmount?: number;

  @IsOptional()
  @IsString()
  replacementDueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
