export type POStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'SENT'
  | 'PARTIAL_RECEIPT'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ISupplier {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface IProduct {
  _id: string;
  vietnameseName: string;
  sku?: string;
}

export interface IPOLine {
  _id: string;
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
  _id: string;
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
  approvalWorkflowRequestId?: string | null;
  submittedForApprovalByUsername?: string | null;
  submittedForApprovalAt?: string | null;
  approvedByUsername?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
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
