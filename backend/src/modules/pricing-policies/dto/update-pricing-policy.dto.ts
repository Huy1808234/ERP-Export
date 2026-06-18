import { PartialType } from '@nestjs/mapped-types';
import { CreatePricingPolicyDto } from './create-pricing-policy.dto';

export class UpdatePricingPolicyDto extends PartialType(
  CreatePricingPolicyDto,
) {}
