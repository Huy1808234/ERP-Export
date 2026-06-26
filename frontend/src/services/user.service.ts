import { sendRequest } from '@/lib/api-client';
import type {
  CreateUserPayload,
  RoleOption,
  UpdateUserPayload,
  UserListParams,
  UserListResponse,
  UserRow,
} from '@/types/user';

const getAuthHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const getUsers = async (
  accessToken: string,
  params: UserListParams,
): Promise<IBackendRes<UserListResponse>> => {
  return sendRequest<IBackendRes<UserListResponse>>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users`,
    method: 'GET',
    queryParams: {
      current: params.current,
      pageSize: params.pageSize,
      ...(params.search ? { search: params.search } : {}),
      ...(params.roleName ? { roleName: params.roleName } : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
    },
    headers: getAuthHeaders(accessToken),
  });
};

export const getUserRoles = async (
  accessToken: string,
): Promise<IBackendRes<RoleOption[]>> => {
  return sendRequest<IBackendRes<RoleOption[]>>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/roles`,
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
};

export const createUser = async (
  accessToken: string,
  payload: CreateUserPayload,
): Promise<IBackendRes<{ _id: string; username: string }>> => {
  return sendRequest<IBackendRes<{ _id: string; username: string }>>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users`,
    method: 'POST',
    body: { ...payload },
    headers: getAuthHeaders(accessToken),
  });
};

export const updateUser = async (
  accessToken: string,
  userRef: string,
  payload: UpdateUserPayload,
): Promise<IBackendRes<{ message: string; data?: UserRow }>> => {
  return sendRequest<IBackendRes<{ message: string; data?: UserRow }>>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/${userRef}`,
    method: 'PATCH',
    body: { ...payload },
    headers: getAuthHeaders(accessToken),
  });
};

export const deactivateUser = async (
  accessToken: string,
  userRef: string,
  reason: string,
): Promise<IBackendRes<{ message: string; data?: UserRow }>> => {
  return sendRequest<IBackendRes<{ message: string; data?: UserRow }>>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/${userRef}`,
    method: 'DELETE',
    body: { reason },
    headers: getAuthHeaders(accessToken),
  });
};

export const bulkDeactivateUsers = async (
  accessToken: string,
  userRefs: string[],
  reason: string,
): Promise<IBackendRes<{ deactivatedCount: number }>> => {
  return sendRequest<IBackendRes<{ deactivatedCount: number }>>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/bulk-deactivate`,
    method: 'POST',
    body: { userRefs, reason },
    headers: getAuthHeaders(accessToken),
  });
};
