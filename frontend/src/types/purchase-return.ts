export type PurchaseReturnStatus =
  | 'DRAFT'
  | 'PENDING_VENDOR'
  | 'SENT'
  | 'CREDITED'
  | 'REPLACED'
  | 'CLOSED'
  | 'CANCELLED';

export type PurchaseReturnReasonCode =
  | 'DEFECTIVE'
  | 'EXPIRED'
  | 'WRONG_SPEC'
  | 'DAMAGED_IN_TRANSIT'
  | 'OVERSUPPLY'
  | 'QUALITY_REJECT'
  | 'OTHER';

export type PurchaseReturnLineCondition =
  | 'GOOD'
  | 'DAMAGED'
  | 'DEFECTIVE'
  | 'EXPIRED'
  | 'WRONG_SPEC';

export interface IPurchaseReturnAttachment {
  _id?: string;
  fileUrl: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  category?: string;
  uploadedByUsername?: string | null;
  createdAt?: string;
}

export interface IPurchaseReturnItem {
  _id?: string;
  productId: string;
  product?: {
    _id?: string;
    vietnameseName: string;
    englishName?: string;
    sku: string;
    hsCode?: string;
  };
  quantity: number;
  unit: string | null;
  unitPrice?: number;
  lineRefundAmount?: number;
  condition?: PurchaseReturnLineCondition;
  batchNumber?: string | null;
  expiryDate?: string | null;
  note?: string | null;
}

export interface IPurchaseReturn {
  _id: string;
  returnNumber: string;
  purchaseOrderId?: string | null;
  qualityCheckId?: string | null;
  claimNumber?: string | null;
  status: PurchaseReturnStatus;
  reasonCode?: PurchaseReturnReasonCode | null;
  reason?: string | null;
  settlementType?: string | null;
  settlementNote?: string | null;
  sentByUsername?: string | null;
  sentAt?: string | null;
  resolvedByUsername?: string | null;
  resolvedAt?: string | null;
  carrierTrackingRef?: string | null;
  expectedPickupAt?: string | null;
  creditNoteNumber?: string | null;
  replacementPurchaseOrderId?: string | null;
  replacementPurchaseOrder?: {
    _id?: string;
    poNumber: string;
  } | null;
  totalRefundableAmount?: number;
  currency?: string;
  purchaseOrder?: {
    _id?: string;
    poNumber: string;
    vendor?: {
      _id?: string;
      name?: string;
    };
  } | null;
  returnDate: string;
  items: IPurchaseReturnItem[];
  attachments?: IPurchaseReturnAttachment[];
  createdByUsername?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface IPurchaseReturnStats {
  total: number;
  byStatus: Record<PurchaseReturnStatus, number>;
  byReasonCode: Record<PurchaseReturnReasonCode, number>;
  totalRefundableAmount: number;
  pendingVendorValue: number;
  inTransitValue: number;
}

export interface IPurchaseReturnQuery {
  current?: number;
  pageSize?: number;
  status?: PurchaseReturnStatus;
  purchaseOrderId?: string;
  qualityCheckId?: string;
  claimNumber?: string;
  vendorId?: string;
  reasonCode?: PurchaseReturnReasonCode;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sort?: 'createdAt' | 'returnDate' | 'amount';
}
