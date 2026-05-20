export interface IPurchaseReturnItem {
  productId: string;
  product?: {
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
  status?: string;
  purchaseOrder?: {
    poNumber: string;
  };
  returnDate: string;
  reason?: string;
  items: IPurchaseReturnItem[];
  createdAt: string;
}
