'use client';

import { SafetyCertificateOutlined, TeamOutlined } from '@ant-design/icons';
import { Result, Tabs } from 'antd';
import type { TabsProps } from 'antd';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useRouter } from '@/i18n/routing';
import { canManageRolePermissions, canManageUsers, getAccessRoleName } from '@/lib/access-control';
import RolePermissionMatrix from './role-permission.matrix';
import UserTable from './user.table';

const UserManagementTabs = () => {
  const t = useTranslations('RolePermissions');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const roleName = getAccessRoleName(session?.user);
  const canOpenUsers = canManageUsers(roleName);
  const canOpenPermissions = canManageRolePermissions(roleName);
  const requestedKey = searchParams.get('tab') === 'permissions' ? 'permissions' : 'users';
  const activeKey = requestedKey === 'permissions' && canOpenPermissions
    ? 'permissions'
    : canOpenUsers
      ? 'users'
      : 'permissions';

  useEffect(() => {
    if (!canOpenUsers && canOpenPermissions && searchParams.get('tab') !== 'permissions') {
      router.replace({ pathname: '/dashboard/user', query: { tab: 'permissions' } });
    }
  }, [canOpenPermissions, canOpenUsers, router, searchParams]);

  const items = useMemo<TabsProps['items']>(() => {
    const visibleItems: NonNullable<TabsProps['items']> = [];

    if (canOpenUsers) {
      visibleItems.push({
        key: 'users',
        label: t('tabs.users'),
        icon: <TeamOutlined />,
        children: <UserTable />,
      });
    }

    if (canOpenPermissions) {
      visibleItems.push({
        key: 'permissions',
        label: t('tabs.permissions'),
        icon: <SafetyCertificateOutlined />,
        children: <RolePermissionMatrix />,
      });
    }

    return visibleItems;
  }, [canOpenPermissions, canOpenUsers, t]);

  const handleTabChange = (key: string) => {
    router.replace(
      key === 'permissions'
        ? { pathname: '/dashboard/user', query: { tab: 'permissions' } }
        : '/dashboard/user',
    );
  };

  if (!items?.length) {
    return (
      <Result
        status="403"
        title="Không có quyền truy cập"
        subTitle="Tài khoản của bạn chưa được cấp quyền vào trang quản trị người dùng."
      />
    );
  }

  return (
    <Tabs
      activeKey={activeKey}
      onChange={handleTabChange}
      items={items}
    />
  );
};

export default UserManagementTabs;
