export type SystemRoleDefinition = {
  name: string;
  description: string;
};

export type SystemPermissionDefinition = {
  name: string;
  apiPath: string;
  method: string;
  module: string;
};

export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    name: 'ADMIN',
    description: 'Quản trị hệ thống - Toàn quyền cấu hình và nhân sự',
  },
  {
    name: 'DIRECTOR',
    description: 'Ban giám đốc - Xem dashboard và phê duyệt cấp cao',
  },
  {
    name: 'MANAGER',
    description: 'Quản lý nghiệp vụ - Duyệt chứng từ và giám sát vận hành',
  },
  {
    name: 'SALES_EXPORT',
    description:
      'Kinh doanh xuất khẩu - Quotation, PI, Sales Contract và khách hàng',
  },
  {
    name: 'PURCHASING',
    description: 'Thu mua - PR, PO, nhà cung cấp và giá mua',
  },
  {
    name: 'LOGISTICS',
    description: 'Logistics - Shipment, vận đơn và bộ chứng từ xuất khẩu',
  },
  {
    name: 'WAREHOUSE',
    description: 'Kho vận - GRN, xuất kho, tồn kho và kiểm kê',
  },
  {
    name: 'ACCOUNTANT',
    description: 'Kế toán - Công nợ, thanh toán, tỷ giá và hạch toán',
  },
  {
    name: 'CHIEF_ACCOUNTANT',
    description: 'Kế toán trưởng - Kiểm soát tài chính và phê duyệt kế toán',
  },
  {
    name: 'CUSTOMER',
    description: 'Khách hàng B2B - Tài khoản cổng khách hàng',
  },
];

export const SYSTEM_PERMISSIONS: readonly SystemPermissionDefinition[] = [
  {
    name: 'read:all',
    apiPath: '*',
    method: 'GET',
    module: 'SYSTEM',
  },
  {
    name: 'manage:all',
    apiPath: '*',
    method: 'ALL',
    module: 'SYSTEM',
  },
  {
    name: 'read:accounting',
    apiPath: '/api/v1/accounting/**',
    method: 'GET',
    module: 'ACCOUNTING',
  },
  {
    name: 'create:accounting',
    apiPath: '/api/v1/accounting/**',
    method: 'POST',
    module: 'ACCOUNTING',
  },
  {
    name: 'update:accounting',
    apiPath: '/api/v1/accounting/**',
    method: 'PATCH',
    module: 'ACCOUNTING',
  },
  {
    name: 'write:accounting',
    apiPath: '/api/v1/accounting/**',
    method: 'WRITE',
    module: 'ACCOUNTING',
  },
  {
    name: 'read:export_document',
    apiPath: '/api/v1/commercial-invoices/**',
    method: 'GET',
    module: 'EXPORT_DOCUMENTS',
  },
  {
    name: 'create:export_document',
    apiPath: '/api/v1/commercial-invoices/**',
    method: 'POST',
    module: 'EXPORT_DOCUMENTS',
  },
  {
    name: 'update:export_document',
    apiPath: '/api/v1/commercial-invoices/**',
    method: 'PATCH',
    module: 'EXPORT_DOCUMENTS',
  },
  {
    name: 'write:export_document',
    apiPath: '/api/v1/commercial-invoices/**',
    method: 'WRITE',
    module: 'EXPORT_DOCUMENTS',
  },
  {
    name: 'read:sales_contract',
    apiPath: '/api/v1/sales-contracts/**',
    method: 'GET',
    module: 'SALES_CONTRACTS',
  },
  {
    name: 'create:sales_contract',
    apiPath: '/api/v1/sales-contracts/**',
    method: 'POST',
    module: 'SALES_CONTRACTS',
  },
  {
    name: 'update:sales_contract',
    apiPath: '/api/v1/sales-contracts/**',
    method: 'PATCH',
    module: 'SALES_CONTRACTS',
  },
  {
    name: 'write:sales_contract',
    apiPath: '/api/v1/sales-contracts/**',
    method: 'WRITE',
    module: 'SALES_CONTRACTS',
  },
  {
    name: 'read:cost_price',
    apiPath: 'field:cost_price',
    method: 'READ',
    module: 'FIELD_ACCESS',
  },
  {
    name: 'read:cost_fields',
    apiPath: 'field:cost_fields',
    method: 'READ',
    module: 'FIELD_ACCESS',
  },
  {
    name: 'create:cost_fields',
    apiPath: 'field:cost_fields',
    method: 'CREATE',
    module: 'FIELD_ACCESS',
  },
  {
    name: 'write:cost_fields',
    apiPath: 'field:cost_fields',
    method: 'WRITE',
    module: 'FIELD_ACCESS',
  },
  {
    name: 'update:cost_fields',
    apiPath: 'field:cost_fields',
    method: 'UPDATE',
    module: 'FIELD_ACCESS',
  },
  {
    name: 'manage:cost_fields',
    apiPath: 'field:cost_fields',
    method: 'MANAGE',
    module: 'FIELD_ACCESS',
  },
  {
    name: 'read:bank_fields',
    apiPath: 'field:bank_fields',
    method: 'READ',
    module: 'FIELD_ACCESS',
  },
  {
    name: 'read:payment_fields',
    apiPath: 'field:payment_fields',
    method: 'READ',
    module: 'FIELD_ACCESS',
  },
  {
    name: 'manage:bank_fields',
    apiPath: 'field:bank_fields',
    method: 'MANAGE',
    module: 'FIELD_ACCESS',
  },
  {
    name: 'read:trade_finance',
    apiPath: 'field:trade_finance',
    method: 'READ',
    module: 'FIELD_ACCESS',
  },
  {
    name: 'manage:trade_finance',
    apiPath: 'field:trade_finance',
    method: 'MANAGE',
    module: 'FIELD_ACCESS',
  },
  {
    name: 'read:lc_sensitive',
    apiPath: 'field:lc_sensitive',
    method: 'READ',
    module: 'FIELD_ACCESS',
  },
];

export const LEGACY_ROLE_ALIASES: Readonly<Record<string, string>> = {
  SUPER_ADMIN: 'ADMIN',
  'SUPER ADMIN': 'ADMIN',
  SALES: 'SALES_EXPORT',
  SALES_STAFF: 'SALES_EXPORT',
  SALES_MANAGER: 'MANAGER',
  PURCHASE_OFFICER: 'PURCHASING',
  LOGISTICS_SPECIALIST: 'LOGISTICS',
  WAREHOUSE_KEEPER: 'WAREHOUSE',
  FINANCE_ACCOUNTANT: 'ACCOUNTANT',
  ACCOUNTING: 'ACCOUNTANT',
};

export function normalizeRoleName(roleName?: string | null): string {
  const normalized = String(roleName || '')
    .trim()
    .toUpperCase();
  return LEGACY_ROLE_ALIASES[normalized] || normalized;
}
