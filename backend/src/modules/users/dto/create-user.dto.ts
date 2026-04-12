import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty({ message: 'Name Không Được Để Trống' })
  @IsString({ message: 'Name phải là chuỗi' })
  name: string;

  @IsEmail({}, { message: 'Email Không Đúng Định Dạng' })
  email: string;

  @IsNotEmpty({ message: 'Password Không Được Để Trống' })
  @IsString({ message: 'Password phải là chuỗi' })
  password: string;

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
