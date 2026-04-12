import { IsEmail, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsMongoId({ message: 'ID Không Hợp Lệ' })
  @IsNotEmpty({ message: 'ID Không Được Để Trống' })
  _id: string;

  @IsOptional()
  @IsString({ message: 'Name phải là chuỗi' })
  name?: string;

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
  @IsString({ message: 'Image phải là chuỗi' })
  image?: string;
}
