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


export class CodeAuthDto {
  @IsNotEmpty({ message: '_id không được để trống' })
  _id: string;

  @IsNotEmpty({ message: 'Code không được để trống' })
  @IsString()
  code: string;

}

export class ChangePasswordAuthDto {
  @IsNotEmpty({ message: '_id không được để trống' })
  _id: string;

  @IsNotEmpty({ message: 'Code không được để trống' })
  @IsString()
  code: string;

  @IsNotEmpty({ message: 'Password không được để trống' })
  @IsString()
  @MinLength(6, { message: 'Password phải từ 6 ký tự trở lên' })
  password: string;
}
