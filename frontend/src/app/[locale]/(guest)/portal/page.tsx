'use client'
import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Table, Tag, Button, Space, theme, Skeleton } from 'antd';
import { 
  ShoppingOutlined, 
  CreditCardOutlined, 
  ArrowRightOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WalletOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import PageBanner from '@/components/guest/PageBanner';
import { getAccessToken } from '@/lib/auth-token';

const { Title, Text, Paragraph } = Typography;

const PortalDashboard = () => {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const accessToken = getAccessToken(session);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/dashboards/portal/summary`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        const result = await res.json();
        setData(result.data);
      } catch (error) {
        console.error('Error fetching portal summary:', error);
      } finally {
        setLoading(false);
      }
    };

    if (accessToken) {
      fetchSummary();
    } else if (session === null) {
      setLoading(false);
    }
  }, [session, accessToken]);

  const { token } = theme.useToken();

  const recentOrders = data?.recentOrders || [];

  const columns = [
    {
      title: 'Mã hợp đồng',
      dataIndex: 'contractNumber',
      key: 'contractNumber',
      render: (text: string) => <Text strong style={{ color: '#1890ff' }}>{text}</Text>,
    },
    {
      title: 'Ngày đặt',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Tổng giá trị',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (val: number, record: any) => <Text strong>{val?.toLocaleString()} {record.currencyCode}</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'blue';
        if (status === 'SHIPPED') color = 'green';
        if (status === 'CONFIRMED') color = 'orange';
        return <Tag color={color} style={{ borderRadius: '4px', padding: '0 12px' }}>{status}</Tag>;
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      render: () => (
        <Button type="text" icon={<ArrowRightOutlined />} style={{ color: '#1890ff' }}>Chi tiết</Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: '100px', textAlign: 'center' }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 20px' }}>
      <div style={{ marginBottom: '40px' }}>
        <Title level={2} style={{ color: '#0f172a', fontWeight: 900, marginBottom: '8px' }}>
          Chào mừng bạn trở lại!
        </Title>
        <Text type="secondary" style={{ fontSize: '16px' }}>
          Dưới đây là tóm tắt hoạt động kinh doanh và trạng thái hàng hóa của bạn hôm nay.
        </Text>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: '48px' }}>
        <Col xs={24} sm={8}>
          <Card 
            variant="borderless" 
            style={{ 
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              background: '#fff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ 
                width: '56px', height: '56px', borderRadius: '16px', background: '#eff6ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <ClockCircleOutlined style={{ fontSize: '24px', color: '#3b82f6' }} />
              </div>
              <Statistic 
                title={<Text type="secondary" style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px' }}>ĐƠN HÀNG ĐANG CHỜ</Text>} 
                value={data?.pendingOrders || 0} 
                styles={{ content: { color: '#0f172a', fontWeight: 900, fontSize: '32px' } }}
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card 
            variant="borderless" 
            style={{ 
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              background: '#fff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ 
                width: '56px', height: '56px', borderRadius: '16px', background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <CheckCircleOutlined style={{ fontSize: '24px', color: '#22c55e' }} />
              </div>
              <Statistic 
                title={<Text type="secondary" style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px' }}>LÔ HÀNG ĐÃ GIAO</Text>} 
                value={data?.shippedOrders || 0} 
                styles={{ content: { color: '#0f172a', fontWeight: 900, fontSize: '32px' } }}
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card 
            variant="borderless" 
            style={{ 
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              background: '#fff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ 
                width: '56px', height: '56px', borderRadius: '16px', background: '#fff7ed',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <WalletOutlined style={{ fontSize: '24px', color: '#f59e0b' }} />
              </div>
              <Statistic 
                title={<Text type="secondary" style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px' }}>TỔNG CÔNG NỢ</Text>} 
                value={data?.totalDebt || 0} 
                prefix="$"
                styles={{ content: { color: '#0f172a', fontWeight: 900, fontSize: '32px' } }}
              />
            </div>
          </Card>
        </Col>
      </Row>

      <Card 
        variant="borderless" 
        style={{ 
          borderRadius: '8px', 
          padding: '12px', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          background: '#fff'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <Title level={4} style={{ margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <HistoryOutlined style={{ color: '#1890ff' }} /> Đơn hàng gần đây
          </Title>
          <Button type="link" style={{ fontWeight: 700 }}>Xem tất cả các đơn hàng</Button>
        </div>
        <Table 
          dataSource={recentOrders} 
          columns={columns} 
          pagination={false} 
          rowKey="id"
          className="premium-portal-table"
        />
      </Card>
    </div>
  );
};

export default PortalDashboard;
