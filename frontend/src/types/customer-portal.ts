export type PortalRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type PortalCurrency = {
  _id: string;
  code: string;
  name: string;
  symbol?: string | null;
  isBase?: boolean;
  isActive?: boolean;
  exchangeRates?: Array<{
    _id?: string;
    rate: number | string;
    rateType?: 'BUY' | 'SELL' | 'TRANSFER' | string;
    effectiveDate?: string | null;
    isActive?: boolean;
  }>;
};

export type PortalProfile = {
  user: {
    username: string;
    partnerId: string;
    roleName?: string | null;
  };
  partner: {
    _id: string;
    name: string;
    country?: string | null;
    region?: string | null;
    defaultCurrency?: string | null;
    creditLimit?: number | null;
    riskLevel?: PortalRiskLevel | null;
    email?: string | null;
    phone?: string | null;
    contactName?: string | null;
  };
  contact: {
    email: string;
    phone?: string | null;
    contactName: string;
  };
  finance: {
    openBalanceForeign: number;
    openInvoiceCount: number;
    defaultCurrency: string;
    creditLimit: number;
    riskLevel?: PortalRiskLevel | null;
  };
};

export type PortalOrderSummary = {
  quotationCount: number;
  contractCount: number;
  proformaInvoiceCount: number;
  orderCount?: number;
  pendingSignatureCount: number;
  shippedCount: number;
  completedCount?: number;
};

export type PortalQuotation = {
  _id: string;
  quotationNumber?: string | null;
  status?: string | null;
  totalAmount?: number | string | null;
  currency?: string | null;
  createdAt?: string | null;
  expiryDate?: string | null;
  rejectionReason?: string | null;
  items?: Array<{
    _id: string;
    product?: PortalProduct | null;
    productId?: string | null;
    productSnapshotName?: string | null;
    quantity: number;
    unit?: string | null;
    unitPrice: number;
    totalAmount?: number;
    totalPrice: number;
    currency: string;
  }>;
};

export type PortalContract = {
  _id: string;
  contractNumber?: string | null;
  status?: string | null;
  signatureStatus?: string | null;
  totalAmount?: number | string | null;
  currency?: string | null;
  createdAt?: string | null;
};

export type PortalProformaInvoice = {
  _id: string;
  piNumber?: string | null;
  status?: string | null;
  totalAmount?: number | string | null;
  currency?: string | null;
  createdAt?: string | null;
};

export type PortalOrders = {
  summary: PortalOrderSummary;
  quotations: PortalQuotation[];
  contracts: PortalContract[];
  proformaInvoices: PortalProformaInvoice[];
};

export type CustomerCommercialDocumentType =
  | 'ALL'
  | 'QUOTATION'
  | 'SALES_CONTRACT'
  | 'PROFORMA_INVOICE'
  | 'COMMERCIAL_INVOICE'
  | 'ORDER';

export type CustomerCommercialDocumentSortField =
  | 'documentDate'
  | 'documentNumber'
  | 'status'
  | 'totalAmount';

export type CustomerCommercialDocumentQuery = {
  search?: string;
  status?: string;
  type?: CustomerCommercialDocumentType;
  sortBy?: CustomerCommercialDocumentSortField;
  sortOrder?: 'ASC' | 'DESC';
  current?: number;
  pageSize?: number;
};

export type CustomerDocumentActionState = {
  canAccept: boolean;
  canReject: boolean;
  canRequestRevision: boolean;
  disabledReason: string | null;
};

export type CustomerDocumentLineItem = {
  _id: string;
  product_id: string | null;
  productName: string;
  sku: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  totalAmount: number;
};

export type CustomerTimelineItem = {
  key: string;
  label: string;
  status: 'finish' | 'process' | 'wait' | 'error';
  date: string | null;
  description: string | null;
};

export type CustomerAuditLogItem = {
  _id: string;
  action: string;
  username: string | null;
  createdAt: string;
  oldValues: unknown;
  newValues: unknown;
};

export type CustomerCommercialDocument = {
  _id: string;
  documentType: Exclude<CustomerCommercialDocumentType, 'ALL'>;
  documentNumber: string;
  lifecycleStage: string;
  status: string;
  documentDate: string | null;
  expiryDate: string | null;
  incoterm: string | null;
  currency: string;
  totalAmount: number;
  totalAmountVnd?: number | null;
  paymentTerms: string | null;
  shipmentStatus: string | null;
  isExpired: boolean;
  actions: CustomerDocumentActionState;
  lineItems: CustomerDocumentLineItem[];
  attachments: Array<{
    _id: string;
    fileName: string;
    url: string | null;
  }>;
  timeline: CustomerTimelineItem[];
  auditLogs: CustomerAuditLogItem[];
  createdAt: string | null;
  updatedAt: string | null;
  // Extended fields for detailed view
  buyerName?: string | null;
  buyerCountry?: string | null;
  deliveryDate?: string | null;
  notes?: string | null;
  signatureStatus?: string | null;
  signingUrl?: string | null;
};

export type CustomerCommercialDocumentList = {
  results: CustomerCommercialDocument[];
  meta: {
    current: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  summary: PortalOrderSummary;
};

export type PortalStatementLine = {
  _id: string;
  invoiceNumber: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  amountForeign: number;
  paidAmountForeign: number;
  openAmountForeign: number;
  currency: string;
  exchangeRate?: number;
  amountVnd?: number;
  paidAmountVnd?: number;
  openAmountVnd?: number;
  status: string;
  // Phase 1: Aging & Cross-linking
  agingBucket: 'CURRENT' | 'DUE_1_30' | 'DUE_31_60' | 'DUE_61_90' | 'OVERDUE_90';
  daysOverdue: number;
  shipmentNumber?: string | null;
  shipmentId?: string | null;
  contractNumber?: string | null;
  contractId?: string | null;
  pdfUrl?: string | null;
};

export type PortalPaymentReceipt = {
  _id: string;
  receiptNumber?: string | null;
  receiptType?: string | null;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  exchangeRate?: number | null;
  accountReceivableId?: string | null;
  bankReference?: string | null;
  submittedAt?: string | null;
  accountReceivable?: {
    _id: string;
    invoiceNumber?: string | null;
    currency?: string | null;
  } | null;
  rejectionReason?: string | null;
};

export type PortalStatement = {
  buyerId: string;
  generatedAt: string;
  summary: {
    totalForeign: number;
    paidForeign: number;
    openForeign: number;
    totalVnd: number;
    paidVnd: number;
    openVnd: number;
    openInvoiceCount: number;
    pendingReceiptCount: number;
    // Phase 1: Aging buckets
    agingCurrent: number;
    agingDue1to30: number;
    agingDue31to60: number;
    agingDue61to90: number;
    agingOverdue90: number;
  };
  lines: PortalStatementLine[];
  receipts: PortalPaymentReceipt[];
};

export type PortalShipmentTimelineItem = {
  status: string;
  label: string;
  state: 'finish' | 'process' | 'wait' | 'error';
  date?: string | null;
};

export type PortalShipment = {
  _id: string;
  shipmentNumber?: string | null;
  blNumber?: string | null;
  blFileUrl?: string | null;
  packingListFileUrl?: string | null;
  status?: string | null;
  bookingNumber?: string | null;
  shippingLine?: string | null;
  vesselName?: string | null;
  voyageNumber?: string | null;
  etd?: string | null;
  eta?: string | null;
  pol?: string | null;
  pod?: string | null;
  carrier?: string | null;
  containers?: Array<{
    _id: string;
    containerNumber?: string | null;
    sealNumber?: string | null;
    type?: string | null;
    weightKg?: number | null;
    cbm?: number | null;
  }>;
  timeline?: PortalShipmentTimelineItem[];
  salesContract?: {
    _id: string;
    contractNumber?: string | null;
  } | null;
};

export type PortalShipmentList = {
  results: PortalShipment[];
  meta: {
    current: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  summary?: {
    total: number;
    statusCounts: Record<string, number>;
  };
};

export type PortalNotification = {
  _id: string;
  title: string;
  description: string;
  severity?: string | null;
  readAt?: string | null;
  createdAt?: string | null;
};

export type PortalNotificationList = {
  results: PortalNotification[];
  meta: {
    current: number;
    pageSize: number;
    total: number;
    unread: number;
  };
};

export type PortalProduct = {
  _id: string;
  sku: string;
  vietnameseName: string;
  englishName?: string | null;
  hsCode?: string | null;
  category?: string | null;
  brand?: string | null;
  originCountry?: string | null;
  unitOfMeasure?: string | null;
  packingType?: string | null;
  piecesPerCarton?: number | null;
  currentStock?: number | string | null;
  defaultExportPrice?: number | string | null;
  exportCurrency?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  isBestseller?: boolean;
  isNew?: boolean;
};

export type PortalProductPricing = {
  product: PortalProduct;
  unitPrice: number | string | null;
  currency: string;
  incoterm: string;
  source: string;
  pricingPolicy_id: string | null;
  quantity: number;
};

export type PortalProductCatalog = {
  buyer: {
    _id: string;
    name: string;
    country?: string | null;
    region?: string | null;
    defaultCurrency?: string | null;
  };
  filters: {
    incoterm: string;
    currency: string;
    quantity: number;
    search: string;
    category: string;
  };
  categories: string[];
  results: PortalProductPricing[];
};

export type CreatePortalInquiryPayload = {
  product_id?: string;
  quantity?: number;
  lineItems?: Array<{
    product_id: string;
    quantity: number;
    targetPrice?: number | null;
    note?: string | null;
  }>;
  incoterm?: string;
  destinationPort?: string | null;
  expectedShipmentDate?: string | null;
  targetPriceCurrency?: string | null;
  note?: string | null;
  customerPhone?: string | null;
  contactEmail?: string | null;
  idempotencyKey?: string | null;
};

export type PortalInquiryLineItem = {
  product_id: string;
  productSnapshotName?: string | null;
  productSnapshotCode?: string | null;
  unitOfMeasure?: string | null;
  quantity: number;
  targetPrice?: number | null;
  note?: string | null;
};

export type PortalInquiry = {
  _id: string;
  inquiryNumber?: string | null;
  buyer_id?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  productId: string;
  productSnapshotName?: string | null;
  productSnapshotCode?: string | null;
  lineItems?: PortalInquiryLineItem[];
  quantity: number | string;
  incoterm?: string | null;
  destinationPort?: string | null;
  expectedShipmentDate?: string | null;
  targetPriceCurrency?: string | null;
  note?: string | null;
  status: 'SUBMITTED' | 'IN_REVIEW' | 'QUOTED' | 'CLOSED' | 'PENDING' | 'PROCESSED' | 'REJECTED';
  isRead: boolean;
  createdAt?: string | null;
  product?: PortalProduct | null;
};

export type CustomerPortalOverview = {
  profile: PortalProfile;
  orders: PortalOrders;
  shipments: PortalShipment[];
  statement: PortalStatement;
  notifications: PortalNotificationList;
};
