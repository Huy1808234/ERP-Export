'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
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
  inquiryNumber?: string | null;
  customerName: string;
  productId: string;
  product?: PortalProduct | null;
  productSnapshotName?: string | null;
  productSnapshotCode?: string | null;
  lineItems?: Array<{
    product_id: string;
    productSnapshotName?: string | null;
    productSnapshotCode?: string | null;
    unitOfMeasure?: string | null;
    quantity: number;
  }>;
  quantity: number;
  incoterm?: string | null;
  destinationPort?: string | null;
  expectedShipmentDate?: string | null;
  note?: string | null;
  status: string;
  isRead: boolean;
  createdAt: string;
};

type InquiryFormValues = {
  product_id: string;
  quantity: number;
  incoterm: string;
  destinationPort?: string;
  expectedShipmentDate?: Dayjs;
  note?: string;
};

const statusColor: Record<string, string> = {
  SUBMITTED: 'orange',
  IN_REVIEW: 'blue',
  QUOTED: 'green',
  CLOSED: 'default',
  PENDING: 'orange',
  PROCESSED: 'green',
  REJECTED: 'red',
};

const getInquiryLines = (record: PortalInquiry) => (
  record.lineItems?.length
    ? record.lineItems
    : [{
        product_id: record.productId,
        productSnapshotName: record.productSnapshotName || record.product?.englishName || record.product?.vietnameseName,
        productSnapshotCode: record.productSnapshotCode || record.product?.sku,
        unitOfMeasure: record.product?.unitOfMeasure,
        quantity: record.quantity,
      }]
);

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
          incoterm: values.incoterm,
          destinationPort: values.destinationPort || null,
          expectedShipmentDate: values.expectedShipmentDate?.toISOString() || null,
          note: values.note || null,
        },
      });

      if (res?.data?._id) {
        message.success(`Đã gửi yêu cầu báo giá ${res.data.inquiryNumber || res.data._id}`);
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
      render: (value: string, record) => <Text strong style={{ color: '#1677ff' }}>{record.inquiryNumber || value}</Text>,
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
          <Text strong>{getInquiryLines(record)[0]?.productSnapshotName || '-'}</Text>
          <Text type="secondary">
            {getInquiryLines(record)[0]?.productSnapshotCode || '-'}
            {getInquiryLines(record).length > 1 ? ` +${getInquiryLines(record).length - 1} SKU` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      align: 'right',
      render: (_value: number, record) => {
        const totalQuantity = getInquiryLines(record).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        return Number(totalQuantity || 0).toLocaleString();
      },
    },
    {
      title: 'Incoterms / Cảng đến',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.incoterm || '-'}</Text>
          <Text type="secondary">{record.destinationPort || '-'}</Text>
        </Space>
      ),
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
            <Col span={8}>
              <Form.Item label={<Text strong>Số lượng</Text>} name="quantity" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="Nhập số lượng" size="large" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={<Text strong>Incoterms</Text>} name="incoterm" initialValue="FOB" rules={[{ required: true }]}>
                <Select
                  size="large"
                  options={['EXW', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP'].map((value) => ({ value, label: value }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={<Text strong>Ngày cần giao</Text>} name="expectedShipmentDate">
                <DatePicker style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label={<Text strong>Cảng đến</Text>} name="destinationPort">
            <Input size="large" placeholder="VD: Hamburg, Los Angeles, Jebel Ali..." />
          </Form.Item>

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
