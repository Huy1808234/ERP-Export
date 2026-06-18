import { PartialType } from '@nestjs/mapped-types';
import { CreateSalesContractDto } from './create-sales-contract.dto';

export class CalculateSalesContractDto extends PartialType(
  CreateSalesContractDto,
) {}
