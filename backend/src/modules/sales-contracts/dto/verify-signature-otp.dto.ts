import { IsString, Length } from 'class-validator';

export class VerifySignatureOtpDto {
  @IsString()
  @Length(6, 6)
  otp: string;
}
