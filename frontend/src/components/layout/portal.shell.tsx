import React from 'react';
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
  