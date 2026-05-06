import { PartialType } from '@nestjs/mapped-types';
import { CreateVendorInvoiceDto } from './create-vendor-invoice.dto';

export class UpdateVendorInvoiceDto extends PartialType(CreateVendorInvoiceDto) {}
