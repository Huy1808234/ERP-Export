export enum UOM {
  PCS = 'PCS',
  KGS = 'KGS',
  TONS = 'TONS',
  CARTONS = 'CARTONS',
  SETS = 'SETS'
}

export interface IProduct {
  _id?: string;
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
  preferredSupplier?: { _id: string; name: string };
  currentStock?: number;
  category?: string;
  isBestseller?: boolean;
  isNew?: boolean;
  imageUrl?: string;
  isActive: boolean;
}
