export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';
export type ShipmentStatus = 'BOOKED' | 'LOADING' | 'CUSTOMS_CLEARED' | 'ON_BOARD' | 'ARRIVED' | 'CLOSED';

export interface IQuotationLine {
  id: string;
  product: {
    id: string;
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
  id: string;
  quotationNumber: string;
  customer: {
    id: string;
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
  logisticsFee: number;
  otherFee: number;
  note?: string;
  bankInfo?: string;
  createdAt: string;
  items?: IQuotationLine[];
}

export interface IContainer {
  containerNumber: string;
  sealNumber?: string;
  containerType: string;
  notes?: string;
}

export interface IShipment {
  id: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  isStockIssued?: boolean;
  stockIssuedAt?: string;
  proformaInvoice?: { piNumber: string };
  salesContract?: { 
    contractNumber: string;
    proformaInvoice?: { piNumber: string };
  };
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
  insuranceCost?: number;
  customsFeeVnd?: number;
  truckingCostVnd?: number;
  localChargesVnd?: number;
}

export interface IPaginationMeta {
  current: number;
  pageSize: number;
  total: number;
}
