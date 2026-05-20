import { IsOptional, IsString } from 'class-validator';

export class CloseQualityExceptionDto {
  @IsOptional()
  @IsString()
  correctiveAction?: string;
}
