export type VendorInvoiceStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface IVendorInvoice {
  _id: string;
  invoiceNumber: string;
  invoiceSeries?: string;
  purchaseOrderId: string;
  purchaseOrder: {
    _id: string;
    poNumber: string;
    totalAmount: number;
  };
  vendorId: string;
  vendor: {
    _id: string;
    name: string;
  };
  invoiceDate: string;
  dueDate?: string;
  amount: number;
  taxRate?: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: VendorInvoiceStatus;
  note?: string;
  attachments?: string[];
  createdAt: string;
}
