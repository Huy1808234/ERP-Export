export type CommercialInvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

export interface ICommercialInvoiceItem {
  _id: string;
  description: string;
  sku?: string | null;
  hsCode?: string | null;
  quantity: number;
  unit?: string | null;
  unitPriceForeign?: number;
  lineAmountForeign?: number;
  netWeight?: number | null;
  grossWeight?: number | null;
  cbm?: number | null;
}

export interface ICommercialInvoiceAuditEvent {
  action: string;
  username: string;
  at: string;
  note?: string | null;
  referenceType?: string | null;
  reference_id?: string | null;
}

export interface ICommercialInvoice {
  _id: string;
  invoiceNumber: string;
  salesContract_id: string;
  shipment_id: string;
  buyer_id: string;
  accountReceivable_id?: string | null;
  exportDocument_id?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  currency: string;
  exchangeRate?: number;
  subtotalForeign?: number;
  taxRatePercent: number;
  taxAmountForeign?: number;
  totalAmountForeign?: number;
  totalAmountVnd?: number;
  incoterm?: string | null;
  paymentTerms?: string | null;
  status: CommercialInvoiceStatus;
  sourceSnapshot?: Record<string, unknown> | null;
  auditTrail?: ICommercialInvoiceAuditEvent[] | null;
  createdByUsername?: string | null;
  issuedByUsername?: string | null;
  issuedAt?: string | null;
  cancelledByUsername?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  note?: string | null;
  buyer?: { name?: string | null; address?: string | null };
  salesContract?: { _id: string; contractNumber?: string | null; status?: string | null };
  shipment?: { _id: string; shipmentNumber?: string | null; status?: string | null };
  exportDocument?: { _id: string; documentNumber?: string | null; checklistStatus?: string | null };
  items?: ICommercialInvoiceItem[];
}

export interface ICommercialInvoiceShipmentOption {
  _id: string;
  shipmentNumber: string;
  status: string;
  salesContract?: {
    _id: string;
    contractNumber?: string | null;
    status?: string | null;
    buyer?: { name?: string | null };
  };
}

export interface IPaginatedResponse<T> {
  results: T[];
  meta?: { current: number; pageSize: number; total: number };
}
