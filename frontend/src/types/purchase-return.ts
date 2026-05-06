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
  id: string;
  returnNumber: string;
  purchaseOrderId?: string;
  purchaseOrder?: {
    poNumber: string;
  };
  returnDate: string;
  reason?: string;
  items: IPurchaseReturnItem[];
  createdAt: string;
}
