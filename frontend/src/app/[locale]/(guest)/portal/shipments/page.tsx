'use client'
import React from 'react';
import { Timeline, Card, Typography, Tag, Row, Col, Space, Badge, Steps, theme } from 'antd';
import { 
  GlobalOutlined, 
  ContainerOutlined, 
  RocketOutlined, 
  HomeOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import PageBanner from '@/components/guest/PageBanner';

const { Title, Text } = Typography;

const ShipmentTracking = () => {
  const { token } = theme.useToken();

  const shipments = [
    {
      id: 'SHP-00129',
      contract: 'SC-2024-001',
      etd: '2024-05-01',
      eta: '2024-05-25',
      status: 'IN_TRANSIT',
      currentLocation: 'South China Sea',
      vessel: 'MAERSK ALABAMA',
      events: [
        { title: 'Giao hàng thành công', date: '2024-05-25 (Dự kiến)', status: 'wait' },
        { title: 'Đang trên tàu', date: '2024-05-05', status: 'process', icon: <RocketOutlined /> },
        { title: 'Thông quan xuất khẩu', date: '2024-05-03', status: 'finish' },
        { title: 'Đã đóng container', date: '2024-05-02', status: 'finish', icon: <ContainerOutlined /> },
        { title: 'Đã xuất kho', date: '2024-05-01', status: 'finish' },
      ]
    }
  ];

  return (
    <div>
      <div style={{ margin: '-40px -40px 32px -40px', overflow: 'hidden', borderRadius: '24px 24px 0 0' }}>
        <PageBanner 
          title="Theo dõi lô hàng"
          subtitle="Cập nhật trạng thái thời gian thực cho các lô hàng đang vận chuyển."
          height="200px"
          breadcrumbs={[{ title: 'Portal', href: '/portal' }, { title: 'Lô hàng' }]}
        />
      </div>

      {shipments.map(shp => (
        <Card 
          key={shp.id}
          bordered={false}
          style={{ 
            marginBottom: '24px', 
            borderRadius: '16px', 
            boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
            borderLeft: `6px solid ${token.colorPrimary}`
          }}
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <div style={{ marginBottom: '24px' }}>
                <Space size="large">
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>MÃ LÔ HÀNG</Text>
                    <Title level={4} style={{ margin: 0 }}>{shp.id}</Title>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>HỢP ĐỒNG</Text>
                    <Title level={4} style={{ margin: 0 }}>{shp.contract}</Title>
                  </div>
                  <Tag color="blue" style={{ borderRadius: '12px', padding: '4px 12px' }}>{shp.status}</Tag>
                </Space>
              </div>

              <div style={{ padding: '24px 0' }}>
                <Steps
                  orientation="vertical"
                  current={1}
                  items={shp.events.map(ev => ({
                    title: <Text strong>{ev.title}</Text>,
                    description: ev.date,
                    status: ev.status as any,
                    icon: ev.icon
                  }))}
                />
              </div>
            </Col>
            
            <Col xs={24} lg={8}>
              <Card 
                style={{ background: '#f8fafc', borderRadius: '12px' }} 
                bordered={false}
                title={<Space><InfoCircleOutlined /> Chi tiết vận tải</Space>}
              >
                <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                  <div>
                    <Text type="secondary">Tàu vận chuyển:</Text>
                    <div style={{ fontWeight: 600 }}>{shp.vessel}</div>
                  </div>
                  <div>
                    <Text type="secondary">Vị trí hiện tại:</Text>
                    <div style={{ fontWeight: 600 }}>{shp.currentLocation}</div>
                  </div>
                  <div>
                    <Text type="secondary">Dự kiến đến (ETA):</Text>
                    <div style={{ fontWeight: 600, color: token.colorSuccess }}>{shp.eta}</div>
                  </div>
                  <div style={{ marginTop: '16px' }}>
                    <Badge status="processing" text="Hành trình đang đúng tiến độ" />
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </Card>
      ))}
    </div>
  );
};

export default ShipmentTracking;
