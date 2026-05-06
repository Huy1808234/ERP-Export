'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Table, Tag, Space, Button, Input, Card, 
  Typography, Row, Col, Statistic, DatePicker,
  Tabs, theme, Badge, Tooltip, Avatar
} from 'antd';
import { 
  SearchOutlined, ReloadOutlined, 
  BankOutlined, CalculatorOutlined, 
  FileSearchOutlined, RiseOutlined,
  FallOutlined, TransactionOutlined,
  DollarCircleOutlined, AuditOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/library/theme.context';
import { sendRequest } from '@/utils/api';
import dayjs, { Dayjs } from 'dayjs';

interface IJournalItem {
  accountCode: string;
  debit: number;
  credit: number;
  partnerId?: string;
}

interface IJournalEntry {
  id: string;
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

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const AccountingPage = () => {
  const { data: session } = useSession();
  const accessToken = (session as any)?.user?.access_token;
  const { token } = theme.useToken();
  const { isDark } = useTheme();

  // --- States ---
  const [journals, setJournals] = useState<IJournalEntry[]>([]);
  const [summary, setSummary] = useState<ISummaryReport>({ revenue: 0, cogs: 0, expenses: 0, netProfit: 0 });
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current: 1, pageSize: 10, total: 0 });
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  // --- Logic Fetch ---
  const fetchAccountingData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const queryParams: any = {
        current: meta.current,
        pageSize: meta.pageSize,
      };

      if (dateRange && dateRange[0] && dateRange[1]) {
        queryParams.startDate = dateRange[0].startOf('day').toISOString();
        queryParams.endDate = dateRange[1].endOf('day').toISOString();
      }

      // 1. Fetch Summary Report
      const summaryRes = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/summary`,
        method: 'GET',
        queryParams,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (summaryRes?.data) setSummary(summaryRes.data);

      // 2. Fetch Journal Entries
      const journalRes = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/journal`,
        method: 'GET',
        queryParams,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (journalRes?.data) {
        setJournals(journalRes.data.results);
        setMeta(prev => ({ ...prev, total: journalRes.data.meta.total }));
      }
    } finally {
      setLoading(false);
    }
  }, [meta.current, meta.pageSize, accessToken, dateRange]);

  useEffect(() => {
    fetchAccountingData();
  }, [fetchAccountingData]);

  // --- Table Columns for Journal ---
  const columns = [
    {
      title: 'MÃ BÚT TOÁN',
      dataIndex: 'entryNumber',
      key: 'entryNumber',
      render: (text: string, record: any) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(record.entryDate).format('DD/MM/YYYY')}</Text>
        </Space>
      ),
    },
    {
      title: 'DIỄN GIẢI',
      dataIndex: 'description',
      key: 'description',
      width: '30%',
    },
    {
      title: 'CHI TIẾT ĐỊNH KHOẢN (NỢ / CÓ)',
      key: 'items',
      render: (_: any, record: any) => (
        <div style={{ background: isDark ? '#1f1f1f' : '#fcfcfc', padding: '8px', borderRadius: '8px' }}>
          {record.items?.map((item: any, idx: number) => (
            <Row key={idx} gutter={16} style={{ marginBottom: 4 }}>
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
      title: 'THAM CHIẾU',
      key: 'ref',
      render: (_: any, record: any) => (
        record.referenceType ? <Tag color="blue">{record.referenceType}: {record.referenceId?.substring(0, 8)}</Tag> : '-'
      ),
    },
    {
      title: 'TRẠNG THÁI',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge status={status === 'POSTED' ? 'success' : 'processing'} text={status} />
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', backgroundColor: token.colorBgLayout, minHeight: '100vh' }}>
      <Row justify="space-between" align="bottom" style={{ marginBottom: '24px' }}>
        <Col>
          <PageHeader 
            title="Kế Toán Tài Chính" 
            icon={<BankOutlined />} 
            description="Quản lý nhật ký chung, sổ cái và báo cáo kết quả kinh doanh tự động" 
          />
        </Col>
        <Col>
          <Space>
            <RangePicker 
              style={{ height: 40, borderRadius: 8 }} 
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchAccountingData} size="large">Làm mới</Button>
            <Button type="primary" icon={<CalculatorOutlined />} size="large">Kết chuyển cuối kỳ</Button>
          </Space>
        </Col>
      </Row>

      {/* Financial Summary */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card variant="borderless" style={{ borderRadius: 16 }}>
            <Statistic 
              title="Tổng Doanh Thu" 
              value={summary.revenue} 
              precision={0}
              suffix="VND"
              prefix={<RiseOutlined style={{ color: token.colorSuccess }} />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ borderRadius: 16 }}>
            <Statistic 
              title="Giá Vốn Hàng Bán" 
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
              title="Chi Phí Vận Hành" 
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
              title="Lợi Nhuận Thuần" 
              value={summary.netProfit} 
              precision={0}
              suffix="VND"
              styles={{ content: { color: token.colorPrimary, fontWeight: 800 } }}
              prefix={<DollarCircleOutlined />} 
            />
          </Card>
        </Col>
      </Row>

      <Tabs 
        defaultActiveKey="1"
        type="card"
        items={[
          {
            key: '1',
            label: <Space><AuditOutlined />Nhật ký chung</Space>,
            children: (
              <Card variant="borderless" style={{ borderRadius: '0 0 16px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} styles={{ body: { padding: 0 } }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                  <Input 
                    placeholder="Tìm theo diễn giải hoặc mã..." 
                    prefix={<SearchOutlined />} 
                    style={{ width: 300, borderRadius: 8 }}
                  />
                  <Space>
                    <Text type="secondary">Tất cả các bút toán được sinh tự động từ các nghiệp vụ Kho & Bán hàng</Text>
                  </Space>
                </div>
                <Table 
                  columns={columns} 
                  dataSource={journals} 
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: meta.current,
                    pageSize: meta.pageSize,
                    total: meta.total,
                    onChange: (page) => setMeta(prev => ({ ...prev, current: page })),
                  }}
                />
              </Card>
            )
          },
          {
            key: '2',
            label: <Space><FileSearchOutlined />Báo cáo Tài chính</Space>,
            children: (
              <Card variant="borderless" style={{ borderRadius: '0 0 16px 16px', minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Space orientation="vertical" align="center">
                  <Avatar size={64} icon={<CalculatorOutlined />} style={{ background: token.colorPrimaryBg, color: token.colorPrimary }} />
                  <Title level={4}>Tính năng Báo cáo chi tiết đang được phát triển</Title>
                  <Text type="secondary">Hệ thống đang thu thập dữ liệu từ các bút toán để lập Bảng cân đối kế toán và P&L chi tiết.</Text>
                </Space>
              </Card>
            )
          }
        ]}
      />
    </div>
  );
};

export default AccountingPage;
