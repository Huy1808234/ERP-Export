export type GRNStatus = 'DRAFT' | 'PENDING_QC' | 'COMPLETED' | 'CANCELLED';

export interface IGRNLine {
  _id: string;
  purchaseOrderItem_id?: string | null;
  productId: string;
  product: {
    _id: string;
    vietnameseName: string;
    sku: string;
  };
  quantityOrdered: number;
  quantityReceived: number;
  quantityRejected: number;
  rejectionReason?: string | null;
  hasActiveQualityCheck?: boolean;
  lotNumber?: string | null;
  qualityStatus?: 'PASS' | 'DAMAGED' | 'WRONG_SPEC' | 'QUARANTINE' | string;
  lineNote?: string | null;
  unit: string;
  note?: string;
}

export interface IGoodsReceipt {
  _id: string;
  grNumber?: string;
  grnNumber?: string;
  purchaseOrderId: string;
  purchaseOrder: {
    _id: string;
    poNumber: string;
    orderDate?: string;
    expectedDeliveryDate?: string;
    totalAmount?: number;
    currency?: string;
    vendor?: {
      _id: string;
      name: string;
    };
  };
  receivedDate: string;
  deliveryNoteNumber?: string | null;
  warehouseName?: string | null;
  warehouseLocation?: string | null;
  attachmentUrl?: string | null;
  receivedByUsername?: string;
  receivedBy: {
    _id: string;
    username: string;
    email?: string;
  };
  status: GRNStatus;
  note?: string;
  items?: IGRNLine[];
  createdAt: string;
}
