import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class PortalSignSalesContractDto {
  @IsString()
  signerName: string;

  @IsOptional()
  @IsString()
  signerTitle?: string | null;

  @IsOptional()
  @IsEmail()
  signerEmail?: string | null;

  @IsOptional()
  @IsString()
  signatureImageFileId?: string | null;

  @IsString()
  consentText: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  otp?: string;
}
