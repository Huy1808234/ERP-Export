import { IsString, IsEnum, IsOptional, IsBoolean, Min, IsNumber, IsEmail, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { BuyerRegion, BuyerPaymentTerm, BuyerRiskLevel, PartnerType } from '../entities/partner.entity';

const toOptionalNumber = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  });

export class UpdatePartnerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(PartnerType)
  partnerType?: PartnerType;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(BuyerRegion)
  region?: BuyerRegion;

  @IsOptional()
  @IsEnum(BuyerRiskLevel)
  riskLevel?: BuyerRiskLevel;

  @IsOptional()
  @toOptionalNumber()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @IsOptional()
  @IsEnum(BuyerPaymentTerm)
  defaultPaymentTerm?: BuyerPaymentTerm;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  taxCode?: string;

  @IsOptional()
  @IsBoolean()
  isManualRisk?: boolean;

  @IsOptional()
  @IsEnum(BuyerRiskLevel)
  manualRiskLevel?: BuyerRiskLevel;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  bankSwiftCode?: string;

  @IsOptional()
  @IsString()
  bankAddress?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  vendorCategory?: string;

  @IsOptional()
  @IsString()
  vendorPaymentTerm?: string;

  @IsOptional()
  @toOptionalNumber()
  @IsNumber()
  @Min(0)
  qualityScore?: number;

  @IsOptional()
  @toOptionalNumber()
  @IsNumber()
  @Min(0)
  deliveryScore?: number;

  @IsOptional()
  @toOptionalNumber()
  @IsNumber()
  @Min(0)
  priceScore?: number;

  @IsOptional()
  @toOptionalNumber()
  @IsNumber()
  @Min(0)
  apBalance?: number;

  @IsOptional()
  @IsDateString()
  paymentDueDate?: string;
}