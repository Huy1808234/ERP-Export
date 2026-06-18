'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Empty, Input, InputNumber, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined, FilePdfOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import PageBanner from '@/components/guest/PageBanner';
import { getAccessToken } from '@/lib/auth-token';
import { sendRequest } from '@/lib/api-client';

const { Text } = Typography;

type PortalProduct = {
  _id: string;
  sku: string;
  vietnameseName: string;
  englishName?: string | null;
  hsCode?: string | null;
  unitOfMeasure?: string | null;
  packingType?: string | null;
  currentStock: number;
  reservedStock: number;
};

type PortalPricingRow = {
  product: PortalProduct;
  unitPrice?: number | null;
  currency: string;
  incoterm: string;
  source: 'PRICING_POLICY' | 'PRODUCT_DEFAULT' | 'CONTACT_SALES' | string;
  pricingPolicy_id?: string | null;
  quantity: number;
};

type PortalPricingResponse = {
  buyer: {
    _id: string;
    name: string;
    country?: string | null;
    region?: string | null;
    defaultCurrency?: string | null;
  };
  filters: {
    incoterm: string;
    currency: string;
    quantity: number;
    search?: string;
  };
  results: PortalPricingRow[];
};

const sourceColor: Record<string, string> = {
  PRICING_POLICY: 'green',
  PRODUCT_DEFAULT: 'blue',
  CONTACT_SALES: 'orange',
};

const incotermOptions = ['EXW', 'FOB', 'CFR', 'CIF', 'DDP'].map((value) => ({ value, label: value }));
const currencyOptions = ['USD', 'EUR', 'VND', 'GBP', 'AUD'].map((value) => ({ value, label: value }));

const formatPrice = (value: number | null | undefined, currency: string) => {
  if (value === null || value === undefined) return 'Liên hệ';
  return `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${currency}`;
};

export default function PricingPage() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PortalPricingResponse | null>(null);
  const [search, setSearch] = useState('');
  const [incoterm, setIncoterm] = useState('FOB');
  const [currency, setCurrency] = useState('USD');
  const [quantity, setQuantity] = useState(1);

  const fetchPricing = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<PortalPricingResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/pricing`,
        method: 'GET',
        headers,
        queryParams: {
          search: search || undefined,
          incoterm,
          currency,
          quantity,
        },
      });
      setData(res?.data || null);
    } catch {
      message.error('Không tải được bảng giá buyer');
    } finally {
      setLoading(false);
    }
  }, [currency, headers, incoterm, message, quantity, search]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const columns: ColumnsType<PortalPricingRow> = [
    {
      title: 'Mã SP',
      dataIndex: ['product', 'sku'],
      width: 140,
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: 'Sản phẩm',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.product.englishName || record.product.vietnameseName}</Text>
          <Text type="secondary">{record.product.vietnameseName}</Text>
        </Space>
      ),
    },
    {
      title: 'HS / Quy cách',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.product.hsCode || '-'}</Text>
          <Text type="secondary">{record.product.packingType || record.product.unitOfMeasure || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Giá buyer',
      align: 'right',
      render: (_, record) => <Text strong style={{ color: '#1677ff' }}>{formatPrice(record.unitPrice, record.currency)}</Text>,
    },
    {
      title: 'Điều kiện',
      render: (_, record) => (
        <Space>
          <Tag color="blue">{record.incoterm}</Tag>
          <Tag color={sourceColor[record.source] || 'default'}>{record.source}</Tag>
        </Space>
      ),
    },
    {
      title: 'Tồn khả dụng',
      align: 'right',
      render: (_, record) => {
        const available = Number(record.product.currentStock || 0) - Number(record.product.reservedStock || 0);
        return `${Math.max(available, 0).toLocaleString()} ${record.product.unitOfMeasure || ''}`;
      },
    },
    {
      title: 'Tài liệu',
      align: 'right',
      render: () => <Button icon={<FilePdfOutlined />} size="small" disabled>Spec</Button>,
    },
  ];

  return (
    <div>
      <div style={{ margin: '-40px -40px 32px -40px', overflow: 'hidden', borderRadius: '24px 24px 0 0' }}>
        <PageBanner
          title="Bảng giá & Catalog"
          subtitle={`Giá được resolve theo buyer ${data?.buyer.name || ''}, Incoterm, tiền tệ và số lượng đặt.`}
          height="200px"
          breadcrumbs={[{ title: 'Portal', href: '/portal' }, { title: 'Bảng giá' }]}
        >
          <div style={{ marginTop: 20 }}>
            <Button disabled type="primary" icon={<DownloadOutlined />} size="large" style={{ borderRadius: 12 }}>
              Tải bảng giá PDF
            </Button>
          </div>
        </PageBanner>
      </div>

      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Card variant="borderless" style={{ background: '#f8fafc', borderRadius: 12 }}>
          <Space size="middle" wrap>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={fetchPricing}
              prefix={<SearchOutlined />}
              placeholder="Tìm mã, tên, HS code..."
              style={{ width: 280, borderRadius: 8 }}
            />
            <Select value={incoterm} onChange={setIncoterm} style={{ width: 120 }} options={incotermOptions} />
            <Select value={currency} onChange={setCurrency} style={{ width: 120 }} options={currencyOptions} />
            <InputNumber min={1} value={quantity} onChange={(value) => setQuantity(Number(value || 1))} style={{ width: 140 }} />
            <Button icon={<ReloadOutlined />} onClick={fetchPricing} loading={loading}>Resolve giá</Button>
          </Space>
        </Card>

        <Table<PortalPricingRow>
          rowKey={(record) => record.product._id}
          loading={loading}
          dataSource={data?.results || []}
          columns={columns}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="Chưa có sản phẩm hoặc bảng giá phù hợp" /> }}
          scroll={{ x: 980 }}
        />
      </Space>
    </div>
  );
}
