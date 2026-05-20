'use client'
import React from 'react';
import { Card, Table, Tag, Button, Space, Typography, Input, Select } from 'antd';
import { SearchOutlined, DownloadOutlined, FilePdfOutlined } from '@ant-design/icons';
import PageBanner from '@/components/guest/PageBanner';

const { Title, Text } = Typography;

const PricingPage = () => {
  const dataSource = [
    {
      key: '1',
      code: 'PROD-001',
      name: 'Hạt điều rang muối Loại A',
      spec: 'Túi 500g, hút chân không',
      moq: '500 kg',
      unitPrice: '$12.50',
      status: 'Sẵn hàng',
    },
    {
      key: '2',
      code: 'PROD-042',
      name: 'Cà phê Robusta S18',
      spec: 'Bao 60kg, độ ẩm <12%',
      moq: '1 tấn',
      unitPrice: '$4.20',
      status: 'Đặt trước',
    },
    {
      key: '3',
      code: 'PROD-089',
      name: 'Tiêu đen tiêu chuẩn G1',
      spec: 'Bao 50kg, tạp chất <0.5%',
      moq: '2 tấn',
      unitPrice: '$6.80',
      status: 'Sẵn hàng',
    },
  ];

  const columns = [
    { title: 'Mã SP', dataIndex: 'code', key: 'code' },
    { title: 'Tên Sản phẩm', dataIndex: 'name', key: 'name', render: (text: string) => <Text strong>{text}</Text> },
    { title: 'Quy cách', dataIndex: 'spec', key: 'spec' },
    { title: 'MOQ', dataIndex: 'moq', key: 'moq' },
    { title: 'Giá đối tác', dataIndex: 'unitPrice', key: 'unitPrice', render: (price: string) => <Text style={{ color: '#3b82f6', fontWeight: 700 }}>{price}</Text> },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'Sẵn hàng' ? 'success' : 'warning'}>{status}</Tag>
      )
    },
    {
      title: 'Hành động',
      key: 'action',
      render: () => (
        <Space>
          <Button icon={<FilePdfOutlined />} size="small">Spec</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ margin: '-40px -40px 32px -40px', overflow: 'hidden', borderRadius: '24px 24px 0 0' }}>
        <PageBanner 
          title="Bảng giá & Catalog"
          subtitle="Cập nhật giá mới nhất áp dụng từ ngày 01/05/2024"
          height="200px"
          breadcrumbs={[{ title: 'Portal', href: '/portal' }, { title: 'Bảng giá' }]}
        >
          <div style={{ marginTop: '20px' }}>
            <Button type="primary" icon={<DownloadOutlined />} size="large" style={{ borderRadius: '12px', background: '#fff', color: '#000', border: 'none', fontWeight: 700 }}>
              Tải Bảng giá (PDF)
            </Button>
          </div>
        </PageBanner>
      </div>

      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Card variant="borderless" style={{ background: '#f8fafc', borderRadius: '12px' }}>
          <Space size="middle">
            <Input prefix={<SearchOutlined />} placeholder="Tìm sản phẩm..." style={{ width: 300, borderRadius: '8px' }} />
            <Select defaultValue="all" style={{ width: 150 }}>
              <Select.Option value="all">Tất cả nhóm hàng</Select.Option>
              <Select.Option value="agro">Nông sản</Select.Option>
              <Select.Option value="seafood">Thủy sản</Select.Option>
            </Select>
          </Space>
        </Card>

        <Table dataSource={dataSource} columns={columns} pagination={false} />
      </Space>
    </div>
  );
};

export default PricingPage;
