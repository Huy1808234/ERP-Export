import { Space, Typography, Tag, Empty } from 'antd';
import { useTranslations, useFormatter } from 'next-intl';
import { formatDate } from '../document.formatters';
import type { CustomerAuditLogItem } from '@/types/customer-portal';

const { Text } = Typography;

const listPanelStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 10,
};

const listRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  border: '1px solid rgba(148, 163, 184, 0.16)',
  borderRadius: 10,
  padding: '10px 12px',
  background: 'rgba(255, 255, 255, 0.03)',
};

type DocumentAuditLogsProps = {
  auditLogs: CustomerAuditLogItem[];
};

export const DocumentAuditLogs = ({ auditLogs }: DocumentAuditLogsProps) => {
  const t = useTranslations('CustomerPortal');
  const format = useFormatter();

  if (!auditLogs || auditLogs.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('documentDetail.noAuditLogs')} />;
  }

  return (
    <div style={listPanelStyle}>
      {auditLogs.map((item) => (
        <div key={item._id} style={listRowStyle}>
          <Space orientation="vertical" size={2}>
            <Space size={8} wrap>
              <Tag>{item.action}</Tag>
              <Text>{item.username || t('documentDetail.system')}</Text>
            </Space>
            <Text type="secondary">{formatDate(item.createdAt, format, 'dateTime')}</Text>
          </Space>
        </div>
      ))}
    </div>
  );
};
