export type VendorInvoiceStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface IVendorInvoice {
  id: string;
  invoiceNumber: string;
  purchaseOrderId: string;
  purchaseOrder: {
    id: string;
    poNumber: string;
    totalAmount: number;
  };
  vendorId: string;
  vendor: {
    id: string;
    name: string;
  };
  invoiceDate: string;
  dueDate?: string;
  totalAmount: number;
  taxAmount: number;
  currency: string;
  status: VendorInvoiceStatus;
  note?: string;
  createdAt: string;
}
