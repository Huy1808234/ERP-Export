import type { IGoodsReceipt } from './goods-receipt';

export type QCResult = 'PASSED' | 'FAILED' | 'CONDITIONAL';
export type QCExceptionStatus = 'NONE' | 'QUARANTINED' | 'RETURN_CREATED' | 'CLAIM_OPEN' | 'CLOSED';
export type QCClaimStatus = 'NONE' | 'OPEN' | 'SENT' | 'RESOLVED' | 'CANCELLED';
export type QCResolutionType = 'NONE' | 'REPLACEMENT' | 'CREDIT_NOTE' | 'ACCEPT_AS_IS' | 'CANCELLED' | 'OTHER';
export type P2PExceptionCandidateSource = 'GRN_REJECTED_LINE' | 'PO_SHORT_RECEIPT';

export interface IQualityCheckProduct {
  _id: string;
  sku?: string | null;
  vietnameseName?: string | null;
  englishName?: string | null;
}

export interface IQualityCheck {
  _id: string;
  checkNumber: string;
  result: QCResult;
  exceptionStatus: QCExceptionStatus;
  claimStatus: QCClaimStatus;
  claimNumber?: string | null;
  claimSentByUsername?: string | null;
  claimSentAt?: string | null;
  resolutionType?: QCResolutionType;
  creditAmount?: number;
  replacementDueDate?: string | null;
  resolvedByUsername?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  quarantineQuantity: number;
  backorderQuantity: number;
  inspectorNotes?: string | null;
  correctiveAction?: string | null;
  inspectorUsername?: string | null;
  createdAt: string;
  product?: IQualityCheckProduct | null;
  goodsReceipt?: {
    _id: string;
    grNumber?: string | null;
    purchaseOrder?: {
      _id: string;
      poNumber?: string | null;
      vendor?: {
        _id: string;
        name?: string | null;
      } | null;
    } | null;
  } | null;
  goodsReceiptItem?: {
    _id: string;
    product?: IQualityCheckProduct | null;
    unit?: string | null;
  } | null;
  purchaseOrder?: {
    _id: string;
    poNumber?: string | null;
    vendor?: {
      _id: string;
      name?: string | null;
    } | null;
  } | null;
  purchaseReturn?: {
    _id: string;
    returnNumber?: string | null;
    status?: string | null;
  } | null;
}

export interface IP2PExceptionCandidate {
  _id: string;
  sourceType: P2PExceptionCandidateSource;
  sourceNumber: string;
  goodsReceiptItem_id: string | null;
  goodsReceipt_id: string | null;
  purchaseOrderItem_id: string | null;
  purchaseOrder_id: string | null;
  product_id: string;
  vendor_id: string | null;
  vendorName: string | null;
  poNumber: string | null;
  grNumber: string | null;
  product: IQualityCheckProduct | null;
  quantityOrdered: number;
  receivedQuantity: number;
  rejectedQuantity: number;
  backorderQuantity: number;
  exceptionQuantity: number;
  unit: string | null;
  qualityStatus: string | null;
  reason: string | null;
  createdAt: string;
  canCreateQc: boolean;
  existingQualityCheck_id: string | null;
}

export interface IExceptionDashboard {
  summary: {
    totalExceptionCount: number;
    openExceptionCount: number;
    activeQualityCheckCount: number;
    pendingSourceCount: number;
    rejectedGrnLineCount: number;
    shortReceiptCount: number;
    openClaimCount: number;
    sentClaimCount: number;
    rejectedQuantity: number;
    backorderQuantity: number;
    pendingCreditAmount: number;
    overdueReplacementCount: number;
  };
  claimAging: {
    days0To7: number;
    days8To14: number;
    days15To30: number;
    over30: number;
  };
  byVendor: Array<{
    vendor_id: string;
    vendorName: string;
    openExceptionCount: number;
    openClaimCount: number;
    rejectedQuantity: number;
    backorderQuantity: number;
  }>;
  byProduct: Array<{
    product_id: string;
    sku?: string | null;
    productName?: string | null;
    openExceptionCount: number;
    rejectedQuantity: number;
    backorderQuantity: number;
  }>;
  pendingSources: IP2PExceptionCandidate[];
}

export interface IExceptionBoardData {
  rows: IQualityCheck[];
  candidates: IP2PExceptionCandidate[];
  grns: IGoodsReceipt[];
  dashboard: IExceptionDashboard | null;
}

export interface CreateQualityCheckPayload extends Record<string, unknown> {
  goodsReceiptItemId?: string;
  productId?: string;
  goodsReceiptId?: string;
  purchaseOrderId?: string;
  result: Exclude<QCResult, 'PASSED'>;
  receivedQuantity?: number;
  rejectedQuantity: number;
  defectRate?: number;
  correctiveAction?: string;
  inspectorNotes: string;
}

export interface ResolveQualityExceptionPayload extends Record<string, unknown> {
  resolutionType: Exclude<QCResolutionType, 'NONE'>;
  creditAmount?: number;
  replacementDueDate?: string;
  note: string;
}
