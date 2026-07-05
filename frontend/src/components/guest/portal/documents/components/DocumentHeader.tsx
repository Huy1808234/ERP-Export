import { Space, Tag, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { statusColor } from '../document.constants';
import type { CustomerCommercialDocument } from '@/types/customer-portal';

const { Text } = Typography;

type DocumentHeaderProps = {
  document: CustomerCommercialDocument | null;
};

export const DocumentHeader = ({ document }: DocumentHeaderProps) => {
  const t = useTranslations('CustomerPortal');

  if (!document) {
    return <>{t('documentDetail.commercialDocument')}</>;
  }

  const statusLabel = document.isExpired
    ? t('ordersTable.expired')
    : t(`documentStatuses.${document.status}`) || document.status;

  const lifecycleLabel = t(`lifecycleStages.${document.lifecycleStage}`) || document.lifecycleStage;
  const shouldShowLifecycle = Boolean(lifecycleLabel && lifecycleLabel !== statusLabel);

  return (
    <Space orientation="vertical" size={4}>
      <Space size={8} wrap>
        <FileTextOutlined />
        <Text strong>{document.documentNumber}</Text>
        <Tag color={document.isExpired ? 'error' : statusColor(document.status)}>
          {statusLabel}
        </Tag>
        {shouldShowLifecycle ? <Tag>{lifecycleLabel}</Tag> : null}
      </Space>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t(`documentTypes.${document.documentType}`)}
      </Text>
    </Space>
  );
};
