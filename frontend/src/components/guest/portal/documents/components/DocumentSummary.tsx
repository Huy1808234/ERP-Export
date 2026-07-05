import { type CSSProperties, type ReactNode } from 'react';
import { Space, Typography, Tag, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslations, useFormatter } from 'next-intl';
import { formatDate, formatMoney } from '../document.formatters';
import type { CustomerCommercialDocument } from '@/types/customer-portal';
import { useTheme } from '@/context/theme.context';

const { Text } = Typography;

const getSummaryPanelStyle = (isDark: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  alignItems: 'center',
  gap: 16,
  border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0.26)'}`,
  borderRadius: 12,
  padding: 20,
  background: isDark 
    ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.25), rgba(14, 165, 233, 0.12))'
    : 'linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(14, 165, 233, 0.08))',
});

const getDetailItemStyle = (isDark: boolean): CSSProperties => ({
  minHeight: 82,
  border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.18)'}`,
  borderRadius: 10,
  padding: '12px 14px',
  background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.5)',
});

const DetailItem = ({
  label,
  value,
  strong,
  isDark,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  isDark?: boolean;
}) => (
  <div style={getDetailItemStyle(isDark || false)}>
    <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
      {label}
    </Text>
    {strong ? <Text strong>{value}</Text> : <Text>{value}</Text>}
  </div>
);

type DocumentSummaryProps = {
  document: CustomerCommercialDocument;
};

export const DocumentSummary = ({ document }: DocumentSummaryProps) => {
  const t = useTranslations('CustomerPortal');
  const format = useFormatter();
  const { isDark } = useTheme();

  return (
    <div style={getSummaryPanelStyle(isDark)}>
      <Space orientation="vertical" size={2}>
        <Text type="secondary">{t('documentDetail.documentDate')}</Text>
        <Text strong style={{ fontSize: 16 }}>{formatDate(document.documentDate, format)}</Text>
      </Space>
      
      <Space orientation="vertical" size={2}>
        <Space size={4}>
          <Text type="secondary">{t('documentDetail.expiry')}</Text>
          <Tooltip title={t('documentDetail.expiry')}>
            <InfoCircleOutlined style={{ color: 'rgba(148, 163, 184, 0.8)' }} />
          </Tooltip>
        </Space>
        {document.expiryDate ? (
          <Text strong style={{ fontSize: 16 }}>{formatDate(document.expiryDate, format)}</Text>
        ) : (
          <Text type="secondary">-</Text>
        )}
      </Space>

      <Space orientation="vertical" size={2}>
        <Text type="secondary">{t('documentDetail.currency')}</Text>
        <Text strong style={{ fontSize: 16 }}>{document.currency}</Text>
      </Space>
      
      {document.paymentTerms && (
        <Space orientation="vertical" size={2}>
          <Text type="secondary">{t('documentDetail.paymentTerms')}</Text>
          <Text strong style={{ fontSize: 16 }}>{document.paymentTerms}</Text>
        </Space>
      )}

      {document.totalAmount > 0 && (
        <Space orientation="vertical" size={2}>
          <Text type="secondary">{t('documentDetail.totalValue')}</Text>
          <Space align="baseline" size={8}>
            <Text strong style={{ fontSize: 20, color: isDark ? '#60a5fa' : '#2563eb' }}>
              {formatMoney(document.totalAmount, document.currency, format)}
            </Text>
            {document.currency !== 'VND' && (document.totalAmountVnd || 0) > 0 && (
              <Text type="secondary" style={{ fontSize: 13 }}>
                ≈ {formatMoney(document.totalAmountVnd || 0, 'VND', format)}
              </Text>
            )}
          </Space>
        </Space>
      )}
    </div>
  );
};

export const DocumentTerms = ({ document }: DocumentSummaryProps) => {
  const t = useTranslations('CustomerPortal');
  const format = useFormatter();
  const { isDark } = useTheme();

  const detailGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
  };

  return (
    <>
      <div style={detailGridStyle}>
        <DetailItem
          isDark={isDark}
          label={t('documentDetail.buyerName')}
          value={document.buyerName || '-'}
          strong
        />
        <DetailItem
          isDark={isDark}
          label={t('documentDetail.buyerCountry')}
          value={document.buyerCountry || '-'}
        />
        <DetailItem
          isDark={isDark}
          label={t('documentDetail.deliveryDate')}
          value={formatDate(document.deliveryDate, format)}
        />
      </div>

      <div style={detailGridStyle}>
        <DetailItem
          isDark={isDark}
          label={t('documentDetail.paymentTerms')}
          value={document.paymentTerms || '-'}
        />
        <DetailItem
          isDark={isDark}
          label="Incoterm"
          value={document.incoterm ? <Tag color="blue">{document.incoterm}</Tag> : '-'}
        />
        {document.notes && (
          <DetailItem
            isDark={isDark}
            label={t('documentDetail.notes')}
            value={<Text style={{ whiteSpace: 'pre-wrap' }}>{document.notes}</Text>}
          />
        )}
      </div>
    </>
  );
};
