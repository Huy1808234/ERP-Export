export enum UOM {
  PCS = 'PCS',
  KGS = 'KGS',
  TONS = 'TONS',
  CARTONS = 'CARTONS',
  SETS = 'SETS'
}

export interface IProduct {
  id?: string;
  sku: string;
  vietnameseName: string;
  englishName: string;
  hsCode?: string;
  descriptionEn?: string;
  unitOfMeasure: UOM;
  packingType?: string;
  
  // Logistics - Trái tim của ERP Xuất khẩu
  piecesPerCarton: number;
  cartonLengthCm: number;
  cartonWidthCm: number;
  cartonHeightCm: number;
  cbmPerCarton: number; // Tự động tính
  netWeightKg: number;
  grossWeightKg: number;

  // Kinh doanh
  purchasePriceVnd: number;
  defaultExportPrice: number;
  exportCurrency: string;
  
  preferredSupplierId?: string;
  preferredSupplier?: { id: string; name: string };
  currentStock?: number;
  isActive: boolean;
}