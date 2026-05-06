import { PartialType } from '@nestjs/mapped-types';
import { CreateCurrencyDto } from './create-currency.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCurrencyDto extends PartialType(CreateCurrencyDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
