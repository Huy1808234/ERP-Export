import { sendRequest } from '@/lib/api-client';
import type {
  BulkRolePermissionAssignmentPayload,
  RolePermission,
  RoleWithPermissions,
} from '@/types/role-permission';

const getAuthHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const getRolesWithPermissions = async (
  accessToken: string,
): Promise<IBackendRes<RoleWithPermissions[]>> => {
  return sendRequest<IBackendRes<RoleWithPermissions[]>>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/roles`,
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
};

export const getAllPermissions = async (
  accessToken: string,
): Promise<IBackendRes<RolePermission[]>> => {
  return sendRequest<IBackendRes<RolePermission[]>>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/roles/permissions/all`,
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
};

export const updateRolePermissionAssignments = async (
  accessToken: string,
  payload: BulkRolePermissionAssignmentPayload,
): Promise<IBackendRes<RoleWithPermissions[]>> => {
  return sendRequest<IBackendRes<RoleWithPermissions[]>>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/roles/permissions/bulk-assignment`,
    method: 'PATCH',
    body: { assignments: payload.assignments },
    headers: getAuthHeaders(accessToken),
  });
};
