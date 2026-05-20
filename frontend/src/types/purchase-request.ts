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
  _id?: string;
  productId: string;
  product?: IProduct;
  description?: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  totalAmount: number;
}

export interface IPurchaseRequest {
  _id: string;
  prNumber: string;
  requestDate: string;
  expectedDate?: string;
  department: string;
  purpose?: string;
  totalAmount: number;
  status: PRStatus;
  approvalWorkflowRequestId?: string | null;
  submittedForApprovalByUsername?: string | null;
  submittedForApprovalAt?: string | null;
  approvedByUsername?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  note?: string;
  items: IPurchaseRequestItem[];
  createdBy?: {
    _id: string;
    username: string;
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
