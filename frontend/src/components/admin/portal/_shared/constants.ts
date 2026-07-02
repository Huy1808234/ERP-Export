import type { Dayjs } from 'dayjs';
import type { CustomerCommercialDocumentType, PortalProduct } from '@/types/customer-portal';

export type CustomerPortalView =
  | 'overview'
  | 'products'
  | 'orders'
  | 'finance'
  | 'shipments'
  | 'settings'
  | 'tickets';

export type CustomerPortalPageProps = {
  view: CustomerPortalView;
};

export type OrdersDocumentTab = CustomerCommercialDocumentType;

export type InquiryFormValues = {
  incoterm: string;
  destinationPort?: string;
  expectedShipmentDate?: Dayjs;
  customerPhone?: string;
  contactEmail?: string;
  note?: string;
};

export type InquiryCartItem = {
  product: PortalProduct;
  quantity: number;
  targetPrice: number | null;
  unitPrice: number | string | null;
  currency: string;
  incoterm: string;
};

export const incotermOptions = [
  { value: 'EXW', label: 'EXW - Ex Works', description: 'Buyer handles pickup and export logistics.' },
  { value: 'FOB', label: 'FOB - Free On Board', description: 'Seller delivers cargo on board at origin port.' },
  { value: 'CFR', label: 'CFR - Cost and Freight', description: 'Seller includes ocean freight to destination port.' },
  { value: 'CIF', label: 'CIF - Cost, Insurance and Freight', description: 'Seller includes freight and cargo insurance.' },
  { value: 'DAP', label: 'DAP - Delivered at Place', description: 'Seller delivers to named destination place.' },
  { value: 'DDP', label: 'DDP - Delivered Duty Paid', description: 'Seller handles duties and final delivery.' },
];

export const orderStatusValues = [
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'PENDING_BUYER_SIGNATURE',
  'BUYER_SIGNED',
  'CONFIRMED',
  'SHIPPED',
  'PAID',
] as const;