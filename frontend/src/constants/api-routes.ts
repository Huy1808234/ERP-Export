/**
 * Centralized API Route Constants
 * 
 * All frontend API URLs should be defined here to ensure consistency
 * between frontend and backend.
 * 
 * Usage:
 *   import { API_ROUTES } from '@/constants/api-routes';
 *   sendRequest({ url: `${API_ROUTES.APPROVALS.PENDING}` })
 */

// =============================================================================
// API Route Prefixes
// =============================================================================
export const API_PREFIX = '/api/v1';

// =============================================================================
// Core Modules
// =============================================================================
export const API_ROUTES = {
  // Auth
  AUTH: {
    PREFIX: `${API_PREFIX}/auth`,
    LOGIN: `${API_PREFIX}/auth/login`,
    LOGOUT: `${API_PREFIX}/auth/logout`,
    REFRESH: `${API_PREFIX}/auth/refresh`,
    CHANGE_PASSWORD: `${API_PREFIX}/auth/change-password`,
    FORGOT_PASSWORD: `${API_PREFIX}/auth/forgot-password`,
  },

  // Users
  USERS: {
    PREFIX: `${API_PREFIX}/users`,
    LIST: `${API_PREFIX}/users`,
    BULK_DEACTIVATE: `${API_PREFIX}/users/bulk-deactivate`,
    DETAIL: (id: string) => `${API_PREFIX}/users/${id}`,
  },

  // Roles
  ROLES: {
    PREFIX: `${API_PREFIX}/roles`,
    LIST: `${API_PREFIX}/roles`,
    PERMISSIONS_ALL: `${API_PREFIX}/roles/permissions/all`,
    PERMISSIONS_BULK: `${API_PREFIX}/roles/permissions/bulk-assignment`,
  },

  // Dashboard
  DASHBOARDS: {
    PREFIX: `${API_PREFIX}/dashboards`,
    LIST: `${API_PREFIX}/dashboards`,
    EXECUTIVE: `${API_PREFIX}/dashboards/executive`,
    KPI_DRILLDOWN: `${API_PREFIX}/dashboards/kpi-drilldown`,
    PORTAL_SUMMARY: `${API_PREFIX}/dashboards/portal/summary`,
  },

  // Products
  PRODUCTS: {
    PREFIX: `${API_PREFIX}/products`,
    LIST: `${API_PREFIX}/products`,
    PUBLIC: `${API_PREFIX}/products/public`,
    EXPORT: `${API_PREFIX}/products/export`,
    BULK_DELETE: `${API_PREFIX}/products/bulk-delete`,
    DETAIL: (id: string) => `${API_PREFIX}/products/${id}`,
    CHANGE_REQUESTS: `${API_PREFIX}/products/change-requests`,
    CHANGE_REQUEST_DETAIL: (id: string) => `${API_PREFIX}/products/change-requests/${id}`,
  },

  // Categories
  CATEGORIES: {
    PREFIX: `${API_PREFIX}/categories`,
    LIST: `${API_PREFIX}/categories`,
  },

  // Partners
  PARTNERS: {
    PREFIX: `${API_PREFIX}/partners`,
    LIST: `${API_PREFIX}/partners`,
    BULK_DELETE: `${API_PREFIX}/partners/bulk-delete`,
    EXPORT: `${API_PREFIX}/partners/export`,
    DETAIL: (id: string) => `${API_PREFIX}/partners/${id}`,
    HISTORY: (id: string) => `${API_PREFIX}/partners/${id}/history`,
  },

  // Quotations
  QUOTATIONS: {
    PREFIX: `${API_PREFIX}/quotations`,
    LIST: `${API_PREFIX}/quotations`,
    DETAIL: (id: string) => `${API_PREFIX}/quotations/${id}`,
  },

  // Proforma Invoices
  PROFORMA_INVOICES: {
    PREFIX: `${API_PREFIX}/proforma-invoices`,
    LIST: `${API_PREFIX}/proforma-invoices`,
    FROM_QUOTATION: `${API_PREFIX}/proforma-invoices/from-quotation`,
    DETAIL: (id: string) => `${API_PREFIX}/proforma-invoices/${id}`,
    STATUS: (id: string) => `${API_PREFIX}/proforma-invoices/${id}/status`,
  },

  // Purchase Orders
  PURCHASE_ORDERS: {
    PREFIX: `${API_PREFIX}/purchase-orders`,
    LIST: `${API_PREFIX}/purchase-orders`,
    FROM_PR: `${API_PREFIX}/purchase-orders/from-pr`,
    STATS: `${API_PREFIX}/purchase-orders/stats`,
    DETAIL: (id: string) => `${API_PREFIX}/purchase-orders/${id}`,
    SEND: (id: string) => `${API_PREFIX}/purchase-orders/${id}/send`,
    MATCHING_STATUS: (id: string) => `${API_PREFIX}/purchase-orders/${id}/matching-status`,
  },

  // Purchase Requests
  PURCHASE_REQUESTS: {
    PREFIX: `${API_PREFIX}/purchase-requests`,
    LIST: `${API_PREFIX}/purchase-requests`,
    DETAIL: (id: string) => `${API_PREFIX}/purchase-requests/${id}`,
    SUBMIT: (id: string) => `${API_PREFIX}/purchase-requests/${id}/submit`,
  },

  // Shipments
  SHIPMENTS: {
    PREFIX: `${API_PREFIX}/shipments`,
    LIST: `${API_PREFIX}/shipments`,
    STATS: `${API_PREFIX}/shipments/stats`,
    DETAIL: (id: string) => `${API_PREFIX}/shipments/${id}`,
    STATUS: (id: string) => `${API_PREFIX}/shipments/${id}/status`,
    TRACKING: (number: string) => `${API_PREFIX}/shipments/tracking/${number}`,
  },

  // Commercial Invoices
  COMMERCIAL_INVOICES: {
    PREFIX: `${API_PREFIX}/commercial-invoices`,
    LIST: `${API_PREFIX}/commercial-invoices`,
    FROM_SHIPMENT: (id: string) => `${API_PREFIX}/commercial-invoices/from-shipment/${id}`,
    DETAIL: (id: string) => `${API_PREFIX}/commercial-invoices/${id}`,
    ISSUE: (id: string) => `${API_PREFIX}/commercial-invoices/${id}/issue`,
    CANCEL: (id: string) => `${API_PREFIX}/commercial-invoices/${id}/cancel`,
    EXPORT_PDF: (id: string) => `${API_PREFIX}/commercial-invoices/${id}/export-pdf`,
  },

  // Sales Contracts
  SALES_CONTRACTS: {
    PREFIX: `${API_PREFIX}/sales-contracts`,
    LIST: `${API_PREFIX}/sales-contracts`,
    DETAIL: (id: string) => `${API_PREFIX}/sales-contracts/${id}`,
    SIGNATURES: (id: string) => `${API_PREFIX}/sales-contracts/${id}/signatures`,
    SIGNATURE_INVITATIONS_RESEND: (id: string) => `${API_PREFIX}/sales-contracts/${id}/signature-invitations/resend`,
    SIGNATURE_INVITATION_REVOKE: (id: string, invitationId: string) => 
      `${API_PREFIX}/sales-contracts/${id}/signature-invitations/${invitationId}/revoke`,
    SIGNING: (token: string) => `${API_PREFIX}/sales-contracts/signing/${token}`,
    SIGNING_OTP: (token: string) => `${API_PREFIX}/sales-contracts/signing/${token}/otp`,
    SIGNING_REQUEST_OTP: (token: string) => `${API_PREFIX}/sales-contracts/signing/${token}/request-otp`,
    SIGNING_RESEND_OTP: (token: string) => `${API_PREFIX}/sales-contracts/signing/${token}/resend-otp`,
    SIGNING_SIGN: (token: string) => `${API_PREFIX}/sales-contracts/signing/${token}/sign`,
  },

  // Export Documents
  EXPORT_DOCUMENTS: {
    PREFIX: `${API_PREFIX}/export-documents`,
    LIST: `${API_PREFIX}/export-documents`,
    PORTAL: `${API_PREFIX}/export-documents/portal`,
    PORTAL_DOWNLOAD: (id: string) => `${API_PREFIX}/export-documents/portal/${id}/download`,
    SHIPMENT: (id: string) => `${API_PREFIX}/export-documents/shipment/${id}`,
    SHIPMENT_GENERATE: (id: string, type: string) => `${API_PREFIX}/export-documents/shipment/${id}/generate/${type}`,
    DOWNLOAD: (id: string, type: string) => `${API_PREFIX}/export-documents/download/${id}/${type}`,
    DETAIL: (id: string) => `${API_PREFIX}/export-documents/${id}`,
    REVIEW: (id: string) => `${API_PREFIX}/export-documents/${id}/review`,
    ACTION: (id: string, action: string) => `${API_PREFIX}/export-documents/${id}/${action}`,
  },

  // Inventory
  INVENTORY: {
    PREFIX: `${API_PREFIX}/inventory`,
    LIST: `${API_PREFIX}/inventory`,
    LEDGER: `${API_PREFIX}/inventory/ledger`,
    AUDIT_TRAIL: `${API_PREFIX}/inventory/audit-trail`,
    ADJUSTMENT: `${API_PREFIX}/inventory/adjustment`,
    COUNTS: `${API_PREFIX}/inventory/counts`,
    COUNT_DETAIL: (id: string) => `${API_PREFIX}/inventory/counts/${id}`,
    COUNT_ITEMS: (id: string) => `${API_PREFIX}/inventory/counts/${id}/items`,
    VALUATION: `${API_PREFIX}/inventory/valuation`,
    EXPORT_DELIVERIES: `${API_PREFIX}/inventory/export-deliveries`,
    EXPORT_DELIVERY_FROM_SHIPMENT: (id: string) => `${API_PREFIX}/inventory/export-deliveries/from-shipment/${id}`,
    EXPORT_DELIVERY_DETAIL: (id: string) => `${API_PREFIX}/inventory/export-deliveries/${id}`,
    EXPORT_DELIVERY_ISSUE: (id: string) => `${API_PREFIX}/inventory/export-deliveries/${id}/issue`,
    EXPORT_DELIVERY_CANCEL: (id: string) => `${API_PREFIX}/inventory/export-deliveries/${id}/cancel`,
    CUSTOMER_RETURNS: `${API_PREFIX}/inventory/customer-returns`,
    CUSTOMER_RETURN_ACTION: (id: string, action: string) => `${API_PREFIX}/inventory/customer-returns/${id}/${action}`,
    LOT_MOVEMENTS: `${API_PREFIX}/inventory/lot-movements`,
  },

  // Quality Control
  QUALITY_CONTROL: {
    PREFIX: `${API_PREFIX}/quality-control`,
    CREATE: `${API_PREFIX}/quality-control`,
    EXCEPTIONS: `${API_PREFIX}/quality-control/exceptions`,
    EXCEPTION_CANDIDATES: `${API_PREFIX}/quality-control/exceptions/candidates`,
    EXCEPTION_DASHBOARD: `${API_PREFIX}/quality-control/exceptions/dashboard`,
    SEND_CLAIM: (id: string) => `${API_PREFIX}/quality-control/${id}/send-claim`,
    RESOLVE_EXCEPTION: (id: string) => `${API_PREFIX}/quality-control/${id}/resolve-exception`,
  },

  // Vendor Invoices
  VENDOR_INVOICES: {
    PREFIX: `${API_PREFIX}/vendor-invoices`,
    LIST: `${API_PREFIX}/vendor-invoices`,
    DETAIL: (id: string) => `${API_PREFIX}/vendor-invoices/${id}`,
    MATCHING_STATUS: (id: string) => `${API_PREFIX}/vendor-invoices/matching-status/${id}`,
  },

  // Files
  FILES: {
    PREFIX: `${API_PREFIX}/files`,
    UPLOAD: `${API_PREFIX}/files/upload`,
  },

  // Ports
  PORTS: {
    PREFIX: `${API_PREFIX}/ports`,
    LIST: `${API_PREFIX}/ports`,
    DETAIL: (id: string) => `${API_PREFIX}/ports/${id}`,
  },

  // Countries
  COUNTRIES: {
    PREFIX: `${API_PREFIX}/countries`,
    LIST: `${API_PREFIX}/countries`,
    DETAIL: (id: string) => `${API_PREFIX}/countries/${id}`,
  },

  // Currencies
  CURRENCIES: {
    PREFIX: `${API_PREFIX}/currencies`,
    LIST: `${API_PREFIX}/currencies`,
    RATES: (id: string) => `${API_PREFIX}/currencies/${id}/rates`,
    RATES_LIST: `${API_PREFIX}/currencies/rates`,
    SYNC_VCB: `${API_PREFIX}/currencies/sync-vcb`,
    CROSS_RATE: `${API_PREFIX}/currencies/cross-rate`,
  },

  // Settings
  SETTINGS: {
    PREFIX: `${API_PREFIX}/settings`,
    LIST: `${API_PREFIX}/settings`,
    DETAIL: (key: string) => `${API_PREFIX}/settings/${key}`,
  },

  // =============================================================================
  // CRITICAL: Approval System - Consolidated
  // 
  // There are TWO controllers serving similar purposes:
  // 1. ApprovalsController (@Controller('approvals')) - Legacy
  // 2. ApprovalMatrixController (@Controller('approval-matrix')) - New workflow
  // 
  // The frontend should use APPROVAL_MATRIX routes (new system)
  // =============================================================================
  APPROVALS: {
    PREFIX: `${API_PREFIX}/approvals`,
    PENDING: `${API_PREFIX}/approvals/pending`,
    APPROVE: (id: string) => `${API_PREFIX}/approvals/${id}/approve`,
    REJECT: (id: string) => `${API_PREFIX}/approvals/${id}/reject`,
  },

  APPROVAL_MATRIX: {
    PREFIX: `${API_PREFIX}/approval-matrix`,
    // Rules
    RULES: `${API_PREFIX}/approval-matrix/rules`,
    RULE_DETAIL: (id: string) => `${API_PREFIX}/approval-matrix/rules/${id}`,
    POLICY: `${API_PREFIX}/approval-matrix/policy`,
    // Requests
    REQUESTS: `${API_PREFIX}/approval-matrix/requests`,
    REQUEST_DETAIL: (id: string) => `${API_PREFIX}/approval-matrix/requests/${id}`,
    PENDING: `${API_PREFIX}/approval-matrix/requests/pending`,
    REQUEST_APPROVE: (id: string) => `${API_PREFIX}/approval-matrix/requests/${id}/approve`,
    REQUEST_REJECT: (id: string) => `${API_PREFIX}/approval-matrix/requests/${id}/reject`,
    REQUEST_CANCEL: (id: string) => `${API_PREFIX}/approval-matrix/requests/${id}/cancel`,
  },

  // Notifications
  NOTIFICATIONS: {
    PREFIX: `${API_PREFIX}/notifications`,
    LIST: `${API_PREFIX}/notifications`,
    UNREAD_COUNT: `${API_PREFIX}/notifications/unread-count`,
    READ_ALL: `${API_PREFIX}/notifications/read-all`,
    READ: (id: string) => `${API_PREFIX}/notifications/${id}/read`,
  },

  // Trade Finance
  TRADE_FINANCE: {
    PREFIX: `${API_PREFIX}/trade-finance`,
    TRANSACTIONS: `${API_PREFIX}/trade-finance/transactions`,
    TRANSACTION_DETAIL: (id: string) => `${API_PREFIX}/trade-finance/transactions/${id}`,
    TRANSACTION_STATUS: (id: string) => `${API_PREFIX}/trade-finance/transactions/${id}/status`,
    RECONCILIATION: (contractId: string) => `${API_PREFIX}/trade-finance/transactions/reconciliation/sales-contract/${contractId}`,
    LC: `${API_PREFIX}/trade-finance/lc`,
    LC_DETAIL: (id: string) => `${API_PREFIX}/trade-finance/lc/${id}`,
    LC_STATUS: (id: string) => `${API_PREFIX}/trade-finance/lc/${id}/status`,
    LC_DISCREPANCIES: (id: string) => `${API_PREFIX}/trade-finance/lc/${id}/discrepancies`,
    LC_DISCREPANCY_RESOLVE: (id: string, discrepancyId: string) => 
      `${API_PREFIX}/trade-finance/lc/${id}/discrepancies/${discrepancyId}/resolve`,
    LC_DEADLINE_DASHBOARD: `${API_PREFIX}/trade-finance/lc/deadline-dashboard`,
    LC_DEADLINE_NOTIFY: `${API_PREFIX}/trade-finance/lc/deadline-dashboard/notify`,
    COLLECTIONS: `${API_PREFIX}/trade-finance/collections`,
    COLLECTION_DETAIL: (id: string) => `${API_PREFIX}/trade-finance/collections/${id}`,
    COLLECTION_STATUS: (id: string) => `${API_PREFIX}/trade-finance/collections/${id}/status`,
  },

  // Search
  SEARCH: {
    PREFIX: `${API_PREFIX}/search`,
    GLOBAL: `${API_PREFIX}/search/global`,
  },

  // Accounting
  ACCOUNTING: {
    PREFIX: `${API_PREFIX}/accounting`,
    REPORT_SUMMARY: `${API_PREFIX}/accounting/report/summary`,
    JOURNAL: `${API_PREFIX}/accounting/journal`,
    CLOSE_PERIOD: `${API_PREFIX}/accounting/close-period`,
    PERIODS: `${API_PREFIX}/accounting/periods`,
    PERIOD_DETAIL: (id: string) => `${API_PREFIX}/accounting/periods/${id}`,
    PERIOD_CLOSE_POLICY: (id: string) => `${API_PREFIX}/accounting/periods/${id}/close-policy`,
    PERIOD_CLOSE: (id: string) => `${API_PREFIX}/accounting/periods/${id}/close`,
    PERIOD_LOCK: (id: string) => `${API_PREFIX}/accounting/periods/${id}/lock`,
    PERIOD_REOPEN: (id: string) => `${API_PREFIX}/accounting/periods/${id}/reopen`,
    PERIOD_OPEN: `${API_PREFIX}/accounting/periods/open`,
    FX_REVALUATIONS: `${API_PREFIX}/accounting/fx-revaluations`,
    FX_REVALUATIONS_RUN: `${API_PREFIX}/accounting/fx-revaluations/run`,
    VAT_REFUNDS: `${API_PREFIX}/accounting/vat-refunds`,
    VAT_REFUND_DETAIL: (id: string) => `${API_PREFIX}/accounting/vat-refunds/${id}`,
    VAT_REFUND_SUBMIT: (id: string) => `${API_PREFIX}/accounting/vat-refunds/${id}/submit`,
    VAT_REFUND_APPROVE: (id: string) => `${API_PREFIX}/accounting/vat-refunds/${id}/approve`,
    VAT_REFUND_REJECT: (id: string) => `${API_PREFIX}/accounting/vat-refunds/${id}/reject`,
    VAT_REFUND_PAY: (id: string) => `${API_PREFIX}/accounting/vat-refunds/${id}/pay`,
    REPORT_TAX: `${API_PREFIX}/accounting/report/tax`,
    REPORT_TAX_EXPORT: `${API_PREFIX}/accounting/report/tax/export`,
    REPORT_AGING: `${API_PREFIX}/accounting/report/aging`,
    REPORT_AR_AGING: `${API_PREFIX}/accounting/report/ar-aging`,
    REPORT_BALANCE_SHEET: `${API_PREFIX}/accounting/report/balance-sheet`,
    REPORT_TREND: `${API_PREFIX}/accounting/report/trend`,
    REPORT_CASH_FLOW: `${API_PREFIX}/accounting/report/cash-flow`,
    REPORT_RATIOS: `${API_PREFIX}/accounting/report/ratios`,
    AUDIT_EVENTS: `${API_PREFIX}/accounting/audit-events`,
    TAX_REPORT_RUNS: `${API_PREFIX}/accounting/tax-report-runs`,
    CLOSE_PACKETS: `${API_PREFIX}/accounting/close-packets`,
  },

  // Pricing Policies
  PRICING_POLICIES: {
    PREFIX: `${API_PREFIX}/pricing-policies`,
    LIST: `${API_PREFIX}/pricing-policies`,
    HISTORY: `${API_PREFIX}/pricing-policies/history`,
    DETAIL: (id: string) => `${API_PREFIX}/pricing-policies/${id}`,
    SUBMIT_APPROVAL: (id: string) => `${API_PREFIX}/pricing-policies/${id}/submit-approval`,
    APPROVE: (id: string) => `${API_PREFIX}/pricing-policies/${id}/approve`,
    RESOLVE: `${API_PREFIX}/pricing-policies/resolve`,
  },

  // Guest (public endpoints)
  GUEST: {
    PREFIX: `${API_PREFIX}/guest`,
    SUMMARY: `${API_PREFIX}/guest/summary`,
  },

  // =============================================================================
  // Portal System - Customer-Facing
  // 
  // There are TWO controllers serving portal purposes:
  // 1. PortalController (@Controller('portal')) - Mixed admin/customer
  // 2. CustomerController (@Controller('customer')) - Customer-specific
  // 
  // For customer portal, prefer CUSTOMER routes for consistency
  // =============================================================================
  PORTAL: {
    PREFIX: `${API_PREFIX}/portal`,
    PROFILE: `${API_PREFIX}/portal/profile`,
    ORDERS: `${API_PREFIX}/portal/orders`,
    SHIPMENTS: `${API_PREFIX}/portal/shipments`,
    PRODUCTS: `${API_PREFIX}/portal/products`,
    PRICING: `${API_PREFIX}/portal/pricing`,
    INQUIRIES: `${API_PREFIX}/portal/inquiries`,
    FINANCE_STATEMENT: `${API_PREFIX}/portal/finance/statement`,
    FINANCE_STATEMENT_DOWNLOAD: `${API_PREFIX}/portal/finance/statement/download`,
    FINANCE_TT_RECEIPTS: `${API_PREFIX}/portal/finance/tt-receipts`,
    FINANCE_TT_RECEIPT_REVIEW: (id: string) => `${API_PREFIX}/portal/finance/tt-receipts/${id}/review`,
    SUPPORT_TICKETS: `${API_PREFIX}/portal/support/tickets`,
    SUPPORT_TICKET_DETAIL: (id: string) => `${API_PREFIX}/portal/support/tickets/${id}`,
    SUPPORT_TICKET_MESSAGES: (id: string) => `${API_PREFIX}/portal/support/tickets/${id}/messages`,
    SUPPORT_TICKET_STATUS: (id: string) => `${API_PREFIX}/portal/support/tickets/${id}/status`,
    NOTIFICATIONS: `${API_PREFIX}/portal/notifications`,
    NOTIFICATION_READ: (id: string) => `${API_PREFIX}/portal/notifications/${id}/read`,
    NOTIFICATIONS_READ_ALL: `${API_PREFIX}/portal/notifications/read-all`,
    QUOTATION_DETAIL: (id: string) => `${API_PREFIX}/portal/quotations/${id}`,
    QUOTATION_PDF: (id: string) => `${API_PREFIX}/portal/quotations/${id}/pdf`,
  },

  // Customer-specific endpoints (preferred for customer portal)
  CUSTOMER: {
    PREFIX: `${API_PREFIX}/customer`,
    ORDERS_SUMMARY: `${API_PREFIX}/customer/orders/summary`,
    COMMERCIAL_DOCUMENTS: `${API_PREFIX}/customer/commercial-documents`,
    COMMERCIAL_DOCUMENT_DETAIL: (id: string) => `${API_PREFIX}/customer/commercial-documents/${id}`,
    QUOTATION_DETAIL: (id: string) => `${API_PREFIX}/customer/quotations/${id}`,
    QUOTATION_ACCEPT: (id: string) => `${API_PREFIX}/customer/quotations/${id}/accept`,
    QUOTATION_REJECT: (id: string) => `${API_PREFIX}/customer/quotations/${id}/reject`,
    QUOTATION_REQUEST_REVISION: (id: string) => `${API_PREFIX}/customer/quotations/${id}/request-revision`,
    QUOTATION_PDF: (id: string) => `${API_PREFIX}/customer/quotations/${id}/pdf`,
    PROFORMA_INVOICE_ACCEPT: (id: string) => `${API_PREFIX}/customer/proforma-invoices/${id}/accept`,
    PROFORMA_INVOICE_REJECT: (id: string) => `${API_PREFIX}/customer/proforma-invoices/${id}/reject`,
    ORDER_TIMELINE: (id: string) => `${API_PREFIX}/customer/orders/${id}/timeline`,
    CONTRACT_SIGNING_INVITATION: (id: string) => `${API_PREFIX}/customer/contracts/${id}/signing-invitation`,
  },

  // Inquiries
  INQUIRIES: {
    PREFIX: `${API_PREFIX}/inquiries`,
    LIST: `${API_PREFIX}/inquiries`,
    BULK_DELETE: `${API_PREFIX}/inquiries/bulk-delete`,
    DETAIL: (id: string) => `${API_PREFIX}/inquiries/${id}`,
    STATUS: (id: string) => `${API_PREFIX}/inquiries/${id}/status`,
  },

  // SePay
  SEPAY: {
    PREFIX: `${API_PREFIX}/sepay`,
    WEBHOOK: `${API_PREFIX}/sepay/webhook`,
    TRANSACTIONS: `${API_PREFIX}/sepay/transactions`,
  },
} as const;

// Type-safe URL builder helper
export type ApiRouteParams = Record<string, string | number>;

export function buildUrl(base: string, params?: ApiRouteParams): string {
  if (!params) return base;
  
  let url = base;
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`{${key}}`, String(value));
  });
  return url;
}
