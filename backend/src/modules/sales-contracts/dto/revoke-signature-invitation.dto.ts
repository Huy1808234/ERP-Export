import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RevokeSignatureInvitationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
