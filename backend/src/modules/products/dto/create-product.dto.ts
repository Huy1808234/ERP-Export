import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

const trimString = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null) return value;
    return typeof value === 'string' ? value.trim() : value;
  });

const toOptionalNumber = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  });

export class CreateProductDto {
  @trimString()
  @IsNotEmpty({ message: 'SKU không được để trống' })
  @IsString()
  sku: string;

  @trimString()
  @IsNotEmpty({ message: 'Tên tiếng Việt không được để trống' })
  @IsString()
  vietnameseName: string;

  @trimString()
  @IsOptional()
  @IsString()
  englishName?: string;

  @trimString()
  @IsOptional()
  @IsString()
  hsCode?: string;

  @trimString()
  @IsOptional()
  @IsString()
  category?: string;

  @trimString()
  @IsOptional()
  @IsString()
  brand?: string;

  @trimString()
  @IsOptional()
  @IsString()
  originCountry?: string;

  @trimString()
  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @trimString()
  @IsOptional()
  @IsString()
  packingType?: string;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  piecesPerCarton?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  cartonsPerPallet?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  cartonLengthCm?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  cartonWidthCm?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  cartonHeightCm?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  cbmPerCarton?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  netWeightPerCarton?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  grossWeightPerCarton?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  palletLayers?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  cartonsPerLayer?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  purchasePriceVnd?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  defaultExportPrice?: number;

  @trimString()
  @IsOptional()
  @IsString()
  exportCurrency?: string;

  @IsOptional()
  @IsUUID('4', { message: 'preferredSupplierId không hợp lệ' })
  preferredSupplierId?: string;

  @trimString()
  @IsOptional()
  @IsString()
  description?: string;

  @trimString()
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
