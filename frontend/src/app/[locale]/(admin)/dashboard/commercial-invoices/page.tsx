'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AuditOutlined,
  CheckCircleOutlined,
  FilePdfOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { useCommercialInvoices } from '@/hooks/useCommercialInvoices';
import { canReadCostFields } from '@/lib/field-access';
import type {
  CommercialInvoiceStatus,
  ICommercialInvoice,
  ICommercialInvoiceAuditEvent,
  ICommercialInvoiceItem,
} from '@/types/commercial-invoice';
import { formatMoneyStatic, formatVND } from '@/utils/format';

const { Text } = Typography;

type CreateFormValues = {
  shipment_id: string;
  invoiceDate?: Dayjs;
  dueDate?: Dayjs;
  taxRatePercent?: number;
  note?: string;
};

type CancelFormValues = {
  reason: string;
};

const statusColor: Record<CommercialInvoiceStatus, string> = {
  DRAFT: 'gold',
  ISSUED: 'green',
  CANCELLED: 'red',
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

const CommercialInvoicesPage = () => {
  const t = useTranslations('CommercialInvoices');
  const { data: session } = useSession();
  const { message } = App.useApp();
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

  const hiddenPrice = useMemo(() => <Text type="secondary">{t('hiddenByPermission')}</Text>, [t]);

  const refreshAll = useCallback(() => {
    fetchInvoices();
    fetchShipmentOptions();
  }, [fetchInvoices, fetchShipmentOptions]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const createInvoice = async () => {
    const values = await createForm.validateFields();
    const result = await createFromShipment(values.shipment_id, {
      invoiceDate: values.invoiceDate?.format('YYYY-MM-DD'),
      dueDate: values.dueDate?.format('YYYY-MM-DD'),
      taxRatePercent: values.taxRatePercent,
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

      <Modal
        title={t('modal.createTitle')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={createInvoice}
        okText={t('actions.createDraft')}
        forceRender
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" initialValues={{ taxRatePercent: 0 }}>
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
                label: `${shipment.shipmentNumber} - ${shipment.salesContract?.contractNumber || '-'} - ${shipment.salesContract?.buyer?.name || ''}`,
              }))}
            />
          </Form.Item>
          <Space orientation="vertical" size={0} style={{ width: '100%' }}>
            <Form.Item name="invoiceDate" label={t('form.invoiceDate')}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="dueDate" label={t('form.dueDate')}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="taxRatePercent" label={t('form.taxRate')}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label={t('form.note')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('modal.cancelTitle')}
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onOk={cancelSelectedInvoice}
        okText={t('actions.cancelDocument')}
        okButtonProps={{ danger: true }}
        forceRender
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
