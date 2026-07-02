import React from 'react';
import { Alert, Button, Empty, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('Common');
  
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
    return <Empty description={t('emptyAccountData')} />;
  }

  return <>{children}</>;
};
