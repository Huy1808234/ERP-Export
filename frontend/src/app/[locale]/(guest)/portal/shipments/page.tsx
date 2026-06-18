'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Badge, Button, Card, Col, Empty, Input, Row, Space, Steps, Tag, Typography, theme } from 'antd';
import { ContainerOutlined, InfoCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import PageBanner from '@/components/guest/PageBanner';
import { getAccessToken } from '@/lib/auth-token';
import { sendRequest } from '@/lib/api-client';

const { Title, Text } = Typography;

type PortalShipmentTimeline = {
  status: string;
  label: string;
  state: 'finish' | 'process' | 'wait';
  date?: string | null;
};

type PortalShipment = {
  _id: string;
  shipmentNumber: string;
  status: string;
  bookingNumber?: string | null;
  shippingLine?: string | null;
  vesselName?: string | null;
  voyageNumber?: string | null;
  pol?: string | null;
  pod?: string | null;
  etd?: string | null;
  eta?: string | null;
  blNumber?: string | null;
  containers?: Array<{
    _id: string;
    containerNumber?: string | null;
    sealNumber?: string | null;
    type: string;
    weightKg: number;
    cbm: number;
  }>;
  salesContract?: {
    _id: string;
    contractNumber: string;
    status: string;
  } | null;
  timeline: PortalShipmentTimeline[];
};

const statusColor: Record<string, string> = {
  BOOKED: 'blue',
  LOADING: 'processing',
  CUSTOMS_CLEARED: 'purple',
  ON_BOARD: 'cyan',
  ARRIVED: 'green',
  CLOSED: 'green',
};

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : '-';

export default function ShipmentTracking() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const [shipments, setShipments] = useState<PortalShipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchShipments = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<PortalShipment[]>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/shipments`,
        method: 'GET',
        headers,
      });
      setShipments(res?.data || []);
    } catch {
      message.error('Không tải được danh sách lô hàng');
    } finally {
      setLoading(false);
    }
  }, [headers, message]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const filteredShipments = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return shipments;
    return shipments.filter((shipment) => (
      shipment.shipmentNumber.toLowerCase().includes(keyword)
      || shipment.status.toLowerCase().includes(keyword)
      || shipment.salesContract?.contractNumber?.toLowerCase().includes(keyword)
      || shipment.bookingNumber?.toLowerCase().includes(keyword)
      || shipment.blNumber?.toLowerCase().includes(keyword)
    ));
  }, [shipments, search]);

  return (
    <div>
      <div style={{ margin: '-40px -40px 32px -40px', overflow: 'hidden', borderRadius: '24px 24px 0 0' }}>
        <PageBanner
          title="Theo dõi lô hàng"
          subtitle="Timeline vận tải, container, ETD/ETA và trạng thái shipment được lọc theo tài khoản buyer."
          height="200px"
          breadcrumbs={[{ title: 'Portal', href: '/portal' }, { title: 'Lô hàng' }]}
        >
          <Space style={{ marginTop: 20 }} wrap>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              prefix={<SearchOutlined />}
              placeholder="Tìm shipment, contract, booking, B/L..."
              style={{ width: 360, height: 44, borderRadius: 12 }}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchShipments} loading={loading}>
              Làm mới
            </Button>
          </Space>
        </PageBanner>
      </div>

      <Space orientation="vertical" size={20} style={{ width: '100%' }}>
        {filteredShipments.length === 0 ? (
          <Card loading={loading} variant="borderless">
            <Empty description="Chưa có lô hàng nào được gắn với tài khoản buyer này" />
          </Card>
        ) : null}

        {filteredShipments.map((shipment) => (
          <Card
            key={shipment._id}
            loading={loading}
            variant="borderless"
            style={{
              marginBottom: 24,
              borderRadius: 16,
              boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
              borderLeft: `6px solid ${token.colorPrimary}`,
            }}
          >
            <Row gutter={[24, 24]}>
              <Col xs={24} lg={16}>
                <Space size="large" wrap style={{ marginBottom: 24 }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>MÃ LÔ HÀNG</Text>
                    <Title level={4} style={{ margin: 0 }}>{shipment.shipmentNumber}</Title>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>HỢP ĐỒNG</Text>
                    <Title level={4} style={{ margin: 0 }}>{shipment.salesContract?.contractNumber || '-'}</Title>
                  </div>
                  <Tag color={statusColor[shipment.status] || 'default'} style={{ borderRadius: 12, padding: '4px 12px' }}>
                    {shipment.status}
                  </Tag>
                </Space>

                <Steps
                  orientation="vertical"
                  current={shipment.timeline.findIndex((item) => item.state === 'process')}
                  items={shipment.timeline.map((event) => ({
                    title: <Text strong>{event.label}</Text>,
                    description: event.date ? formatDate(event.date) : event.status,
                    status: event.state,
                  }))}
                />
              </Col>

              <Col xs={24} lg={8}>
                <Card
                  style={{ background: '#f8fafc', borderRadius: 12 }}
                  variant="borderless"
                  title={<Space><InfoCircleOutlined /> Chi tiết vận tải</Space>}
                >
                  <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                    <div>
                      <Text type="secondary">Tuyến:</Text>
                      <div style={{ fontWeight: 600 }}>{shipment.pol || '?'} → {shipment.pod || '?'}</div>
                    </div>
                    <div>
                      <Text type="secondary">Tàu/chuyến:</Text>
                      <div style={{ fontWeight: 600 }}>{shipment.vesselName || '-'} {shipment.voyageNumber || ''}</div>
                    </div>
                    <div>
                      <Text type="secondary">ETD / ETA:</Text>
                      <div style={{ fontWeight: 600 }}>{formatDate(shipment.etd)} / {formatDate(shipment.eta)}</div>
                    </div>
                    <div>
                      <Text type="secondary">Booking / B/L:</Text>
                      <div style={{ fontWeight: 600 }}>{shipment.bookingNumber || '-'} / {shipment.blNumber || '-'}</div>
                    </div>
                    <Badge status="processing" text="Đồng bộ từ shipment admin" />
                  </Space>
                </Card>

                <Card
                  style={{ marginTop: 16, background: '#fff', borderRadius: 12 }}
                  variant="borderless"
                  title={<Space><ContainerOutlined /> Container</Space>}
                >
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    {(shipment.containers || []).length === 0 ? <Text type="secondary">Chưa có container</Text> : null}
                    {(shipment.containers || []).map((container) => (
                      <div key={container._id}>
                        <Text strong>{container.containerNumber || container.type}</Text>
                        <div>
                          <Text type="secondary">
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
        ))}
      </Space>
    </div>
  );
}
