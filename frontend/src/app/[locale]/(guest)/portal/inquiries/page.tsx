'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MessageOutlined, PlusOutlined, QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import PageBanner from '@/components/guest/PageBanner';
import { getAccessToken } from '@/lib/auth-token';
import { sendRequest } from '@/lib/api-client';

const { Title, Text } = Typography;
const { TextArea } = Input;

type PortalProduct = {
  _id: string;
  sku: string;
  vietnameseName: string;
  englishName?: string | null;
  unitOfMeasure?: string | null;
};

type PortalPricingRow = {
  product: PortalProduct;
  unitPrice?: number | null;
  currency: string;
  source: string;
};

type PortalPricingResponse = {
  results: PortalPricingRow[];
};

type PortalInquiry = {
  _id: string;
  customerName: string;
  productId: string;
  product?: PortalProduct | null;
  productSnapshotName?: string | null;
  productSnapshotCode?: string | null;
  quantity: number;
  note?: string | null;
  status: string;
  isRead: boolean;
  createdAt: string;
};

type InquiryFormValues = {
  product_id: string;
  quantity: number;
  note?: string;
};

const statusColor: Record<string, string> = {
  PENDING: 'orange',
  PROCESSED: 'green',
  REJECTED: 'red',
};

export default function InquiryPortal() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const [form] = Form.useForm<InquiryFormValues>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inquiries, setInquiries] = useState<PortalInquiry[]>([]);
  const [pricingRows, setPricingRows] = useState<PortalPricingRow[]>([]);

  const fetchData = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const [inquiriesRes, pricingRes] = await Promise.all([
        sendRequest<IBackendRes<PortalInquiry[]>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/inquiries`,
          method: 'GET',
          headers,
        }),
        sendRequest<IBackendRes<PortalPricingResponse>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/pricing`,
          method: 'GET',
          headers,
        }),
      ]);
      setInquiries(inquiriesRes?.data || []);
      setPricingRows(pricingRes?.data?.results || []);
    } catch {
      message.error('Không tải được yêu cầu báo giá');
    } finally {
      setLoading(false);
    }
  }, [headers, message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const productOptions = useMemo(() => (
    pricingRows.map((row) => ({
      value: row.product._id,
      label: `${row.product.sku} - ${row.product.englishName || row.product.vietnameseName}`,
    }))
  ), [pricingRows]);

  const submitInquiry = async (values: InquiryFormValues) => {
    if (!headers) return;
    setSubmitting(true);
    try {
      const res = await sendRequest<IBackendRes<PortalInquiry>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/inquiries`,
        method: 'POST',
        headers,
        body: {
          product_id: values.product_id,
          quantity: Number(values.quantity || 1),
          note: values.note || null,
        },
      });

      if (res?.data?._id) {
        message.success('Đã gửi yêu cầu báo giá cho Sales');
        form.resetFields();
        setIsModalOpen(false);
        await fetchData();
      } else {
        message.error(String(res?.message || 'Không gửi được inquiry'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<PortalInquiry> = [
    {
      title: 'Mã yêu cầu',
      dataIndex: '_id',
      render: (value: string) => <Text strong style={{ color: '#1677ff' }}>{value}</Text>,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      render: (value: string) => new Date(value).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Sản phẩm',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.product?.englishName || record.productSnapshotName || record.product?.vietnameseName}</Text>
          <Text type="secondary">{record.product?.sku || record.productSnapshotCode}</Text>
        </Space>
      ),
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      align: 'right',
      render: (value: number, record) => `${Number(value || 0).toLocaleString()} ${record.product?.unitOfMeasure || ''}`,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value: string) => <Tag color={statusColor[value] || 'default'}>{value}</Tag>,
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      render: (value?: string | null) => value || '-',
    },
  ];

  return (
    <div style={{ margin: '-48px -48px 0 -48px' }}>
      <PageBanner
        title="Yêu cầu báo giá"
        subtitle="Gửi và theo dõi các yêu cầu báo giá của tài khoản buyer hiện tại."
        height="260px"
        offset={false}
        breadcrumbs={[{ title: 'Portal', href: '/portal' }, { title: 'Yêu cầu báo giá' }]}
        imageUrl="https://images.unsplash.com/photo-1521791136064-7986c295944b?auto=format&fit=crop&q=80&w=2500"
      >
        <Space style={{ marginTop: 20 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => setIsModalOpen(true)}
          >
            Tạo yêu cầu mới
          </Button>
          <Button icon={<ReloadOutlined />} size="large" onClick={fetchData} loading={loading}>
            Làm mới
          </Button>
        </Space>
      </PageBanner>

      <div style={{ padding: 48 }}>
        <Card variant="borderless">
          <Table<PortalInquiry>
            rowKey="_id"
            loading={loading}
            dataSource={inquiries}
            columns={columns}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <Empty description="Chưa có yêu cầu báo giá nào" /> }}
            scroll={{ x: 900 }}
          />
        </Card>
      </div>

      <Modal
        title={null}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={640}
        centered
        styles={{ body: { padding: 40 } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64,
            height: 64,
            background: '#eff6ff',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <QuestionCircleOutlined style={{ fontSize: 32, color: '#3b82f6' }} />
          </div>
          <Title level={3}>Gửi yêu cầu báo giá mới</Title>
          <Text type="secondary">Sales sẽ nhận inquiry trong màn admin và phản hồi bằng quotation/PI.</Text>
        </div>

        <Form<InquiryFormValues> form={form} layout="vertical" onFinish={submitInquiry}>
          <Form.Item label={<Text strong>Sản phẩm quan tâm</Text>} name="product_id" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Chọn sản phẩm từ bảng giá/catalog"
              size="large"
              options={productOptions}
              optionFilterProp="label"
              notFoundContent="Chưa có sản phẩm khả dụng"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item label={<Text strong>Số lượng</Text>} name="quantity" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="Nhập số lượng" size="large" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label={<Text strong>Đơn vị</Text>}>
                <Input disabled value="Theo sản phẩm" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label={<Text strong>Ghi chú</Text>} name="note">
            <TextArea rows={4} placeholder="Ví dụ: Cần giá CIF Hamburg, giao hàng tháng 6..." style={{ borderRadius: 12 }} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Button type="primary" block size="large" htmlType="submit" loading={submitting}>
              <MessageOutlined /> Gửi yêu cầu
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
