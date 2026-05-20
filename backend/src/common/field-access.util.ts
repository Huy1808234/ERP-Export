import { ForbiddenException } from '@nestjs/common';
import { normalizeRoleName } from './auth/role-catalog';

const COST_FIELD_NAMES = new Set([
  'purchasePriceVnd',
  'purchasePrice',
  'purchase_price_vnd',
  'basePriceVnd',
  'basePrice',
  'unitCost',
  'unitCostVnd',
  'cost',
  'costVnd',
  'stockValue',
  'inventoryValue',
  'inventoryValueVnd',
  'varianceValue',
  'varianceValueVnd',
  'totalInventoryValue',
  'totalInventoryValueVnd',
  'grossProfitVnd',
  'grossProfit',
  'grossProfitMargin',
  'grossMargin',
  'grossMarginPercent',
  'margin',
  'marginPercent',
  'profit',
  'netProfit',
  'expenses',
  'logisticsCostBreakdown',
  'logisticsCostRatio',
  'logisticsCostRatioPercent',
  'freightCost',
  'insuranceCost',
  'localChargesVnd',
  'truckingCostVnd',
  'customsFeeVnd',
  'totalCost',
  'cogs',
  'cogsVnd',
]);

const BANK_FIELD_NAMES = new Set([
  'bankName',
  'bankAccountName',
  'bankAccountNumber',
  'bankSwiftCode',
  'bankAddress',
  'bankInfo',
  'bankReference',
  'bankProofFileId',
  'bankProofUrl',
  'bankTransferAt',
  'beneficiaryBank',
  'beneficiaryAccount',
  'beneficiaryAccountName',
  'beneficiaryAccountNumber',
  'swiftCode',
  'iban',
  'paymentProofUrl',
  'receiptProofUrl',
]);

const TRADE_FINANCE_FIELD_NAMES = new Set([
  'issuingBank',
  'advisingBank',
  'descriptionOfGoods',
  'documentsRequired',
  'additionalConditions',
  'discrepancies',
  'handlingInstructions',
]);

const COST_PRIVILEGED_ROLES = new Set([
  'ADMIN',
  'SUPER ADMIN',
  'SUPER_ADMIN',
  'DIRECTOR',
  'MANAGER',
  'FINANCE',
  'PURCHASING',
  'ACCOUNTANT',
  'ACCOUNTING',
  'CHIEF_ACCOUNTANT',
]);

const COST_PRIVILEGED_PERMISSIONS = new Set([
  'read:cost_price',
  'read:cost_fields',
  'write:cost_fields',
  'update:cost_fields',
  'manage:cost_fields',
  'read:all',
]);

const BANK_PRIVILEGED_ROLES = new Set([
  'ADMIN',
  'SUPER ADMIN',
  'SUPER_ADMIN',
  'DIRECTOR',
  'MANAGER',
  'FINANCE',
  'ACCOUNTANT',
  'ACCOUNTING',
  'CHIEF_ACCOUNTANT',
  'TREASURY',
]);

const BANK_PRIVILEGED_PERMISSIONS = new Set([
  'read:bank_fields',
  'read:payment_fields',
  'manage:bank_fields',
  'read:trade_finance',
  'manage:trade_finance',
  'read:all',
]);

const TRADE_FINANCE_PRIVILEGED_ROLES = new Set([
  'ADMIN',
  'SUPER ADMIN',
  'SUPER_ADMIN',
  'DIRECTOR',
  'MANAGER',
  'FINANCE',
  'ACCOUNTANT',
  'ACCOUNTING',
  'CHIEF_ACCOUNTANT',
  'SALES_EXPORT',
]);

const TRADE_FINANCE_PRIVILEGED_PERMISSIONS = new Set([
  'read:trade_finance',
  'manage:trade_finance',
  'read:lc_sensitive',
  'read:all',
]);

type PermissionLike =
  | string
  | {
      name?: unknown;
      code?: unknown;
      apiPath?: unknown;
    };

type CostAccessUser = {
  role?:
    | string
    | {
        name?: unknown;
        permissions?: PermissionLike[];
      }
    | null;
  roleName?: unknown;
  permissions?: PermissionLike[];
};

function normalizeAccessKey(value: unknown): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value).trim();
  }

  return '';
}

function getRoleName(user?: CostAccessUser | null): string {
  const role = typeof user?.role === 'string' ? user.role : user?.role?.name;
  return normalizeRoleName(
    normalizeAccessKey(role) || normalizeAccessKey(user?.roleName)
  );
}

function getPermissionKey(permission: PermissionLike): string {
  if (typeof permission === 'string') return permission.trim().toLowerCase();

  return (
    normalizeAccessKey(permission.name) ||
    normalizeAccessKey(permission.code) ||
    normalizeAccessKey(permission.apiPath)
  ).toLowerCase();
}

function getPermissions(user?: CostAccessUser | null): PermissionLike[] {
  const rolePermissions =
    user?.role && typeof user.role === 'object' && Array.isArray(user.role.permissions)
      ? user.role.permissions
      : [];
  const userPermissions = Array.isArray(user?.permissions)
    ? user.permissions
    : [];

  return [...rolePermissions, ...userPermissions];
}

export function canReadCostFields(user?: CostAccessUser | null): boolean {
  const roleName = getRoleName(user);
  if (COST_PRIVILEGED_ROLES.has(roleName)) return true;

  return hasAnyPermission(user, COST_PRIVILEGED_PERMISSIONS);
}

export function canReadBankFields(user?: CostAccessUser | null): boolean {
  const roleName = getRoleName(user);
  if (BANK_PRIVILEGED_ROLES.has(roleName)) return true;

  return hasAnyPermission(user, BANK_PRIVILEGED_PERMISSIONS);
}

export function canReadTradeFinanceFields(user?: CostAccessUser | null): boolean {
  const roleName = getRoleName(user);
  if (TRADE_FINANCE_PRIVILEGED_ROLES.has(roleName)) return true;

  return hasAnyPermission(user, TRADE_FINANCE_PRIVILEGED_PERMISSIONS);
}

export function maskCostFields<T>(
  value: T,
  user?: CostAccessUser | null,
  extraFieldNames: string[] = [],
): T {
  const extraFieldNameSet = new Set(extraFieldNames);
  if (
    canReadCostFields(user) &&
    canReadBankFields(user) &&
    canReadTradeFinanceFields(user)
  ) {
    return value;
  }

  return maskCostFieldsDeep(value, user, extraFieldNameSet) as T;
}

export function assertCanWriteCostFields(
  value: unknown,
  user?: CostAccessUser | null,
  extraFieldNames: string[] = [],
) {
  if (!containsCostField(value, new Set(extraFieldNames))) return;
  if (canReadCostFields(user)) return;

  throw new ForbiddenException(
    'Current role is not allowed to create or update cost-sensitive fields',
  );
}

function containsCostField(
  value: unknown,
  extraFieldNames: Set<string>,
): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsCostField(item, extraFieldNames));
  }

  if (
    !value ||
    typeof value !== 'object' ||
    value instanceof Date ||
    Buffer.isBuffer(value)
  ) {
    return false;
  }

  const source = value as Record<string, unknown>;
  if (
    typeof source.field === 'string' &&
    (COST_FIELD_NAMES.has(source.field) || extraFieldNames.has(source.field))
  ) {
    return true;
  }

  return Object.entries(source).some(([key, nestedValue]) => {
    if (COST_FIELD_NAMES.has(key) || extraFieldNames.has(key)) return true;
    return containsCostField(nestedValue, extraFieldNames);
  });
}

function hasAnyPermission(
  user: CostAccessUser | null | undefined,
  allowedPermissions: Set<string>,
): boolean {
  return getPermissions(user).some((permission) =>
    allowedPermissions.has(getPermissionKey(permission)),
  );
}

function canReadField(
  fieldName: string,
  user: CostAccessUser | null | undefined,
  extraFieldNames: Set<string>,
): boolean {
  if (COST_FIELD_NAMES.has(fieldName) || extraFieldNames.has(fieldName)) {
    return canReadCostFields(user);
  }

  if (BANK_FIELD_NAMES.has(fieldName)) {
    return canReadBankFields(user);
  }

  if (TRADE_FINANCE_FIELD_NAMES.has(fieldName)) {
    return canReadTradeFinanceFields(user);
  }

  return true;
}

function maskCostFieldsDeep(
  value: unknown,
  user: CostAccessUser | null | undefined,
  extraFieldNames: Set<string>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskCostFieldsDeep(item, user, extraFieldNames));
  }

  if (
    !value ||
    typeof value !== 'object' ||
    value instanceof Date ||
    Buffer.isBuffer(value)
  ) {
    return value;
  }

  const source = value as Record<string, unknown>;
  if (
    typeof source.field === 'string' &&
    !canReadField(source.field, user, extraFieldNames)
  ) {
    return Object.entries(source).reduce<Record<string, unknown>>(
      (acc, [key, nestedValue]) => {
        if (key === 'before' || key === 'after') return acc;
        acc[key] = maskCostFieldsDeep(nestedValue, user, extraFieldNames);
        return acc;
      },
      {},
    );
  }

  return Object.entries(source).reduce<Record<string, unknown>>(
    (acc, [key, nestedValue]) => {
      if (!canReadField(key, user, extraFieldNames)) return acc;
      acc[key] = maskCostFieldsDeep(nestedValue, user, extraFieldNames);
      return acc;
    },
    {},
  );
}
