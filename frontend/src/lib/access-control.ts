export const STAFF_ROLES = [
  'ADMIN',
  'DIRECTOR',
  'MANAGER',
  'SALES_EXPORT',
  'PURCHASING',
  'LOGISTICS',
  'WAREHOUSE',
  'ACCOUNTANT',
  'CHIEF_ACCOUNTANT',
] as const;

export const SYSTEM_ROLES = [
  ...STAFF_ROLES,
  'CUSTOMER',
] as const;

export type RoleName = (typeof SYSTEM_ROLES)[number];

type AccessRoleInput = {
  roleName?: string | null;
  role?: string | { name?: string | null } | null;
  partnerId?: string | null;
} | null | undefined;

type DashboardAccessRule = {
  path: string;
  label: string;
  roles: RoleName[];
  exact?: boolean;
};

const ROLE_ALIASES: Record<string, RoleName> = {
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
  BUYER: 'CUSTOMER',
  CUSTOMER_PORTAL: 'CUSTOMER',
  PORTAL_CUSTOMER: 'CUSTOMER',
  BUYER_PORTAL: 'CUSTOMER',
};

const ALL_STAFF = [...STAFF_ROLES];
const ALL_DASHBOARD_USERS = [...SYSTEM_ROLES];
const MANAGEMENT = ['ADMIN', 'DIRECTOR', 'MANAGER'] as RoleName[];
const USER_MANAGE_ROLES = ['ADMIN'] as RoleName[];
const COUNTRY_MANAGE_ROLES = ['ADMIN', 'MANAGER'] as RoleName[];
const SALES_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'SALES_EXPORT'] as RoleName[];
const PURCHASE_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'PURCHASING'] as RoleName[];
const LOGISTICS_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT'] as RoleName[];
const FINANCE_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT'] as RoleName[];
const INVENTORY_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'WAREHOUSE', 'LOGISTICS', 'ACCOUNTANT'] as RoleName[];
const MASTER_DATA_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'SALES_EXPORT', 'PURCHASING', 'LOGISTICS', 'ACCOUNTANT'] as RoleName[];
const COUNTRY_READ_ROLES = ['ADMIN', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT', 'LOGISTICS'] as RoleName[];
const SUPPORT_DESK_ROLES = ['ADMIN', 'MANAGER', 'SALES_EXPORT', 'LOGISTICS'] as RoleName[];

export const DASHBOARD_ACCESS_RULES: DashboardAccessRule[] = [
  { path: '/dashboard/access-denied', label: 'Thông báo phân quyền', roles: ALL_DASHBOARD_USERS },
  { path: '/dashboard/notifications', label: 'Thông báo', roles: ALL_STAFF },
  { path: '/dashboard/approval-matrix', label: 'Ma trận phê duyệt', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT'] },
  { path: '/dashboard/approvals', label: 'Phê duyệt', roles: ALL_STAFF },
  { path: '/dashboard/partners', label: 'Đối tác', roles: MASTER_DATA_ROLES },
  { path: '/dashboard/customers', label: 'Khách hàng', roles: MASTER_DATA_ROLES },
  { path: '/dashboard/product', label: 'Sản phẩm', roles: MASTER_DATA_ROLES },
  { path: '/dashboard/inquiry', label: 'Yêu cầu báo giá', roles: SALES_ROLES },
  { path: '/dashboard/quotation', label: 'Báo giá', roles: SALES_ROLES },
  { path: '/dashboard/pricing-policies', label: 'Chính sách giá', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT'] },
  { path: '/dashboard/proforma-invoice', label: 'Proforma Invoice', roles: SALES_ROLES },
  { path: '/dashboard/sales-contract', label: 'Hợp đồng xuất khẩu', roles: SALES_ROLES },
  { path: '/dashboard/commercial-invoices', label: 'Commercial Invoice', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT', 'LOGISTICS'] },
  { path: '/dashboard/support', label: 'Support & Claims', roles: SUPPORT_DESK_ROLES },
  { path: '/dashboard/purchase/exceptions', label: 'Ngoại lệ P2P/QC', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'PURCHASING', 'WAREHOUSE'] },
  { path: '/dashboard/purchase/matching', label: 'Đối chiếu 3 bên', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'PURCHASING', 'ACCOUNTANT'] },
  { path: '/dashboard/purchase-request', label: 'Yêu cầu mua hàng', roles: PURCHASE_ROLES },
  { path: '/dashboard/purchase-orders', label: 'Đơn mua hàng', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'PURCHASING', 'LOGISTICS'] },
  { path: '/dashboard/goods-receipt', label: 'Phiếu nhập kho', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'PURCHASING', 'WAREHOUSE'] },
  { path: '/dashboard/vendor-invoice', label: 'Hóa đơn nhà cung cấp', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'PURCHASING', 'ACCOUNTANT'] },
  { path: '/dashboard/vendor-evaluations', label: 'Đánh giá nhà cung cấp', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'PURCHASING', 'ACCOUNTANT'] },
  { path: '/dashboard/purchase-return', label: 'Trả hàng mua', roles: PURCHASE_ROLES },
  { path: '/dashboard/shipment', label: 'Lô hàng', roles: LOGISTICS_ROLES },
  { path: '/dashboard/ports', label: 'Cảng biển', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT', 'ACCOUNTANT'] },
  { path: '/dashboard/document', label: 'Chứng từ xuất khẩu', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT', 'ACCOUNTANT'] },
  { path: '/dashboard/finance/lc', label: 'L/C', roles: FINANCE_ROLES },
  { path: '/dashboard/finance/collections', label: 'Nhờ thu', roles: FINANCE_ROLES },
  { path: '/dashboard/finance/general', label: 'Thanh toán T/T', roles: FINANCE_ROLES },
  { path: '/dashboard/finance', label: 'Tài chính', roles: FINANCE_ROLES },
  { path: '/dashboard/account-receivables', label: 'Công nợ phải thu', roles: [...FINANCE_ROLES, 'SALES_EXPORT'] },
  { path: '/dashboard/account-payables', label: 'Công nợ phải trả', roles: [...FINANCE_ROLES, 'PURCHASING'] },
  { path: '/dashboard/accounting', label: 'Kế toán', roles: FINANCE_ROLES },
  { path: '/dashboard/inventory/counts', label: 'Kiểm kê kho', roles: INVENTORY_ROLES },
  { path: '/dashboard/inventory/returns', label: 'Hàng trả buyer', roles: INVENTORY_ROLES },
  { path: '/dashboard/inventory/export-deliveries', label: 'Phiếu xuất kho', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'WAREHOUSE', 'LOGISTICS', 'SALES_EXPORT'] },
  { path: '/dashboard/inventory/ledger', label: 'Lịch sử kho', roles: INVENTORY_ROLES },
  { path: '/dashboard/inventory', label: 'Tồn kho', roles: INVENTORY_ROLES },
  { path: '/dashboard/user', label: 'Người dùng', roles: MANAGEMENT },
  { path: '/dashboard/settings/countries', label: 'Quốc gia', roles: COUNTRY_MANAGE_ROLES },
  { path: '/dashboard/settings/currencies', label: 'Tiền tệ', roles: ['ADMIN', 'DIRECTOR', 'MANAGER', 'ACCOUNTANT'] },
  { path: '/dashboard/settings/system', label: 'Cài đặt hệ thống', roles: ['ADMIN'] },
  { path: '/dashboard/settings', label: 'Cài đặt', roles: ['ADMIN'] },
  { path: '/dashboard/portal/orders', label: 'Đơn hàng của tôi', roles: ['CUSTOMER'] },
  { path: '/dashboard/portal/products', label: 'Sản phẩm & bảng giá', roles: ['CUSTOMER'] },
  { path: '/dashboard/portal/finance', label: 'Tài chính & Công nợ', roles: ['CUSTOMER'] },
  { path: '/dashboard/portal/shipments', label: 'Tra cứu lô hàng', roles: ['CUSTOMER'] },
  { path: '/dashboard/portal/settings', label: 'Cài đặt Portal', roles: ['CUSTOMER'] },
  { path: '/dashboard/portal/tickets', label: 'Hỗ Trợ & Khiếu Nại', roles: ['CUSTOMER'] },
  { path: '/dashboard/portal', label: 'Tổng quan Portal', roles: ['CUSTOMER'] },
  { path: '/dashboard', label: 'Tổng quan', roles: ALL_STAFF, exact: true },
];

const orderedRules = [...DASHBOARD_ACCESS_RULES].sort((a, b) => b.path.length - a.path.length);

export function normalizeRoleName(roleName?: string | null): RoleName | '' {
  const normalized = String(roleName || '').trim().toUpperCase();
  if (!normalized) return '';

  return ROLE_ALIASES[normalized] || (SYSTEM_ROLES.includes(normalized as RoleName) ? normalized as RoleName : '');
}

export function getAccessRoleName(user?: AccessRoleInput): RoleName | '' {
  const role = user?.role;
  const rawRoleName = typeof role === 'string' ? role : role?.name || user?.roleName;
  const normalizedRole = normalizeRoleName(rawRoleName);
  if (normalizedRole) return normalizedRole;

  return user?.partnerId ? 'CUSTOMER' : '';
}

export function isStaffRole(roleName?: string | null): boolean {
  const role = normalizeRoleName(roleName);
  return Boolean(role && STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]));
}

export function isDashboardUserRole(roleName?: string | null): boolean {
  return Boolean(normalizeRoleName(roleName));
}

export function isRoleAllowed(roleName: string | null | undefined, roles: readonly RoleName[]): boolean {
  const role = normalizeRoleName(roleName);
  return Boolean(role && roles.includes(role));
}

export function canManageUsers(roleName?: string | null): boolean {
  return isRoleAllowed(roleName, USER_MANAGE_ROLES);
}

export function canManageRolePermissions(roleName?: string | null): boolean {
  return isRoleAllowed(roleName, MANAGEMENT);
}

export function normalizeDashboardPath(pathname: string): string {
  const pathOnly = pathname.split('?')[0].split('#')[0] || '/';
  const normalized = pathOnly.endsWith('/') && pathOnly !== '/' ? pathOnly.slice(0, -1) : pathOnly;
  return normalized || '/';
}

export function getDashboardAccessRule(pathname: string): DashboardAccessRule | null {
  const normalizedPath = normalizeDashboardPath(pathname);

  return orderedRules.find((rule) => (
    rule.exact
      ? normalizedPath === rule.path
      : normalizedPath === rule.path || normalizedPath.startsWith(`${rule.path}/`)
  )) ?? null;
}

export function canAccessDashboardPath(pathname: string, roleName?: string | null): boolean {
  const normalizedPath = normalizeDashboardPath(pathname);
  if (!normalizedPath.startsWith('/dashboard')) return true;

  const role = normalizeRoleName(roleName);
  if (!role) return false;

  const rule = getDashboardAccessRule(normalizedPath);
  if (!rule) return role === 'ADMIN' || role === 'DIRECTOR' || role === 'MANAGER';

  return rule.roles.includes(role);
}

export function getDashboardAccessLabel(pathname: string): string {
  return getDashboardAccessRule(pathname)?.label || 'Trang này';
}

export function canReadCountryCatalog(roleName?: string | null): boolean {
  const role = normalizeRoleName(roleName);
  return Boolean(role && COUNTRY_READ_ROLES.includes(role));
}
