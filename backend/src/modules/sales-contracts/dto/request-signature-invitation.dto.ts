import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RequestSignatureInvitationDto {
  @IsOptional()
  @IsString()
  signerName?: string;

  @IsOptional()
  @IsString()
  signerTitle?: string;

  @IsOptional()
  @IsEmail()
  signerEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;
}
