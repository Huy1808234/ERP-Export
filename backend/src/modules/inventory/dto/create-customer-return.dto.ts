import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { IsEntityId } from '@/common/ids/entity-id.validator';
import { CustomerReturnReason } from '../entities/customer-return.entity';

const toOptionalNumber = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  });

export class CustomerReturnLineDto {
  @IsEntityId({ message: 'productId phải là _id hợp lệ' })
  productId: string;

  @toOptionalNumber()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.0001)
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  lotNumber?: string;

  @IsOptional()
  @IsBoolean()
  quarantine?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateCustomerReturnDto {
  @IsEntityId({ message: 'buyerId phải là _id hợp lệ' })
  buyerId: string;

  @IsOptional()
  @IsEntityId({ message: 'shipmentId phải là _id hợp lệ' })
  shipmentId?: string;

  @IsOptional()
  @IsEntityId({ message: 'salesContractId phải là _id hợp lệ' })
  salesContractId?: string;

  @IsEnum(CustomerReturnReason)
  reason: CustomerReturnReason;

  @IsOptional()
  @IsString()
  returnDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustomerReturnLineDto)
  items: CustomerReturnLineDto[];
}

export class CustomerReturnDecisionDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
