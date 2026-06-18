import { useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getAccessToken } from '@/lib/auth-token';
import {
  getAllPermissions,
  getRolesWithPermissions,
  updateRolePermissionAssignments,
} from '@/services/role-permission.service';
import type {
  RolePermission,
  RolePermissionAssignment,
  RoleWithPermissions,
} from '@/types/role-permission';

interface RolePermissionActionResult {
  success: boolean;
  message?: string;
}

export const useRolePermissions = () => {
  const { data: session } = useSession();
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchRolePermissions = useCallback(async (): Promise<RolePermissionActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      return { success: false, message: 'Missing access token' };
    }

    setLoading(true);
    try {
      const [rolesRes, permissionsRes] = await Promise.all([
        getRolesWithPermissions(accessToken),
        getAllPermissions(accessToken),
      ]);

      if (!rolesRes?.data || !permissionsRes?.data) {
        return {
          success: false,
          message: rolesRes?.message || permissionsRes?.message || 'Unable to load role permissions',
        };
      }

      setRoles(rolesRes.data);
      setPermissions(permissionsRes.data);
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, [session]);

  const saveRolePermissions = useCallback(async (
    assignments: RolePermissionAssignment[],
  ): Promise<RolePermissionActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      return { success: false, message: 'Missing access token' };
    }

    setSaving(true);
    try {
      const res = await updateRolePermissionAssignments(accessToken, { assignments });
      if (!res?.data) {
        return { success: false, message: res?.message || 'Unable to save role permissions' };
      }

      setRoles(res.data);
      return { success: true };
    } finally {
      setSaving(false);
    }
  }, [session]);

  return {
    roles,
    permissions,
    loading,
    saving,
    fetchRolePermissions,
    saveRolePermissions,
  };
};
