import { Transform, TransformFnParams } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

const trimString = () =>
  Transform(({ value }: TransformFnParams) => {
    const input: unknown = value;
    return typeof input === 'string' ? input.trim() : input;
  });

export class ReverseGoodsReceiptDto {
  @trimString()
  @IsString()
  @MinLength(3)
  reason: string;
}
