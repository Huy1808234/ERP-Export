import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ExchangeRateType } from '../entities/exchange-rate.entity';

export class CreateExchangeRateDto {
  @IsString()
  @IsNotEmpty()
  currencyId: string;

  @IsNumber()
  @IsNotEmpty()
  rate: number;

  @IsDateString()
  @IsNotEmpty()
  effectiveDate: string;

  @IsEnum(ExchangeRateType)
  @IsOptional()
  rateType?: ExchangeRateType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
