'use client';

import { Alert, Button, Empty, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import type React from 'react';

import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';

export const PortalShell = ({
  title,
  subtitle,
  icon,
  extra,
  fullWidth = true,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  extra?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}) => (
  <AdminPageScroll>
    <PageHeader title={title} description={subtitle} icon={icon} extra={extra} />
    <div style={{ width: '100%', maxWidth: fullWidth ? '100%' : 1440, margin: fullWidth ? 0 : '0 auto' }}>
      {children}
    </div>
  </AdminPageScroll>
);

export const PageState = ({
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}) => {
  const t = useTranslations('CustomerPortal');

  if (loading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        title={error}
        action={<Button onClick={onRetry}>{t('retry')}</Button>}
      />
    );
  }

  if (empty) {
    return <Empty description={t('empty')} />;
  }

  return <>{children}</>;
};