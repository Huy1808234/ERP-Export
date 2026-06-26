import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const CUSTOMER_DOCUMENT_TYPES = [
  'ALL',
  'QUOTATION',
  'SALES_CONTRACT',
  'PROFORMA_INVOICE',
  'ORDER',
] as const;

export const CUSTOMER_DOCUMENT_SORT_FIELDS = [
  'documentDate',
  'documentNumber',
  'status',
  'totalAmount',
] as const;

export type CustomerDocumentType = (typeof CUSTOMER_DOCUMENT_TYPES)[number];
export type CustomerDocumentSortField =
  (typeof CUSTOMER_DOCUMENT_SORT_FIELDS)[number];

export class QueryCommercialDocumentDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsIn(CUSTOMER_DOCUMENT_TYPES)
  type?: CustomerDocumentType;

  @IsOptional()
  @IsIn(CUSTOMER_DOCUMENT_SORT_FIELDS)
  sortBy?: CustomerDocumentSortField;

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  current?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
