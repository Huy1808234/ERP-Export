import type { Permission } from '@/modules/roles/entities/permission.entity';
import type { Role } from '@/modules/roles/entities/role.entity';
import { PermissionDataScope } from '@/common/auth/permission-scope';

export type AuthenticatedPermission = Pick<
  Permission,
  '_id' | 'name' | 'apiPath' | 'method' | 'module'
>;

export type AuthenticatedRole = Pick<Role, '_id' | 'name'> &
  Partial<Pick<Role, 'description' | 'isActive'>> & {
    permissions?: AuthenticatedPermission[];
    permissionAssignments?: Array<{
      permissionRef?: string;
      scope?: PermissionDataScope;
      permission?: AuthenticatedPermission;
    }>;
  };

export interface AuthenticatedUser {
  _id?: string;
  username?: string;
  name?: string;
  email?: string;
  roleName?: string | null;
  role?: string | AuthenticatedRole | null;
  partnerId?: string | null;
  permissionScopes?: Record<string, PermissionDataScope>;
}

export type QueryParamValue =
  | undefined
  | string
  | string[]
  | QueryParams
  | QueryParams[];

export interface QueryParams {
  [key: string]: QueryParamValue;
}
export type JsonRecord = Record<string, unknown>;
