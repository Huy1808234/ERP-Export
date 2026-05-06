import { PartialType } from '@nestjs/mapped-types';
import { CreateLCDto } from './create-lc.dto';

export class UpdateLCDto extends PartialType(CreateLCDto) {}
