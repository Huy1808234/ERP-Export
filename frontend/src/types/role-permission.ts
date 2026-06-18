export interface RolePermission {
  _id: string;
  name: string;
  apiPath: string;
  method: string;
  module: string;
}

export interface RoleWithPermissions {
  _id: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  permissions?: RolePermission[];
}

export interface RolePermissionAssignment {
  role_ref: string;
  permission_refs: string[];
}

export interface BulkRolePermissionAssignmentPayload {
  assignments: RolePermissionAssignment[];
}
