import { PartialType } from '@nestjs/mapped-types';
import { CreateVendorEvaluationDto } from './create-vendor-evaluation.dto';

export class UpdateVendorEvaluationDto extends PartialType(
  CreateVendorEvaluationDto,
) {}
