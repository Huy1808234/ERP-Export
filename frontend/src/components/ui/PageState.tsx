import React from 'react';
import { Alert, Button, Empty, Skeleton } from 'antd';
import { useLocale } from 'next-intl';

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
  const locale = useLocale();
  
  const isVietnamese = locale === 'vi';
  const retryText = isVietnamese ? 'Tải lại' : 'Retry';
  const emptyText = isVietnamese ? 'Chưa có dữ liệu phù hợp cho tài khoản này.' : 'No matching data for this account yet.';

  if (loading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        title={error}
        action={<Button onClick={onRetry}>{retryText}</Button>}
      />
    );
  }

  if (empty) {
    return <Empty description={emptyText} />;
  }

  return <>{children}</>;
};
