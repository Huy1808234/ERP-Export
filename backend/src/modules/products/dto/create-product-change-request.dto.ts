import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateProductChangeRequestDto {
  @IsObject()
  patch: Record<string, unknown>;

  @IsOptional()
  @IsString()
  reason?: string;
}
