import React from 'react';
import { Card, Col, Row, Space, Tag, Typography, Badge } from 'antd';
import { ContainerOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { PortalShipment } from '@/types/shipment.type';
import ShipmentTimeline from './ShipmentTimeline';

const { Title, Text } = Typography;

const statusColor: Record<string, string> = {
  BOOKED: 'blue',
  LOADING: 'processing',
  CUSTOMS_CLEARED: 'purple',
  ON_BOARD: 'cyan',
  ARRIVED: 'green',
  CLOSED: 'green',
};

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : '-';

interface ShipmentCardProps {
  shipment: PortalShipment;
}

export default function ShipmentCard({ shipment }: ShipmentCardProps) {
  const t = useTranslations('PortalShipments');

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -4, boxShadow: '0 10px 25px rgba(24, 144, 255, 0.2)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{ marginBottom: 24, borderRadius: 16 }}
    >
      <Card
        variant="borderless"
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          borderLeft: `6px solid #1890ff`,
          background: '#111827', // Adjust for dark mode as per screenshot
          color: '#e5e7eb',
        }}
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Space size="large" wrap style={{ marginBottom: 24 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, color: '#9ca3af' }}>{t('label_shipment_number')}</Text>
                <Title level={4} style={{ margin: 0, color: '#f3f4f6' }}>{shipment.shipmentNumber}</Title>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, color: '#9ca3af' }}>{t('label_contract')}</Text>
                <Title level={4} style={{ margin: 0, color: '#f3f4f6' }}>{shipment.salesContract?.contractNumber || '-'}</Title>
              </div>
              <Tag color={statusColor[shipment.status] || 'default'} style={{ borderRadius: 12, padding: '4px 12px', border: 'none', boxShadow: `0 0 10px ${statusColor[shipment.status] === 'green' ? 'rgba(82, 196, 26, 0.5)' : 'rgba(24, 144, 255, 0.5)'}` }}>
                {shipment.status}
              </Tag>
            </Space>

            <ShipmentTimeline timeline={shipment.timeline} />
          </Col>

          <Col xs={24} lg={8}>
            <Card
              style={{ background: '#1f2937', borderRadius: 12, borderColor: '#374151' }}
              variant="borderless"
              title={<Space style={{ color: '#60a5fa' }}><InfoCircleOutlined /> {t('title_transport_details')}</Space>}
            >
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Text type="secondary" style={{ color: '#9ca3af' }}>{t('label_route')}</Text>
                  <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{shipment.pol || '?'} → {shipment.pod || '?'}</div>
                </div>
                <div>
                  <Text type="secondary" style={{ color: '#9ca3af' }}>{t('label_vessel')}</Text>
                  <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{shipment.vesselName || '-'} {shipment.voyageNumber || ''}</div>
                </div>
                <div>
                  <Text type="secondary" style={{ color: '#9ca3af' }}>{t('label_etd_eta')}</Text>
                  <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{formatDate(shipment.etd)} / {formatDate(shipment.eta)}</div>
                </div>
                <div>
                  <Text type="secondary" style={{ color: '#9ca3af' }}>{t('label_booking_bl')}</Text>
                  <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{shipment.bookingNumber || '-'} / {shipment.blNumber || '-'}</div>
                </div>
                <Badge status="processing" text={<span style={{ color: '#9ca3af' }}>{t('badge_sync')}</span>} />
              </Space>
            </Card>

            <Card
              style={{ marginTop: 16, background: '#1f2937', borderRadius: 12, borderColor: '#374151' }}
              variant="borderless"
              title={<Space style={{ color: '#34d399' }}><ContainerOutlined /> {t('title_container')}</Space>}
            >
              <Space orientation="vertical" style={{ width: '100%' }}>
                {(shipment.containers || []).length === 0 ? <Text type="secondary" style={{ color: '#9ca3af' }}>{t('empty_container')}</Text> : null}
                {(shipment.containers || []).map((container) => (
                  <div key={container._id}>
                    <Text strong style={{ color: '#f3f4f6' }}>{container.containerNumber || container.type}</Text>
                    <div>
                      <Text type="secondary" style={{ color: '#9ca3af' }}>
                        Seal {container.sealNumber || '-'} · {container.type} · {Number(container.cbm || 0).toLocaleString()} CBM
                      </Text>
                    </div>
                  </div>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>
    </motion.div>
  );
}
