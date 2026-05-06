import { PartialType } from '@nestjs/mapped-types';
import { CreateAccountPayableDto } from './create-account-payable.dto';

export class UpdateAccountPayableDto extends PartialType(CreateAccountPayableDto) {}
