import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'Username must be a string' })
  username?: string;

  @IsOptional()
  @IsString({ message: 'Display name must be a string' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email is invalid' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Address must be a string' })
  address?: string;

  @IsOptional()
  @IsString({ message: 'Image must be a string' })
  image?: string;

  @IsOptional()
  @IsString({ message: 'Role name must be a string' })
  roleName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class DeactivateUserDto {
  @IsNotEmpty({ message: 'Deactivation reason is required' })
  @IsString({ message: 'Deactivation reason must be a string' })
  @MinLength(3)
  reason: string;
}

export class BulkDeactivateUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  userRefs: string[];

  @IsNotEmpty({ message: 'Deactivation reason is required' })
  @IsString({ message: 'Deactivation reason must be a string' })
  @MinLength(3)
  reason: string;
}
