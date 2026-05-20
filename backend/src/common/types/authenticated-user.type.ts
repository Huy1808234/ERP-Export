import type { Permission } from '@/modules/roles/entities/permission.entity';
import type { Role } from '@/modules/roles/entities/role.entity';

export type AuthenticatedPermission = Pick<
  Permission,
  '_id' | 'name' | 'apiPath' | 'method' | 'module'
>;

export type AuthenticatedRole = Pick<
  Role,
  '_id' | 'name' | 'description' | 'isActive'
> & {
  permissions?: AuthenticatedPermission[];
};

export interface AuthenticatedUser {
  _id?: string;
  username?: string;
  name?: string;
  email?: string;
  roleName?: string | null;
  role?: string | AuthenticatedRole | null;
  partnerId?: string | null;
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
