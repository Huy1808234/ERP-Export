// create-auth.dto.ts

import {
  IsEmail, // Nên dùng cái này để validate định dạng email
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateAuthDto {
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không đúng định dạng' }) 
  email: string;

  @IsNotEmpty({ message: 'Password không được để trống' })
  @IsString()
  @MinLength(6, { message: 'Password phải từ 6 ký tự trở lên' })
  password: string;

  @IsOptional()
  @IsString()
  name: string;
}

export class CodeAuthDto {
  @IsNotEmpty({ message: 'id không được để trống' })
  @IsString()
  id: string;

  @IsNotEmpty({ message: 'Code không được để trống' })
  @IsString()
  code: string;
}

export class ChangePasswordAuthDto {
  @IsNotEmpty({ message: 'id không được để trống' })
  @IsString()
  id: string;

  @IsNotEmpty({ message: 'Code không được để trống' })
  @IsString()
  code: string;

  @IsNotEmpty({ message: 'Password không được để trống' })
  @IsString()
  @MinLength(6, { message: 'Password phải từ 6 ký tự trở lên' })
  password: string;
}