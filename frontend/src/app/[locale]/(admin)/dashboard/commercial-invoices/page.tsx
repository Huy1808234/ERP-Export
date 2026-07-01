'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AlertOutlined,
  AuditOutlined,
  BankOutlined,
  CheckCircleOutlined,
  FilePdfOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { getAccessToken } from '@/lib/auth-token';
import { sendRequest } from '@/lib/api-client';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { useCommercialInvoices } from '@/hooks/useCommercialInvoices';
import { canReadCostFields } from '@/lib/field-access';
import type {
  CommercialInvoiceStatus,
  ICommercialInvoice,
  ICommercialInvoiceAuditEvent,
  ICommercialInvoiceItem,
  ICommercialInvoiceShipmentOption,
} from '@/types/commercial-invoice';
import { formatMoneyStatic, formatVND } from '@/utils/format';

const { Text, Title } = Typography;

type CreateFormValues = {
  shipment_id: string;
  invoiceDate?: Dayjs;
  dueDate?: Dayjs;
  taxRatePercent?: number;
  exchangeRate?: number;
  bankAccountId?: string;
  note?: string;
};

type CancelFormValues = {
  reason: string;
};

type SystemSetting = {
  key: string;
  value?: string | number | boolean | null;
};

type CurrencyExchangeRate = {
  rateType?: string | null;
  rate?: number | null;
};

type CurrencyOption = {
  code: string;
  exchangeRates?: CurrencyExchangeRate[];
};

const statusColor: Record<CommercialInvoiceStatus, string> = {
  DRAFT: 'gold',
  ISSUED: 'green',
  CANCELLED: 'red',
};

// Mock bank accounts - In production, fetch from settings/company config
const BANK_ACCOUNTS = [
  {
    _id: 'bank_001',
    bankName: 'Vietcombank',
    branchName: 'Chi nhánh TP.HCM',
    accountNumber: '1234567890',
    accountName: 'CÔNG TY TNHH XUẤT NHẬP KHẨU ABC',
    swiftCode: 'BFTVVNVX',
  },
  {
    _id: 'bank_002',
    bankName: 'Techcombank',
    branchName: 'Chi nhánh Hà Nội',
    accountNumber: '9876543210',
    accountName: 'CÔNG TY TNHH XUẤT NHẬP KHẨU ABC',
    swiftCode: 'VTCBVNVX',
  },
];

// Payment terms mapping
const PAYMENT_TERMS_DAYS: Record<string, number> = {
  'net 30': 30,
  'net 45': 45,
  'net 60': 60,
  'net 90': 90,
  'due on receipt': 0,
  'cash': 0,
};

const getPaymentTermDays = (terms: string | null | undefined): number => {
  if (!terms) return 30; // Default to Net 30
  const lower = terms.toLowerCase();
  for (const [key, days] of Object.entries(PAYMENT_TERMS_DAYS)) {
    if (lower.includes(key)) return days;
  }
  return 30; // Default fallback
};

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'primary';
};

const statToneClass: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-slate-900 dark:text-slate-100',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  primary: 'text-blue-600 dark:text-blue-400',
};

const StatCard = ({ label, value, tone = 'default' }: StatCardProps) => (
  <Card
    variant="borderless"
    className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
    styles={{ body: { padding: 18 } }}
  >
    <Statistic
      title={<span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>}
      valueRender={() => (
        <div className={`mt-1 text-2xl font-bold leading-tight ${statToneClass[tone]}`}>
          {value}
        </div>
      )}
    />
  </Card>
);

// Live Preview Component
const CILivePreview = ({
  shipment,
  taxRatePercent = 0,
  exchangeRate = 1,
}: {
  shipment: ICommercialInvoiceShipmentOption | null;
  taxRatePercent: number;
  exchangeRate: number;
}) => {
  const t = useTranslations('CommercialInvoices');

  if (!shipment) {
    return (
      <div className="flex h-full items-center justify-center">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <InfoCircleOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <Text type="secondary" style={{ textAlign: 'center' }}>
            {t('form.selectShipmentToPreview')}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
            {t('form.previewHint')}
          </Text>
        </div>
      </div>
    );
  }

  // Calculate items from shipment (mock data for preview)
  const contract = shipment.salesContract;
  
  // Mock items based on shipment - in real app, fetch from shipment.items
  const mockItems = [
    { description: 'Product A', sku: 'SKU-001', quantity: 1000, unit: 'PCS', unitPrice: 5.50 },
    { description: 'Product B', sku: 'SKU-002', quantity: 500, unit: 'KG', unitPrice: 12.00 },
  ];

  const subtotal = mockItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * (taxRatePercent / 100);
  const total = subtotal + taxAmount;
  const totalVnd = total * exchangeRate;

  const hasItems = mockItems.length > 0;
  const isShipped = ['ON_BOARD', 'ARRIVED', 'CLOSED'].includes(shipment.status);

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {/* Warnings */}
      {!hasItems && (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          title={t('warnings.noItemsTitle')}
          description={t('warnings.noItemsDesc')}
        />
      )}

      {!isShipped && (
        <Alert
          type="warning"
          showIcon
          icon={<AlertOutlined />}
          title={t('warnings.shipmentNotShippedTitle')}
          description={t('warnings.shipmentNotShippedDesc')}
        />
      )}

      {/* CI Preview Card */}
      <Card
        variant="outlined"
        styles={{ body: { padding: 0 } }}
        className="overflow-hidden"
      >
        {/* Header */}
        <div style={{ background: '#1a365d', color: '#fff', padding: '16px 24px' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Text strong style={{ color: '#fff', fontSize: 16 }}>
                COMMERCIAL INVOICE
              </Text>
            </Col>
            <Col>
              <Space orientation="vertical" size={0} align="end">
                <Text style={{ color: '#fff', fontSize: 12 }}>No: [Auto-generated]</Text>
                <Text style={{ color: '#94a3b8', fontSize: 11 }}>Date: [Today]</Text>
              </Space>
            </Col>
          </Row>
        </div>

        {/* Buyer & Route Info */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <Row gutter={[24, 12]}>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                {t('preview.buyer')}
              </Text>
              <div>
                <Text strong>{contract?.buyer?.name || '-'}</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>Country: Vietnam</Text>
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                {t('preview.shipmentRoute')}
              </Text>
              <div>
                <Text strong>{shipment.pol || 'POL'} → {shipment.pod || 'POD'}</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('preview.shipment')}: {shipment.shipmentNumber}
              </Text>
            </Col>
          </Row>
        </div>

        {/* Items Table */}
        <Table
          size="small"
          pagination={false}
          columns={[
            { title: '#', width: 40, render: (_, __, i) => i + 1 },
            { title: t('preview.description'), dataIndex: 'description' },
            { title: t('preview.qty'), dataIndex: 'quantity', align: 'right' as const, width: 80 },
            { title: t('preview.unit'), dataIndex: 'unit', width: 60 },
            { title: t('preview.unitPrice'), dataIndex: 'unitPrice', align: 'right' as const, width: 100,
              render: (v) => `$${v.toFixed(2)}` },
            { title: t('preview.total'), 
              render: (_, r) => `$${(r.quantity * r.unitPrice).toFixed(2)}`,
              align: 'right' as const, width: 100 },
          ]}
          dataSource={mockItems}
          rowKey="sku"
        />

        {/* Totals */}
        <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Row justify="end">
            <Col span={12}>
              <Space.Compact orientation="vertical" size="small" style={{ width: '100%' }}>
                <Row justify="space-between">
                  <Text type="secondary">{t('preview.subtotal')}:</Text>
                  <Text>${subtotal.toFixed(2)}</Text>
                </Row>
                <Row justify="space-between">
                  <Text type="secondary">{t('preview.tax')} ({taxRatePercent}%):</Text>
                  <Text>${taxAmount.toFixed(2)}</Text>
                </Row>
                <Divider style={{ margin: '8px 0' }} />
                <Row justify="space-between">
                  <Text strong>{t('preview.grandTotal')}:</Text>
                  <Text strong style={{ color: '#dc2626', fontSize: 16 }}>
                    ${total.toFixed(2)}
                  </Text>
                </Row>
                <Row justify="space-between">
                  <Text type="secondary" style={{ fontSize: 12 }}>(VND):</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatVND(totalVnd)}
                  </Text>
                </Row>
              </Space.Compact>
            </Col>
          </Row>
        </div>
      </Card>

      {/* Bank Info Preview */}
      <Card variant="outlined" size="small">
        <Space>
          <BankOutlined style={{ color: '#1890ff', fontSize: 20 }} />
          <Text strong>{t('preview.bankInfo')}</Text>
        </Space>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
          {t('preview.selectBankAccount')}
        </Text>
      </Card>
    </Space>
  );
};

const CommercialInvoicesPage = () => {
  const t = useTranslations('CommercialInvoices');
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const { message, modal } = App.useApp();
  const [createForm] = Form.useForm<CreateFormValues>();
  const [cancelForm] = Form.useForm<CancelFormValues>();
  const {
    rows,
    shipments,
    loading,
    fetchInvoices,
    fetchShipmentOptions,
    createFromShipment,
    issueInvoice,
    cancelInvoice,
    fetchInvoiceDetail,
    downloadCommercialInvoicePdf,
  } = useCommercialInvoices();

  const canViewPrice = canReadCostFields(session?.user);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [selected, setSelected] = useState<ICommercialInvoice | null>(null);
  const [creating, setCreating] = useState(false);

  // Form values for live preview
  const [taxRate, setTaxRate] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(23500);

  const hiddenPrice = useMemo(() => <Text type="secondary">{t('hiddenByPermission')}</Text>, [t]);

  const refreshAll = useCallback(() => {
    fetchInvoices();
    fetchShipmentOptions();
  }, [fetchInvoices, fetchShipmentOptions]);

  const fetchDefaults = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [settingsRes, curRes] = await Promise.all([
        sendRequest<IBackendRes<SystemSetting[]>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/settings`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<CurrencyOption[]>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);
      
      if (Array.isArray(settingsRes?.data)) {
        const vatSetting = settingsRes.data.find((setting) => setting.key === 'DEFAULT_PURCHASE_VAT_RATE');
        if (vatSetting?.value) {
          setTaxRate(Number(vatSetting.value));
        }
      }

      if (Array.isArray(curRes?.data)) {
        const usd = curRes.data.find((currency) => currency.code === 'USD');
        if (usd?.exchangeRates?.length) {
          const transferRate = usd.exchangeRates.find((rate) => (rate.rateType || 'TRANSFER') === 'TRANSFER') || usd.exchangeRates[0];
          if (transferRate?.rate) {
            setExchangeRate(transferRate.rate);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [accessToken]);

  useEffect(() => {
    refreshAll();
    fetchDefaults();
  }, [refreshAll, fetchDefaults]);

  const selectedShipmentId = Form.useWatch('shipment_id', createForm);
  const selectedShipment = useMemo(() => {
    return shipments.find((s) => s._id === selectedShipmentId) || null;
  }, [shipments, selectedShipmentId]);

  // Auto-fill default tax and exchange rate when modal opens
  useEffect(() => {
    if (createOpen) {
      const currentTax = createForm.getFieldValue('taxRatePercent');
      const currentExchange = createForm.getFieldValue('exchangeRate');
      
      if (currentTax === undefined) {
        createForm.setFieldValue('taxRatePercent', taxRate);
      }
      if (currentExchange === undefined) {
        createForm.setFieldValue('exchangeRate', exchangeRate);
      }
    }
  }, [createOpen, createForm, taxRate, exchangeRate]);

  // Auto-fill dates when shipment selected
  useEffect(() => {
    if (selectedShipment && createOpen) {
      const contract = selectedShipment.salesContract;
      const today = dayjs();
      const paymentTermDays = getPaymentTermDays(contract?.paymentTerms);
      const dueDate = paymentTermDays > 0 ? today.add(paymentTermDays, 'day') : today;

      createForm.setFieldsValue({
        invoiceDate: today,
        dueDate: dueDate,
        exchangeRate: exchangeRate,
        taxRatePercent: taxRate,
      });
    }
  }, [selectedShipment, createOpen, createForm, exchangeRate, taxRate]);

  // Check for existing CI
  const existingCI = useMemo(() => {
    if (!selectedShipmentId) return null;
    return rows.find(ci => ci.shipment_id === selectedShipmentId);
  }, [selectedShipmentId, rows]);

  const createInvoice = async () => {
    const values = await createForm.validateFields();
    
    // Block if no items warning
    if (!selectedShipment?.items?.length) {
      const confirmed = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: t('warnings.confirmNoItemsTitle'),
          content: t('warnings.confirmNoItemsDesc'),
          okText: t('actions.continue'),
          cancelText: t('actions.cancel'),
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!confirmed) return;
    }

    setCreating(true);
    try {
      const result = await createFromShipment(values.shipment_id, {
        invoiceDate: values.invoiceDate?.format('YYYY-MM-DD'),
        dueDate: values.dueDate?.format('YYYY-MM-DD'),
        taxRatePercent: values.taxRatePercent,
        exchangeRate: values.exchangeRate,
        note: values.note,
      });

      if (result) {
        message.success(t('messages.created', { invoiceNumber: result.invoiceNumber }));
        createForm.resetFields();
        setCreateOpen(false);
        refreshAll();
      } else {
        message.error(t('messages.createFailed'));
      }
    } finally {
      setCreating(false);
    }
  };

  const issueSelectedInvoice = async (record: ICommercialInvoice) => {
    const result = await issueInvoice(record._id);
    if (result) {
      message.success(t('messages.issued', { invoiceNumber: result.invoiceNumber }));
      refreshAll();
    } else {
      message.error(t('messages.issueFailed'));
    }
  };

  const cancelSelectedInvoice = async () => {
    if (!selected) return;
    const values = await cancelForm.validateFields();
    const result = await cancelInvoice(selected._id, values.reason);
    if (result) {
      message.success(t('messages.cancelled', { invoiceNumber: result.invoiceNumber }));
      cancelForm.resetFields();
      setCancelOpen(false);
      setSelected(null);
      refreshAll();
    } else {
      message.error(t('messages.cancelFailed'));
    }
  };

  const openInvoiceDetail = async (record: ICommercialInvoice) => {
    setSelected(record);
    setDetailOpen(true);
    setDetailLoading(true);

    try {
      const detail = await fetchInvoiceDetail(record._id);
      if (detail) {
        setSelected(detail);
        return;
      }
      message.error(t('messages.detailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const downloadCommercialInvoice = async (record: ICommercialInvoice) => {
    if (record.status !== 'ISSUED') {
      message.warning(t('messages.issueBeforeDownload'));
      return;
    }

    const ok = await downloadCommercialInvoicePdf(
      record.shipment_id,
      `CI_${record.invoiceNumber}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_'),
    );
    if (!ok) message.error(t('messages.downloadFailed'));
  };

  const formatProtectedMoney = useCallback(
    (value: number | string | null | undefined, currency = 'VND') => {
      if (!canViewPrice) return hiddenPrice;
      return formatMoneyStatic(value, currency);
    },
    [canViewPrice, hiddenPrice],
  );

  const formatProtectedVnd = useCallback(
    (value: number | string | null | undefined) => {
      if (!canViewPrice) return hiddenPrice;
      return formatVND(value || 0);
    },
    [canViewPrice, hiddenPrice],
  );

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.status !== 'CANCELLED') {
          acc.vnd += Number(row.totalAmountVnd || 0);
        }
        if (row.status === 'ISSUED') acc.issued += 1;
        if (row.status === 'DRAFT') acc.draft += 1;
        return acc;
      },
      { vnd: 0, issued: 0, draft: 0 },
    );
  }, [rows]);

  const columns: ColumnsType<ICommercialInvoice> = [
    {
      title: t('table.invoice'),
      dataIndex: 'invoiceNumber',
      width: 230,
      render: (value: string, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{dayjs(record.invoiceDate).format('DD/MM/YYYY')}</Text>
        </Space>
      ),
    },
    {
      title: t('table.shipmentContract'),
      width: 250,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.shipment?.shipmentNumber || record.shipment_id}</Text>
          <Text type="secondary">{record.salesContract?.contractNumber || record.salesContract_id}</Text>
        </Space>
      ),
    },
    {
      title: t('table.buyer'),
      width: 180,
      render: (_, record) => record.buyer?.name || record.buyer_id,
    },
    {
      title: t('table.amount'),
      align: 'right',
      width: 180,
      render: (_, record) => (
        <Space orientation="vertical" size={0} align="end">
          <Text strong>{formatProtectedMoney(record.totalAmountForeign, record.currency)}</Text>
          <Text type="secondary">{formatProtectedVnd(record.totalAmountVnd)}</Text>
        </Space>
      ),
    },
    {
      title: t('table.sourceLinks'),
      width: 260,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{t('labels.ar')}: {record.accountReceivable_id || '-'}</Text>
          <Text type="secondary">
            {t('labels.exportDoc')}: {record.exportDocument?.documentNumber || record.exportDocument_id || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      render: (value: CommercialInvoiceStatus) => <Tag color={statusColor[value]}>{t(`status.${value}`)}</Tag>,
      width: 130,
    },
    {
      title: t('table.actions'),
      width: 330,
      render: (_, record) => (
        <Space wrap>
          <Button
            size="small"
            icon={<AuditOutlined />}
            onClick={() => {
              void openInvoiceDetail(record);
            }}
          >
            {t('actions.detail')}
          </Button>
          {record.status === 'DRAFT' && (
            <Popconfirm title={t('confirm.issueTitle')} onConfirm={() => issueSelectedInvoice(record)}>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}>
                {t('actions.issue')}
              </Button>
            </Popconfirm>
          )}
          {record.status === 'DRAFT' && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => {
                setSelected(record);
                setCancelOpen(true);
              }}
            >
              {t('actions.cancel')}
            </Button>
          )}
          {record.status === 'ISSUED' && (
            <Button
              size="small"
              icon={<FilePdfOutlined />}
              onClick={() => {
                void downloadCommercialInvoice(record);
              }}
            >
              {t('actions.invoicePdf')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const itemColumns: ColumnsType<ICommercialInvoiceItem> = [
    {
      title: t('itemTable.item'),
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.description}</Text>
          <Text type="secondary">{record.sku || '-'} / HS {record.hsCode || '-'}</Text>
        </Space>
      ),
    },
    { title: t('itemTable.qty'), dataIndex: 'quantity', align: 'right', width: 100 },
    { title: t('itemTable.unit'), dataIndex: 'unit', width: 90 },
    ...(canViewPrice
      ? [
          {
            title: t('itemTable.unitPrice'),
            align: 'right' as const,
            render: (_: unknown, record: ICommercialInvoiceItem) =>
              formatMoneyStatic(record.unitPriceForeign, selected?.currency || 'USD'),
          },
          {
            title: t('itemTable.lineAmount'),
            align: 'right' as const,
            render: (_: unknown, record: ICommercialInvoiceItem) =>
              formatMoneyStatic(record.lineAmountForeign, selected?.currency || 'USD'),
          },
        ]
      : []),
  ];

  const auditColumns: ColumnsType<ICommercialInvoiceAuditEvent> = [
    { title: t('auditTable.action'), dataIndex: 'action', width: 190 },
    { title: t('auditTable.actor'), dataIndex: 'username', width: 150 },
    { title: t('auditTable.at'), dataIndex: 'at', render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm') },
    {
      title: t('auditTable.reference'),
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.referenceType || '-'}</Text>
          <Text type="secondary">{record.reference_id || record.note || '-'}</Text>
        </Space>
      ),
    },
  ];

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('title')}
        description={t('description')}
        extra={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={refreshAll}>
              {t('actions.refresh')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              {t('actions.newCi')}
            </Button>
          </Space>
        )}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label={t('stats.documents')} value={rows.length} />
        <StatCard label={t('stats.issued')} value={totals.issued} tone="success" />
        <StatCard label={t('stats.draft')} value={totals.draft} tone="warning" />
        <StatCard label={t('stats.totalVnd')} value={formatProtectedVnd(totals.vnd)} tone="primary" />
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <Table<ICommercialInvoice>
          rowKey="_id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1280 }}
          pagination={{ pageSize: 10 }}
        />
      </div>

      {/* Create CI Modal - Split Layout */}
      <Modal
        title={
          <Space>
            <FilePdfOutlined />
            <span>{t('modal.createTitle')}</span>
          </Space>
        }
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        width={1200}
        styles={{ body: { minHeight: 400, paddingTop: 16 } }}
        destroyOnHidden
        footer={
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setCreateOpen(false)}>{t('actions.cancel')}</Button>
            <Button type="primary" onClick={createInvoice} loading={creating}>
              {t('actions.createDraft')}
            </Button>
          </Space>
        }
      >
        <Row gutter={32}>
          {/* Left Column - Form */}
          <Col xs={24} lg={10}>
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              {/* Shipment Selection */}
              <Card variant="outlined" size="small">
                <Title level={5} style={{ marginBottom: 16 }}>
                  <InfoCircleOutlined /> {t('form.shipmentSection')}
                </Title>
                <Form form={createForm} layout="vertical">
                  <Form.Item
                    name="shipment_id"
                    label={t('form.shipment')}
                    rules={[{ required: true, message: t('validation.selectShipment') }]}
                  >
                    <Select
                      showSearch
                      placeholder={t('form.selectShipment')}
                      optionFilterProp="label"
                      options={shipments.map((shipment) => ({
                        value: shipment._id,
                        label: (
                          <Space>
                            <Text>{shipment.shipmentNumber}</Text>
                            <Text type="secondary">-</Text>
                            <Text>{shipment.salesContract?.contractNumber || '-'}</Text>
                            <Badge
                              status={
                                ['ON_BOARD', 'ARRIVED', 'CLOSED'].includes(shipment.status)
                                  ? 'success'
                                  : 'warning'
                              }
                              text={
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {shipment.status}
                                </Text>
                              }
                            />
                          </Space>
                        ),
                      }))}
                    />
                  </Form.Item>

                  {/* Duplicate Warning */}
                  {existingCI && (
                    <Alert
                      type="warning"
                      showIcon
                      icon={<WarningOutlined />}
                      title={t('warnings.existingCiTitle')}
                      description={
                        <Space.Compact orientation="vertical" size="small">
                          <Text>
                            {t('warnings.existingCiDesc', { invoiceNumber: existingCI.invoiceNumber })}
                          </Text>
                          <Button size="small" onClick={() => openInvoiceDetail(existingCI)}>
                            {t('form.viewExisting')}
                          </Button>
                        </Space.Compact>
                      }
                    />
                  )}
                </Form>
              </Card>

              {/* Invoice Details */}
              <Card variant="outlined" size="small">
                <Title level={5} style={{ marginBottom: 16 }}>
                  {t('form.invoiceSection')}
                </Title>
                <Form form={createForm} layout="vertical">
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="invoiceDate" label={t('form.invoiceDate')}>
                        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="dueDate" label={t('form.dueDate')}>
                        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="taxRatePercent" label={t('form.taxRate')}>
                        <InputNumber
                          min={0}
                          max={100}
                          style={{ width: '100%' }}
                          suffix="%"
                          onChange={(v) => setTaxRate(v || 0)}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="exchangeRate" label={t('form.exchangeRate')}>
                        <InputNumber
                          min={1}
                          style={{ width: '100%' }}
                          precision={0}
                          prefix={<span style={{ color: 'rgba(0,0,0,0.45)', marginRight: 4, whiteSpace: 'nowrap' }}>1 USD =</span>}
                          suffix={<span style={{ color: 'rgba(0,0,0,0.45)', whiteSpace: 'nowrap' }}>VND</span>}
                          onChange={(v) => setExchangeRate(v || 23500)}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item name="bankAccountId" label={t('form.bankAccount')}>
                    <Select
                      placeholder={t('form.selectBankAccount')}
                      options={BANK_ACCOUNTS.map((bank) => ({
                        value: bank._id,
                        label: (
                          <div style={{ lineHeight: 1.4 }}>
                            <div style={{ fontWeight: 600 }}>{bank.bankName}</div>
                            <div style={{ fontSize: 11, color: '#999' }}>
                              {bank.accountNumber} - {bank.branchName}
                            </div>
                          </div>
                        ),
                      }))}
                    />
                  </Form.Item>

                  <Form.Item name="note" label={t('form.note')}>
                    <Input.TextArea rows={3} placeholder={t('form.notePlaceholder')} />
                  </Form.Item>
                </Form>
              </Card>
            </Space>
          </Col>

          {/* Right Column - Live Preview */}
          <Col xs={24} lg={14}>
            <Card
              variant="outlined"
              size="small"
              styles={{ body: { height: '100%', minHeight: 500 } }}
            >
              <Space style={{ marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0 }}>
                  {t('preview.title')}
                </Title>
                <Tooltip title={t('preview.autoUpdate')}>
                  <InfoCircleOutlined style={{ color: '#1890ff' }} />
                </Tooltip>
              </Space>
              <CILivePreview
                shipment={selectedShipment}
                taxRatePercent={taxRate}
                exchangeRate={exchangeRate}
              />
            </Card>
          </Col>
        </Row>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        title={t('modal.cancelTitle')}
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onOk={cancelSelectedInvoice}
        okText={t('actions.cancelDocument')}
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        <Form form={cancelForm} layout="vertical">
          <Form.Item
            name="reason"
            label={t('form.reason')}
            rules={[{ required: true, min: 3, message: t('validation.cancelReason') }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selected?.invoiceNumber || t('title')}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        size="large"
      >
        {selected && (
          <Spin spinning={detailLoading}>
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label={t('labels.status')}>
                  <Tag color={statusColor[selected.status]}>{t(`status.${selected.status}`)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('labels.buyer')}>{selected.buyer?.name || selected.buyer_id}</Descriptions.Item>
                <Descriptions.Item label={t('labels.shipment')}>{selected.shipment?.shipmentNumber || selected.shipment_id}</Descriptions.Item>
                <Descriptions.Item label={t('labels.contract')}>{selected.salesContract?.contractNumber || selected.salesContract_id}</Descriptions.Item>
                <Descriptions.Item label={t('labels.invoiceDate')}>{dayjs(selected.invoiceDate).format('DD/MM/YYYY')}</Descriptions.Item>
                <Descriptions.Item label={t('labels.dueDate')}>{selected.dueDate ? dayjs(selected.dueDate).format('DD/MM/YYYY') : '-'}</Descriptions.Item>
                <Descriptions.Item label={t('labels.subtotal')}>{formatProtectedMoney(selected.subtotalForeign, selected.currency)}</Descriptions.Item>
                <Descriptions.Item label={t('labels.tax')}>{formatProtectedMoney(selected.taxAmountForeign, selected.currency)}</Descriptions.Item>
                <Descriptions.Item label={t('labels.total')}>{formatProtectedMoney(selected.totalAmountForeign, selected.currency)}</Descriptions.Item>
                <Descriptions.Item label={t('labels.totalVnd')}>{formatProtectedVnd(selected.totalAmountVnd)}</Descriptions.Item>
                {selected.exchangeRate && (
                  <Descriptions.Item label={t('labels.exchangeRate')}>
                    1 {selected.currency} = {formatVND(selected.exchangeRate * (selected.currency === 'USD' ? 1 : 1))} VND
                  </Descriptions.Item>
                )}
              </Descriptions>

              <Table<ICommercialInvoiceItem>
                rowKey="_id"
                size="small"
                columns={itemColumns}
                dataSource={selected.items ?? []}
                pagination={false}
                scroll={{ x: canViewPrice ? 760 : 520 }}
              />

              <Table<ICommercialInvoiceAuditEvent>
                rowKey={(record) => `${record.action}-${record.at}-${record.reference_id || ''}`}
                size="small"
                columns={auditColumns}
                dataSource={selected.auditTrail ?? []}
                pagination={false}
              />
            </Space>
          </Spin>
        )}
      </Drawer>
    </AdminPageScroll>
  );
};

export default CommercialInvoicesPage;
