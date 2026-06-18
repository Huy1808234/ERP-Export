import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  BuyerPaymentTerm,
  BuyerRegion,
  PartnerType,
  BuyerRiskLevel,
} from '../entities/partner.entity';

// LỜI KHUYÊN: Bạn nên move 2 hàm này sang file riêng (VD: src/common/decorators/transform.decorator.ts)
// để các DTO khác (như Product, PO) cũng có thể xài lại, tránh duplicate code.
export const trimString = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null) return value;
    return typeof value === 'string' ? value.trim() : value;
  });

export const toOptionalNumber = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const num = Number(value);
    // Nếu parse lỗi ra NaN, trả lại value gốc (string) để @IsNumber ở dưới chém nó
    return isNaN(num) ? value : num;
  });

export class CreatePartnerDto {
  @trimString()
  @IsNotEmpty({ message: 'Tên đối tác không được để trống' })
  @IsString({ message: 'Tên đối tác phải là chuỗi' })
  name: string;

  @IsEnum(PartnerType, { message: 'Loại đối tác không hợp lệ' })
  partnerType: PartnerType;

  @trimString()
  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi' })
  address?: string;

  @trimString()
  @IsOptional()
  @IsString({ message: 'Tên người liên hệ phải là chuỗi' })
  contactName?: string;

  @trimString()
  @IsOptional()
  @IsString({ message: 'Quốc gia phải là chuỗi' })
  country?: string;
  @trimString()
  @IsOptional()
  @IsString({ message: 'Mã quốc gia phải là chuỗi' })
  countryCode?: string;

  @IsOptional()
  @IsEnum(BuyerRegion, { message: 'Khu vực không hợp lệ' })
  region?: BuyerRegion;

  @trimString()
  @IsOptional()
  @IsString({ message: 'Mã số thuế phải là chuỗi' })
  taxCode?: string;

  @IsOptional()
  @IsEnum(BuyerPaymentTerm, { message: 'Điều khoản thanh toán không hợp lệ' })
  defaultPaymentTerm?: BuyerPaymentTerm;

  @trimString()
  @IsOptional()
  @IsString({ message: 'Đồng tiền mặc định phải là chuỗi' })
  defaultCurrency?: string;

  @trimString()
  @IsOptional()
  @IsString({ message: 'Tên ngân hàng phải là chuỗi' })
  bankName?: string;

  @trimString()
  @IsOptional()
  @IsString({ message: 'Tên chủ tài khoản phải là chuỗi' })
  bankAccountName?: string;

  @trimString()
  @IsOptional()
  @IsString({ message: 'Số tài khoản phải là chuỗi' })
  bankAccountNumber?: string;

  @trimString()
  @IsOptional()
  @IsString({ message: 'Mã Swift Code phải là chuỗi' })
  bankSwiftCode?: string;

  @trimString()
  @IsOptional()
  @IsString({ message: 'Địa chỉ ngân hàng phải là chuỗi' })
  bankAddress?: string;

  @toOptionalNumber()
  @IsOptional()
  // Bổ sung allowNaN: false để vá lỗi truyền chữ vào Number
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'Hạn mức tín dụng (Credit Limit) phải là số' },
  )
  @Min(0, { message: 'Hạn mức tín dụng không được âm' })
  creditLimit?: number;

  @IsOptional()
  @IsEnum(BuyerRiskLevel, { message: 'Mức độ rủi ro không hợp lệ' })
  riskLevel?: BuyerRiskLevel;

  @IsOptional()
  @IsBoolean({ message: 'isManualRisk phải là kiểu boolean' })
  isManualRisk?: boolean;

  @IsOptional()
  @IsEnum(BuyerRiskLevel, { message: 'manualRiskLevel không hợp lệ' })
  manualRiskLevel?: BuyerRiskLevel;

  @trimString()
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  note?: string;

  @trimString()
  @IsOptional()
  @IsString({ message: 'Phân loại nhà cung cấp phải là chuỗi' })
  vendorCategory?: string;

  @trimString()
  @IsOptional()
  @IsString({ message: 'Điều khoản thanh toán vendor phải là chuỗi' })
  vendorPaymentTerm?: string;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'Điểm chất lượng phải là số' },
  )
  @Min(0, { message: 'Điểm chất lượng không được âm' })
  qualityScore?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'Điểm giao hàng phải là số' },
  )
  @Min(0, { message: 'Điểm giao hàng không được âm' })
  deliveryScore?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'Điểm giá cả phải là số' },
  )
  @Min(0, { message: 'Điểm giá cả không được âm' })
  priceScore?: number;

  @toOptionalNumber()
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'Công nợ AP phải là số' },
  )
  @Min(0, { message: 'Công nợ AP không được âm' })
  apBalance?: number;

  @trimString()
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  @trimString()
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  phone?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày đến hạn thanh toán không hợp lệ' })
  paymentDueDate?: string;

  @IsOptional()
  @IsBoolean({
    message: 'Trạng thái hoạt động (isActive) phải là kiểu boolean',
  })
  isActive?: boolean;
}
