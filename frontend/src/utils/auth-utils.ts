import { IUser } from "@/types/next-auth";

/**
 * List of roles that are allowed to access the administrative dashboard.
 */
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
];

const ROLE_ALIASES: Record<string, string> = {
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

function normalizeRoleName(roleName?: string | null): string {
  const normalized = String(roleName || '').trim().toUpperCase();
  return ROLE_ALIASES[normalized] || normalized;
}

/**
 * Checks if a user has staff/admin permissions based on their role.
 * 
 * @param user The user object from the session
 * @returns boolean
 */
export function isStaff(user: any): boolean {
  if (!user) return false;
  
  const rawRoleName = typeof user.role === 'object' 
    ? user.role.name || user.roleName
    : user.role || user.roleName;
  const roleName = normalizeRoleName(rawRoleName);

  // If the role is explicitly CUSTOMER, they are not staff
  if (roleName === 'CUSTOMER') return false;

  // Check if the role is in our whitelist or if it's not null (since customers don't have roles by default)
  // We prefer the whitelist for better security
  return STAFF_ROLES.includes(roleName);
}
