import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateProductDto {
  @IsNotEmpty({ message: 'SKU Không Được Để Trống' })
  @IsString({ message: 'SKU phải là chuỗi' })
  sku: string;

  @IsNotEmpty({ message: 'Tên tiếng Việt Không Được Để Trống' })
  @IsString({ message: 'Tên tiếng Việt phải là chuỗi' })
  vietnameseName: string;

  @IsOptional()
  @IsString({ message: 'Tên tiếng Anh phải là chuỗi' })
  englishName?: string;

  @IsOptional()
  @IsString({ message: 'HS Code phải là chuỗi' })
  hsCode?: string;

  @IsOptional()
  @IsString({ message: 'Category phải là chuỗi' })
  category?: string;

  @IsOptional()
  @IsString({ message: 'Brand phải là chuỗi' })
  brand?: string;

  @IsOptional()
  @IsString({ message: 'Origin Country phải là chuỗi' })
  originCountry?: string;

  @IsOptional()
  @IsString({ message: 'Unit Of Measure phải là chuỗi' })
  unitOfMeasure?: string;

  @IsOptional()
  @IsString({ message: 'Packing Type phải là chuỗi' })
  packingType?: string;

  @IsOptional()
  @IsInt({ message: 'Pieces Per Carton phải là số nguyên' })
  @Min(0, { message: 'Pieces Per Carton không được âm' })
  piecesPerCarton?: number;

  @IsOptional()
  @IsInt({ message: 'Cartons Per Pallet phải là số nguyên' })
  @Min(0, { message: 'Cartons Per Pallet không được âm' })
  cartonsPerPallet?: number;

  @IsOptional()
  @IsNumber({}, { message: 'CBM Per Carton phải là số' })
  @Min(0, { message: 'CBM Per Carton không được âm' })
  cbmPerCarton?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Net Weight Per Carton phải là số' })
  @Min(0, { message: 'Net Weight Per Carton không được âm' })
  netWeightPerCarton?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Gross Weight Per Carton phải là số' })
  @Min(0, { message: 'Gross Weight Per Carton không được âm' })
  grossWeightPerCarton?: number;

  @IsOptional()
  @IsInt({ message: 'Pallet Layers phải là số nguyên' })
  @Min(0, { message: 'Pallet Layers không được âm' })
  palletLayers?: number;

  @IsOptional()
  @IsInt({ message: 'Cartons Per Layer phải là số nguyên' })
  @Min(0, { message: 'Cartons Per Layer không được âm' })
  cartonsPerLayer?: number;

  @IsOptional()
  @IsString({ message: 'Description phải là chuỗi' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Note phải là chuỗi' })
  note?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive phải là kiểu boolean' })
  isActive?: boolean;

  @IsOptional()
  @IsUUID('all', { message: 'Preferred Supplier ID không hợp lệ' })
  preferredSupplierId?: string;
}