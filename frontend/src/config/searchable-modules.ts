import { canAccessDashboardPath } from '@/lib/access-control';

export type SearchableModuleAlias =
  | string
  | {
    value: string;
    targetHref?: string;
    subtitle?: string;
  };

export type SearchableModuleDefinition = {
  _id: string;
  titleKey: string;
  titleFallback: string;
  subtitle: string;
  targetHref: string;
  aliases: SearchableModuleAlias[];
  allowedRoles?: string[];
};

export type SearchableModuleResult = {
  _id: string;
  type: 'MENU';
  title: string;
  subtitle: string | null;
  status: string | null;
  targetHref: string;
  updatedAt: null;
  matchedFields: string[];
};

type BuildSearchableModuleResultsOptions = {
  keyword: string;
  roleName?: string | null;
  translateTitle: (key: string, fallback: string) => string;
};

const valuationTarget = '/dashboard/inventory/counts?section=valuation';
const fifoValuationTarget = `${valuationTarget}&method=FIFO`;
const avgValuationTarget = `${valuationTarget}&method=AVG`;

export const SEARCHABLE_MODULES: SearchableModuleDefinition[] = [
  {
    _id: 'dashboard',
    titleKey: 'items.overview',
    titleFallback: 'Operation Overview',
    subtitle: 'Executive hub / Dashboard / Tổng quan vận hành',
    targetHref: '/dashboard',
    aliases: ['dashboard', 'overview', 'operation overview', 'executive hub', 'tong quan', 'tong quan van hanh', 'trung tam dieu hanh'],
  },
  {
    _id: 'approvals',
    titleKey: 'items.approvals',
    titleFallback: 'Smart Approvals',
    subtitle: 'Approval workflow / Phê duyệt thông minh',
    targetHref: '/dashboard/approvals',
    aliases: ['approval', 'approvals', 'smart approvals', 'phe duyet', 'phe duyet thong minh', 'duyet'],
  },
  {
    _id: 'approval-matrix',
    titleKey: 'items.approvalMatrix',
    titleFallback: 'Approval Matrix',
    subtitle: 'Approval rules / Ma trận phê duyệt',
    targetHref: '/dashboard/approval-matrix',
    aliases: ['matrix', 'approval matrix', 'approval rule', 'approval rules', 'ma tran', 'ma tran phe duyet', 'quy tac phe duyet'],
  },
  {
    _id: 'partners',
    titleKey: 'items.partners',
    titleFallback: 'Global Partners',
    subtitle: 'Customers / Buyers / Vendors / Logistics',
    targetHref: '/dashboard/partners',
    aliases: ['partners', 'global partners', 'customer', 'customers', 'buyer', 'buyers', 'vendor', 'vendors', 'supplier', 'doi tac', 'doi tac toan cau', 'khach hang', 'nha cung cap', 'ncc'],
  },
  {
    _id: 'products',
    titleKey: 'items.products',
    titleFallback: 'Product Catalog',
    subtitle: 'Products / SKU / HS code / Danh mục sản phẩm',
    targetHref: '/dashboard/product',
    aliases: ['product', 'products', 'product catalog', 'sku', 'hs code', 'hang hoa', 'san pham', 'danh muc san pham'],
  },
  {
    _id: 'inventory',
    titleKey: 'items.inventory',
    titleFallback: 'Live Inventory',
    subtitle: 'Real-time stock / Tồn kho real-time',
    targetHref: '/dashboard/inventory',
    aliases: ['live', 'live inventory', 'inventory', 'stock', 'real time stock', 'ton kho', 'ton kho real time', 'kho hang'],
  },
  {
    _id: 'inventory-ledger',
    titleKey: 'items.inventoryLedger',
    titleFallback: 'Stock History',
    subtitle: 'Inventory ledger / Lịch sử kho',
    targetHref: '/dashboard/inventory/ledger',
    aliases: ['ledger', 'inventory ledger', 'stock history', 'history', 'lich su kho', 'so kho'],
  },
  {
    _id: 'inventory-counts',
    titleKey: 'items.inventoryCounts',
    titleFallback: 'Stock Counts',
    subtitle: 'Inventory count / FIFO / AVG valuation / Kiểm kê & định giá kho',
    targetHref: '/dashboard/inventory/counts',
    aliases: [
      'count',
      'counts',
      'stock count',
      'stock counts',
      'inventory count',
      'inventory counts',
      { value: 'inventory valuation', targetHref: valuationTarget },
      { value: 'valuation', targetHref: valuationTarget },
      { value: 'valuation report', targetHref: valuationTarget },
      { value: 'stock valuation', targetHref: valuationTarget },
      { value: 'fifo', targetHref: fifoValuationTarget, subtitle: 'FIFO valuation / Nhập trước xuất trước' },
      { value: 'fiflo', targetHref: fifoValuationTarget, subtitle: 'FIFO valuation / Nhập trước xuất trước' },
      { value: 'first in first out', targetHref: fifoValuationTarget, subtitle: 'FIFO valuation / Nhập trước xuất trước' },
      { value: 'avg', targetHref: avgValuationTarget, subtitle: 'AVG valuation / Bình quân gia quyền' },
      { value: 'average', targetHref: avgValuationTarget, subtitle: 'AVG valuation / Bình quân gia quyền' },
      { value: 'average cost', targetHref: avgValuationTarget, subtitle: 'AVG valuation / Bình quân gia quyền' },
      { value: 'weighted average', targetHref: avgValuationTarget, subtitle: 'AVG valuation / Bình quân gia quyền' },
      { value: 'weighted average cost', targetHref: avgValuationTarget, subtitle: 'AVG valuation / Bình quân gia quyền' },
      { value: 'cogs', targetHref: valuationTarget },
      { value: 'cost of goods sold', targetHref: valuationTarget },
      'kiem ke',
      'kiem ke kho',
      { value: 'dinh gia ton kho', targetHref: valuationTarget },
      { value: 'bao cao dinh gia ton kho', targetHref: valuationTarget },
      { value: 'nhap truoc xuat truoc', targetHref: fifoValuationTarget, subtitle: 'FIFO valuation / Nhập trước xuất trước' },
      { value: 'binh quan', targetHref: avgValuationTarget, subtitle: 'AVG valuation / Bình quân gia quyền' },
      { value: 'binh quan gia quyen', targetHref: avgValuationTarget, subtitle: 'AVG valuation / Bình quân gia quyền' },
      { value: 'gia von', targetHref: valuationTarget },
    ],
  },
  {
    _id: 'inventory-export-deliveries',
    titleKey: 'items.exportDeliveries',
    titleFallback: 'Export Deliveries',
    subtitle: 'Export warehouse issue / Phiếu xuất kho',
    targetHref: '/dashboard/inventory/export-deliveries',
    aliases: ['export delivery', 'export deliveries', 'warehouse issue', 'stock issue', 'phieu xuat kho', 'xuat kho', 'phieu xuat kho export'],
  },
  {
    _id: 'inventory-returns',
    titleKey: 'items.inventoryReturns',
    titleFallback: 'Customer Returns',
    subtitle: 'Buyer returns / Trả hàng buyer',
    targetHref: '/dashboard/inventory/returns',
    aliases: ['return', 'returns', 'customer return', 'buyer return', 'tra hang', 'tra hang buyer', 'hang tra'],
  },
  {
    _id: 'inquiries',
    titleKey: 'items.inquiries',
    titleFallback: 'Market Inquiries',
    subtitle: 'RFQ / Yêu cầu báo giá',
    targetHref: '/dashboard/inquiry',
    aliases: ['inquiry', 'inquiries', 'rfq', 'market inquiry', 'yeu cau bao gia', 'yeu cau', 'bao gia'],
  },
  {
    _id: 'quotations',
    titleKey: 'items.quotations',
    titleFallback: 'Sales Quotations',
    subtitle: 'Quotation / Báo giá bán hàng',
    targetHref: '/dashboard/quotation',
    aliases: ['quotation', 'quotations', 'quote', 'sales quotation', 'bao gia', 'bao gia ban hang'],
  },
  {
    _id: 'pricing-policies',
    titleKey: 'items.pricingPolicies',
    titleFallback: 'Pricing Policies',
    subtitle: 'Price policy / Chính sách giá',
    targetHref: '/dashboard/pricing-policies',
    aliases: ['pricing', 'price', 'pricing policy', 'pricing policies', 'chinh sach gia', 'bang gia', 'gia ban'],
  },
  {
    _id: 'proforma-invoices',
    titleKey: 'items.proformaInvoices',
    titleFallback: 'Proforma Invoices',
    subtitle: 'PI / Hóa đơn chiếu lệ',
    targetHref: '/dashboard/proforma-invoice',
    aliases: ['pi', 'proforma', 'proforma invoice', 'proforma invoices', 'hoa don chieu le'],
  },
  {
    _id: 'sales-contracts',
    titleKey: 'items.salesContracts',
    titleFallback: 'Export Contracts',
    subtitle: 'Sales contract / Hợp đồng xuất khẩu',
    targetHref: '/dashboard/sales-contract',
    aliases: ['contract', 'contracts', 'sales contract', 'export contract', 'hop dong', 'hop dong xuat khau', 'hd xuat'],
  },
  {
    _id: 'commercial-invoices',
    titleKey: 'items.commercialInvoices',
    titleFallback: 'Commercial Invoices',
    subtitle: 'CI / Hóa đơn thương mại',
    targetHref: '/dashboard/commercial-invoices',
    aliases: ['ci', 'commercial invoice', 'commercial invoices', 'invoice', 'hoa don thuong mai'],
  },
  {
    _id: 'purchase-requests',
    titleKey: 'items.purchaseRequests',
    titleFallback: 'PR Requests',
    subtitle: 'Purchase request / Yêu cầu mua hàng',
    targetHref: '/dashboard/purchase-request',
    aliases: ['pr', 'purchase request', 'purchase requests', 'yeu cau mua hang', 'de nghi mua hang'],
  },
  {
    _id: 'purchase-orders',
    titleKey: 'items.purchaseOrders',
    titleFallback: 'PO Orders',
    subtitle: 'Purchase order / Đơn mua hàng',
    targetHref: '/dashboard/purchase-orders',
    aliases: ['po', 'purchase order', 'purchase orders', 'don mua hang', 'don hang mua'],
  },
  {
    _id: 'goods-receipts',
    titleKey: 'items.goodsReceipts',
    titleFallback: 'Goods Receipt',
    subtitle: 'GRN / Phiếu nhập kho',
    targetHref: '/dashboard/goods-receipt',
    aliases: ['grn', 'goods receipt', 'goods receipts', 'receipt', 'phieu nhap kho', 'nhap kho'],
  },
  {
    _id: 'vendor-invoices',
    titleKey: 'items.vendorInvoices',
    titleFallback: 'Vendor Invoices',
    subtitle: 'Supplier invoice / Hóa đơn nhà cung cấp',
    targetHref: '/dashboard/vendor-invoice',
    aliases: ['vendor invoice', 'vendor invoices', 'supplier invoice', 'ap invoice', 'hoa don nha cung cap', 'hoa don ncc'],
  },
  {
    _id: 'vendor-evaluations',
    titleKey: 'items.vendorEvaluations',
    titleFallback: 'Vendor Scorecards',
    subtitle: 'Vendor scorecard / Đánh giá nhà cung cấp',
    targetHref: '/dashboard/vendor-evaluations',
    aliases: ['vendor scorecard', 'vendor scorecards', 'vendor evaluation', 'vendor evaluations', 'danh gia ncc', 'danh gia nha cung cap'],
  },
  {
    _id: 'purchase-returns',
    titleKey: 'items.purchaseReturns',
    titleFallback: 'Purchase Returns',
    subtitle: 'Vendor return / Trả hàng mua',
    targetHref: '/dashboard/purchase-return',
    aliases: ['purchase return', 'purchase returns', 'vendor return', 'supplier return', 'tra hang mua', 'tra hang ncc'],
  },
  {
    _id: 'purchase-exceptions',
    titleKey: 'items.purchaseExceptions',
    titleFallback: 'P2P/QC Exceptions',
    subtitle: 'QC exceptions / Ngoại lệ P2P/QC',
    targetHref: '/dashboard/purchase/exceptions',
    aliases: ['p2p', 'qc', 'exception', 'exceptions', 'p2p qc', 'quality control', 'ngoai le', 'ngoai le p2p', 'ngoai le qc'],
  },
  {
    _id: 'purchase-matching',
    titleKey: 'items.threeWayMatching',
    titleFallback: '3-Way Matching',
    subtitle: 'PO/GRN/Invoice matching / Đối chiếu 3 bên',
    targetHref: '/dashboard/purchase/matching',
    aliases: ['matching', '3 way matching', 'three way matching', 'three-way matching', 'doi chieu 3 ben', 'doi chieu ba ben'],
  },
  {
    _id: 'shipments',
    titleKey: 'items.shipments',
    titleFallback: 'Global Logistics',
    subtitle: 'Shipment / Logistics / Lô hàng',
    targetHref: '/dashboard/shipment',
    aliases: ['shipment', 'shipments', 'logistics', 'global logistics', 'lo hang', 'van chuyen'],
  },
  {
    _id: 'ports',
    titleKey: 'items.ports',
    titleFallback: 'Sea Ports',
    subtitle: 'POL/POD master data / Danh muc cang bien',
    targetHref: '/dashboard/ports',
    aliases: ['ports', 'sea ports', 'seaport', 'cang bien', 'cang di', 'cang den', 'pol', 'pod', 'unlocode'],
  },
  {
    _id: 'export-documents',
    titleKey: 'items.exportDocuments',
    titleFallback: 'Export Documents',
    subtitle: 'Document center / Bộ chứng từ xuất khẩu',
    targetHref: '/dashboard/document',
    aliases: ['document', 'documents', 'export document', 'export documents', 'bo chung tu', 'chung tu xuat khau', 'xk'],
  },
  {
    _id: 'trade-finance-lc',
    titleKey: 'items.lc',
    titleFallback: 'Trade Finance (L/C)',
    subtitle: 'Letter of credit / Tín dụng thư',
    targetHref: '/dashboard/finance/lc',
    aliases: ['lc', 'l c', 'letter of credit', 'trade finance', 'tin dung thu'],
  },
  {
    _id: 'trade-finance-collections',
    titleKey: 'items.collections',
    titleFallback: 'Collections (D/P, D/A)',
    subtitle: 'Collections / Nhờ thu',
    targetHref: '/dashboard/finance/collections',
    aliases: ['collection', 'collections', 'dp', 'da', 'd p', 'd a', 'nho thu'],
  },
  {
    _id: 'trade-finance-general',
    titleKey: 'items.paymentTT',
    titleFallback: 'Payment (T/T)',
    subtitle: 'General payment / Thanh toán T/T',
    targetHref: '/dashboard/finance/general',
    aliases: ['payment', 'payments', 'tt', 't t', 'general payment', 'thanh toan', 'thanh toan tt'],
  },
  {
    _id: 'account-receivables',
    titleKey: 'items.accountReceivables',
    titleFallback: 'Buyer Receivables',
    subtitle: 'AR / Công nợ buyer',
    targetHref: '/dashboard/account-receivables',
    aliases: ['ar', 'a r', 'account receivable', 'account receivables', 'buyer receivables', 'cong no buyer', 'cong no phai thu', 'phai thu'],
  },
  {
    _id: 'account-payables',
    titleKey: 'items.accountPayables',
    titleFallback: 'Vendor Payables',
    subtitle: 'AP / Công nợ NCC',
    targetHref: '/dashboard/account-payables',
    aliases: ['ap', 'a p', 'account payable', 'account payables', 'vendor payables', 'cong no ncc', 'cong no phai tra', 'phai tra'],
  },
  {
    _id: 'accounting',
    titleKey: 'items.finance',
    titleFallback: 'Accounting & Tax',
    subtitle: 'Financial accounting / Kế toán & thuế',
    targetHref: '/dashboard/accounting',
    aliases: ['accounting', 'tax', 'finance', 'financial accounting', 'ke toan', 'thue', 'bao cao tai chinh'],
  },
  {
    _id: 'users',
    titleKey: 'items.users',
    titleFallback: 'Team Management',
    subtitle: 'Users / Roles / Quản lý đội ngũ',
    targetHref: '/dashboard/user',
    allowedRoles: ['ADMIN'],
    aliases: ['user', 'users', 'team', 'team management', 'role', 'roles', 'quan ly doi ngu', 'nguoi dung', 'vai tro'],
  },
  {
    _id: 'role-permissions',
    titleKey: 'items.rolePermissions',
    titleFallback: 'Roles & Permissions',
    subtitle: 'Role permission matrix / Phân quyền vai trò',
    targetHref: '/dashboard/user?tab=permissions',
    allowedRoles: ['ADMIN', 'DIRECTOR', 'MANAGER'],
    aliases: [
      'permission',
      'permissions',
      'role permission',
      'role permissions',
      'roles permissions',
      'rbac',
      'access control',
      'phan quyen',
      'phan quyen role',
      'phan quyen vai tro',
      'cap quyen',
      'cap quyen role',
    ],
  },
  {
    _id: 'system-settings',
    titleKey: 'items.systemSettings',
    titleFallback: 'System Settings',
    subtitle: 'Settings / Administration / Cài đặt hệ thống',
    targetHref: '/dashboard/settings/system',
    aliases: ['setting', 'settings', 'system settings', 'system', 'admin', 'administration', 'cai dat', 'cai dat he thong'],
  },
  {
    _id: 'currencies',
    titleKey: 'items.currencies',
    titleFallback: 'FX Management',
    subtitle: 'Currency / Exchange rate / Tỷ giá',
    targetHref: '/dashboard/settings/currencies',
    aliases: ['currency', 'currencies', 'fx', 'exchange rate', 'ty gia', 'ngoai te'],
  },
  {
    _id: 'countries',
    titleKey: 'items.countries',
    titleFallback: 'Country Management',
    subtitle: 'Country catalog / Quản lý quốc gia',
    targetHref: '/dashboard/settings/countries',
    allowedRoles: ['ADMIN', 'MANAGER'],
    aliases: ['country', 'countries', 'quoc gia', 'quan ly quoc gia', 'ma quoc gia'],
  },
];

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (match) => (match === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matchesSearchText(value: string, normalizedKeyword: string): boolean {
  const normalizedValue = normalizeSearchText(value);
  const compactValue = normalizedValue.replace(/\s/g, '');
  const compactKeyword = normalizedKeyword.replace(/\s/g, '');

  return normalizedValue.includes(normalizedKeyword) || (
    compactKeyword.length > 0 && compactValue.includes(compactKeyword)
  );
}

function aliasValue(alias: SearchableModuleAlias): string {
  return typeof alias === 'string' ? alias : alias.value;
}

function canAccessModule(module: SearchableModuleDefinition, roleName?: string | null): boolean {
  if (module.allowedRoles?.length) {
    const normalizedRole = normalizeSearchText(roleName || '').toUpperCase();
    if (!module.allowedRoles.map((role) => role.toUpperCase()).includes(normalizedRole)) return false;
  }

  return canAccessDashboardPath(module.targetHref, roleName);
}

function getMatchedAlias(module: SearchableModuleDefinition, normalizedKeyword: string): SearchableModuleAlias | null {
  return module.aliases.find((alias) => matchesSearchText(aliasValue(alias), normalizedKeyword)) ?? null;
}

export function buildSearchableModuleResults({
  keyword,
  roleName,
  translateTitle,
}: BuildSearchableModuleResultsOptions): SearchableModuleResult[] {
  const normalizedKeyword = normalizeSearchText(keyword);
  if (!normalizedKeyword) return [];

  return SEARCHABLE_MODULES.reduce<SearchableModuleResult[]>((results, module) => {
    if (!canAccessModule(module, roleName)) return results;

    const title = translateTitle(module.titleKey, module.titleFallback);
    const matchedAlias = getMatchedAlias(module, normalizedKeyword);
    const matchedAliasObject = typeof matchedAlias === 'string' ? null : matchedAlias;
    const matchedFields = [
      title,
      module.titleFallback,
      module.subtitle,
      module.targetHref,
      ...module.aliases.map(aliasValue),
    ];

    if (!matchedFields.some((value) => matchesSearchText(value, normalizedKeyword))) {
      return results;
    }

    results.push({
      _id: `menu-${module._id}`,
      type: 'MENU',
      title,
      subtitle: matchedAliasObject?.subtitle ?? module.subtitle,
      status: null,
      targetHref: matchedAliasObject?.targetHref ?? module.targetHref,
      updatedAt: null,
      matchedFields,
    });

    return results;
  }, []);
}
