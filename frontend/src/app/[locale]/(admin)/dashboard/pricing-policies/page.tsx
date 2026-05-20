'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DollarOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import { formatCurrency, formatMoneyStatic } from '@/utils/format';

const { Text } = Typography;

const INCOTERMS = ['EXW', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP'];
const REGIONS = ['EU', 'US', 'ASEAN', 'APAC', 'MIDDLE_EAST', 'OTHER'];

interface IProductOption {
  _id: string;
  sku: string;
  vietnameseName: string;
}

interface IPartnerOption {
  _id: string;
  name: string;
  partnerType: string;
  country?: string | null;
  region?: string | null;
}

interface IPricingPolicy {
  _id: string;
  productId: string;
  product?: IProductOption;
  buyerId?: string | null;
  buyer?: IPartnerOption | null;
  marketRegion?: string | null;
  country?: string | null;
  incoterm: string;
  currency: string;
  minQuantity: number;
  maxQuantity?: number | null;
  unitPrice: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
  createdByUsername: string;
  note?: string | null;
}

interface ISalesPriceHistory {
  _id: string;
  product?: IProductOption;
  buyer?: IPartnerOption;
  sourceType: string;
  sourceNumber?: string | null;
  incoterm: string;
  currency: string;
  quantity: number;
  unitPrice: number;
  createdByUsername: string;
  occurredAt: string;
  pricingPolicyId?: string | null;
}

const PricingPoliciesPage = () => {
  const t = useTranslations('PricingPolicy');
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const [policies, setPolicies] = useState<IPricingPolicy[]>([]);
  const [history, setHistory] = useState<ISalesPriceHistory[]>([]);
  const [products, setProducts] = useState<IProductOption[]>([]);
  const [buyers, setBuyers] = useState<IPartnerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const fetchReferenceData = useCallback(async () => {
    if (!accessToken) return;
    const [productRes, partnerRes] = await Promise.all([
      sendRequest<IBackendRes<{ results: IProductOption[] }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 200 },
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      sendRequest<IBackendRes<{ results: IPartnerOption[] }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 200, partnerType: 'CUSTOMER' },
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    setProducts(productRes?.data?.results ?? []);
    setBuyers((partnerRes?.data?.results ?? []).filter((partner) => partner.partnerType === 'CUSTOMER'));
  }, [accessToken]);

  const fetchRows = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [policyRes, historyRes] = await Promise.all([
        sendRequest<IBackendRes<IPricingPolicy[]>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/pricing-policies`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<ISalesPriceHistory[]>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/pricing-policies/history`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      setPolicies(policyRes?.data ?? []);
      setHistory(historyRes?.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchReferenceData();
    fetchRows();
  }, [fetchReferenceData, fetchRows]);

  const filteredPolicies = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return policies;

    return policies.filter((policy) => (
      policy.product?.sku?.toLowerCase().includes(keyword)
      || policy.product?.vietnameseName?.toLowerCase().includes(keyword)
      || policy.buyer?.name?.toLowerCase().includes(keyword)
      || policy.country?.toLowerCase().includes(keyword)
    ));
  }, [policies, search]);

  const createPolicy = async () => {
    const values = await form.validateFields();
    if (!accessToken) return;

    const res = await sendRequest<IBackendRes<IPricingPolicy>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/pricing-policies`,
      method: 'POST',
      body: {
        ...values,
        effectiveFrom: values.effectiveFrom?.format('YYYY-MM-DD'),
        effectiveTo: values.effectiveTo ? values.effectiveTo.format('YYYY-MM-DD') : undefined,
        country: values.country ? String(values.country).toUpperCase() : undefined,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res?.data) {
      message.success(t('messages.createSuccess'));
      setModalOpen(false);
      form.resetFields();
      fetchRows();
    } else {
      message.error(res?.message || t('messages.createError'));
    }
  };

  const policyColumns: ColumnsType<IPricingPolicy> = [
    {
      title: t('policyTable.product'),
      key: 'product',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.product?.sku || record.productId}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.product?.vietnameseName || '-'}</Text>
        </Space>
      ),
    },
    {
      title: t('policyTable.marketBuyer'),
      key: 'market',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.buyer?.name || t('policyTable.globalPolicy')}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {[record.marketRegion, record.country].filter(Boolean).join(' / ') || t('policyTable.allMarkets')}
          </Text>
        </Space>
      ),
    },
    {
      title: t('policyTable.incoterm'),
      dataIndex: 'incoterm',
      key: 'incoterm',
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: t('policyTable.tier'),
      key: 'tier',
      render: (_, record) => `${formatCurrency(record.minQuantity, 2)} - ${record.maxQuantity ? formatCurrency(record.maxQuantity, 2) : t('policyTable.infinity')}`,
    },
    {
      title: t('policyTable.price'),
      key: 'unitPrice',
      align: 'right',
      render: (_, record) => <Text strong>{formatMoneyStatic(record.unitPrice, record.currency)}</Text>,
    },
    {
      title: t('policyTable.effective'),
      key: 'effective',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{dayjs(record.effectiveFrom).format('DD/MM/YYYY')}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.effectiveTo ? dayjs(record.effectiveTo).format('DD/MM/YYYY') : t('policyTable.unlimited')}</Text>
        </Space>
      ),
    },
    {
      title: t('policyTable.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? t('status.active') : t('status.inactive')}</Tag>,
    },
  ];

  const historyColumns: ColumnsType<ISalesPriceHistory> = [
    {
      title: t('historyTable.product'),
      key: 'product',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.product?.sku || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.product?.vietnameseName || '-'}</Text>
        </Space>
      ),
    },
    { title: t('historyTable.buyer'), key: 'buyer', render: (_, record) => record.buyer?.name || '-' },
    {
      title: t('historyTable.source'),
      key: 'source',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Tag color={record.sourceType === 'SALES_CONTRACT' ? 'purple' : 'cyan'}>{record.sourceType}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.sourceNumber || record._id}</Text>
        </Space>
      ),
    },
    { title: t('historyTable.incoterm'), dataIndex: 'incoterm', key: 'incoterm', render: (value: string) => <Tag>{value}</Tag> },
    { title: t('historyTable.quantity'), dataIndex: 'quantity', key: 'quantity', align: 'right', render: (value: number) => formatCurrency(value, 2) },
    { title: t('historyTable.unitPrice'), key: 'unitPrice', align: 'right', render: (_, record) => formatMoneyStatic(record.unitPrice, record.currency) },
    { title: t('historyTable.occurredAt'), dataIndex: 'occurredAt', key: 'occurredAt', render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm') },
    { title: t('historyTable.createdBy'), dataIndex: 'createdByUsername', key: 'createdByUsername' },
  ];

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('title')}
        icon={<DollarOutlined />}
        description={t('description')}
        extra={(
          <Space orientation="horizontal">
            <Button icon={<ReloadOutlined />} onClick={() => { fetchReferenceData(); fetchRows(); }}>
              {t('actions.reload')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              {t('actions.create')}
            </Button>
          </Space>
        )}
      />

      <Card variant="borderless">
        <Tabs
          items={[
            {
              key: 'policies',
              label: t('tabs.policies'),
              children: (
                <>
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder={t('searchPlaceholder')}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    style={{ width: 360, marginBottom: 16 }}
                  />
                  <Table<IPricingPolicy>
                    rowKey="_id"
                    columns={policyColumns}
                    dataSource={filteredPolicies}
                    loading={loading}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                  />
                </>
              ),
            },
            {
              key: 'history',
              label: t('tabs.history'),
              children: (
                <Table<ISalesPriceHistory>
                  rowKey="_id"
                  columns={historyColumns}
                  dataSource={history}
                  loading={loading}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={t('modal.title')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={createPolicy}
        width={760}
        okText={t('actions.save')}
        cancelText={t('actions.cancel')}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            incoterm: 'FOB',
            currency: 'USD',
            minQuantity: 1,
            isActive: true,
            effectiveFrom: dayjs(),
          }}
        >
          <Form.Item name="productId" label={t('form.product')} rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder={t('form.productPlaceholder')}
              optionFilterProp="label"
              options={products.map((product) => ({
                value: product._id,
                label: `${product.sku} - ${product.vietnameseName}`,
              }))}
            />
          </Form.Item>

          <Form.Item name="buyerId" label={t('form.buyer')}>
            <Select
              allowClear
              showSearch
              placeholder={t('form.buyerPlaceholder')}
              optionFilterProp="label"
              options={buyers.map((buyer) => ({
                value: buyer._id,
                label: `${buyer.name}${buyer.country ? ` - ${buyer.country}` : ''}`,
              }))}
            />
          </Form.Item>

          <Space orientation="horizontal" size={16} style={{ width: '100%' }}>
            <Form.Item name="marketRegion" label={t('form.region')} style={{ flex: 1 }}>
              <Select allowClear options={REGIONS.map((region) => ({ value: region, label: region }))} />
            </Form.Item>
            <Form.Item name="country" label={t('form.country')} style={{ flex: 1 }}>
              <Input placeholder="US, DE, JP..." />
            </Form.Item>
            <Form.Item name="incoterm" label={t('form.incoterm')} rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select options={INCOTERMS.map((term) => ({ value: term, label: term }))} />
            </Form.Item>
          </Space>

          <Space orientation="horizontal" size={16} style={{ width: '100%' }}>
            <Form.Item name="currency" label={t('form.currency')} rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="unitPrice" label={t('form.unitPrice')} rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Space orientation="horizontal" size={16} style={{ width: '100%' }}>
            <Form.Item name="minQuantity" label={t('form.minQuantity')} rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="maxQuantity" label={t('form.maxQuantity')} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Space orientation="horizontal" size={16} style={{ width: '100%' }}>
            <Form.Item name="effectiveFrom" label={t('form.effectiveFrom')} rules={[{ required: true }]} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="effectiveTo" label={t('form.effectiveTo')} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="isActive" label={t('form.active')} valuePropName="checked" style={{ flex: 1 }}>
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item name="note" label={t('form.note')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </AdminPageScroll>
  );
};

export default PricingPoliciesPage;
