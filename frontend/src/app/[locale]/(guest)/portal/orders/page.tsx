'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Descriptions, Empty, Input, Modal, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, FilePdfOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
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
  unitOfMeasure?: string | null;
};

type PortalLineItem = {
  _id: string;
  product?: PortalProduct | null;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  totalAmount?: number;
  totalPrice?: number;
};

type PortalContract = {
  _id: string;
  contractNumber: string;
  status: string;
  signatureStatus?: string | null;
  incoterm: string;
  currencyCode: string;
  totalAmount: number;
  createdAt: string;
  deliveryDate?: string | null;
  validUntil?: string | null;
  items?: PortalLineItem[];
};

type PortalProformaInvoice = {
  _id: string;
  piNumber: string;
  status: string;
  incoterm: string;
  currency: string;
  totalAmount: number;
  issueDate: string;
  salesContractId?: string | null;
  salesContract?: { _id: string; contractNumber: string; status: string } | null;
  items?: PortalLineItem[];
};

type PortalOrdersResponse = {
  summary: {
    contractCount: number;
    proformaInvoiceCount: number;
    pendingSignatureCount: number;
    shippedCount: number;
  };
  contracts: PortalContract[];
  proformaInvoices: PortalProformaInvoice[];
};

type OrderRow = {
  _id: string;
  type: 'PI' | 'CONTRACT';
  number: string;
  date: string;
  status: string;
  signatureStatus?: string | null;
  incoterm: string;
  currency: string;
  totalAmount: number;
  items: PortalLineItem[];
  source: PortalContract | PortalProformaInvoice;
};

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'orange',
  APPROVED: 'blue',
  SENT: 'processing',
  ACCEPTED: 'green',
  PENDING_BUYER_SIGNATURE: 'purple',
  BUYER_SIGNED: 'cyan',
  CONFIRMED: 'blue',
  SHIPPED: 'green',
  PAID: 'green',
  REJECTED: 'red',
  CANCELLED: 'red',
};

const money = (value: number, currency: string) => (
  `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
);

export default function OrdersPortal() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<PortalOrdersResponse | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<OrderRow | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<PortalOrdersResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/orders`,
        method: 'GET',
        headers,
      });
      setOrders(res?.data || null);
    } catch {
      message.error('Không tải được danh sách PI/hợp đồng');
    } finally {
      setLoading(false);
    }
  }, [headers, message]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const rows = useMemo<OrderRow[]>(() => {
    const proformaRows = (orders?.proformaInvoices || []).map((pi) => ({
      _id: pi._id,
      type: 'PI' as const,
      number: pi.piNumber,
      date: pi.issueDate,
      status: pi.status,
      signatureStatus: pi.salesContract?.status || null,
      incoterm: pi.incoterm,
      currency: pi.currency,
      totalAmount: Number(pi.totalAmount || 0),
      items: pi.items || [],
      source: pi,
    }));
    const contractRows = (orders?.contracts || []).map((contract) => ({
      _id: contract._id,
      type: 'CONTRACT' as const,
      number: contract.contractNumber,
      date: contract.createdAt,
      status: contract.status,
      signatureStatus: contract.signatureStatus || null,
      incoterm: contract.incoterm,
      currency: contract.currencyCode,
      totalAmount: Number(contract.totalAmount || 0),
      items: contract.items || [],
      source: contract,
    }));

    const keyword = search.trim().toLowerCase();
    return [...contractRows, ...proformaRows]
      .filter((row) => (
        !keyword
        || row.number.toLowerCase().includes(keyword)
        || row.status.toLowerCase().includes(keyword)
        || row.type.toLowerCase().includes(keyword)
      ))
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
  }, [orders, search]);

  const columns: ColumnsType<OrderRow> = [
    {
      title: 'Số chứng từ',
      dataIndex: 'number',
      render: (value: string, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong style={{ color: '#1677ff' }}>{value}</Text>
          <Tag>{record.type === 'PI' ? 'Proforma Invoice' : 'Sales Contract'}</Tag>
        </Space>
      ),
    },
    {
      title: 'Ngày',
      dataIndex: 'date',
      render: (value: string) => value ? new Date(value).toLocaleDateString('vi-VN') : '-',
    },
    {
      title: 'Điều kiện',
      dataIndex: 'incoterm',
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: 'Tổng giá trị',
      align: 'right',
      render: (_, record) => <Text strong>{money(record.totalAmount, record.currency)}</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value: string, record) => (
        <Space orientation="vertical" size={0}>
          <Tag color={statusColor[value] || 'default'}>{value}</Tag>
          {record.signatureStatus ? <Text type="secondary">{record.signatureStatus}</Text> : null}
        </Space>
      ),
    },
    {
      title: 'Hành động',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => setSelected(record)}>Xem</Button>
          <Button icon={<FilePdfOutlined />} disabled>PDF</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ margin: '-48px -48px 0 -48px' }}>
      <PageBanner
        title="Hợp đồng & Đơn hàng"
        subtitle="Theo dõi Proforma Invoice, Sales Contract và trạng thái ký duyệt của tài khoản buyer hiện tại."
        height="260px"
        offset={false}
        breadcrumbs={[{ title: 'Portal', href: '/portal' }, { title: 'Đơn hàng' }]}
        imageUrl="https://images.unsplash.com/photo-1454165833267-028ec48467b8?auto=format&fit=crop&q=80&w=2500"
      />

      <div style={{ padding: 48 }}>
        <Card
          variant="borderless"
          extra={<Button icon={<ReloadOutlined />} onClick={fetchOrders}>Làm mới</Button>}
        >
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Space wrap>
              <Input
                prefix={<SearchOutlined />}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo mã PI/SC hoặc trạng thái"
                style={{ width: 320 }}
              />
              <Tag color="blue">Contract: {orders?.summary.contractCount || 0}</Tag>
              <Tag color="purple">PI: {orders?.summary.proformaInvoiceCount || 0}</Tag>
              <Tag color="orange">Chờ ký: {orders?.summary.pendingSignatureCount || 0}</Tag>
            </Space>
            <Table<OrderRow>
              rowKey={(record) => `${record.type}-${record._id}`}
              loading={loading}
              dataSource={rows}
              columns={columns}
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: <Empty description="Chưa có PI hoặc hợp đồng nào" /> }}
              scroll={{ x: 920 }}
            />
          </Space>
        </Card>
      </div>

      <Modal
        title={selected?.number}
        open={Boolean(selected)}
        onCancel={() => setSelected(null)}
        footer={<Button onClick={() => setSelected(null)}>Đóng</Button>}
        width={820}
      >
        {selected ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Loại">{selected.type === 'PI' ? 'Proforma Invoice' : 'Sales Contract'}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{selected.status}</Descriptions.Item>
              <Descriptions.Item label="Incoterm">{selected.incoterm}</Descriptions.Item>
              <Descriptions.Item label="Tổng">{money(selected.totalAmount, selected.currency)}</Descriptions.Item>
            </Descriptions>
            <Table<PortalLineItem>
              rowKey="_id"
              dataSource={selected.items}
              pagination={false}
              columns={[
                {
                  title: 'Sản phẩm',
                  render: (_, item) => (
                    <Space orientation="vertical" size={0}>
                      <Text strong>{item.product?.englishName || item.product?.vietnameseName || item.product?._id}</Text>
                      <Text type="secondary">{item.product?.sku}</Text>
                    </Space>
                  ),
                },
                { title: 'Số lượng', dataIndex: 'quantity', align: 'right' },
                { title: 'Đơn giá', dataIndex: 'unitPrice', align: 'right', render: (value: number) => money(value, selected.currency) },
                {
                  title: 'Thành tiền',
                  align: 'right',
                  render: (_, item) => money(Number(item.totalAmount ?? item.totalPrice ?? 0), selected.currency),
                },
              ]}
            />
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}
