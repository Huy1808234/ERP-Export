import { PartialType } from '@nestjs/mapped-types';
import { CreateAccountReceivableDto } from './create-account-receivable.dto';

export class UpdateAccountReceivableDto extends PartialType(CreateAccountReceivableDto) {}
