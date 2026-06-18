import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  Length,
} from 'class-validator';

export class CreateCurrencyDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  symbol?: string;

  @IsBoolean()
  @IsOptional()
  isBase?: boolean;
}
