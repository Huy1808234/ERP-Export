import { Injectable } from '@nestjs/common';
import { ApprovalDocumentType } from './entities/approval-rule.entity';

export type ApprovalPolicyEnforcement =
  | 'MATRIX_REQUIRED'
  | 'DIRECT_ALLOWED'
  | 'LEGACY_DIRECT_REVIEW';

export type ApprovalPolicyRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ApprovalPolicyAction = {
  key: string;
  module: string;
  action: string;
  route: string;
  documentType: ApprovalDocumentType | null;
  enforcement: ApprovalPolicyEnforcement;
  riskLevel: ApprovalPolicyRiskLevel;
  note: string;
};

@Injectable()
export class ApprovalPolicyService {
  private readonly actions: ApprovalPolicyAction[] = [
    {
      key: 'purchase-request.approve',
      module: 'P2P',
      action: 'Approve purchase request',
      route: 'POST /purchase-requests/:_id/approve',
      documentType: ApprovalDocumentType.PURCHASE_REQUEST,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'HIGH',
      note: 'Legacy direct endpoint exists; new PR submissions should use approval workflow.',
    },
    {
      key: 'purchase-order.approve',
      module: 'P2P',
      action: 'Approve/send purchase order',
      route: 'POST /purchase-orders/:_id/send',
      documentType: ApprovalDocumentType.PURCHASE_ORDER,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'HIGH',
      note: 'PO value commitment must be approved by matrix before supplier send.',
    },
    {
      key: 'quotation.approve',
      module: 'O2C',
      action: 'Approve quotation',
      route: 'PATCH /quotations/:_id/status',
      documentType: ApprovalDocumentType.QUOTATION,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'HIGH',
      note: 'Commercial offer approval must be workflow-backed.',
    },
    {
      key: 'proforma-invoice.approve',
      module: 'O2C',
      action: 'Approve proforma invoice',
      route: 'PATCH /proforma-invoices/:_id/status',
      documentType: ApprovalDocumentType.PROFORMA_INVOICE,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'HIGH',
      note: 'PI approval controls external buyer commitment.',
    },
    {
      key: 'sales-contract.approve',
      module: 'O2C',
      action: 'Approve sales contract',
      route: 'PATCH /sales-contracts/:_id/submit-approval',
      documentType: ApprovalDocumentType.SALES_CONTRACT,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'CRITICAL',
      note: 'Contract approval may reserve stock and create downstream shipment obligations.',
    },
    {
      key: 'sales-contract.cancel',
      module: 'O2C',
      action: 'Cancel sales contract',
      route: 'PATCH /sales-contracts/:_id/cancel',
      documentType: ApprovalDocumentType.SALES_CONTRACT_CANCEL,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'CRITICAL',
      note: 'Cancellation must retain reason and approval trail.',
    },
    {
      key: 'ap.payment-batch',
      module: 'AP',
      action: 'Submit AP payment batch',
      route: 'PATCH /account-payables/payment-batches/:_id/submit',
      documentType: ApprovalDocumentType.AP_PAYMENT_BATCH,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'CRITICAL',
      note: 'Cash-out batch requires configured approval levels.',
    },
    {
      key: 'ap.payment-reversal',
      module: 'AP',
      action: 'Reverse AP settlement/payment',
      route: 'PATCH /account-payables/settlement-audits/:_id/reverse',
      documentType: ApprovalDocumentType.AP_PAYMENT_REVERSAL,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'CRITICAL',
      note: 'Payment reversal impacts AP, ledger, and settlement audit.',
    },
    {
      key: 'inventory.adjustment',
      module: 'Inventory',
      action: 'Inventory adjustment',
      route: 'POST /inventory/adjustment',
      documentType: ApprovalDocumentType.INVENTORY_ADJUSTMENT,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'CRITICAL',
      note: 'Stock and valuation adjustments must not post without approval.',
    },
    {
      key: 'inventory.count',
      module: 'Inventory',
      action: 'Approve inventory count variance',
      route: 'PATCH /inventory/counts/:_id/approve',
      documentType: ApprovalDocumentType.INVENTORY_COUNT,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'HIGH',
      note: 'Count variance can affect stock valuation.',
    },
    {
      key: 'product.change',
      module: 'Master Data',
      action: 'Approve sensitive product data change',
      route: 'POST /products/:_id/change-requests',
      documentType: ApprovalDocumentType.PRODUCT_CHANGE_REQUEST,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'HIGH',
      note: 'Cost, price, HS code, and logistics data changes require approval.',
    },
    {
      key: 'tax.vat-refund',
      module: 'Accounting',
      action: 'Approve VAT refund dossier',
      route: 'PATCH /accounting/vat-refunds/:_id/submit',
      documentType: ApprovalDocumentType.VAT_REFUND,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'CRITICAL',
      note: 'VAT refund must link frozen tax report trace and approval workflow.',
    },
    {
      key: 'accounting.period-reopen',
      module: 'Accounting',
      action: 'Reopen accounting period',
      route: 'PATCH /accounting/periods/:_id/reopen',
      documentType: ApprovalDocumentType.ACCOUNTING_PERIOD_REOPEN,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'CRITICAL',
      note: 'Period reopen creates reversal trail and cannot be direct.',
    },
    {
      key: 'accounting.period-lock',
      module: 'Accounting',
      action: 'Lock accounting period',
      route: 'PATCH /accounting/periods/:_id/lock',
      documentType: ApprovalDocumentType.ACCOUNTING_PERIOD_LOCK,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'CRITICAL',
      note: 'Permanent lock requires close packet and valid audit hash chain.',
    },
    {
      key: 'export-document.review',
      module: 'Export Documents',
      action: 'Review/approve statutory export document',
      route: 'PATCH /export-documents/:_id/review',
      documentType: ApprovalDocumentType.EXPORT_DOCUMENT_REVIEW,
      enforcement: 'MATRIX_REQUIRED',
      riskLevel: 'HIGH',
      note: 'Official document review should be approval-backed.',
    },
    {
      key: 'shipment.status',
      module: 'Logistics',
      action: 'Update shipment milestone/status',
      route: 'PATCH /shipments/:_id/status',
      documentType: null,
      enforcement: 'DIRECT_ALLOWED',
      riskLevel: 'MEDIUM',
      note: 'Operational milestone update is direct but must remain audit logged.',
    },
    {
      key: 'export-delivery.issue',
      module: 'Inventory',
      action: 'Issue stock from export delivery',
      route: 'PATCH /inventory/export-deliveries/:_id/issue',
      documentType: null,
      enforcement: 'LEGACY_DIRECT_REVIEW',
      riskLevel: 'CRITICAL',
      note: 'Current direct issue path should be reviewed against stock/period guards.',
    },
  ];

  findAll() {
    return this.actions;
  }

  findMatrixRequired() {
    return this.actions.filter((action) => action.enforcement === 'MATRIX_REQUIRED');
  }

  findLegacyDirectReview() {
    return this.actions.filter((action) => action.enforcement === 'LEGACY_DIRECT_REVIEW');
  }
}
