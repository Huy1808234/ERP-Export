import type { QuotationStatus, ShipmentStatus } from '@/types/o2c';

export const QUOTATION_STATUS_CONFIG: Record<QuotationStatus, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: 'Nháp' },
  SENT: { color: 'blue', label: 'Đã gửi' },
  ACCEPTED: { color: 'success', label: 'Được chấp nhận' },
  REJECTED: { color: 'error', label: 'Bị từ chối' },
  EXPIRED: { color: 'warning', label: 'Hết hạn' },
  CONVERTED: { color: 'purple', label: 'Đã tạo PI' },
};

export const SHIPMENT_STATUS_CONFIG: Record<ShipmentStatus, { color: string }> = {
  BOOKED: { color: 'blue' },
  LOADING: { color: 'orange' },
  CUSTOMS_CLEARED: { color: 'cyan' },
  ON_BOARD: { color: 'geekblue' },
  ARRIVED: { color: 'green' },
  CLOSED: { color: 'purple' },
};

export const SHIPMENT_STATUS_KEYS = Object.keys(SHIPMENT_STATUS_CONFIG) as ShipmentStatus[];

export const INCOTERMS_KEYS = ['EXW', 'FOB', 'CIF', 'CFR', 'DAP', 'DDP'] as const;
export type IncotermKey = typeof INCOTERMS_KEYS[number];

export const PAYMENT_TERM_KEYS = [
  'TT_30_70_BL',
  'TT_100_ADVANCE',
  'LC_AT_SIGHT',
  'TT_30_70_SHIPMENT',
  'CAD',
  'DP_AT_SIGHT',
  'TT'
] as const;
export type PaymentTermKey = typeof PAYMENT_TERM_KEYS[number];
