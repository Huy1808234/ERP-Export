import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateSettingDto {
  @IsNotEmpty({ message: 'Key cannot be empty' })
  @IsString()
  key: string;

  @IsOptional()
  @IsString()
  value: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class BulkUpdateSettingsDto {
  @IsNotEmpty()
  settings: UpdateSettingDto[];
}
