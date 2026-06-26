import { Transform, TransformFnParams } from 'class-transformer';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const trimString = () =>
  Transform(({ value }: TransformFnParams) => {
    const input: unknown = value;
    return typeof input === 'string' ? value.trim() : input;
  });

export const PURCHASE_RETURN_SETTLEMENT_TYPES = [
  'CREDITED',
  'REPLACED',
  'CLOSED',
] as const;

export class ResolvePurchaseReturnDto {
  @IsIn(PURCHASE_RETURN_SETTLEMENT_TYPES)
  settlementType: (typeof PURCHASE_RETURN_SETTLEMENT_TYPES)[number];

  @IsOptional()
  @trimString()
  @IsString()
  settlementNote?: string | null;

  /** Required when settlementType === 'CREDITED'. */
  @IsOptional()
  @IsString()
  creditNoteNumber?: string | null;

  /** Required when settlementType === 'REPLACED'. */
  @IsOptional()
  @IsString()
  replacementPurchaseOrderId?: string | null;
}

export class CancelPurchaseReturnDto {
  @trimString()
  @IsString()
  @MinLength(3)
  reason: string;
}
