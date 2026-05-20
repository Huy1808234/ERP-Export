import { IsOptional, IsString } from 'class-validator';

export class ProductChangeDecisionDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
