export type PurchaseReturnStatus =
  | 'DRAFT'
  | 'PENDING_VENDOR'
  | 'SENT'
  | 'CREDITED'
  | 'REPLACED'
  | 'CLOSED'
  | 'CANCELLED';

export interface IPurchaseReturnItem {
  _id?: string;
  productId: string;
  product?: {
    _id?: string;
    vietnameseName: string;
    sku: string;
  };
  quantity: number;
  unit: string;
}

export interface IPurchaseReturn {
  _id: string;
  returnNumber: string;
  purchaseOrderId?: string;
  qualityCheckId?: string | null;
  claimNumber?: string | null;
  status: PurchaseReturnStatus;
  purchaseOrder?: {
    _id?: string;
    poNumber: string;
  };
  returnDate: string;
  reason?: string | null;
  settlementType?: string | null;
  settlementNote?: string | null;
  sentByUsername?: string | null;
  sentAt?: string | null;
  resolvedByUsername?: string | null;
  resolvedAt?: string | null;
  items: IPurchaseReturnItem[];
  createdAt: string;
}
