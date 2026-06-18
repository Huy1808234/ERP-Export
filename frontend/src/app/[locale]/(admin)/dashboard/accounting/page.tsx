'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Table, Tag, Space, Button, Input, Card,
  Typography, Row, Col, Statistic, DatePicker,
  Tabs, theme, Badge, Alert,
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  SearchOutlined, ReloadOutlined,
  BankOutlined, CalculatorOutlined,
  FileSearchOutlined, RiseOutlined,
  FallOutlined,
  DollarCircleOutlined, AuditOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import AccountingReports from '@/components/admin/accounting/AccountingReports';
import AccountingProductionWorkflows from '@/components/admin/accounting/AccountingProductionWorkflows';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';
import { canReadCostFields } from '@/lib/field-access';

interface IJournalItem {
  accountCode: string;
  debit: number;
  credit: number;
  partnerId?: string;
}

interface IJournalEntry {
  _id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  status: string;
  items: IJournalItem[];
}

interface ISummaryReport {
  revenue: number;
  cogs: number;
  expenses: number;
  netProfit: number;
}

type AccountingQueryParams = {
  current: number;
  pageSize: number;
  startDate?: string;
  endDate?: string;
};

type SummaryReportResponse = {
  current?: Partial<ISummaryReport>;
  previous?: Partial<ISummaryReport>;
} & Partial<ISummaryReport>;

type JournalListResponse = {
  results?: IJournalEntry[];
  meta?: {
    total?: number;
  };
};

const { Text } = Typography;
const { RangePicker } = DatePicker;

const AccountingPage = () => {
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const canViewCost = canReadCostFields(session?.user);
  const { token } = theme.useToken();
  const t = useTranslations('Accounting');

  const [journals, setJournals] = useState<IJournalEntry[]>([]);
  const [summary, setSummary] = useState<ISummaryReport>({ revenue: 0, cogs: 0, expenses: 0, netProfit: 0 });
  const [loading, setLoading] = useState(true);
  const [journalSearch, setJournalSearch] = useState('');
  const [meta, setMeta] = useState({ current: 1, pageSize: 10, total: 0 });
  const { current, pageSize } = meta;
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const fetchAccountingData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const queryParams: AccountingQueryParams = {
        current,
        pageSize,
      };

      if (dateRange && dateRange[0] && dateRange[1]) {
        queryParams.startDate = dateRange[0].startOf('day').toISOString();
        queryParams.endDate = dateRange[1].endOf('day').toISOString();
      }

      const summaryRes = await sendRequest<IBackendRes<SummaryReportResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/summary`,
        method: 'GET',
        queryParams,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (summaryRes?.data) {
        const summaryData = summaryRes.data.current ?? summaryRes.data;
        setSummary({ revenue: 0, cogs: 0, expenses: 0, netProfit: 0, ...summaryData });
      }

      const journalRes = await sendRequest<IBackendRes<JournalListResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/journal`,
        method: 'GET',
        queryParams,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (journalRes?.data) {
        setJournals(journalRes.data.results || []);
        setMeta((prev) => ({ ...prev, total: journalRes.data?.meta?.total || 0 }));
      }
    } finally {
      setLoading(false);
    }
  }, [current, pageSize, accessToken, dateRange]);

  useEffect(() => {
    fetchAccountingData();
  }, [fetchAccountingData]);

  const normalizedJournalSearch = journalSearch.trim().toLowerCase();
  const matchesJournalSearch = (value?: string | number | null) => (
    String(value ?? '').toLowerCase().includes(normalizedJournalSearch)
  );
  const visibleJournals = normalizedJournalSearch
    ? journals.filter((journal) => (
        matchesJournalSearch(journal.entryNumber)
        || matchesJournalSearch(journal.description)
        || matchesJournalSearch(journal.referenceType)
        || matchesJournalSearch(journal.referenceId)
        || journal.items?.some((item) => (
          matchesJournalSearch(item.accountCode) || matchesJournalSearch(item.partnerId)
        ))
      ))
    : journals;

  const getJournalTotal = (items: IJournalItem[] = [], side: 'debit' | 'credit') => (
    items.reduce((total, item) => total + Number(item[side] || 0), 0)
  );

  const journalLineColumns: TableColumnsType<IJournalItem> = [
    {
      title: t('reports.columns.account'),
      dataIndex: 'accountCode',
      key: 'accountCode',
      width: 180,
      render: (accountCode: string) => <Text strong style={{ color: token.colorPrimary }}>{accountCode}</Text>,
    },
    {
      title: t('workflows.closePolicy.totalDebit'),
      dataIndex: 'debit',
      key: 'debit',
      align: 'right',
      render: (value: number) => (
        Number(value) > 0 ? <Text type="success">{Number(value).toLocaleString()}</Text> : '-'
      ),
    },
    {
      title: t('workflows.closePolicy.totalCredit'),
      dataIndex: 'credit',
      key: 'credit',
      align: 'right',
      render: (value: number) => (
        Number(value) > 0 ? <Text type="danger">{Number(value).toLocaleString()}</Text> : '-'
      ),
    },
  ];

  const columns: TableColumnsType<IJournalEntry> = [
    {
      title: t('table.entryNumber'),
      dataIndex: 'entryNumber',
      key: 'entryNumber',
      width: 220,
      render: (text: string, record: IJournalEntry) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(record.entryDate).format('DD/MM/YYYY')}</Text>
        </Space>
      ),
    },
    {
      title: t('table.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('table.entryDetails'),
      key: 'totals',
      width: 260,
      render: (_value: unknown, record: IJournalEntry) => (
        <Space orientation="vertical" size={0} style={{ width: '100%' }}>
          <Text type="secondary">{record.items?.length || 0} dòng định khoản</Text>
          <Space orientation="horizontal" size={12} wrap>
            <Text type="success">{getJournalTotal(record.items, 'debit').toLocaleString()}</Text>
            <Text type="danger">{getJournalTotal(record.items, 'credit').toLocaleString()}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: t('table.reference'),
      key: 'ref',
      width: 220,
      render: (_value: unknown, record: IJournalEntry) => (
        record.referenceType ? <Tag color="blue">{record.referenceType}: {record.referenceId?.substring(0, 8)}</Tag> : '-'
      ),
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => (
        <Badge status={status === 'POSTED' ? 'success' : 'processing'} text={status} />
      ),
    },
  ];

  return (
    <AdminPageScroll>
      <Row justify="space-between" align="bottom" style={{ marginBottom: '24px' }}>
        <Col>
          <PageHeader
            title={t('title')}
            icon={<BankOutlined />}
            description={t('description')}
          />
        </Col>
        <Col>
          <Space orientation="horizontal">
            <RangePicker
              style={{ height: 40, borderRadius: 8 }}
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchAccountingData} size="large">{t('actions.refresh')}</Button>
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              size="large"
              disabled={!dateRange?.[0] || !dateRange?.[1]}
              onClick={async () => {
                if (!accessToken) return;
                const res = await sendRequest<IBackendRes<unknown>>({
                  url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/close-period`,
                  method: 'POST',
                  body: {
                    startDate: dateRange?.[0]?.toISOString(),
                    endDate: dateRange?.[1]?.toISOString(),
                  },
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (res?.data) {
                  fetchAccountingData();
                }
              }}
            >
              {t('actions.closePeriod')}
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} xl={canViewCost ? 6 : 8}>
          <Card size="small" variant="borderless" style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
            <Statistic
              title={t('summary.revenue')}
              value={summary.revenue}
              precision={0}
              suffix="VND"
              styles={{ content: { color: token.colorSuccess } }}
              prefix={<RiseOutlined />}
            />
          </Card>
        </Col>
        {canViewCost ? <>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small" variant="borderless" style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
            <Statistic
              title={t('summary.cogs')}
              value={summary.cogs}
              precision={0}
              suffix="VND"
              styles={{ content: { color: token.colorWarning } }}
              prefix={<FallOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small" variant="borderless" style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
            <Statistic
              title={t('summary.expenses')}
              value={summary.expenses}
              precision={0}
              suffix="VND"
              styles={{ content: { color: token.colorError } }}
              prefix={<FallOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small" variant="borderless" style={{ borderRadius: 12, background: token.colorPrimaryBg }} styles={{ body: { padding: 16 } }}>
            <Statistic
              title={t('summary.netProfit')}
              value={summary.netProfit}
              precision={0}
              suffix="VND"
              styles={{ content: { color: token.colorPrimary, fontWeight: 800 } }}
              prefix={<DollarCircleOutlined />}
            />
          </Card>
        </Col>
        </> : (
          <Col xs={24} xl={16}>
            <Card size="small" variant="borderless" style={{ borderRadius: 12, height: '100%' }} styles={{ body: { padding: 16 } }}>
              <Alert
                type="info"
                showIcon
                title={t('alerts.costHiddenTitle')}
                description={t('alerts.costHiddenDescription')}
              />
            </Card>
          </Col>
        )}
      </Row>

      <Tabs
        defaultActiveKey="1"
        type="card"
        destroyOnHidden
        items={[
          {
            key: '1',
            label: <Space orientation="horizontal"><AuditOutlined />{t('tabs.journal')}</Space>,
            children: (
              <Card variant="borderless" style={{ borderRadius: '0 0 16px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} styles={{ body: { padding: 0 } }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <Input
                    placeholder={t('filters.searchPlaceholder')}
                    prefix={<SearchOutlined />}
                    value={journalSearch}
                    onChange={(event) => {
                      setJournalSearch(event.target.value);
                      setMeta((prev) => ({ ...prev, current: 1 }));
                    }}
                    allowClear
                    style={{ width: 300, borderRadius: 8 }}
                  />
                  <Space orientation="horizontal">
                    <Text type="secondary">{t('journalHint')}</Text>
                  </Space>
                </div>
                <Table
                  columns={columns}
                  dataSource={visibleJournals}
                  rowKey="_id"
                  loading={loading}
                  size="middle"
                  scroll={{ x: 1080 }}
                  expandable={{
                    expandedRowRender: (record) => (
                      <div style={{ padding: '4px 16px 12px 48px' }}>
                        <Table<IJournalItem>
                          rowKey={(item) => `${record._id}-${item.accountCode}-${item.debit}-${item.credit}-${item.partnerId || 'none'}`}
                          columns={journalLineColumns}
                          dataSource={record.items || []}
                          pagination={false}
                          size="small"
                        />
                      </div>
                    ),
                    rowExpandable: (record) => Boolean(record.items?.length),
                  }}
                  locale={{ emptyText: t('empty.noJournal') }}
                  pagination={{
                    current: normalizedJournalSearch ? 1 : current,
                    pageSize,
                    total: normalizedJournalSearch ? visibleJournals.length : meta.total,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50'],
                    onChange: (page, nextPageSize) => {
                      setMeta((prev) => ({
                        ...prev,
                        current: nextPageSize === prev.pageSize ? page : 1,
                        pageSize: nextPageSize,
                      }));
                    },
                  }}
                />
              </Card>
            ),
          },
          {
            key: '2',
            label: <Space orientation="horizontal"><FileSearchOutlined />{t('tabs.reports')}</Space>,
            children: (
              <AccountingReports accessToken={accessToken ?? ''} dateRange={dateRange} canViewCost={canViewCost} />
            ),
          },
          {
            key: '3',
            label: <Space orientation="horizontal"><CalculatorOutlined />{t('tabs.workflows')}</Space>,
            children: (
              <AccountingProductionWorkflows accessToken={accessToken ?? ''} />
            ),
          },
        ]}
      />
    </AdminPageScroll>
  );
};

export default AccountingPage;
