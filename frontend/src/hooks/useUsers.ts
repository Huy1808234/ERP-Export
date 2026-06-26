import { useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getAccessToken } from '@/lib/auth-token';
import {
  bulkDeactivateUsers,
  createUser,
  deactivateUser,
  getUserRoles,
  getUsers,
  updateUser,
} from '@/services/user.service';
import type {
  CreateUserPayload,
  RoleOption,
  UpdateUserPayload,
  UserListParams,
  UserRow,
  UserSummary,
} from '@/types/user';

interface UserActionResult {
  success: boolean;
  message?: string;
}

const emptySummary: UserSummary = {
  total: 0,
  active: 0,
  admin: 0,
};

export const useUsers = () => {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [summary, setSummary] = useState<UserSummary>(emptySummary);
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    current: 1,
    pageSize: 10,
    pages: 0,
    total: 0,
  });

  const requireAccessToken = useCallback((): string | null => {
    return getAccessToken(session) ?? null;
  }, [session]);

  const fetchUsers = useCallback(async (params: UserListParams): Promise<UserActionResult> => {
    const accessToken = requireAccessToken();
    if (!accessToken) {
      const message = 'Missing access token';
      setError(message);
      return { success: false, message };
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getUsers(accessToken, params);
      if (!res?.data) {
        const message = res?.message || 'Unable to load users';
        setError(message);
        return { success: false, message };
      }

      setUsers(res.data.results ?? []);
      setSummary(res.data.summary ?? emptySummary);
      setMeta({
        current: params.current,
        pageSize: params.pageSize,
        pages: res.data.totalPages,
        total: res.data.totalItems,
      });
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, [requireAccessToken]);

  const fetchRoles = useCallback(async (): Promise<UserActionResult> => {
    const accessToken = requireAccessToken();
    if (!accessToken) {
      return { success: false, message: 'Missing access token' };
    }

    setRolesLoading(true);
    try {
      const res = await getUserRoles(accessToken);
      if (!res?.data) {
        return { success: false, message: res?.message || 'Unable to load roles' };
      }

      setRoles(res.data);
      return { success: true };
    } finally {
      setRolesLoading(false);
    }
  }, [requireAccessToken]);

  const addUser = useCallback(async (payload: CreateUserPayload): Promise<UserActionResult> => {
    const accessToken = requireAccessToken();
    if (!accessToken) {
      return { success: false, message: 'Missing access token' };
    }

    setSubmitting(true);
    try {
      const res = await createUser(accessToken, payload);
      if (!res?.data) {
        return { success: false, message: res?.message || 'Unable to create user' };
      }
      return { success: true, message: res.message };
    } finally {
      setSubmitting(false);
    }
  }, [requireAccessToken]);

  const editUser = useCallback(async (
    userRef: string,
    payload: UpdateUserPayload,
  ): Promise<UserActionResult> => {
    const accessToken = requireAccessToken();
    if (!accessToken) {
      return { success: false, message: 'Missing access token' };
    }

    setSubmitting(true);
    try {
      const res = await updateUser(accessToken, userRef, payload);
      if (!res?.data) {
        return { success: false, message: res?.message || 'Unable to update user' };
      }
      return { success: true, message: res.message };
    } finally {
      setSubmitting(false);
    }
  }, [requireAccessToken]);

  const deactivate = useCallback(async (
    userRef: string,
    reason: string,
  ): Promise<UserActionResult> => {
    const accessToken = requireAccessToken();
    if (!accessToken) {
      return { success: false, message: 'Missing access token' };
    }

    setSubmitting(true);
    try {
      const res = await deactivateUser(accessToken, userRef, reason);
      if (!res?.data) {
        return { success: false, message: res?.message || 'Unable to deactivate user' };
      }
      return { success: true, message: res.message };
    } finally {
      setSubmitting(false);
    }
  }, [requireAccessToken]);

  const bulkDeactivate = useCallback(async (
    userRefs: string[],
    reason: string,
  ): Promise<UserActionResult> => {
    const accessToken = requireAccessToken();
    if (!accessToken) {
      return { success: false, message: 'Missing access token' };
    }

    setSubmitting(true);
    try {
      const res = await bulkDeactivateUsers(accessToken, userRefs, reason);
      if (!res?.data) {
        return { success: false, message: res?.message || 'Unable to deactivate users' };
      }
      return { success: true, message: res.message };
    } finally {
      setSubmitting(false);
    }
  }, [requireAccessToken]);

  return {
    users,
    roles,
    summary,
    meta,
    loading,
    rolesLoading,
    submitting,
    error,
    fetchUsers,
    fetchRoles,
    addUser,
    editUser,
    deactivate,
    bulkDeactivate,
  };
};
