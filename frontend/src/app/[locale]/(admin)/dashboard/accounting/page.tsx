'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Table, Tag, Space, Button, Input, Card,
  Typography, Row, Col, Statistic, DatePicker,
  Tabs, theme, Badge, Alert,
} from 'antd';
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
  const [meta, setMeta] = useState({ current: 1, pageSize: 10, total: 0 });
  const { current, pageSize } = meta;
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const fetchAccountingData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const queryParams: any = {
        current,
        pageSize,
      };

      if (dateRange && dateRange[0] && dateRange[1]) {
        queryParams.startDate = dateRange[0].startOf('day').toISOString();
        queryParams.endDate = dateRange[1].endOf('day').toISOString();
      }

      const summaryRes = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/summary`,
        method: 'GET',
        queryParams,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (summaryRes?.data) {
        const summaryData = summaryRes.data.current ?? summaryRes.data;
        setSummary({ revenue: 0, cogs: 0, expenses: 0, netProfit: 0, ...summaryData });
      }

      const journalRes = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/journal`,
        method: 'GET',
        queryParams,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (journalRes?.data) {
        setJournals(journalRes.data.results);
        setMeta((prev) => ({ ...prev, total: journalRes.data.meta.total }));
      }
    } finally {
      setLoading(false);
    }
  }, [current, pageSize, accessToken, dateRange]);

  useEffect(() => {
    fetchAccountingData();
  }, [fetchAccountingData]);

  const columns = [
    {
      title: t('table.entryNumber'),
      dataIndex: 'entryNumber',
      key: 'entryNumber',
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
      width: '30%',
    },
    {
      title: t('table.entryDetails'),
      key: 'items',
      render: (_: any, record: IJournalEntry) => (
        <div style={{ background: '#fcfcfc', padding: '8px', borderRadius: '8px' }}>
          {record.items?.map((item, index) => (
            <Row key={`${item.accountCode}-${index}`} gutter={16} style={{ marginBottom: 4 }}>
              <Col span={6}>
                <Text strong style={{ color: token.colorPrimary }}>{item.accountCode}</Text>
              </Col>
              <Col span={9} style={{ textAlign: 'right' }}>
                {item.debit > 0 && <Text type="success">{item.debit.toLocaleString()}</Text>}
              </Col>
              <Col span={9} style={{ textAlign: 'right' }}>
                {item.credit > 0 && <Text type="danger">{item.credit.toLocaleString()}</Text>}
              </Col>
            </Row>
          ))}
        </div>
      ),
    },
    {
      title: t('table.reference'),
      key: 'ref',
      render: (_: any, record: IJournalEntry) => (
        record.referenceType ? <Tag color="blue">{record.referenceType}: {record.referenceId?.substring(0, 8)}</Tag> : '-'
      ),
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      key: 'status',
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
              onClick={async () => {
                if (!accessToken) return;
                const res = await sendRequest<IBackendRes<any>>({
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

      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={canViewCost ? 6 : 8}>
          <Card variant="borderless" style={{ borderRadius: 16 }}>
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
        <Col span={6}>
          <Card variant="borderless" style={{ borderRadius: 16 }}>
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
        <Col span={6}>
          <Card variant="borderless" style={{ borderRadius: 16 }}>
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
        <Col span={6}>
          <Card variant="borderless" style={{ borderRadius: 16, background: token.colorPrimaryBg }}>
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
          <Col span={16}>
            <Card variant="borderless" style={{ borderRadius: 16, height: '100%' }}>
              <Alert
                type="info"
                showIcon
                title="Chỉ số giá vốn và lợi nhuận đang được ẩn"
                description="Tài khoản hiện tại không có quyền read:cost_fields nên các KPI COGS, chi phí và lợi nhuận không được hiển thị trên admin."
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
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                  <Input
                    placeholder={t('filters.searchPlaceholder')}
                    prefix={<SearchOutlined />}
                    style={{ width: 300, borderRadius: 8 }}
                  />
                  <Space orientation="horizontal">
                    <Text type="secondary">{t('journalHint')}</Text>
                  </Space>
                </div>
                <Table
                  columns={columns}
                  dataSource={journals}
                  rowKey="_id"
                  loading={loading}
                  pagination={{
                    current,
                    pageSize,
                    total: meta.total,
                    onChange: (page) => setMeta((prev) => ({ ...prev, current: page })),
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
            label: <Space orientation="horizontal"><CalculatorOutlined />Workflow kế toán</Space>,
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
