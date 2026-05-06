export type GRNStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';

export interface IGRNLine {
  id: string;
  productId: string;
  product: {
    id: string;
    vietnameseName: string;
    sku: string;
  };
  quantityReceived: number;
  unit: string;
  note?: string;
}

export interface IGoodsReceipt {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  purchaseOrder: {
    id: string;
    poNumber: string;
  };
  receivedDate: string;
  receivedById: string;
  receivedBy: {
    id: string;
    email: string;
  };
  status: GRNStatus;
  note?: string;
  items?: IGRNLine[];
  createdAt: string;
}
