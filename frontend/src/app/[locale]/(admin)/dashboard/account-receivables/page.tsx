'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
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
  DollarOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SearchOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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

const statusMeta: Record<ARStatus, { badge: 'default' | 'processing' | 'success' | 'warning' | 'error' }> = {
  UNPAID: { badge: 'warning' },
  PARTIAL: { badge: 'processing' },
  PAID: { badge: 'success' },
  OVERDUE: { badge: 'error' },
  CANCELLED: { badge: 'default' },
};

const allocationStageMeta: Record<string, { color: string }> = {
  ADVANCE: { color: 'blue' },
  BALANCE: { color: 'cyan' },
  COLLECTION: { color: 'purple' },
  MANUAL: { color: 'default' },
};

const AccountReceivablesPage = () => {
  const t = useTranslations('AccountReceivables');
  const { data: session } = useSession();
  const router = useRouter();
  const accessToken = getAccessToken(session);

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

  const hasAllocationRows = useMemo(
    () => filteredRows.some((row) => Boolean(row.allocations?.length)),
    [filteredRows],
  );

  const agingTotal = Object.values(aging).reduce((sum, value) => sum + Number(value || 0), 0);

  const columns = useMemo<ColumnsType<IAccountReceivable>>(() => [
    {
      title: t('table.invoiceContract'),
      key: 'invoice',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.invoiceNumber}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.salesContract?.contractNumber || record.salesContractId || t('fallback.commercialInvoice')}
          </Text>
        </Space>
      ),
    },
    {
      title: t('table.buyer'),
      key: 'buyer',
      render: (_, record) => record.buyer?.name || record.buyerId,
    },
    {
      title: t('table.amount'),
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
      title: t('table.paid'),
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
      title: t('table.dueDate'),
      key: 'dueDate',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.dueDate ? dayjs(record.dueDate).format('DD/MM/YYYY') : '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('table.invoiceDate', { date: dayjs(record.invoiceDate).format('DD/MM/YYYY') })}
          </Text>
        </Space>
      ),
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      key: 'status',
      render: (value: ARStatus) => (
        <Badge status={statusMeta[value]?.badge ?? 'default'} text={t(`status.${value}`)} />
      ),
    },
    {
      title: t('table.createdBy'),
      dataIndex: 'createdByUsername',
      key: 'createdByUsername',
      render: (value?: string | null) => value || t('fallback.system'),
    },
  ], [t]);

  const allocationColumns = useMemo<ColumnsType<IPaymentAllocation>>(() => [
    {
      title: t('payments.transaction'),
      key: 'tradeFinanceTransactionId',
      width: 250,
      render: (_, record) => {
        const stage = record.paymentStage || 'MANUAL';
        return (
          <Space orientation="vertical" size={0}>
            <Tag color={allocationStageMeta[stage]?.color || 'default'}>
              {t(`allocationStages.${stage}`)}
            </Tag>
            <Text code style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
              {record.tradeFinanceTransaction?.bankReference || record.tradeFinanceTransactionId || t('fallback.manual')}
            </Text>
          </Space>
        );
      },
    },
    { title: t('payments.foreignAmount'), dataIndex: 'allocatedAmountForeign', key: 'allocatedAmountForeign', align: 'right', width: 130, render: (value: number) => formatCurrency(value, 2) },
    { title: 'VND', dataIndex: 'allocatedAmountVnd', key: 'allocatedAmountVnd', align: 'right', width: 150, render: (value: number) => formatVND(value || 0) },
    { title: t('payments.exchangeRate'), dataIndex: 'exchangeRate', key: 'exchangeRate', align: 'right', width: 120, render: (value: number) => formatCurrency(value, 2) },
    { title: t('payments.allocatedAt'), dataIndex: 'allocatedAt', key: 'allocatedAt', width: 160, render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm') },
    { title: t('payments.allocatedBy'), dataIndex: 'allocatedByUsername', key: 'allocatedByUsername', width: 140 },
  ], [t]);

  const renderAllocationDetails = useCallback((record: IAccountReceivable) => {
    const allocations = record.allocations ?? [];

    if (!allocations.length) {
      return (
        <div className="ar-allocation-panel">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('empty.noPayments')} />
        </div>
      );
    }

    return (
      <div className="ar-allocation-panel">
        <Table<IPaymentAllocation>
          rowKey="_id"
          columns={allocationColumns}
          dataSource={allocations}
          pagination={false}
          size="small"
          tableLayout="fixed"
          scroll={{ x: 950 }}
          locale={{ emptyText: t('empty.noPayments') }}
        />
      </div>
    );
  }, [allocationColumns, t]);

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('title')}
        icon={<WalletOutlined />}
        description={t('description')}
        extra={(
          <Space orientation="horizontal">
            <Button icon={<ReloadOutlined />} onClick={fetchRows}>
              {t('actions.reload')}
            </Button>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => router.push('/dashboard/commercial-invoices')}
            >
              {t('actions.openCommercialInvoices')}
            </Button>
          </Space>
        )}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card variant="borderless">
            <Statistic title={t('stats.openAr')} value={dso.openAr} formatter={(value) => formatVND(Number(value || 0))} prefix={<DollarOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card variant="borderless">
            <Statistic title={t('stats.dsoWindow', { days: dso.days || 90 })} value={dso.dso} suffix={t('units.days')} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card variant="borderless">
            <Statistic title={t('stats.over90')} value={aging.over_90} formatter={(value) => formatVND(Number(value || 0))} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card variant="borderless">
            <Statistic title={t('stats.totalAging')} value={agingTotal} formatter={(value) => formatVND(Number(value || 0))} />
          </Card>
        </Col>
      </Row>

      <Card
        variant="borderless"
        title={t('aging.title')}
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[12, 12]}>
          {[
            [t('aging.current'), aging.current, 'green'],
            [t('aging.days30'), aging.days_30, 'blue'],
            [t('aging.days60'), aging.days_60, 'gold'],
            [t('aging.days90'), aging.days_90, 'orange'],
            [t('aging.over90'), aging.over_90, 'red'],
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
        title={t('table.title')}
        extra={(
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t('table.searchPlaceholder')}
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
          locale={{ emptyText: t('empty.noReceivables') }}
          expandable={hasAllocationRows ? {
            expandedRowRender: renderAllocationDetails,
            rowExpandable: (record) => Boolean(record.allocations?.length),
          } : undefined}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1180 }}
          className="account-receivables-table"
        />
      </Card>

      <style jsx global>{`
        .account-receivables-table .ant-table-expanded-row > .ant-table-cell {
          padding: 12px 24px 16px 56px !important;
          background: transparent !important;
        }

        .ar-allocation-panel {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
          overflow: hidden;
          background: rgba(15, 23, 42, 0.12);
        }

        .ar-allocation-panel .ant-empty {
          margin: 0;
          padding: 18px 12px;
        }
      `}</style>
    </AdminPageScroll>
  );
};

export default AccountReceivablesPage;
