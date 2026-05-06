'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Row, Col, Card, Statistic, Table, Typography, 
  Tabs, theme, Spin, Button, Progress, List, Space, Avatar, Divider, DatePicker
} from 'antd';
import { 
  RiseOutlined, FallOutlined, 
  DollarCircleOutlined, PieChartOutlined,
  ReloadOutlined, HistoryOutlined,
  CalendarOutlined, ArrowUpOutlined,
  BarChartOutlined, BankOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import dayjs, { Dayjs } from 'dayjs';

interface ISummaryReport {
  revenue: number;
  cogs: number;
  expenses: number;
  netProfit: number;
}

interface IAgingReport {
  current: number;
  days_30: number;
  days_60: number;
  days_90: number;
  over_90: number;
}

interface IBalanceSheetItem {
  code: string;
  name: string;
  balance: number;
}

interface IBalanceSheet {
  assets: IBalanceSheetItem[];
  liabilities: IBalanceSheetItem[];
  equity: IBalanceSheetItem[];
}

const { Text, Title } = Typography;

const AccountingReportsPage = () => {
  const { data: session } = useSession();
  const accessToken = (session as any)?.user?.access_token;
  const { token } = theme.useToken();

  const [summary, setSummary] = useState<ISummaryReport | null>(null);
  const [aging, setAging] = useState<IAgingReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<IBalanceSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const queryParams: any = {};
      if (dateRange && dateRange[0] && dateRange[1]) {
        queryParams.startDate = dateRange[0].startOf('day').toISOString();
        queryParams.endDate = dateRange[1].endOf('day').toISOString();
      }

      const [summaryRes, agingRes, balanceRes] = await Promise.all([
        sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/summary`,
          method: 'GET',
          queryParams,
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/aging`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` }, // Aging doesn't usually use date range, it's "as of now"
        }),
        sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/balance-sheet`,
          method: 'GET',
          queryParams,
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      ]);

      if (summaryRes?.data) setSummary(summaryRes.data);
      if (agingRes?.data) setAging(agingRes.data);
      if (balanceRes?.data) setBalanceSheet(balanceRes.data);
    } finally {
      setLoading(false);
    }
  }, [accessToken, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !summary) return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div style={{ padding: '24px', backgroundColor: token.colorBgLayout, minHeight: '100vh' }}>
      <Row justify="space-between" align="bottom" style={{ marginBottom: '24px' }}>
        <Col>
          <PageHeader 
            title="Báo Cáo Tài Chính" 
            icon={<PieChartOutlined />} 
            description="Phân tích kết quả kinh doanh và theo dõi sức khỏe dòng tiền công nợ" 
          />
        </Col>
        <Col>
          <Space>
            <DatePicker.RangePicker 
              style={{ height: 40, borderRadius: 8 }} 
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchData} size="large">Làm mới dữ liệu</Button>
          </Space>
        </Col>
      </Row>

      <Tabs 
        defaultActiveKey="1"
        items={[
          {
            key: '1',
            label: <Space><BarChartOutlined />P&L (Kết quả kinh doanh)</Space>,
            children: (
              <div style={{ marginTop: 16 }}>
                <Row gutter={[16, 16]}>
                  <Col span={16}>
                    <Card variant="borderless" style={{ borderRadius: 16 }}>
                      <Title level={4} style={{ marginBottom: 24 }}>Cấu trúc Doanh thu & Chi phí</Title>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Card variant="borderless" style={{ background: token.colorSuccessBg }}>
                            <Statistic 
                              title="Tỷ lệ Giá vốn / Doanh thu" 
                              value={summary ? (summary.cogs / summary.revenue) * 100 : 0} 
                              precision={1}
                              suffix="%"
                              styles={{ content: { color: token.colorSuccess } }}
                            />
                            <Progress percent={summary ? Math.round((summary.cogs / summary.revenue) * 100) : 0} strokeColor={token.colorSuccess} showInfo={false} />
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card variant="borderless" style={{ background: token.colorErrorBg }}>
                            <Statistic 
                              title="Tỷ lệ Chi phí / Doanh thu" 
                              value={summary ? (summary.expenses / summary.revenue) * 100 : 0} 
                              precision={1}
                              suffix="%"
                              styles={{ content: { color: token.colorError } }}
                            />
                            <Progress percent={summary ? Math.round((summary.expenses / summary.revenue) * 100) : 0} strokeColor={token.colorError} showInfo={false} />
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card variant="borderless" style={{ background: token.colorPrimaryBg }}>
                            <Statistic 
                              title="Biên Lợi nhuận Thuần" 
                              value={summary ? (summary.netProfit / summary.revenue) * 100 : 0} 
                              precision={1}
                              suffix="%"
                              styles={{ content: { color: token.colorPrimary } }}
                            />
                            <Progress percent={summary ? Math.round((summary.netProfit / summary.revenue) * 100) : 0} strokeColor={token.colorPrimary} showInfo={false} />
                          </Card>
                        </Col>
                      </Row>

                      <div style={{ marginTop: 32 }}>
                         <Title level={5}>Báo cáo P&L tóm tắt</Title>
                         <Table 
                           pagination={false} 
                           dataSource={[
                             { key: '1', label: 'Doanh thu thuần', amount: summary?.revenue || 0, color: 'inherit' },
                             { key: '2', label: 'Giá vốn hàng bán (COGS)', amount: -(summary?.cogs || 0), color: token.colorError },
                             { key: '3', label: 'Lợi nhuận gộp', amount: ((summary?.revenue || 0) - (summary?.cogs || 0)), color: token.colorSuccess, bold: true },
                             { key: '4', label: 'Chi phí bán hàng & QLDN', amount: -(summary?.expenses || 0), color: token.colorError },
                             { key: '5', label: 'Lợi nhuận thuần từ HĐKD', amount: summary?.netProfit || 0, color: token.colorPrimary, bold: true },
                           ]}
                           columns={[
                             { title: 'Khoản mục', dataIndex: 'label', key: 'label', render: (text: string, rec: any) => <Text strong={rec.bold}>{text}</Text> },
                             { title: 'Số tiền (VND)', dataIndex: 'amount', key: 'amount', align: 'right', render: (val: number, rec: any) => <Text strong={rec.bold} style={{ color: rec.color }}>{val?.toLocaleString()}</Text> },
                           ]}
                         />
                      </div>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card variant="borderless" style={{ borderRadius: 16, height: '100%' }}>
                      <Title level={4}>Sức khỏe tài chính</Title>
                      <List
                        itemLayout="horizontal"
                        dataSource={[
                          { title: 'Khả năng sinh lời', icon: <RiseOutlined style={{ color: '#52c41a' }} />, desc: 'Biên lợi nhuận gộp đang ở mức tốt' },
                          { title: 'Quản trị chi phí', icon: <ArrowUpOutlined style={{ color: '#faad14' }} />, desc: 'Chi phí vận hành tăng nhẹ so với tháng trước' },
                          { title: 'Rủi ro dòng tiền', icon: <DollarCircleOutlined style={{ color: '#1890ff' }} />, desc: 'Dòng tiền ổn định từ các hợp đồng xuất khẩu' },
                        ]}
                        renderItem={(item) => (
                          <List.Item>
                            <List.Item.Meta
                              avatar={<Avatar icon={item.icon} />}
                              title={item.title}
                              description={item.desc}
                            />
                          </List.Item>
                        )}
                      />
                    </Card>
                  </Col>
                </Row>
              </div>
            )
          },
          {
            key: '2',
            label: <Space><CalendarOutlined />Phân tích Tuổi nợ (Aging)</Space>,
            children: (
              <div style={{ marginTop: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card variant="borderless" style={{ borderRadius: 16 }}>
                      <Title level={4}>Phân tích nợ phải trả (AP Aging)</Title>
                      <div style={{ marginTop: 24 }}>
                        <Text>Đang trong hạn (Current)</Text>
                        <Progress percent={100} success={{ percent: aging ? (aging.current / (aging.current + aging.days_30 + aging.days_60 + aging.days_90 + aging.over_90)) * 100 : 0 }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                          <Text type="secondary">Số tiền: {aging?.current?.toLocaleString()} VND</Text>
                        </div>

                        <Text>Quá hạn 1 - 30 ngày</Text>
                        <Progress percent={aging ? (aging.days_30 / (aging.current + aging.days_30 + aging.days_60 + aging.days_90 + aging.over_90)) * 100 : 0} status="active" />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                          <Text type="secondary">Số tiền: {aging?.days_30?.toLocaleString()} VND</Text>
                        </div>

                        <Text>Quá hạn 31 - 60 ngày</Text>
                        <Progress percent={aging ? (aging.days_60 / (aging.current + aging.days_30 + aging.days_60 + aging.days_90 + aging.over_90)) * 100 : 0} status="exception" />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                          <Text type="secondary">Số tiền: {aging?.days_60?.toLocaleString()} VND</Text>
                        </div>

                        <Text>Quá hạn {'>'} 90 ngày</Text>
                        <Progress percent={aging ? (aging.over_90 / (aging.current + aging.days_30 + aging.days_60 + aging.days_90 + aging.over_90)) * 100 : 0} strokeColor={token.colorError} />
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text type="secondary">Số tiền: {aging?.over_90?.toLocaleString()} VND</Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card variant="borderless" style={{ borderRadius: 16 }}>
                      <Title level={4}>Tổng quan Công nợ</Title>
                      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                        <Col span={12}>
                          <Statistic title="Tổng nợ phải trả (AP)" value={aging ? (aging.current + aging.days_30 + aging.days_60 + aging.days_90 + aging.over_90) : 0} suffix="VND" />
                        </Col>
                        <Col span={12}>
                          <Statistic title="Tổng nợ quá hạn" value={aging ? (aging.days_30 + aging.days_60 + aging.days_90 + aging.over_90) : 0} styles={{ content: { color: token.colorError } }} suffix="VND" />
                        </Col>
                      </Row>
                      <Divider />
                      <Text type="secondary">
                        <HistoryOutlined /> Dữ liệu được cập nhật dựa trên ngày đến hạn của Vendor Invoice. Các khoản nợ quá hạn 90 ngày cần được xử lý gấp để tránh ảnh hưởng đến uy tín với NCC.
                      </Text>
                    </Card>
                  </Col>
                </Row>
              </div>
            )
          },
          {
            key: '3',
            label: <Space><BankOutlined />Bảng cân đối kế toán (Balance Sheet)</Space>,
            children: (
              <div style={{ marginTop: 16 }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Card title="TÀI SẢN (ASSETS)" variant="borderless" style={{ borderRadius: 16, height: '100%' }}>
                      <Table 
                        size="small"
                        pagination={false}
                        dataSource={balanceSheet?.assets}
                        columns={[
                          { title: 'Tài khoản', dataIndex: 'name', key: 'name' },
                          { title: 'Số dư', dataIndex: 'balance', key: 'balance', align: 'right', render: (v) => v?.toLocaleString() }
                        ]}
                      />
                      <div style={{ marginTop: 20, textAlign: 'right' }}>
                        <Title level={5}>Tổng tài sản: {balanceSheet?.assets?.reduce((sum: number, i: any) => sum + i.balance, 0)?.toLocaleString()} VND</Title>
                      </div>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card title="NỢ PHẢI TRẢ (LIABILITIES)" variant="borderless" style={{ borderRadius: 16, height: '100%' }}>
                      <Table 
                        size="small"
                        pagination={false}
                        dataSource={balanceSheet?.liabilities}
                        columns={[
                          { title: 'Tài khoản', dataIndex: 'name', key: 'name' },
                          { title: 'Số dư', dataIndex: 'balance', key: 'balance', align: 'right', render: (v) => v?.toLocaleString() }
                        ]}
                      />
                      <div style={{ marginTop: 20, textAlign: 'right' }}>
                        <Title level={5}>Tổng nợ: {balanceSheet?.liabilities?.reduce((sum: number, i: any) => sum + i.balance, 0)?.toLocaleString()} VND</Title>
                      </div>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card title="VỐN CHỦ SỞ HỮU (EQUITY)" variant="borderless" style={{ borderRadius: 16, height: '100%' }}>
                      <Table 
                        size="small"
                        pagination={false}
                        dataSource={balanceSheet?.equity}
                        columns={[
                          { title: 'Khoản mục', dataIndex: 'name', key: 'name' },
                          { title: 'Số tiền', dataIndex: 'balance', key: 'balance', align: 'right', render: (v) => v?.toLocaleString() }
                        ]}
                      />
                      <div style={{ marginTop: 20, textAlign: 'right' }}>
                        <Title level={5}>Tổng vốn: {balanceSheet?.equity?.reduce((sum: number, i: any) => sum + i.balance, 0)?.toLocaleString()} VND</Title>
                      </div>
                    </Card>
                  </Col>
                </Row>
                <div style={{ marginTop: 24, textAlign: 'center' }}>
                    <Text type="secondary" italic>Phương trình kế toán: Tài sản = Nợ phải trả + Vốn chủ sở hữu</Text>
                </div>
              </div>
            )
          }
        ]}
      />
    </div>
  );
};

export default AccountingReportsPage;
