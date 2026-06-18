import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { CreateAccountPayableDto } from './create-account-payable.dto';

export class UpdateAccountPayableDto extends PartialType(
  CreateAccountPayableDto,
) {}

export class VoidAccountPayableDto {
  @IsNotEmpty({ message: 'Void reason is required' })
  @IsString({ message: 'Void reason must be a string' })
  @MinLength(3)
  reason: string;
}
