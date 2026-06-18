export enum PermissionDataScope {
  OWN = 'OWN',
  DEPARTMENT = 'DEPARTMENT',
  ALL = 'ALL',
}

const scopeRank: Record<PermissionDataScope, number> = {
  [PermissionDataScope.OWN]: 1,
  [PermissionDataScope.DEPARTMENT]: 2,
  [PermissionDataScope.ALL]: 3,
};

type PermissionLike = {
  name?: unknown;
};

type PermissionAssignmentLike = {
  permission?: PermissionLike | null;
  permissionName?: unknown;
  scope?: unknown;
};

type PermissionScopedRoleLike = {
  permissions?: PermissionLike[];
  permissionAssignments?: PermissionAssignmentLike[];
};

export type PermissionScopedUser = {
  username?: string;
  role?: string | PermissionScopedRoleLike | null;
  permissionScopes?: Record<string, PermissionDataScope>;
};

export function normalizePermissionDataScope(
  value?: unknown,
): PermissionDataScope {
  if (value === undefined || value === null || value === '')
    return PermissionDataScope.ALL;

  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (normalized === PermissionDataScope.ALL) return PermissionDataScope.ALL;
  if (normalized === PermissionDataScope.DEPARTMENT)
    return PermissionDataScope.DEPARTMENT;
  return PermissionDataScope.OWN;
}

export function maxPermissionDataScope(
  current: PermissionDataScope,
  next: PermissionDataScope,
): PermissionDataScope {
  return scopeRank[next] > scopeRank[current] ? next : current;
}

function getAssignmentPermissionName(
  assignment: PermissionAssignmentLike,
): string {
  const permissionName =
    typeof assignment.permissionName === 'string'
      ? assignment.permissionName
      : assignment.permission?.name;

  return typeof permissionName === 'string' ? permissionName.trim() : '';
}

export function buildPermissionScopeMap(
  user?: PermissionScopedUser | null,
): Record<string, PermissionDataScope> {
  const role = user?.role;
  const roleObject = role && typeof role === 'object' ? role : null;
  const scopeMap: Record<string, PermissionDataScope> = {};

  for (const permission of roleObject?.permissions ?? []) {
    if (typeof permission.name === 'string' && permission.name.trim()) {
      scopeMap[permission.name.trim()] = PermissionDataScope.ALL;
    }
  }

  for (const assignment of roleObject?.permissionAssignments ?? []) {
    const permissionName = getAssignmentPermissionName(assignment);
    if (!permissionName) continue;

    const nextScope = normalizePermissionDataScope(assignment.scope);
    scopeMap[permissionName] = scopeMap[permissionName]
      ? maxPermissionDataScope(scopeMap[permissionName], nextScope)
      : nextScope;
  }

  return {
    ...scopeMap,
    ...(user?.permissionScopes ?? {}),
  };
}

function getLegacyPermissionName(permissionName: string): string | null {
  const [action, subject] = permissionName.split(':');
  if (!subject) return null;

  if (action === 'create' || action === 'update') {
    return `write:${subject}`;
  }

  return null;
}

export function getPermissionDataScope(
  user: PermissionScopedUser | null | undefined,
  permissionName: string,
): PermissionDataScope {
  const scopeMap = buildPermissionScopeMap(user);
  const exactScope = scopeMap[permissionName];
  if (exactScope) return exactScope;

  const legacyPermissionName = getLegacyPermissionName(permissionName);
  if (legacyPermissionName && scopeMap[legacyPermissionName]) {
    return scopeMap[legacyPermissionName];
  }

  if (permissionName.startsWith('read:') && scopeMap['read:all']) {
    return scopeMap['read:all'];
  }

  if (scopeMap['manage:all']) {
    return scopeMap['manage:all'];
  }

  return PermissionDataScope.OWN;
}

export function canAccessOwnedRecord(
  user: PermissionScopedUser | null | undefined,
  permissionName: string,
  ownerUsername?: string | null,
): boolean {
  const scope = getPermissionDataScope(user, permissionName);
  if (scope === PermissionDataScope.ALL) return true;

  const actorUsername = user?.username;
  if (!actorUsername || !ownerUsername) return false;

  if (scope === PermissionDataScope.DEPARTMENT) {
    return actorUsername === ownerUsername;
  }

  return actorUsername === ownerUsername;
}
