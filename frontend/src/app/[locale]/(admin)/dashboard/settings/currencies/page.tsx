'use client';

import { DollarOutlined, EditOutlined, LineChartOutlined, SyncOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { useTheme } from '@/context/theme.context';
import { sendRequest } from '@/lib/api-client';
import { App, Avatar, Button, Card, Col, Divider, Form, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tag, theme, Typography } from 'antd';
import dayjs from 'dayjs';
import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { getAccessToken } from '@/lib/auth-token';

const { Text, Title, Paragraph } = Typography;

type RateType = 'TRANSFER' | 'BUY' | 'SELL' | 'ACCOUNTING';

type CurrencyInfo = {
  label: string;
  color: string;
  symbol: string;
};

const CURRENCY_INFO: Record<string, CurrencyInfo> = {
  VND: { label: 'VND', color: '#da251d', symbol: 'VND' },
  USD: { label: 'USD', color: '#1677ff', symbol: '$' },
  EUR: { label: 'EUR', color: '#003399', symbol: 'EUR' },
  JPY: { label: 'JPY', color: '#bc002d', symbol: 'JPY' },
  GBP: { label: 'GBP', color: '#722ed1', symbol: 'GBP' },
  CNY: { label: 'CNY', color: '#ee1c25', symbol: 'CNY' },
};

const rateTypes: RateType[] = ['TRANSFER', 'BUY', 'SELL', 'ACCOUNTING'];

const CurrencyPage = ({ embedded = false }: { embedded?: boolean }) => {
  const t = useTranslations('CurrencyManagement');
  const { notification } = App.useApp();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const { token } = theme.useToken();
  const { isDark } = useTheme();

  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<any>(null);
  const [rates, setRates] = useState<any[]>([]);
  const [selectedRateType, setSelectedRateType] = useState<RateType>('TRANSFER');
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [converter, setConverter] = useState({ from: 'USD', to: 'EUR', amount: 1, result: 0, loading: false });
  const [form] = Form.useForm();

  const getCurrencyInfo = (code: string): CurrencyInfo => CURRENCY_INFO[code] || { label: code, color: '#64748b', symbol: code };

  const fetchRates = useCallback(async (currency: any, rateType: RateType = selectedRateType) => {
    if (!accessToken || !currency?._id) return;

    setSelectedCurrency(currency);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies/${currency._id}/rates`,
        method: 'GET',
        queryParams: { rateType },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setRates(res?.data || []);
    } catch {
      setRates([]);
    }
  }, [accessToken, selectedRateType]);

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
        if (!selectedCurrency) {
          const firstNonBase = res.data.find((currency: any) => !currency.isBase);
          if (firstNonBase) {
            fetchRates(firstNonBase, selectedRateType);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, fetchRates, selectedCurrency, selectedRateType]);

  useEffect(() => {
    fetchCurrencies();
  }, [fetchCurrencies]);

  const handleUpdateRate = async (values: any) => {
    try {
      const rateType = values.rateType || selectedRateType;
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies/rates`,
        method: 'POST',
        body: {
          currencyId: selectedCurrency._id,
          rate: values.rate,
          rateType,
          effectiveDate: dayjs().toISOString(),
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({
          title: t('notifications.updateSuccessTitle'),
          description: t('notifications.updateSuccessDescription'),
        });
        setIsRateModalOpen(false);
        form.resetFields();
        await fetchCurrencies();
        await fetchRates(selectedCurrency, rateType);
      }
    } catch {
      notification.error({
        title: t('notifications.updateErrorTitle'),
        description: t('notifications.updateErrorDescription'),
      });
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
        title: t('notifications.syncSuccessTitle'),
        description: res?.message || t('notifications.syncSuccessDescription'),
      });
      await fetchCurrencies();
      if (selectedCurrency) {
        await fetchRates(selectedCurrency, selectedRateType);
      }
    } catch {
      notification.error({
        title: t('notifications.syncErrorTitle'),
        description: t('notifications.syncErrorDescription'),
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCalculateCrossRate = useCallback(async () => {
    if (!accessToken) return;

    setConverter((prev) => ({ ...prev, loading: true }));
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies/cross-rate`,
        method: 'GET',
        queryParams: { from: converter.from, to: converter.to, rateType: selectedRateType },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      setConverter((prev) => ({
        ...prev,
        result: res?.data ? res.data.rate * prev.amount : prev.result,
        loading: false,
      }));
    } catch (error) {
      console.error('Cross-rate error:', error);
      setConverter((prev) => ({ ...prev, loading: false }));
    }
  }, [accessToken, converter.from, converter.to, selectedRateType]);

  useEffect(() => {
    if (currencies.length >= 2) {
      handleCalculateCrossRate();
    }
  }, [currencies.length, converter.from, converter.to, converter.amount, selectedRateType, handleCalculateCrossRate]);

  const handleRateTypeChange = (value: RateType) => {
    setSelectedRateType(value);
    if (selectedCurrency) {
      fetchRates(selectedCurrency, value);
    }
  };

  const currencyColumns = [
    {
      title: t('table.currency'),
      key: 'currency',
      render: (_: any, record: any) => {
        const info = getCurrencyInfo(record.code);
        return (
          <Space>
            <Avatar style={{ backgroundColor: info.color }}>{info.label.slice(0, 1)}</Avatar>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: token.colorText }}>{record.code}</div>
              <div style={{ fontSize: 12, color: token.colorTextDescription }}>{record.name}</div>
            </div>
          </Space>
        );
      },
    },
    {
      title: t('table.currentRate'),
      key: 'latestRate',
      align: 'right' as const,
      render: (_: any, record: any) => {
        const normalized = (rate: any) => (rate?.rateType || 'TRANSFER') as RateType;
        const ratesForType = record.exchangeRates?.filter((rate: any) => normalized(rate) === selectedRateType) || [];
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
      },
    },
    {
      title: t('table.actions'),
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
          {t('actions.updateRate')}
        </Button>
      ),
    },
  ];

  const currencyOptions = currencies.map((currency) => ({
    value: currency.code,
    label: `${currency.code} - ${currency.name}`,
  }));

  const rateTypeOptions = rateTypes.map((rateType) => ({
    value: rateType,
    label: t(`rateTypes.${rateType}`),
  }));

  const content = (
    <div style={{
      padding: embedded ? 0 : 32,
      backgroundColor: embedded ? 'transparent' : token.colorBgLayout,
    }}>
      {!embedded && (
        <PageHeader
          title={t('title')}
          icon={<DollarOutlined style={{ color: token.colorPrimary }} />}
          description={t('description')}
        />
      )}

      <AnimatePresence mode="wait">
        {selectedCurrency && !selectedCurrency.isBase && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ marginTop: embedded ? 0 : 24 }}
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
                        style={{ backgroundColor: getCurrencyInfo(selectedCurrency.code).color, fontSize: 18 }}
                      >
                        {selectedCurrency.code}
                      </Avatar>
                      <div>
                        <Title level={4} style={{ margin: 0 }}>{t('trend.title', { code: selectedCurrency.code })}</Title>
                        <Text type="secondary">{t('trend.subtitle', { type: t(`rateTypes.${selectedRateType}`) })}</Text>
                      </div>
                    </Space>
                  </Col>
                  <Col>
                    <Statistic
                      title={t('trend.currentRate')}
                      value={rates[0]?.rate || 0}
                      suffix="VND"
                      styles={{ content: { color: token.colorPrimary, fontWeight: 800 } }}
                    />
                  </Col>
                </Row>
              </div>
              <div style={{ height: 250, width: '100%', padding: '20px 24px 10px', minWidth: 0 }}>
                <SafeResponsiveContainer height={250}>
                  <AreaChart data={[...rates].reverse()}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={token.colorPrimary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={token.colorPrimary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                    <XAxis
                      dataKey="effectiveDate"
                      tickFormatter={(value) => dayjs(value).format('DD/MM')}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: token.colorTextDescription }}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: token.colorTextDescription }}
                      tickFormatter={(value) => value.toLocaleString()}
                    />
                    <ChartTooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: 'none',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        background: isDark ? '#1e293b' : '#ffffff',
                      }}
                      labelFormatter={(value) => dayjs(value).format('DD MMMM, YYYY')}
                      formatter={(value: any) => [`${value.toLocaleString()} VND`, t('chart.rate')]}
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
                </SafeResponsiveContainer>
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
              <Text strong>{t('currentRates')}</Text>
              <Tag color="blue">{t('rateType', { type: t(`rateTypes.${selectedRateType}`) })}</Tag>
            </Space>
            <Space>
              <Button
                icon={<SyncOutlined />}
                onClick={handleSyncVCB}
                loading={syncLoading}
                style={{ borderRadius: 10 }}
              >
                {t('actions.syncVCB')}
              </Button>
              <Select
                value={selectedRateType}
                style={{ width: 140 }}
                onChange={handleRateTypeChange}
                options={rateTypeOptions}
              />
            </Space>
          </div>
        }
      >
        <Table
          columns={currencyColumns}
          dataSource={currencies}
          rowKey={(record: any) => record._id || record.code}
          loading={loading}
          pagination={false}
          style={{ marginBottom: 16 }}
          onRow={(record) => ({
            onClick: () => {
              if (!record.isBase) {
                fetchRates(record);
              }
            },
            style: { cursor: record.isBase ? 'default' : 'pointer' },
          })}
          rowClassName={(record) => selectedCurrency?._id === record._id ? 'ant-table-row-selected' : ''}
        />
        <Divider />
        <Paragraph type="secondary">
          <SyncOutlined /> {t('note')}
        </Paragraph>
      </Card>

      <Card
        variant="borderless"
        style={{ borderRadius: 20, marginTop: 24, background: isDark ? '#141414' : '#f8fafc' }}
        title={<Space><LineChartOutlined style={{ color: token.colorPrimary }} /> <Text strong>{t('crossRate.title')}</Text></Space>}
      >
        <Row gutter={24} align="middle">
          <Col span={7}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>{t('crossRate.from')}</Text>
            <Select
              style={{ width: '100%' }}
              value={converter.from}
              onChange={(value) => setConverter((prev) => ({ ...prev, from: value }))}
              options={currencyOptions}
            />
          </Col>
          <Col span={1} style={{ textAlign: 'center', paddingTop: 28 }}>
            <SyncOutlined style={{ fontSize: 20, color: token.colorTextDescription }} />
          </Col>
          <Col span={7}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>{t('crossRate.to')}</Text>
            <Select
              style={{ width: '100%' }}
              value={converter.to}
              onChange={(value) => setConverter((prev) => ({ ...prev, to: value }))}
              options={currencyOptions}
            />
          </Col>
          <Col span={9}>
            <div style={{
              padding: '16px 24px',
              background: token.colorPrimaryBg,
              borderRadius: 16,
              border: `1px dashed ${token.colorPrimary}`,
              textAlign: 'center',
            }}>
              {converter.loading ? (
                <SyncOutlined spin />
              ) : (
                <div>
                  <div style={{ fontSize: 13, color: token.colorPrimary, opacity: 0.8 }}>{t('crossRate.resultLabel')}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: token.colorPrimary }}>
                    {t('crossRate.result', {
                      from: converter.from,
                      value: converter.result.toLocaleString(undefined, { maximumFractionDigits: 6 }),
                      to: converter.to,
                    })}
                  </div>
                </div>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      <Modal
        title={t('modal.title', { code: selectedCurrency?.code || '' })}
        open={isRateModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsRateModalOpen(false)}
        okText={t('modal.okText')}
        cancelText={t('modal.cancelText')}
      >
        <Form form={form} layout="vertical" onFinish={handleUpdateRate} style={{ marginTop: 16 }}>
          <Form.Item label={t('modal.rateType')} name="rateType" initialValue={selectedRateType}>
            <Select options={rateTypeOptions} />
          </Form.Item>
          <Form.Item
            label={t('modal.rateValue', { code: selectedCurrency?.code || '' })}
            name="rate"
            rules={[{ required: true, message: t('modal.rateRequired') }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder={t('modal.ratePlaceholder')}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, ''))}
            />
          </Form.Item>
          <Text type="secondary">{t('modal.note')}</Text>
        </Form>
      </Modal>
    </div>
  );

  if (embedded) return content;

  return (
    <AdminPageScroll>
      {content}
    </AdminPageScroll>
  );
};

export default CurrencyPage;
