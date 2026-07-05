import { Timeline, Typography, Tag, Space, Empty } from 'antd';
import { useTranslations, useFormatter } from 'next-intl';
import { CheckCircleOutlined, ClockCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { formatDate } from '../document.formatters';
import type { CustomerTimelineItem } from '@/types/customer-portal';

const { Text } = Typography;

type DocumentTimelineProps = {
  timeline: CustomerTimelineItem[];
};

export const DocumentTimeline = ({ timeline }: DocumentTimelineProps) => {
  const t = useTranslations('CustomerPortal');
  const format = useFormatter();

  if (!timeline || timeline.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Timeline
      mode="left"
      items={timeline.map((item, index) => {
        let color = 'gray';
        let icon = <ClockCircleOutlined />;
        if (item.status === 'finish') {
          color = 'green';
          icon = <CheckCircleOutlined />;
        } else if (item.status === 'process') {
          color = 'blue';
          icon = <SyncOutlined spin />;
        }

        const isLast = index === timeline.length - 1;

        // Try mapping the label via the locale, default to string if not found
        // Since we are moving to enums but timeline items might still be text,
        // we use a try-fallback mechanism or map via translation keys if they exist.
        // E.g., 'Quotation issued' -> 'documentDetail.timelineLabels.quotationIssued'
        // For now, we assume the backend returns generic English texts.
        // We'll rely on our translation map.
        const timelineLabelsMap: Record<string, string> = {
          Quotation: t('lifecycleStages.Quotation'),
          'Quotation issued': t('documentDetail.timelineLabels.quotationIssued'),
          'Sales Contract': t('lifecycleStages.Sales Contract'),
          'Proforma Invoice': t('lifecycleStages.Proforma Invoice'),
          Payment: t('lifecycleStages.Payment'),
          Shipment: t('lifecycleStages.Shipment'),
          Completed: t('lifecycleStages.Completed'),
        };

        const timelineDescriptionsMap: Record<string, string> = {
          'Payment received': t('documentDetail.timelineDescriptions.paymentReceived'),
        };

        const label = timelineLabelsMap[item.label] || item.label;
        const desc = item.description ? timelineDescriptionsMap[item.description] || item.description : undefined;

        return {
          color,
          dot: icon,
          children: (
            <div style={{ marginBottom: isLast ? 0 : 24 }}>
              <Space orientation="vertical" size={2}>
                <Text strong={item.status === 'process'}>{label}</Text>
                {item.date && (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {formatDate(item.date, format)}
                  </Text>
                )}
                {desc && (
                  <Tag style={{ marginTop: 4 }}>{desc}</Tag>
                )}
              </Space>
            </div>
          ),
        };
      })}
    />
  );
};
