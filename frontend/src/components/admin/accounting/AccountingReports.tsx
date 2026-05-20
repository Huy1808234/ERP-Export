'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Row, Col, Card, Statistic, Table, Typography, 
  Tabs, theme, Spin, Button, Progress, Space, Avatar, Divider, Empty, Badge, Tooltip,
  Tag, Modal, ConfigProvider
} from 'antd';
import { 
  RiseOutlined, FallOutlined, 
  DollarCircleOutlined, PieChartOutlined,
  ReloadOutlined, HistoryOutlined,
  CalendarOutlined, ArrowUpOutlined,
  BarChartOutlined, BankOutlined,
  AreaChartOutlined, PercentageOutlined,
  ExportOutlined, FileExcelOutlined,
  SwapOutlined, WalletOutlined,
  LineChartOutlined, InfoCircleOutlined,
  ArrowRightOutlined,
  FilterOutlined,
  DoubleRightOutlined
} from '@ant-design/icons';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, 
  Legend, AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, ComposedChart
} from 'recharts';
import { sendRequest } from '@/lib/api-client';
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import dayjs, { type Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const { Text, Title } = Typography;

interface IAccountingReportsProps {
  accessToken: string;
  dateRange: [Dayjs | null, Dayjs | null] | null;
  canViewCost: boolean;
}

type ReportQueryParams = {
  startDate?: string;
  endDate?: string;
};

type MoneyPeriod = {
  revenue?: number;
  cogs?: number;
  expenses?: number;
  netProfit?: number;
};

type AccountingSummaryReport = {
  current?: MoneyPeriod;
  previous?: MoneyPeriod;
};

type AgingReport = {
  current?: number;
  days_30?: number;
  days_60?: number;
  days_90?: number;
  over_90?: number;
};

type BalanceSheetLine = {
  key?: string;
  code?: string;
  name: string;
  balance: number;
  bold?: boolean;
};

type BalanceSheetReport = {
  assets?: BalanceSheetLine[];
  liabilities?: BalanceSheetLine[];
  equity?: BalanceSheetLine[];
};

type TrendReportLine = {
  month: string;
  revenue?: number;
  netProfit?: number;
};

type CashFlowReport = {
  operatingInflow?: number;
  operatingOutflow?: number;
  netCashFlow?: number;
};

type RatioReport = {
  grossMargin?: number;
  netMargin?: number;
  inventoryTurnover?: number;
};

type PieLine = {
  name: string;
  value: number;
};

type ProfitLossRow = {
  key: string;
  label: string;
  curr?: number;
  prev?: number;
  bold?: boolean;
  indent?: boolean;
  color?: string;
};

const toNumber = (value: unknown) => Number(value || 0);
const formatMoneyText = (value: unknown) => `${toNumber(value).toLocaleString()} VND`;
const agingTotal = (aging?: AgingReport | null) =>
  toNumber(aging?.current) +
  toNumber(aging?.days_30) +
  toNumber(aging?.days_60) +
  toNumber(aging?.days_90) +
  toNumber(aging?.over_90);
const ratioPercent = (value?: number) => Number(value || 0) * 100;

const AccountingReports: React.FC<IAccountingReportsProps> = ({ accessToken, dateRange, canViewCost }) => {
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AccountingSummaryReport | null>(null);
  const [apAging, setApAging] = useState<AgingReport | null>(null);
  const [arAging, setArAging] = useState<AgingReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [trend, setTrend] = useState<TrendReportLine[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null);
  const [ratios, setRatios] = useState<RatioReport | null>(null);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const queryParams: ReportQueryParams = {};
      if (dateRange && dateRange[0] && dateRange[1]) {
        queryParams.startDate = dateRange[0].startOf('day').toISOString();
        queryParams.endDate = dateRange[1].endOf('day').toISOString();
      }

      const [summaryRes, apRes, arRes, balanceRes, trendRes, cashRes, ratioRes] = await Promise.all([
        sendRequest<IBackendRes<AccountingSummaryReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/summary`,
          method: 'GET',
          queryParams,
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<AgingReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/aging`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<AgingReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/ar-aging`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<BalanceSheetReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/balance-sheet`,
          method: 'GET',
          queryParams,
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<TrendReportLine[]>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/trend`,
          method: 'GET',
          queryParams,
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<CashFlowReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/cash-flow`,
          method: 'GET',
          queryParams,
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<RatioReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/ratios`,
          method: 'GET',
          queryParams,
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      ]);

      if (summaryRes?.data) setSummary(summaryRes.data);
      if (apRes?.data) setApAging(apRes.data);
      if (arRes?.data) setArAging(arRes.data);
      if (balanceRes?.data) setBalanceSheet(balanceRes.data);
      if (trendRes?.data) setTrend(trendRes.data);
      if (cashRes?.data) setCashFlow(cashRes.data);
      if (ratioRes?.data) setRatios(ratioRes.data);
    } finally {
      setLoading(false);
    }
  }, [accessToken, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const protectedRows = canViewCost ? [
      ["Giá vốn", summary?.current?.cogs, summary?.previous?.cogs],
      ["Chi phí", summary?.current?.expenses, summary?.previous?.expenses],
      ["Lợi nhuận thuần", summary?.current?.netProfit, summary?.previous?.netProfit],
    ] : [];
    
    const summaryData = [
      ["BÁO CÁO KẾT QUẢ KINH DOANH"],
      ["Từ ngày", dateRange?.[0]?.format('DD/MM/YYYY')],
      ["Đến ngày", dateRange?.[1]?.format('DD/MM/YYYY')],
      [""],
      ["Chỉ tiêu", "Kỳ này (VND)", "Kỳ trước (VND)"],
      ["Doanh thu", summary?.current?.revenue, summary?.previous?.revenue],
      ["Giá vốn", summary?.current?.cogs, summary?.previous?.cogs],
      ["Chi phí", summary?.current?.expenses, summary?.previous?.expenses],
      ["Lợi nhuận thuần", summary?.current?.netProfit, summary?.previous?.netProfit]
    ];
    summaryData.splice(6, 3, ...protectedRows);
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "P&L");

    const bsData = [
      ["BẢNG CÂN ĐỐI KẾ TOÁN"],
      [""],
      ["Tài khoản", "Số dư (VND)"],
      ["--- TÀI SẢN ---"],
      ...(balanceSheet?.assets || []).map((asset) => [asset.name, asset.balance]),
      [""],
      ["--- NGUỒN VỐN ---"],
      ...(balanceSheet?.liabilities || []).map((liability) => [liability.name, liability.balance]),
      ...(balanceSheet?.equity || []).map((equity) => [equity.name, equity.balance]),
    ];
    const wsBS = XLSX.utils.aoa_to_sheet(bsData);
    XLSX.utils.book_append_sheet(wb, wsBS, "Balance Sheet");

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `Bao_Cao_Tai_Chinh_${dayjs().format('YYYYMMDD')}.xlsx`);
  };

  if (loading && !summary) return (
    <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: token.colorBgContainer, borderRadius: 16 }}>
      <Spin size="large" description="Đang khởi tạo báo cáo tài chính cao cấp..." />
    </div>
  );

  const COLORS = [token.colorPrimary, '#13c2c2', '#fa8c16', '#eb2f96', '#722ed1', '#2f54eb'];

  const assetPieData: PieLine[] = (balanceSheet?.assets || []).map((asset) => ({ name: asset.name, value: asset.balance }));
  const equityLiabPieData = [
    ...(balanceSheet?.liabilities || []),
    ...(balanceSheet?.equity || [])
  ].map((item) => ({ name: item.name, value: item.balance }));

  const calculateTrend = (curr?: number, prev?: number) => {
    const currentValue = Number(curr || 0);
    const previousValue = Number(prev || 0);
    if (!previousValue) return 0;
    return ((currentValue - previousValue) / previousValue) * 100;
  };

  const renderTrendTag = (value: number) => {
    const isPos = value >= 0;
    return (
      <Tag color={isPos ? 'success' : 'error'} variant="filled" style={{ borderRadius: 20, padding: '0 8px' }}>
        <Space orientation="horizontal" size={4}>
          {isPos ? <RiseOutlined /> : <FallOutlined />}
          {Math.abs(value).toFixed(1)}%
        </Space>
      </Tag>
    );
  };

  return (
    <div style={{ marginTop: 24 }}>
      {/* --- Top Header KPI Cards --- */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ borderRadius: 16, background: `linear-gradient(135deg, ${token.colorPrimary}10 0%, ${token.colorPrimary}20 100%)` }}>
            <Statistic 
              title={<Space orientation="horizontal" size={4}><RiseOutlined /> Doanh thu thuần</Space>}
              value={summary?.current?.revenue}
              suffix="VND"
              styles={{ content: { color: token.colorPrimary, fontWeight: 700, fontSize: 24 } }}
            />
            <div style={{ marginTop: 8 }}>
              {renderTrendTag(calculateTrend(summary?.current?.revenue, summary?.previous?.revenue))}
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>so với kỳ trước</Text>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ borderRadius: 16, background: `linear-gradient(135deg, ${token.colorSuccess}10 0%, ${token.colorSuccess}20 100%)` }}>
            <Statistic 
              title={<Space orientation="horizontal" size={4}><DollarCircleOutlined /> Lợi nhuận ròng</Space>}
              value={canViewCost ? summary?.current?.netProfit : 0}
              formatter={(value) => canViewCost ? Number(value || 0).toLocaleString() : 'Ẩn theo phân quyền'}
              suffix={canViewCost ? 'VND' : undefined}
              styles={{ content: { color: token.colorSuccess, fontWeight: 700, fontSize: 24 } }}
            />
            <div style={{ marginTop: 8 }}>
              {canViewCost ? renderTrendTag(calculateTrend(summary?.current?.netProfit, summary?.previous?.netProfit)) : <Tag>read:cost_fields</Tag>}
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>so với kỳ trước</Text>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ borderRadius: 16, background: `linear-gradient(135deg, ${token.colorWarning}10 0%, ${token.colorWarning}20 100%)` }}>
            <Statistic 
              title={<Space orientation="horizontal" size={4}><WalletOutlined /> Dòng tiền thuần</Space>}
              value={cashFlow?.netCashFlow}
              suffix="VND"
              styles={{ content: { color: token.colorWarningText, fontWeight: 700, fontSize: 24 } }}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color="warning" variant="filled" style={{ borderRadius: 20 }}>Dòng tiền dương</Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ borderRadius: 16, background: `linear-gradient(135deg, ${token.colorInfo}10 0%, ${token.colorInfo}20 100%)` }}>
            <Statistic 
              title={<Space orientation="horizontal" size={4}><HistoryOutlined /> Phải thu KH</Space>}
              value={agingTotal(arAging)}
              suffix="VND"
              styles={{ content: { color: token.colorInfoText, fontWeight: 700, fontSize: 24 } }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Tổng dư nợ khách hàng</Text>
            </div>
          </Card>
        </Col>
      </Row>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Space orientation="horizontal">
          <Button icon={<FilterOutlined />} variant="outlined">Bộ lọc nâng cao</Button>
          <Button icon={<FileExcelOutlined />} type="primary" onClick={exportToExcel} style={{ borderRadius: 8 }}>Xuất Excel</Button>
        </Space>
      </div>
      
      <Tabs 
        defaultActiveKey="pl"
        destroyOnHidden
        items={[
          {
            key: 'pl',
            label: <Space orientation="horizontal"><BarChartOutlined />Kết quả Kinh doanh (P&L)</Space>,
            children: (
              <Row gutter={[24, 24]}>
                <Col span={16}>
                  <Card variant="borderless" style={{ borderRadius: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                      <div>
                        <Title level={4} style={{ margin: 0 }}>Xu hướng Tài chính</Title>
                        <Text type="secondary">Phân tích biến động doanh thu & lợi nhuận qua các kỳ</Text>
                      </div>
                      <Space orientation="horizontal" size={16}>
                        <Badge color={token.colorPrimary} text="Doanh thu" />
                        {canViewCost && <Badge color={token.colorSuccess} text="Lợi nhuận" />}
                      </Space>
                    </div>
                    <div style={{ height: 400, width: '100%', minWidth: 0 }}>
                      <SafeResponsiveContainer height={400}>
                        <AreaChart data={trend}>
                          <defs>
                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={token.colorPrimary} stopOpacity={0.15}/>
                              <stop offset="95%" stopColor={token.colorPrimary} stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={token.colorSuccess} stopOpacity={0.15}/>
                              <stop offset="95%" stopColor={token.colorSuccess} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={token.colorBorderSecondary} />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: token.colorTextSecondary}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} tick={{fill: token.colorTextSecondary}} />
                          <ReTooltip 
                            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '12px' }}
                            formatter={(value: unknown) => [formatMoneyText(value), '']}
                          />
                          <Area type="monotone" dataKey="revenue" stroke={token.colorPrimary} fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                          {canViewCost && <Area type="monotone" dataKey="netProfit" stroke={token.colorSuccess} fillOpacity={1} fill="url(#colorProf)" strokeWidth={3} strokeDasharray="5 5" />}
                        </AreaChart>
                      </SafeResponsiveContainer>
                    </div>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card variant="borderless" style={{ borderRadius: 16, height: '100%' }} title={<Title level={5} style={{margin: 0}}>Chỉ số Hiệu quả</Title>}>
                    {canViewCost ? <Space orientation="vertical" style={{ width: '100%' }} size={24}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text type="secondary">Biên lợi nhuận gộp</Text>
                          <Text strong>{ratioPercent(ratios?.grossMargin).toFixed(1)}%</Text>
                        </div>
                        <Progress percent={Math.round(ratioPercent(ratios?.grossMargin))} status="active" strokeColor={token.colorSuccess} showInfo={false} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text type="secondary">Biên lợi nhuận ròng</Text>
                          <Text strong>{ratioPercent(ratios?.netMargin).toFixed(1)}%</Text>
                        </div>
                        <Progress percent={Math.round(ratioPercent(ratios?.netMargin))} status="active" strokeColor={token.colorPrimary} showInfo={false} />
                      </div>
                      <Divider style={{ margin: '12px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">Vòng quay tồn kho</Text>
                        <Text strong>{ratios?.inventoryTurnover?.toFixed(2)} lần</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">Khả năng thanh toán</Text>
                        <Tag color="cyan">1.2 (Ổn định)</Tag>
                      </div>
                    </Space> : (
                      <Empty description="Chỉ số biên lợi nhuận và vòng quay tồn kho đang được ẩn theo phân quyền" />
                    )}
                  </Card>
                </Col>
                <Col span={24}>
                  <Card variant="borderless" style={{ borderRadius: 16 }} styles={{ body: { padding: 0 } }}>
                    <Table 
                      pagination={false} 
                      rowKey="key"
                      dataSource={[
                        { key: '1', label: '1. Doanh thu bán hàng và cung cấp dịch vụ', curr: summary?.current?.revenue, prev: summary?.previous?.revenue, bold: true },
                        { key: '2', label: '2. Các khoản giảm trừ doanh thu', curr: 0, prev: 0, indent: true },
                        { key: '3', label: '3. Doanh thu thuần', curr: summary?.current?.revenue, prev: summary?.previous?.revenue, bold: true },
                        ...(canViewCost ? [
                          { key: '4', label: '4. Giá vốn hàng bán', curr: -(summary?.current?.cogs || 0), prev: -(summary?.previous?.cogs || 0), color: token.colorError, indent: true },
                          { key: '5', label: '5. Lợi nhuận gộp về bán hàng', curr: ((summary?.current?.revenue || 0) - (summary?.current?.cogs || 0)), prev: ((summary?.previous?.revenue || 0) - (summary?.previous?.cogs || 0)), bold: true, color: token.colorSuccess },
                          { key: '6', label: '6. Chi phí bán hàng & QL doanh nghiệp', curr: -(summary?.current?.expenses || 0), prev: -(summary?.previous?.expenses || 0), color: token.colorError, indent: true },
                          { key: '7', label: '7. Lợi nhuận thuần từ hoạt động kinh doanh', curr: summary?.current?.netProfit, prev: summary?.previous?.netProfit, bold: true, color: token.colorPrimary },
                        ] : [
                          { key: 'hidden', label: '4. Giá vốn, chi phí và lợi nhuận', curr: undefined, prev: undefined, bold: true, color: token.colorTextSecondary },
                        ]),
                      ]}
                      columns={[
                        { 
                          title: 'CHỈ TIÊU', 
                          dataIndex: 'label', 
                          key: 'label',
                          render: (text, record) => (
                            <Text strong={record.bold} style={{ paddingLeft: record.indent ? 24 : 0 }}>{text}</Text>
                          )
                        },
                        { 
                          title: 'KỲ NÀY (VND)', 
                          dataIndex: 'curr', 
                          key: 'curr', 
                          align: 'right',
                          render: (val, record) => (
                            <Text strong={record.bold} style={{ color: record.color }}>{val === undefined ? 'Ẩn theo phân quyền' : val?.toLocaleString()}</Text>
                          )
                        },
                        { 
                          title: 'KỲ TRƯỚC (VND)', 
                          dataIndex: 'prev', 
                          key: 'prev', 
                          align: 'right',
                          render: (val, record) => (
                            <Text type="secondary" style={{ opacity: 0.7 }}>{val === undefined ? 'Ẩn theo phân quyền' : val?.toLocaleString()}</Text>
                          )
                        },
                        {
                          title: '% Tăng/Giảm',
                          key: 'trend',
                          align: 'center',
                          render: (_, record) => {
                            if (record.curr === undefined || record.prev === undefined) return <Text type="secondary">-</Text>;
                            const t = calculateTrend(record.curr, record.prev);
                            return renderTrendTag(t);
                          }
                        },
                        { 
                          title: 'CHI TIẾT', 
                          key: 'action', 
                          align: 'center',
                          render: () => (
                            <Tooltip title="Truy xuất sổ chi tiết">
                              <Button type="text" shape="circle" icon={<ArrowRightOutlined />} />
                            </Tooltip>
                          )
                        },
                      ]}
                    />
                  </Card>
                </Col>
              </Row>
            )
          },
          {
            key: 'bs',
            label: <Space orientation="horizontal"><BankOutlined />Bảng cân đối kế toán</Space>,
            children: (
              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <Card title="Cơ cấu Tài sản" variant="borderless" style={{ borderRadius: 16 }}>
                    <div style={{ height: 200, display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '60%', height: 200, minWidth: 0 }}>
                        <SafeResponsiveContainer height={200}>
                          <PieChart>
                            <Pie data={assetPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                              {assetPieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <ReTooltip formatter={(value: unknown) => formatMoneyText(value)} />
                          </PieChart>
                        </SafeResponsiveContainer>
                      </div>
                      <div style={{ width: '40%', paddingLeft: 16 }}>
                        <Space orientation="vertical" style={{ width: '100%' }} size={4}>
                          {assetPieData.map((item, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                              <Badge color={COLORS[index % COLORS.length]} text={<Text style={{fontSize: 12}}>{item.name}</Text>} />
                            </div>
                          ))}
                        </Space>
                      </div>
                    </div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="Cơ cấu Nguồn vốn" variant="borderless" style={{ borderRadius: 16 }}>
                    <div style={{ height: 200, display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '60%', height: 200, minWidth: 0 }}>
                        <SafeResponsiveContainer height={200}>
                          <PieChart>
                            <Pie data={equityLiabPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                              {equityLiabPieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                            </Pie>
                            <ReTooltip formatter={(value: unknown) => formatMoneyText(value)} />
                          </PieChart>
                        </SafeResponsiveContainer>
                      </div>
                      <div style={{ width: '40%', paddingLeft: 16 }}>
                        <Space orientation="vertical" style={{ width: '100%' }} size={4}>
                          {equityLiabPieData.map((item, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                              <Badge color={COLORS[(index + 2) % COLORS.length]} text={<Text style={{fontSize: 12}}>{item.name}</Text>} />
                            </div>
                          ))}
                        </Space>
                      </div>
                    </div>
                  </Card>
                </Col>
                <Col span={24}>
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Table<BalanceSheetLine>
                        title={() => <Text strong><ArrowUpOutlined style={{color: token.colorSuccess}} /> TÀI SẢN (ASSETS)</Text>}
                        size="small"
                        pagination={false}
                        rowKey="name"
                        dataSource={[
                          ...(balanceSheet?.assets || []),
                          { name: 'TỔNG CỘNG TÀI SẢN', balance: (balanceSheet?.assets || []).reduce((sum, asset) => sum + asset.balance, 0), bold: true }
                        ]}
                        columns={[
                          { title: 'Tài khoản', dataIndex: 'name', key: 'name', render: (text: string, record) => <Text strong={record.bold} style={{paddingLeft: record.bold ? 0 : 12}}>{text}</Text> },
                          { title: 'Số dư', dataIndex: 'balance', key: 'balance', align: 'right', render: (value: number, record) => <Text strong={record.bold}>{value?.toLocaleString()}</Text> }
                        ]}
                      />
                    </Col>
                    <Col span={12}>
                      <Table<BalanceSheetLine>
                        title={() => <Text strong><ArrowUpOutlined style={{color: token.colorInfo}} /> NGUỒN VỐN (L & E)</Text>}
                        size="small"
                        pagination={false}
                        rowKey="name"
                        dataSource={[
                          ...(balanceSheet?.liabilities || []),
                          ...(balanceSheet?.equity || []),
                          { name: 'TỔNG CỘNG NGUỒN VỐN', balance: [...(balanceSheet?.liabilities || []), ...(balanceSheet?.equity || [])].reduce((sum, line) => sum + line.balance, 0), bold: true }
                        ]}
                        columns={[
                          { title: 'Tài khoản', dataIndex: 'name', key: 'name', render: (text: string, record) => <Text strong={record.bold} style={{paddingLeft: record.bold ? 0 : 12}}>{text}</Text> },
                          { title: 'Số dư', dataIndex: 'balance', key: 'balance', align: 'right', render: (value: number, record) => <Text strong={record.bold}>{value?.toLocaleString()}</Text> }
                        ]}
                      />
                    </Col>
                  </Row>
                </Col>
              </Row>
            )
          },
          {
            key: 'cf',
            label: <Space orientation="horizontal"><WalletOutlined />Lưu chuyển Tiền tệ</Space>,
            children: (
              <Card variant="borderless" style={{ borderRadius: 16 }}>
                <Row gutter={[32, 32]}>
                  <Col span={16}>
                    <Title level={4}>Dòng tiền Hoạt động</Title>
                    <div style={{ height: 300, width: '100%', minWidth: 0 }}>
                      <SafeResponsiveContainer height={300}>
                        <BarChart data={[
                          { name: 'Tiền thu (In)', value: toNumber(cashFlow?.operatingInflow), fill: token.colorSuccess },
                          { name: 'Tiền chi (Out)', value: -toNumber(cashFlow?.operatingOutflow), fill: token.colorError },
                          { name: 'Dòng tiền thuần', value: toNumber(cashFlow?.netCashFlow), fill: token.colorPrimary },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} />
                          <YAxis axisLine={false} tickLine={false} />
                          <ReTooltip formatter={(value: unknown) => formatMoneyText(value)} />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ background: token.colorFillAlter, padding: 24, borderRadius: 16, height: '100%' }}>
                      <Title level={5}>Tóm tắt dòng tiền</Title>
                      <Divider />
                      <Space orientation="vertical" size={20} style={{width: '100%'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                          <Text type="secondary">Thu từ bán hàng</Text>
                          <Text strong>{cashFlow?.operatingInflow?.toLocaleString()}</Text>
                        </div>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                          <Text type="secondary">Chi cho nhà cung cấp</Text>
                          <Text strong style={{color: token.colorError}}>-{cashFlow?.operatingOutflow?.toLocaleString()}</Text>
                        </div>
                        <Divider style={{margin: '8px 0'}} />
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                          <Text strong>Lưu chuyển tiền thuần</Text>
                          <Text strong style={{color: token.colorPrimary, fontSize: 18}}>{cashFlow?.netCashFlow?.toLocaleString()}</Text>
                        </div>
                      </Space>
                    </div>
                  </Col>
                </Row>
              </Card>
            )
          },
          {
            key: 'aging',
            label: <Space orientation="horizontal"><HistoryOutlined />Công nợ & Tuổi nợ</Space>,
            children: (
              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <Card title="Tuổi nợ Phải thu (AR Aging)" variant="borderless" style={{ borderRadius: 16 }}>
                    <div style={{ height: 250, width: '100%', minWidth: 0 }}>
                      <SafeResponsiveContainer height={250}>
                        <BarChart data={[
                          { name: 'Trong hạn', value: arAging?.current || 0, fill: token.colorSuccess },
                          { name: '1-30 ngày', value: arAging?.days_30 || 0, fill: token.colorWarning },
                          { name: '31-60 ngày', value: arAging?.days_60 || 0, fill: '#fa8c16' },
                          { name: '> 60 ngày', value: (arAging?.days_90 || 0) + (arAging?.over_90 || 0), fill: token.colorError },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                          <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} axisLine={false} tickLine={false} />
                          <ReTooltip formatter={(value: unknown) => formatMoneyText(value)} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    </div>
                    <Divider />
                    <Button type="link" icon={<DoubleRightOutlined />} style={{padding: 0}}>Xem danh sách khách hàng nợ</Button>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="Tuổi nợ Phải trả (AP Aging)" variant="borderless" style={{ borderRadius: 16 }}>
                    <div style={{ height: 250, width: '100%', minWidth: 0 }}>
                      <SafeResponsiveContainer height={250}>
                        <BarChart data={[
                          { name: 'Trong hạn', value: apAging?.current || 0, fill: token.colorSuccess },
                          { name: '1-30 ngày', value: apAging?.days_30 || 0, fill: token.colorWarning },
                          { name: '31-60 ngày', value: apAging?.days_60 || 0, fill: '#fa8c16' },
                          { name: '> 60 ngày', value: (apAging?.days_90 || 0) + (apAging?.over_90 || 0), fill: token.colorError },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                          <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} axisLine={false} tickLine={false} />
                          <ReTooltip formatter={(value: unknown) => formatMoneyText(value)} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    </div>
                    <Divider />
                    <Button type="link" icon={<DoubleRightOutlined />} style={{padding: 0}}>Xem danh sách nhà cung cấp cần trả</Button>
                  </Card>
                </Col>
              </Row>
            )
          }
        ]}
      />
    </div>
  );
};

export default AccountingReports;


