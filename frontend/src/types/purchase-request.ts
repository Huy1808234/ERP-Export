import { IProduct } from "./product";

export enum PRStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PARTIAL_PO = 'PARTIAL_PO',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface IPurchaseRequestItem {
  id?: string;
  productId: string;
  product?: IProduct;
  description?: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  totalAmount: number;
}

export interface IPurchaseRequest {
  id: string;
  prNumber: string;
  requestDate: string;
  expectedDate?: string;
  department: string;
  purpose?: string;
  totalAmount: number;
  status: PRStatus;
  note?: string;
  items: IPurchaseRequestItem[];
  createdBy?: {
    id: string;
    email: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface IPRPaginate {
  results: IPurchaseRequest[];
  totalItems: number;
  totalPages: number;
}
