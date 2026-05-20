import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { ContractSignerType } from '../entities/contract-signature.entity';

export class SignSalesContractDto {
  @IsEnum(ContractSignerType)
  signerType: ContractSignerType;

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

  @IsOptional()
  @IsString()
  consentText?: string | null;
}
