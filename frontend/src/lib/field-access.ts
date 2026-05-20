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

type PermissionLike = string | { name?: unknown; code?: unknown; apiPath?: unknown };

type CostAccessUser = {
  role?: string | { name?: unknown; permissions?: PermissionLike[] } | null;
  roleName?: unknown;
  permissions?: PermissionLike[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function asCostAccessUser(value: unknown): CostAccessUser {
  return isRecord(value) ? value : {};
}

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

function getRoleName(user: CostAccessUser): string {
  const role = typeof user.role === 'string' ? user.role : user.role?.name;
  return (normalizeAccessKey(role) || normalizeAccessKey(user.roleName)).toUpperCase();
}

function getPermissionKey(permission: PermissionLike): string {
  if (typeof permission === 'string') return permission.trim().toLowerCase();

  return (
    normalizeAccessKey(permission.name) ||
    normalizeAccessKey(permission.code) ||
    normalizeAccessKey(permission.apiPath)
  ).toLowerCase();
}

function getPermissions(user: CostAccessUser): PermissionLike[] {
  const rolePermissions =
    user.role && typeof user.role === 'object' && Array.isArray(user.role.permissions)
      ? user.role.permissions
      : [];
  const userPermissions = Array.isArray(user.permissions) ? user.permissions : [];

  return [...rolePermissions, ...userPermissions];
}

export function canReadCostFields(user?: unknown): boolean {
  const accessUser = asCostAccessUser(user);
  const roleName = getRoleName(accessUser);
  if (COST_PRIVILEGED_ROLES.has(roleName)) return true;

  return hasAnyPermission(accessUser, COST_PRIVILEGED_PERMISSIONS);
}

export function canReadBankFields(user?: unknown): boolean {
  const accessUser = asCostAccessUser(user);
  const roleName = getRoleName(accessUser);
  if (BANK_PRIVILEGED_ROLES.has(roleName)) return true;

  return hasAnyPermission(accessUser, BANK_PRIVILEGED_PERMISSIONS);
}

export function canReadTradeFinanceFields(user?: unknown): boolean {
  const accessUser = asCostAccessUser(user);
  const roleName = getRoleName(accessUser);
  if (TRADE_FINANCE_PRIVILEGED_ROLES.has(roleName)) return true;

  return hasAnyPermission(accessUser, TRADE_FINANCE_PRIVILEGED_PERMISSIONS);
}

export function sanitizeCostPayload<T>(
  value: T,
  canViewCost: boolean,
  extraFieldNames: string[] = [],
): T {
  if (canViewCost) return value;
  return sanitizeCostPayloadDeep(value, canViewCost, new Set(extraFieldNames)) as T;
}

function hasAnyPermission(
  user: CostAccessUser,
  allowedPermissions: Set<string>,
): boolean {
  return getPermissions(user).some((permission) =>
    allowedPermissions.has(getPermissionKey(permission)),
  );
}

function canReadField(
  fieldName: string,
  canViewCost: boolean,
  extraFieldNames: Set<string>,
): boolean {
  if (COST_FIELD_NAMES.has(fieldName) || extraFieldNames.has(fieldName)) {
    return canViewCost;
  }

  if (BANK_FIELD_NAMES.has(fieldName) || TRADE_FINANCE_FIELD_NAMES.has(fieldName)) {
    return canViewCost;
  }

  return true;
}

function sanitizeCostPayloadDeep(
  value: unknown,
  canViewCost: boolean,
  extraFieldNames: Set<string>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeCostPayloadDeep(item, canViewCost, extraFieldNames));
  }

  if (
    !value ||
    typeof value !== 'object' ||
    value instanceof Date ||
    (typeof File !== 'undefined' && value instanceof File) ||
    (typeof Blob !== 'undefined' && value instanceof Blob)
  ) {
    return value;
  }

  const source = value as Record<string, unknown>;
  if (
    typeof source.field === 'string' &&
    !canReadField(source.field, canViewCost, extraFieldNames)
  ) {
    return Object.entries(source).reduce<Record<string, unknown>>((acc, [key, nestedValue]) => {
      if (key === 'before' || key === 'after') return acc;
      acc[key] = sanitizeCostPayloadDeep(nestedValue, canViewCost, extraFieldNames);
      return acc;
    }, {});
  }

  return Object.entries(source).reduce<Record<string, unknown>>((acc, [key, nestedValue]) => {
    if (!canReadField(key, canViewCost, extraFieldNames)) return acc;
    acc[key] = sanitizeCostPayloadDeep(nestedValue, canViewCost, extraFieldNames);
    return acc;
  }, {});
}
