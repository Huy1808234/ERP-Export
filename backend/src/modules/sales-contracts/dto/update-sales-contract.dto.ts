import { PartialType } from '@nestjs/mapped-types';
import { CreateSalesContractDto } from './create-sales-contract.dto';

export class UpdateSalesContractDto extends PartialType(
  CreateSalesContractDto,
) {}
