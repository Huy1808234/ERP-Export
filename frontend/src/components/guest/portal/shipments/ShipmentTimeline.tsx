import React from 'react';
import { Steps, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { PortalShipmentTimeline } from '@/types/shipment.type';

const { Text } = Typography;

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : '-';

interface ShipmentTimelineProps {
  timeline: PortalShipmentTimeline[];
}

export default function ShipmentTimeline({ timeline }: ShipmentTimelineProps) {
  const t = useTranslations('PortalShipments');
  const currentIndex = timeline.findIndex((item) => item.state === 'process');
  // If no process is found, and last is finish, set to end. Otherwise -1.
  const current = currentIndex >= 0 ? currentIndex : (timeline[timeline.length - 1]?.state === 'finish' ? timeline.length : -1);

  return (
    <div style={{ marginTop: 24, padding: 24, background: '#1f2937', borderRadius: 12, border: '1px solid #374151' }}>
      <Typography.Title level={5} style={{ color: '#e5e7eb', marginBottom: 24 }}>{t('title_timeline')}</Typography.Title>
      <Steps
        progressDot
        current={current}
        items={timeline.map((event) => ({
          title: <Text strong style={{ color: event.state === 'finish' || event.state === 'process' ? '#60a5fa' : '#9ca3af' }}>{event.label}</Text>,
          description: (
            <div style={{ color: '#9ca3af', fontSize: 12 }}>
              {event.date ? formatDate(event.date) : event.status}
            </div>
          ),
          status: event.state,
        }))}
      />
    </div>
  );
}
