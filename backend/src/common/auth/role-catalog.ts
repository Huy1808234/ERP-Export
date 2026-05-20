export type SystemRoleDefinition = {
  name: string;
  description: string;
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
    description: 'Kinh doanh xuất khẩu - Quotation, PI, Sales Contract và khách hàng',
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
  const normalized = String(roleName || '').trim().toUpperCase();
  return LEGACY_ROLE_ALIASES[normalized] || normalized;
}
