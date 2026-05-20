'use client'
import React, { useState } from 'react';
import { Table, Tag, Button, Typography, Space, Modal, Form, Input, Select, InputNumber, Card, theme, Row, Col, Divider } from 'antd';
import { 
  PlusOutlined, 
  MessageOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import PageBanner from '@/components/guest/PageBanner';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const InquiryPortal = () => {
  const { token } = theme.useToken();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const inquiries = [
    {
      key: '1',
      id: 'INQ-8821',
      date: '2024-05-12',
      product: 'Gạo Jasmine Thượng Hạng',
      quantity: '50 Tấn',
      status: 'PENDING',
    },
    {
      key: '2',
      id: 'INQ-8815',
      date: '2024-05-10',
      product: 'Màn hình Dell 24 inch',
      quantity: '200 Cái',
      status: 'QUOTED',
    },
  ];

  const columns = [
    {
      title: 'Mã yêu cầu',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => <Text strong style={{ color: '#1890ff' }}>{text}</Text>,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Sản phẩm',
      dataIndex: 'product',
      key: 'product',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'QUOTED' ? 'green' : 'orange'} style={{ borderRadius: '4px', padding: '0 12px' }}>
          {status === 'QUOTED' ? 'ĐÃ BÁO GIÁ' : 'ĐANG XỬ LÝ'}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      render: () => (
        <Space>
          <Button type="text" icon={<MessageOutlined />} style={{ color: '#1890ff' }}>Phản hồi</Button>
          <Button type="link">Xem báo giá</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ margin: '-48px -48px 0 -48px' }}>
      <PageBanner 
        title="Yêu cầu báo giá"
        subtitle="Gửi yêu cầu báo giá cho các mặt hàng bạn quan tâm và theo dõi tiến độ báo giá từ đội ngũ VinaExport."
        height="260px"
        offset={false}
        breadcrumbs={[{ title: 'Portal', href: '/portal' }, { title: 'Yêu cầu báo giá' }]}
        imageUrl="https://images.unsplash.com/photo-1521791136064-7986c295944b?auto=format&fit=crop&q=80&w=2500"
      >
        <div style={{ marginTop: '20px' }}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            size="large" 
            onClick={() => setIsModalOpen(true)}
            style={{ borderRadius: '12px', height: '48px', fontWeight: 700, background: '#1890ff', border: 'none' }}
          >
            Tạo yêu cầu mới
          </Button>
        </div>
      </PageBanner>

      <div style={{ padding: '48px' }}>
        <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          <Table dataSource={inquiries} columns={columns} pagination={{ pageSize: 10 }} />
        </div>
      </div>

      <Modal
        title={null}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
        centered
        styles={{ body: { padding: '40px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '64px', height: '64px', background: '#eff6ff', borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
          }}>
            <QuestionCircleOutlined style={{ fontSize: '32px', color: '#3b82f6' }} />
          </div>
          <Title level={3}>Gửi yêu cầu báo giá mới</Title>
          <Text type="secondary">Vui lòng cung cấp chi tiết nhu cầu để chúng tôi báo giá tốt nhất.</Text>
        </div>

        <Form layout="vertical">
          <Form.Item label={<Text strong>Sản phẩm quan tâm</Text>} name="product" rules={[{ required: true }]}>
            <Select placeholder="Chọn sản phẩm từ catalog" size="large">
              <Select.Option value="1">Gạo Jasmine Thượng Hạng</Select.Option>
              <Select.Option value="2">Màn hình Dell 24 inch</Select.Option>
              <Select.Option value="3">Áo thun Nam màu Navy</Select.Option>
            </Select>
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item label={<Text strong>Số lượng</Text>} name="quantity" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} placeholder="Nhập số lượng" size="large" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label={<Text strong>Đơn vị</Text>} name="unit">
                <Select placeholder="ĐVT" size="large">
                  <Select.Option value="ton">Tấn</Select.Option>
                  <Select.Option value="pcs">Cái/Chiếc</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label={<Text strong>Ghi chú (Incoterms, Cảng đến...)</Text>} name="note">
            <TextArea rows={4} placeholder="Ví dụ: Cần giá CIF cảng Hamburg, giao hàng tháng 6..." style={{ borderRadius: '12px' }} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: '24px' }}>
            <Button type="primary" block size="large" onClick={() => setIsModalOpen(false)} style={{ borderRadius: '12px', height: '54px', fontWeight: 800 }}>
              GỬI YÊU CẦU NGAY
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InquiryPortal;
