'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Badge,
  Button,
  Card,
  Col,
  Input,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CloudSyncOutlined,
  DollarOutlined,
  ReloadOutlined,
  SearchOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSession } from 'next-auth/react';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import { formatCurrency, formatMoneyStatic, formatVND } from '@/utils/format';

const { Text } = Typography;

type ARStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';

interface IPaymentAllocation {
  _id: string;
  allocatedAmountForeign: number;
  allocatedAmountVnd: number;
  exchangeRate: number;
  allocatedAt: string;
  allocatedByUsername: string;
  tradeFinanceTransactionId?: string | null;
  paymentStage?: 'ADVANCE' | 'BALANCE' | 'COLLECTION' | 'MANUAL';
  tradeFinanceTransaction?: {
    _id: string;
    type: string;
    status: string;
    amount: number;
    currency: string;
    bankReference?: string | null;
    transactionDate?: string | null;
  } | null;
  note?: string | null;
}

interface IAccountReceivable {
  _id: string;
  buyerId: string;
  buyer?: { name?: string };
  salesContract?: { contractNumber?: string };
  salesContractId?: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  amountForeign: number;
  paidAmountForeign: number;
  amountVnd: number;
  paidAmountVnd: number;
  currency: string;
  exchangeRate: number;
  status: ARStatus;
  createdByUsername?: string | null;
  allocations?: IPaymentAllocation[];
}

interface IAging {
  current: number;
  days_30: number;
  days_60: number;
  days_90: number;
  over_90: number;
}

interface IDso {
  days: number;
  totalCreditSales: number;
  openAr: number;
  dso: number;
}

const statusMeta: Record<ARStatus, { label: string; color: string; badge: 'default' | 'processing' | 'success' | 'warning' | 'error' }> = {
  UNPAID: { label: 'Chưa thu', color: 'orange', badge: 'warning' },
  PARTIAL: { label: 'Thu một phần', color: 'blue', badge: 'processing' },
  PAID: { label: 'Đã thu đủ', color: 'green', badge: 'success' },
  OVERDUE: { label: 'Quá hạn', color: 'red', badge: 'error' },
  CANCELLED: { label: 'Đã hủy', color: 'default', badge: 'default' },
};

const allocationStageMeta: Record<string, { label: string; color: string }> = {
  ADVANCE: { label: 'T/T Advance', color: 'blue' },
  BALANCE: { label: 'T/T Balance', color: 'cyan' },
  COLLECTION: { label: 'D/P D/A', color: 'purple' },
  MANUAL: { label: 'Manual', color: 'default' },
};

const AccountReceivablesPage = () => {
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const { message } = App.useApp();

  const [rows, setRows] = useState<IAccountReceivable[]>([]);
  const [aging, setAging] = useState<IAging>({ current: 0, days_30: 0, days_60: 0, days_90: 0, over_90: 0 });
  const [dso, setDso] = useState<IDso>({ days: 90, totalCreditSales: 0, openAr: 0, dso: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchRows = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [receivablesRes, agingRes, dsoRes] = await Promise.all([
        sendRequest<IBackendRes<IAccountReceivable[]>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/account-receivables`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<IAging>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/account-receivables/aging`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<IDso>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/account-receivables/dso`,
          method: 'GET',
          queryParams: { days: 90 },
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      setRows(receivablesRes?.data ?? []);
      setAging(agingRes?.data ?? { current: 0, days_30: 0, days_60: 0, days_90: 0, over_90: 0 });
      setDso(dsoRes?.data ?? { days: 90, totalCreditSales: 0, openAr: 0, dso: 0 });
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;

    return rows.filter((row) => (
      row.invoiceNumber.toLowerCase().includes(keyword)
      || row.buyer?.name?.toLowerCase().includes(keyword)
      || row.salesContract?.contractNumber?.toLowerCase().includes(keyword)
    ));
  }, [rows, search]);

  const syncShippedContracts = async () => {
    if (!accessToken) return;
    const res = await sendRequest<IBackendRes<{ syncedCount: number }>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/account-receivables/sync-shipped`,
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res?.data) {
      message.success(`Đã đồng bộ ${res.data.syncedCount} hợp đồng đã giao`);
      fetchRows();
    } else {
      message.error(res?.message || 'Không đồng bộ được công nợ phải thu');
    }
  };

  const agingTotal = Object.values(aging).reduce((sum, value) => sum + Number(value || 0), 0);

  const columns: ColumnsType<IAccountReceivable> = [
    {
      title: 'Hóa đơn / Hợp đồng',
      key: 'invoice',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.invoiceNumber}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.salesContract?.contractNumber || record.salesContractId || 'Commercial Invoice'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Buyer',
      key: 'buyer',
      render: (_, record) => record.buyer?.name || record.buyerId,
    },
    {
      title: 'Giá trị',
      key: 'amount',
      align: 'right',
      render: (_, record) => (
        <Space orientation="vertical" size={0} align="end">
          <Text strong>{formatMoneyStatic(record.amountForeign, record.currency)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{formatVND(record.amountVnd || 0)}</Text>
        </Space>
      ),
    },
    {
      title: 'Đã thu',
      key: 'paid',
      align: 'right',
      render: (_, record) => {
        const percent = record.amountForeign > 0 ? Math.min((record.paidAmountForeign / record.amountForeign) * 100, 100) : 0;
        return (
          <Space orientation="vertical" size={4} align="end" style={{ width: 180 }}>
            <Text>{formatMoneyStatic(record.paidAmountForeign || 0, record.currency)}</Text>
            <Progress percent={Math.round(percent)} size="small" showInfo={false} />
          </Space>
        );
      },
    },
    {
      title: 'Hạn thu',
      key: 'dueDate',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.dueDate ? dayjs(record.dueDate).format('DD/MM/YYYY') : '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Invoice: {dayjs(record.invoiceDate).format('DD/MM/YYYY')}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (value: ARStatus) => (
        <Badge status={statusMeta[value]?.badge ?? 'default'} text={statusMeta[value]?.label ?? value} />
      ),
    },
    {
      title: 'Người tạo',
      dataIndex: 'createdByUsername',
      key: 'createdByUsername',
      render: (value?: string | null) => value || 'system',
    },
  ];

  const allocationColumns: ColumnsType<IPaymentAllocation> = [
    {
      title: 'Giao dịch',
      key: 'tradeFinanceTransactionId',
      render: (_, record) => {
        const stage = record.paymentStage || 'MANUAL';
        return (
          <Space orientation="vertical" size={0}>
            <Tag color={allocationStageMeta[stage]?.color || 'default'}>
              {allocationStageMeta[stage]?.label || stage}
            </Tag>
            <Text code>{record.tradeFinanceTransaction?.bankReference || record.tradeFinanceTransactionId || 'Manual'}</Text>
          </Space>
        );
      },
    },
    { title: 'Ngoại tệ', dataIndex: 'allocatedAmountForeign', key: 'allocatedAmountForeign', align: 'right', render: (value: number) => formatCurrency(value, 2) },
    { title: 'VND', dataIndex: 'allocatedAmountVnd', key: 'allocatedAmountVnd', align: 'right', render: (value: number) => formatVND(value || 0) },
    { title: 'Tỷ giá', dataIndex: 'exchangeRate', key: 'exchangeRate', align: 'right', render: (value: number) => formatCurrency(value, 2) },
    { title: 'Ngày phân bổ', dataIndex: 'allocatedAt', key: 'allocatedAt', render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm') },
    { title: 'Người xử lý', dataIndex: 'allocatedByUsername', key: 'allocatedByUsername' },
  ];

  return (
    <AdminPageScroll>
      <PageHeader
        title="Công nợ phải thu Buyer"
        icon={<WalletOutlined />}
        description="Theo dõi AR ngoại tệ theo từng Commercial Invoice, phân bổ tiền T/T và tính DSO"
        extra={(
          <Space orientation="horizontal">
            <Button icon={<ReloadOutlined />} onClick={fetchRows}>
              Tải lại
            </Button>
            <Button type="primary" icon={<CloudSyncOutlined />} onClick={syncShippedContracts}>
              Đồng bộ hợp đồng đã giao
            </Button>
          </Space>
        )}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card variant="borderless">
            <Statistic title="AR còn mở" value={dso.openAr} formatter={(value) => formatVND(Number(value || 0))} prefix={<DollarOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card variant="borderless">
            <Statistic title="DSO 90 ngày" value={dso.dso} suffix="ngày" />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card variant="borderless">
            <Statistic title="Quá hạn > 90 ngày" value={aging.over_90} formatter={(value) => formatVND(Number(value || 0))} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card variant="borderless">
            <Statistic title="Tổng Aging" value={agingTotal} formatter={(value) => formatVND(Number(value || 0))} />
          </Card>
        </Col>
      </Row>

      <Card
        variant="borderless"
        title="AR Aging"
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[12, 12]}>
          {[
            ['Current', aging.current, 'green'],
            ['1-30', aging.days_30, 'blue'],
            ['31-60', aging.days_60, 'gold'],
            ['61-90', aging.days_90, 'orange'],
            ['>90', aging.over_90, 'red'],
          ].map(([label, value, color]) => (
            <Col xs={24} sm={12} lg={4} key={String(label)}>
              <Tag color={String(color)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8 }}>
                <Space orientation="vertical" size={2}>
                  <Text strong>{String(label)}</Text>
                  <Text>{formatVND(Number(value || 0))}</Text>
                </Space>
              </Tag>
            </Col>
          ))}
        </Row>
      </Card>

      <Card
        variant="borderless"
        title="Danh sách công nợ phải thu"
        extra={(
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm hóa đơn, buyer, hợp đồng"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 320 }}
          />
        )}
      >
        <Table<IAccountReceivable>
          rowKey="_id"
          columns={columns}
          dataSource={filteredRows}
          loading={loading}
          expandable={{
            expandedRowRender: (record) => (
              <Table<IPaymentAllocation>
                rowKey="_id"
                columns={allocationColumns}
                dataSource={record.allocations ?? []}
                pagination={false}
                size="small"
              />
            ),
          }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>
    </AdminPageScroll>
  );
};

export default AccountReceivablesPage;
