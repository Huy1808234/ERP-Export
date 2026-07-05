import { Button, Empty, Space, Typography } from 'antd';
import { PaperClipOutlined, DownloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { CustomerCommercialDocument } from '@/types/customer-portal';

const { Text } = Typography;

type DocumentAttachmentsProps = {
  document: CustomerCommercialDocument;
};

export const DocumentAttachments = ({ document }: DocumentAttachmentsProps) => {
  const t = useTranslations('CustomerPortal');

  if (!document.attachments?.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('documentDetail.noAttachments')} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {document.attachments.map((file) => (
        <div
          key={file._id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            border: '1px solid rgba(148, 163, 184, 0.16)',
            borderRadius: 10,
            padding: '10px 12px',
            background: 'rgba(255, 255, 255, 0.03)',
          }}
        >
          <Space>
            <PaperClipOutlined style={{ color: 'rgba(148, 163, 184, 0.8)' }} />
            <Text>{file.fileName}</Text>
          </Space>
          {file.url && (
            <Button
              type="text"
              icon={<DownloadOutlined />}
              onClick={() => window.open(file.url as string, '_blank')}
            >
              {t('documentDetail.open')}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};
