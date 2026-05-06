export type POStatus = 'DRAFT' | 'SENT' | 'PARTIAL_RECEIPT' | 'RECEIVED' | 'COMPLETED' | 'CANCELLED';

export interface ISupplier {
  id: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface IProduct {
  id: string;
  vietnameseName: string;
  sku?: string;
}

export interface IPOLine {
  id: string;
  productId: string;
  product: IProduct;
  quantity: number;
  receivedQuantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  totalAmount: number;
}

export interface IPurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendor: ISupplier;
  orderDate: string;
  expectedDeliveryDate?: string;
  currency: string;
  subTotal: number;
  taxAmount: number;
  totalAmount: number;
  status: POStatus;
  note?: string;
  createdAt: string;
  items?: IPOLine[];
}

export interface IPaginationMeta {
  current: number;
  pageSize: number;
  total: number;
  pages?: number;
}
