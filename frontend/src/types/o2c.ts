export type QuotationStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONVERTED';

export type ProformaInvoiceStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED';
export type ShipmentStatus = 'BOOKED' | 'LOADING' | 'CUSTOMS_CLEARED' | 'ON_BOARD' | 'ARRIVED' | 'CLOSED';

export interface IQuotationLine {
  _id: string;
  product: {
    _id: string;
    vietnameseName: string;
    englishName?: string;
    sku?: string;
    hsCode?: string;
    piecesPerCarton?: number;
    cbmPerCarton?: number;
    grossWeightPerCarton?: number;
  };
  productDescription?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export interface IQuotation {
  _id: string;
  quotationNumber: string;
  customer: {
    _id: string;
    name: string;
    address?: string;
    contactPerson?: string;
    taxId?: string;
  };
  incoterm: string;
  incotermLocation?: string;
  currency: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  paymentTerms?: string;
  expiryDate?: string;
  subTotal: number;
  totalAmount: number;
  status: QuotationStatus;
  approvalWorkflowRequestId?: string | null;
  submittedForApprovalByUsername?: string | null;
  submittedForApprovalAt?: string | null;
  approvedByUsername?: string | null;
  approvedAt?: string | null;
  rejectedByUsername?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  logisticsFee: number;
  otherFee: number;
  domesticTransportCost?: number;
  portCharges?: number;
  seaFreight?: number;
  insuranceCost?: number;
  note?: string;
  bankInfo?: string;
  createdBy?: {
    _id: string;
    fullName?: string;
    name?: string;
    role?: {
      name: string;
    };
  };
  createdAt: string;
  items?: IQuotationLine[];
  proformaInvoices?: any[];
}

export interface IProformaInvoice extends Omit<IQuotation, 'status'> {
  piNumber: string;
  issueDate: string;
  depositAmount: number;
  depositPercent: number;
  quotationId?: string;
  status: ProformaInvoiceStatus;
}

export interface IContainer {
  containerNumber: string;
  sealNumber?: string;
  containerType: string;
  notes?: string;
}

export interface ISalesContract {
  _id: string;
  contractNumber: string;
  buyerId?: string;
  buyer?: { name: string; country?: string };
  status: string;
  incoterm: string;
  currencyCode: string;
  exchangeRate: number;
  totalAmount: number;
  totalAmountVnd: number;
  pol?: string;
  pod?: string;
  bookingNumber?: string;
  seaFreight: number;
  insuranceCost: number;
  domesticTransportCost: number;
  portCharges: number;
  logisticsFee: number;
  otherFee: number;
  deliveryDate?: string;
  validUntil?: string;
  paymentTerms?: string;
  notes?: string;
  items?: any[];
  proformaInvoiceId?: string;
  proformaInvoice?: { piNumber: string };
  createdAt: string;
}

export interface IShipment {
  _id: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  isStockIssued?: boolean;
  stockIssuedAt?: string;
  proformaInvoice?: { piNumber: string };
  salesContract?: ISalesContract;
  logisticsPartnerId?: string;
  logisticsPartner?: { name: string };
  bookingNumber?: string;
  vesselName?: string;
  pol?: string;
  pod?: string;
  etd?: string;
  eta?: string;
  containers?: IContainer[];
  documentChecklist?: Record<string, 'PENDING' | 'DONE' | 'NA'>;
  freightCost?: number;
  freightCurrency?: string;
  insuranceCost?: number;
  insuranceCurrency?: string;
  customsFeeVnd?: number;
  truckingCostVnd?: number;
  localChargesVnd?: number;
}

export interface IPaginationMeta {
  current: number;
  pageSize: number;
  total: number;
}
