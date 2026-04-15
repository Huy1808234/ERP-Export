import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PartnerType } from '../entities/partner.entity';

export class CreatePartnerDto {
  @IsNotEmpty({ message: 'Name Không Được Để Trống' })
  @IsString({ message: 'Name phải là chuỗi' })
  name: string;

  @IsEnum(PartnerType, { message: 'Partner Type không hợp lệ' })
  partnerType: PartnerType;

  @IsOptional()
  @IsString({ message: 'Contact Name phải là chuỗi' })
  contactName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email Không Đúng Định Dạng' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Phone phải là chuỗi' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Address phải là chuỗi' })
  address?: string;

  @IsOptional()
  @IsString({ message: 'Tax Code phải là chuỗi' })
  taxCode?: string;

  @IsOptional()
  @IsString({ message: 'Website phải là chuỗi' })
  website?: string;

  @IsOptional()
  @IsString({ message: 'Note phải là chuỗi' })
  note?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive phải là kiểu boolean' })
  isActive?: boolean;
}