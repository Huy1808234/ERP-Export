import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateAuthDto {
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsNotEmpty({ message: 'Password không được để trống' })
  @IsString()
  @MinLength(6, { message: 'Password phải từ 6 ký tự trở lên' })
  password: string;

  @IsOptional()
  @IsString()
  name: string;
}