'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Card,
  Col,
  Row,
  Space,
  Steps,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { GlobalOutlined } from '@ant-design/icons';

import { useCustomerPortalShipments } from '@/hooks/useCustomerPortal';
import { PageState, PortalShell } from '@/components/admin/portal/_shared/PortalShell';
import { formatDate, statusColor } from '@/components/admin/portal/_shared/helpers';
import type { PortalShipment } from '@/types/customer-portal';

export const ShipmentsPage = () => {
  const locale = useLocale();
  const t = useTranslations('CustomerPortal');
  const { shipments, loading, error, fetchShipments } = useCustomerPortalShipments();

  useEffect(() => {
    void fetchShipments();
  }, [fetchShipments]);

  const columns: ColumnsType<PortalShipment> = [
    { title: t('shipmentNumber'), dataIndex: 'shipmentNumber', render: (value: string | null | undefined, record) => value || record._id },
    { title: t('status'), dataIndex: 'status', render: (value: string | null | undefined) => <Tag color={statusColor(value)}>{value || '-'}</Tag> },
    { title: t('route'), render: (_value: unknown, record) => `${record.pol || '-'} -> ${record.pod || '-'}` },
    { title: t('blNumber'), dataIndex: 'blNumber', render: (value: string | null | undefined) => value || '-' },
    { title: t('eta'), dataIndex: 'eta', render: (value: string | null | undefined) => formatDate(value, locale) },
  ];

  return (
    <PortalShell title={t('shipmentsTitle')} subtitle={t('shipmentsSubtitle')} icon={<GlobalOutlined />}>
      <PageState loading={loading} error={error} empty={shipments.length === 0} onRetry={() => void fetchShipments()}>
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Card variant="borderless">
            <Table rowKey="_id" columns={columns} dataSource={shipments} pagination={{ pageSize: 8 }} />
          </Card>
          <Row gutter={[16, 16]}>
            {shipments.map((shipment) => (
              <Col xs={24} xl={12} key={shipment._id}>
                <Card
                  title={shipment.shipmentNumber || shipment._id}
                  extra={<Tag color={statusColor(shipment.status)}>{shipment.status || '-'}</Tag>}
                  variant="borderless"
                >
                  <Steps
                    orientation="vertical"
                    size="small"
                    items={(shipment.timeline || []).map((item) => ({
                      title: item.label,
                      content: formatDate(item.date, locale),
                      status: item.state,
                    }))}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </Space>
      </PageState>
    </PortalShell>
  );
};