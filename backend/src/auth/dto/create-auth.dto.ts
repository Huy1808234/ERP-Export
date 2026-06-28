import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateAuthDto {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email is invalid' })
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(6, { message: 'Password must have at least 6 characters' })
  password: string;

  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  username?: string;
}

export class CodeAuthDto {
  @IsNotEmpty({ message: 'Account reference is required' })
  @IsString()
  accountRef: string;

  @IsNotEmpty({ message: 'Code is required' })
  @IsString()
  code: string;
}

export class ChangePasswordAuthDto {
  @IsNotEmpty({ message: 'Account reference is required' })
  @IsString()
  accountRef: string;

  @IsNotEmpty({ message: 'Code is required' })
  @IsString()
  code: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(6, { message: 'Password must have at least 6 characters' })
  password: string;
}

export class ForgotPasswordAuthDto {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email is invalid' })
  email: string;
}

export class RefreshTokenAuthDto {
  @IsNotEmpty({ message: 'Refresh token is required' })
  @IsString()
  refreshToken: string;
}
