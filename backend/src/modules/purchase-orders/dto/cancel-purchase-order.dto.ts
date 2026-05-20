import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

const trimString = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CancelPurchaseOrderDto {
  @trimString()
  @IsString()
  @MinLength(3)
  reason: string;
}
