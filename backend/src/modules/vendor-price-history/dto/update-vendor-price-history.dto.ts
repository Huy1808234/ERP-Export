import { PartialType } from '@nestjs/mapped-types';
import { CreateVendorPriceHistoryDto } from './create-vendor-price-history.dto';

export class UpdateVendorPriceHistoryDto extends PartialType(
  CreateVendorPriceHistoryDto,
) {}
