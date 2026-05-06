// File: src/helpers/typeorm.util.ts

/**
 * Tiện ích giúp TypeORM tự động parse kiểu 'numeric' của PostgreSQL
 * từ String sang Number một cách an toàn.
 */
export class ColumnNumericTransformer {
  to(data: number | null): number | null {
    return data;
  }
  
  from(data: string | null): number | null {
    return data ? parseFloat(data) : null;
  }
}