export type PortalShipmentTimeline = {
  status: string;
  label: string;
  state: 'finish' | 'process' | 'wait';
  date?: string | null;
};

export type PortalShipment = {
  _id: string;
  shipmentNumber: string;
  status: string;
  bookingNumber?: string | null;
  shippingLine?: string | null;
  vesselName?: string | null;
  voyageNumber?: string | null;
  pol?: string | null;
  pod?: string | null;
  etd?: string | null;
  eta?: string | null;
  blNumber?: string | null;
  containers?: Array<{
    _id: string;
    containerNumber?: string | null;
    sealNumber?: string | null;
    type: string;
    weightKg: number;
    cbm: number;
  }>;
  salesContract?: {
    _id: string;
    contractNumber: string;
    status: string;
  } | null;
  timeline: PortalShipmentTimeline[];
};
