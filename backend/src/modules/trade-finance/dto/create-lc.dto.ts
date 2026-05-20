import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { LCType } from '../entities/letter-of-credit.entity';
import { IsEntityId } from '@/common/ids/entity-id.validator';

export class CreateLCDto {
  @IsString()
  @IsNotEmpty()
  lcNumber: string;

  @IsEntityId()
  @IsNotEmpty()
  salesContractId: string;

  @IsEnum(LCType)
  @IsNotEmpty()
  lcType: LCType;

  @IsString()
  @IsNotEmpty()
  issuingBank: string;

  @IsString()
  @IsOptional()
  advisingBank: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsOptional()
  currency: string;

  @IsDateString()
  @IsNotEmpty()
  issueDate: string;

  @IsDateString()
  @IsNotEmpty()
  expiryDate: string;

  @IsDateString()
  @IsOptional()
  latestShipmentDate: string;

  @IsDateString()
  @IsOptional()
  presentationDeadline: string;

  @IsString()
  @IsOptional()
  descriptionOfGoods: string;

  @IsString()
  @IsOptional()
  documentsRequired: string;

  @IsString()
  @IsOptional()
  additionalConditions: string;
}
