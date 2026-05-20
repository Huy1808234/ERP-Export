'use client'
import React, { useState } from 'react';
import { Table, Tag, Button, Typography, Space, Modal, Steps, message, theme, Input, Divider } from 'antd';
import {
  FilePdfOutlined,
  EditOutlined,
  EyeOutlined,
  SearchOutlined,
  FilterOutlined
} from '@ant-design/icons';
import PageBanner from '@/components/guest/PageBanner';

const { Title, Text, Paragraph } = Typography;

const OrdersPortal = () => {
  const { token } = theme.useToken();
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);

  const orders = [
    {
      key: '1',
      id: 'SC-2024-001',
      date: '2024-05-10',
      total: '$12,500',
      status: 'SHIPPED',
      type: 'Sales Contract',
      signed: true,
    },
    {
      key: '2',
      id: 'PI-2024-088',
      date: '2024-05-12',
      total: '$8,200',
      status: 'PENDING_SIGN',
      type: 'Proforma Invoice',
      signed: false,
    },
    {
      key: '3',
      id: 'SC-2024-005',
      date: '2024-05-15',
      total: '$15,000',
      status: 'PROCESSING',
      type: 'Sales Contract',
      signed: true,
    },
  ];

  const handleSign = (order: any) => {
    setCurrentOrder(order);
    setIsSignModalOpen(true);
  };

  const confirmSign = () => {
    message.success(`Bạn đã ký điện tử thành công cho ${currentOrder.id}. Bản hợp đồng chính thức đã được gửi tới email của bạn.`);
    setIsSignModalOpen(false);
  };

  const columns = [
    {
      title: 'Số văn bản',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => <Text strong style={{ color: '#1890ff' }}>{text}</Text>,
    },
    {
      title: 'Loại tài liệu',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => <Tag style={{ borderRadius: '4px' }}>{text}</Tag>,
    },
    {
      title: 'Ngày phát hành',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Tổng giá trị',
      dataIndex: 'total',
      key: 'total',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'PENDING_SIGN' ? 'orange' : status === 'SHIPPED' ? 'green' : 'blue'} style={{ borderRadius: '4px', padding: '0 12px' }}>
          {status === 'PENDING_SIGN' ? 'CHỜ KÝ' : status === 'SHIPPED' ? 'HOÀN TẤT' : 'ĐANG XỬ LÝ'}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="text" icon={<EyeOutlined />} style={{ color: '#1890ff' }}>Xem</Button>
          {!record.signed && (
            <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => handleSign(record)} style={{ borderRadius: '6px' }}>Ký ngay</Button>
          )}
          <Button type="text" icon={<FilePdfOutlined />} disabled={!record.signed}>PDF</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ margin: '-48px -48px 0 -48px' }}>
      <PageBanner
        title="Hợp đồng & Đơn hàng"
        subtitle="Quản lý danh sách hợp đồng, theo dõi lịch sử và thực hiện ký duyệt điện tử trực tuyến."
        height="260px"
        offset={false}
        breadcrumbs={[{ title: 'Portal', href: '/portal' }, { title: 'Đơn hàng' }]}
        imageUrl="https://images.unsplash.com/photo-1454165833267-028ec48467b8?auto=format&fit=crop&q=80&w=2500"
      />

      <div style={{ padding: '48px' }}>
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'flex-end' }}>
          <Space size="middle">
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Tìm theo mã SC/PI..."
              style={{ width: '280px', height: '44px', borderRadius: '12px' }}
            />
            <Button icon={<FilterOutlined />} style={{ height: '44px', borderRadius: '12px' }}>Bộ lọc</Button>
          </Space>
        </div>

        <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          <Table dataSource={orders} columns={columns} pagination={{ pageSize: 10 }} />
        </div>
      </div>

      <Modal
        title={null}
        open={isSignModalOpen}
        onCancel={() => setIsSignModalOpen(false)}
        onOk={confirmSign}
        okText="Xác nhận & Ký tên"
        cancelText="Để sau"
        width={700}
        centered
        styles={{ body: { padding: '40px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '80px', height: '80px', background: '#eff6ff', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px'
          }}>
            <EditOutlined style={{ fontSize: '32px', color: '#3b82f6' }} />
          </div>
          <Title level={3}>Ký điện tử tài liệu</Title>
          <Text type="secondary">Bạn đang thực hiện ký duyệt cho văn bản: <Text strong>{currentOrder?.id}</Text></Text>
        </div>

        <Steps
          current={1}
          size="small"
          items={[
            { title: 'Phát hành', description: 'Bản nháp PI' },
            { title: 'Phê duyệt', description: 'Ký xác nhận' },
            { title: 'Hoàn tất', description: 'Sales Contract' },
          ]}
          style={{ marginBottom: '40px' }}
        />

        <div style={{
          padding: '32px',
          background: '#f8fafc',
          borderRadius: '20px',
          border: '1px dashed #cbd5e1',
          textAlign: 'center'
        }}>
          <Paragraph type="secondary" style={{ fontSize: '14px', marginBottom: '24px' }}>
            Tôi xác nhận đã kiểm tra kỹ các nội dung về mặt hàng, quy cách và giá trị trong bản Proforma Invoice này.
          </Paragraph>
          <div style={{
            height: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            fontFamily: '"Dancing Script", cursive, serif',
            color: '#1e40af',
            opacity: 0.8
          }}>
            VinaExport User
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <Text type="secondary" style={{ fontSize: '11px' }}>Hệ thống chữ ký điện tử bảo mật VinaExport - {new Date().toLocaleDateString()}</Text>
        </div>
      </Modal>
    </div>
  );
};

export default OrdersPortal;
