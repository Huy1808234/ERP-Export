'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Table, Tag, Space, Button, Input, Card, 
  Typography, Row, Col, Statistic, Form,
  Modal, InputNumber, App, theme, Avatar, Divider, Select
} from 'antd';
import { 
  GlobalOutlined, DollarOutlined, 
  HistoryOutlined, PlusOutlined,
  EditOutlined, LineChartOutlined,
  ArrowUpOutlined, ArrowDownOutlined,
  DashboardOutlined, SyncOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/library/theme.context';
import { sendRequest } from '@/utils/api';
import dayjs from 'dayjs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as ChartTooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

const { Text, Title, Paragraph } = Typography;

const CURRENCY_INFO: Record<string, { flag: string; color: string; symbol: string }> = {
  VND: { flag: '🇻🇳', color: '#da251d', symbol: '₫' },
  USD: { flag: '🇺🇸', color: '#002868', symbol: '$' },
  EUR: { flag: '🇪🇺', color: '#003399', symbol: '€' },
  JPY: { flag: '🇯🇵', color: '#bc002d', symbol: '¥' },
  GBP: { flag: '🇬🇧', color: '#00247d', symbol: '£' },
  CNY: { flag: '🇨🇳', color: '#ee1c25', symbol: '¥' },
};

const formatCurrency = (amount: number, code: string) => {
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: code === 'VND' || code === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch (e) {
    return amount.toLocaleString();
  }
};

type RateType = 'TRANSFER' | 'BUY' | 'SELL' | 'ACCOUNTING';

const CurrencyPage = () => {
  const { notification } = App.useApp();
  const { data: session } = useSession();
  const accessToken = (session as any)?.user?.access_token;
  const { token } = theme.useToken();
  const { isDark } = useTheme();

  // --- States ---
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<any>(null);
  const [rates, setRates] = useState<any[]>([]);
  const [selectedRateType, setSelectedRateType] = useState<RateType>('TRANSFER');
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [converter, setConverter] = useState({ from: 'USD', to: 'EUR', amount: 1, result: 0, loading: false });
  const [form] = Form.useForm();

  // --- Logic Fetch ---
  const fetchCurrencies = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies`,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        setCurrencies(res.data);
        if (res.data.length > 0 && !selectedCurrency) {
          const firstNonBase = res.data.find((c: any) => !c.isBase);
          if (firstNonBase) fetchRates(firstNonBase);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedCurrency]);

  const fetchRates = async (currency: any, rateType: RateType = selectedRateType) => {
    setSelectedCurrency(currency);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies/${currency.id}/rates`,
        method: 'GET',
        queryParams: { rateType },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) setRates(res.data);
    } catch (error) {
      setRates([]);
    }
  };

  useEffect(() => {
    fetchCurrencies();
  }, [fetchCurrencies]);

  const handleUpdateRate = async (values: any) => {
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies/rates`,
        method: 'POST',
        body: {
          currencyId: selectedCurrency.id,
          rate: values.rate,
          rateType: values.rateType || selectedRateType,
          effectiveDate: dayjs().toISOString(),
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        notification.success({ title: 'Thành công', description: 'Đã cập nhật tỷ giá mới' });
        setIsRateModalOpen(false);
        form.resetFields();
        await fetchCurrencies();
        if (selectedCurrency) {
          await fetchRates(selectedCurrency, values.rateType || selectedRateType);
        }
      }
    } catch (error) {
      notification.error({ title: 'Lỗi', description: 'Không thể cập nhật tỷ giá' });
    }
  };

  const handleSyncVCB = async () => {
    setSyncLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies/sync-vcb`,
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      notification.success({ 
        title: 'Đồng bộ hoàn tất', 
        description: res?.message || 'Hệ thống đã kiểm tra tỷ giá mới nhất.' 
      });
      await fetchCurrencies();
      if (selectedCurrency) {
        await fetchRates(selectedCurrency, selectedRateType);
      }
    } catch (error) {
      notification.error({ 
        title: 'Lỗi đồng bộ', 
        description: 'Không thể kết nối với API Vietcombank hoặc quyền hạn không đủ.' 
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCalculateCrossRate = async () => {
    if (!accessToken) return;
    setConverter(prev => ({ ...prev, loading: true }));
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies/cross-rate`,
        method: 'GET',
        queryParams: { from: converter.from, to: converter.to, rateType: selectedRateType },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        setConverter(prev => ({ ...prev, result: res.data.rate * prev.amount, loading: false }));
      } else {
        setConverter(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Cross-rate error:', error);
      setConverter(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (currencies.length >= 2) handleCalculateCrossRate();
  }, [currencies, converter.from, converter.to, converter.amount, selectedRateType]);

  // --- Table Columns ---
  const currencyColumns = [
    {
      title: 'TIỀN TỆ',
      key: 'currency',
      render: (_: any, record: any) => {
        const info = CURRENCY_INFO[record.code] || { flag: '🏳️', color: '#64748b' };
        return (
          <Space>
            <span style={{ fontSize: 24 }}>{info.flag}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: token.colorText }}>{record.code}</div>
              <div style={{ fontSize: 12, color: token.colorTextDescription }}>{record.name}</div>
            </div>
          </Space>
        );
      }
    },
    {
      title: 'TỶ GIÁ HIỆN TẠI (VND)',
      key: 'latestRate',
      align: 'right' as const,
      render: (_: any, record: any) => {
        const normalized = (r: any) => (r?.rateType || 'TRANSFER') as RateType;
        const ratesForType = record.exchangeRates?.filter((r: any) => normalized(r) === selectedRateType) || [];
        const latest = record.isBase ? 1 : ratesForType[0]?.rate;
        const previous = record.isBase ? 1 : ratesForType[1]?.rate;
        
        const volatility = !record.isBase && latest && previous ? ((latest - previous) / previous) * 100 : 0;

        return (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: token.colorPrimary }}>
              {latest ? latest.toLocaleString(undefined, { minimumFractionDigits: record.isBase ? 0 : 2 }) : '---'}
            </div>
            {!record.isBase && latest && previous && (
              <Text type={volatility >= 0 ? 'success' : 'danger'} style={{ fontSize: 11 }}>
                {volatility >= 0 ? '+' : ''}{volatility.toFixed(2)}%
              </Text>
            )}
          </div>
        );
      }
    },
    {
      title: 'THAO TÁC',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => (
        <Button 
          type="primary"
          ghost
          icon={<EditOutlined />}
          onClick={() => {
            setSelectedCurrency(record);
            setIsRateModalOpen(true);
          }}
          style={{ borderRadius: 8 }}
        >
          Cập nhật giá
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '32px', backgroundColor: token.colorBgLayout, minHeight: '100vh' }}>
      <PageHeader 
        title="Bảng Tỷ Giá Báo Giá" 
        icon={<DollarOutlined style={{ color: token.colorPrimary }} />} 
        description="Cập nhật tỷ giá mới nhất để hệ thống tự động tính giá bán cho khách hàng." 
      />

      <AnimatePresence mode="wait">
        {selectedCurrency && !selectedCurrency.isBase && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ marginTop: 24 }}
          >
            <Card 
              variant="borderless" 
              style={{ borderRadius: 24, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}
              styles={{ body: { padding: 0 } }}
            >
              <div style={{ padding: '20px 24px', background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#ffffff', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Space size="middle">
                      <Avatar 
                        size="large" 
                        style={{ backgroundColor: CURRENCY_INFO[selectedCurrency.code]?.color || token.colorPrimary, fontSize: 24 }}
                      >
                        {CURRENCY_INFO[selectedCurrency.code]?.flag || '🏳️'}
                      </Avatar>
                      <div>
                        <Title level={4} style={{ margin: 0 }}>Xu hướng tỷ giá {selectedCurrency.code}/VND</Title>
                        <Text type="secondary">Dữ liệu lịch sử loại: {selectedRateType}</Text>
                      </div>
                    </Space>
                  </Col>
                  <Col>
                    <Statistic 
                      title="Giá hiện tại" 
                      value={rates[0]?.rate || 0} 
                      suffix="VND"
                      styles={{ content: { color: token.colorPrimary, fontWeight: 800 } }}
                    />
                  </Col>
                </Row>
              </div>
              <div style={{ height: 250, width: '100%', padding: '20px 24px 10px', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height={250} minWidth={0}>
                  <AreaChart data={[...rates].reverse()}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={token.colorPrimary} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={token.colorPrimary} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                    <XAxis 
                      dataKey="effectiveDate" 
                      tickFormatter={(val) => dayjs(val).format('DD/MM')}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: token.colorTextDescription }}
                    />
                    <YAxis 
                      domain={['auto', 'auto']}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: token.colorTextDescription }}
                      tickFormatter={(val) => val.toLocaleString()}
                    />
                    <ChartTooltip 
                      contentStyle={{ 
                        borderRadius: 12, 
                        border: 'none', 
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        background: isDark ? '#1e293b' : '#ffffff'
                      }}
                      labelFormatter={(val) => dayjs(val).format('DD MMMM, YYYY')}
                      formatter={(val: any) => [val.toLocaleString() + ' VND', 'Tỷ giá']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="rate" 
                      stroke={token.colorPrimary} 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorRate)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card 
        variant="borderless" 
        style={{ borderRadius: 20, marginTop: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Space>
              <Text strong>Tỷ giá hiện hành</Text>
              <Tag color="blue">Loại: {selectedRateType}</Tag>
            </Space>
            <Space>
              <Button 
                icon={<SyncOutlined />} 
                onClick={handleSyncVCB} 
                loading={syncLoading}
                style={{ borderRadius: 10 }}
              >
                Cập nhật từ VCB
              </Button>
              <Select
                value={selectedRateType}
                style={{ width: 140 }}
                onChange={(v) => setSelectedRateType(v)}
                options={[
                  { value: 'TRANSFER', label: 'Chuyển khoản' },
                  { value: 'BUY', label: 'Mua vào' },
                  { value: 'SELL', label: 'Bán ra' },
                  { value: 'ACCOUNTING', label: 'Kế toán' },
                ]}
              />
            </Space>
          </div>
        }
      >
        <Table 
          columns={currencyColumns} 
          dataSource={currencies} 
          rowKey="id" 
          loading={loading}
          pagination={false}
          style={{ marginBottom: 16 }}
          onRow={(record) => ({
            onClick: () => {
              if (!record.isBase) {
                fetchRates(record);
              }
            },
            style: { cursor: record.isBase ? 'default' : 'pointer' }
          })}
          rowClassName={(record) => selectedCurrency?.id === record.id ? 'ant-table-row-selected' : ''}
        />
        <Divider />
        <Paragraph type="secondary">
          <SyncOutlined /> Tỷ giá trên sẽ được dùng làm căn cứ quy đổi giá trị Hợp đồng và Invoice cho khách hàng.
        </Paragraph>
      </Card>

      {/* Quick Cross-Rate Converter (Senior Feature) */}
      <Card 
        variant="borderless" 
        style={{ borderRadius: 20, marginTop: 24, background: isDark ? '#141414' : '#f8fafc' }}
        title={<Space><LineChartOutlined style={{ color: token.colorPrimary }} /> <Text strong>Bộ tính tỷ giá chéo (Cross-Rate Calculator)</Text></Space>}
      >
        <Row gutter={24} align="middle">
          <Col span={7}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Từ loại tệ</Text>
            <Select 
              style={{ width: '100%' }}
              value={converter.from}
              onChange={(v) => setConverter(prev => ({ ...prev, from: v }))}
              options={currencies.map(c => ({ value: c.code, label: `${CURRENCY_INFO[c.code]?.flag} ${c.code}` }))}
            />
          </Col>
          <Col span={1} style={{ textAlign: 'center', paddingTop: 28 }}>
            <SyncOutlined style={{ fontSize: 20, color: token.colorTextDescription }} />
          </Col>
          <Col span={7}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Sang loại tệ</Text>
            <Select 
              style={{ width: '100%' }}
              value={converter.to}
              onChange={(v) => setConverter(prev => ({ ...prev, to: v }))}
              options={currencies.map(c => ({ value: c.code, label: `${CURRENCY_INFO[c.code]?.flag} ${c.code}` }))}
            />
          </Col>
          <Col span={9}>
            <div style={{ 
              padding: '16px 24px', 
              background: token.colorPrimaryBg, 
              borderRadius: 16, 
              border: `1px dashed ${token.colorPrimary}`,
              textAlign: 'center'
            }}>
              {converter.loading ? (
                <SyncOutlined spin />
              ) : (
                <div>
                  <div style={{ fontSize: 13, color: token.colorPrimary, opacity: 0.8 }}>Kết quả quy đổi tương ứng</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: token.colorPrimary }}>
                    1 {converter.from} = {converter.result.toLocaleString(undefined, { maximumFractionDigits: 6 })} {converter.to}
                  </div>
                </div>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* Modal Cập nhật Tỷ giá */}
      <Modal
        title={`Cập nhật Tỷ giá cho ${selectedCurrency?.code}`}
        open={isRateModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsRateModalOpen(false)}
        okText="Lưu tỷ giá"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleUpdateRate} style={{ marginTop: 16 }}>
          <Form.Item label="Loại tỷ giá" name="rateType" initialValue={selectedRateType}>
            <Select
              options={[
                { value: 'TRANSFER', label: 'TRANSFER' },
                { value: 'BUY', label: 'BUY' },
                { value: 'SELL', label: 'SELL' },
                { value: 'ACCOUNTING', label: 'ACCOUNTING' },
              ]}
            />
          </Form.Item>
          <Form.Item 
            label={`Giá trị quy đổi sang VND (1 ${selectedCurrency?.code} = ? VND)`} 
            name="rate" 
            rules={[{ required: true, message: 'Vui lòng nhập tỷ giá' }]}
          >
            <InputNumber 
              style={{ width: '100%' }} 
              placeholder="Ví dụ: 25450" 
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => Number(value!.replace(/\$\s?|(,*)/g, ''))}
            />
          </Form.Item>
          <Text type="secondary">Tỷ giá này sẽ được áp dụng cho tất cả các chứng từ Bán hàng & Mua hàng kể từ thời điểm này.</Text>
        </Form>
      </Modal>
    </div>
  );
};

export default CurrencyPage;
