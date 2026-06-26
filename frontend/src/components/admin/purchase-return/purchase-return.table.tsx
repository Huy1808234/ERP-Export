'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useLocale, useTranslations } from 'next-intl';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ContainerOutlined,
  CreditCardOutlined,
  DollarOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
  SendOutlined,
  ShopOutlined,
  SwapOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePurchaseReturns } from '@/hooks/usePurchaseReturns';
import { useTheme } from '@/context/theme.context';
import { formatDate } from '@/utils/format';
import { notification, modal } from '@/providers/antd-static';
import type {
  IPurchaseReturn,
  PurchaseReturnReasonCode,
  PurchaseReturnStatus,
} from '@/types/purchase-return';
import PurchaseReturnModal from './purchase-return.modal';

const { Text } = Typography;

const STATUS_COLOR: Record<PurchaseReturnStatus, string> = {
  DRAFT: 'default',
  PENDING_VENDOR: 'processing',
  SENT: 'blue',
  CREDITED: 'green',
  REPLACED: 'purple',
  CLOSED: 'green',
  CANCELLED: 'red',
};

const REASON_CODE_KEYS: PurchaseReturnReasonCode[] = [
  'DEFECTIVE',
  'EXPIRED',
  'WRONG_SPEC',
  'DAMAGED_IN_TRANSIT',
  'OVERSUPPLY',
  'QUALITY_REJECT',
  'OTHER',
];

const STATUS_KEYS: PurchaseReturnStatus[] = [
  'DRAFT',
  'PENDING_VENDOR',
  'SENT',
  'CREDITED',
  'REPLACED',
  'CLOSED',
  'CANCELLED',
];

const PurchaseReturnTable = () => {
  const t = useTranslations('PurchaseReturn');
  const locale = useLocale();
  const {
    data,
    meta,
    loading,
    stats,
    fetchReturns,
    fetchStats,
    runReturnAction,
    fetchOne,
  } = usePurchaseReturns();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterForm] = Form.useForm();
  const [filters, setFilters] = useState<{
    status?: PurchaseReturnStatus | '';
    search?: string;
    reasonCode?: PurchaseReturnReasonCode;
    dateRange?: [Dayjs | null, Dayjs | null] | null;
    sort?: 'createdAt' | 'returnDate' | 'amount';
  }>({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<IPurchaseReturn | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { token } = theme.useToken();
  const { isDark } = useTheme();

  const refreshData = useCallback(() => {
    const [from, to] = filters.dateRange ?? [];
    fetchReturns({
      current,
      pageSize,
      status: filters.status,
      search: filters.search,
      reasonCode: filters.reasonCode,
      dateFrom: from ? from.format('YYYY-MM-DD') : undefined,
      dateTo: to ? to.format('YYYY-MM-DD') : undefined,
      sort: filters.sort,
    });
  }, [current, pageSize, filters, fetchReturns]);

  useEffect(() => {
    refreshData();
    fetchStats();
  }, [refreshData, fetchStats]);

  const handleAction = async (
    record: IPurchaseReturn,
    action: 'submit' | 'send' | 'resolve' | 'cancel',
    body: Record<string, unknown> = {},
    successMessage = 'Purchase return updated',
  ) => {
    const loadingKey = `${record._id}:${action}:${String(
      body.settlementType || '',
    )}`;
    setActionLoading(loadingKey);
    try {
      await runReturnAction(record._id, action, body);
      notification.success({ title: successMessage });
      refreshData();
      fetchStats();
    } catch (error) {
      notification.error({
        title: error instanceof Error ? error.message : 'Action failed',
      });
      throw error;
    } finally {
      setActionLoading(null);
    }
  };

  const confirmCancel = (record: IPurchaseReturn) => {
    let reason = '';
    modal.confirm({
      title: t('notifications.cancelPrompt', { id: record.returnNumber }),
      content: (
        <Input.TextArea
          rows={3}
          placeholder={t('notifications.cancelReason')}
          onChange={(event) => {
            reason = event.target.value;
          }}
        />
      ),
      okText: t('table.tooltips.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!reason.trim()) {
          notification.error({
            title: t('notifications.cancelReasonRequired'),
          });
          return Promise.reject(
            new Error(t('notifications.cancelReasonRequired')),
          );
        }
        await handleAction(
          record,
          'cancel',
          { reason: reason.trim() },
          t('notifications.cancelled'),
        );
      },
    });
  };

  const openResolveModal = (
    record: IPurchaseReturn,
    settlementType: 'CREDITED' | 'REPLACED' | 'CLOSED',
  ) => {
    let settlementNote = '';
    let creditNoteNumber = '';
    let replacementPoNumber = '';
    modal.confirm({
      title: t('resolveModal.title'),
      icon: <CheckCircleOutlined style={{ color: token.colorPrimary }} />,
      width: 560,
      content: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">
              {t('resolveModal.settlementType')}:
            </Text>{' '}
            <Tag color={STATUS_COLOR[settlementType] || 'blue'}>
              {t(`status.${settlementType}`)}
            </Tag>
          </div>
          <Input
            placeholder={t('resolveModal.settlementNotePlaceholder')}
            onChange={(e) => {
              settlementNote = e.target.value;
            }}
          />
          {settlementType === 'CREDITED' ? (
            <Input
              addonBefore={t('resolveModal.creditNoteNumber')}
              placeholder={t('resolveModal.creditNoteNumberPlaceholder')}
              onChange={(e) => {
                creditNoteNumber = e.target.value;
              }}
            />
          ) : null}
          {settlementType === 'REPLACED' ? (
            <Input
              addonBefore={t('resolveModal.replacementPoNumber')}
              placeholder={t('resolveModal.replacementPoNumberPlaceholder')}
              onChange={(e) => {
                replacementPoNumber = e.target.value;
              }}
            />
          ) : null}
        </Space>
      ),
      okText: t('resolveModal.submit'),
      onOk: async () => {
        const body: Record<string, unknown> = {
          settlementType,
          settlementNote: settlementNote.trim() || null,
        };
        if (settlementType === 'CREDITED') {
          if (!creditNoteNumber.trim()) {
            notification.error({
              title: t('resolveModal.creditNoteNumber'),
            });
            return Promise.reject(
              new Error('Credit note number is required'),
            );
          }
          body.creditNoteNumber = creditNoteNumber.trim();
        }
        if (settlementType === 'REPLACED') {
          if (!replacementPoNumber.trim()) {
            notification.error({
              title: t('resolveModal.replacementPoNumber'),
            });
            return Promise.reject(
              new Error('Replacement PO is required'),
            );
          }
          body.replacementPurchaseOrderId = replacementPoNumber.trim();
        }
        await handleAction(record, 'resolve', body, t(`notifications.${settlementType.toLowerCase()}`));
      },
    });
  };

  const showDetail = async (record: IPurchaseReturn) => {
    setDetailRecord(record);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = await fetchOne(record._id);
      if (detail) {
        setDetailRecord(detail);
      } else {
        notification.error({ title: t('notifications.loadDetailError') });
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const renderActions = (record: IPurchaseReturn) => {
    const status = record.status;
    const isLoading = (action: string, settlementType = '') =>
      actionLoading === `${record._id}:${action}:${settlementType}`;

    return (
      <Space size={4} wrap>
        <Tooltip title={t('table.tooltips.viewDetail')}>
          <Button
            type="text"
            icon={
              <EyeOutlined style={{ color: token.colorPrimary }} />
            }
            onClick={() => showDetail(record)}
          />
        </Tooltip>
        {status === 'DRAFT' ? (
          <Tooltip title={t('table.tooltips.submit')}>
            <Button
              type="text"
              icon={<CheckCircleOutlined />}
              loading={isLoading('submit')}
              onClick={() =>
                handleAction(
                  record,
                  'submit',
                  {},
                  t('notifications.submitted'),
                )
              }
            />
          </Tooltip>
        ) : null}
        {status === 'DRAFT' || status === 'PENDING_VENDOR' ? (
          <Tooltip title={t('table.tooltips.send')}>
            <Button
              type="text"
              icon={<SendOutlined style={{ color: token.colorPrimary }} />}
              loading={isLoading('send')}
              onClick={() =>
                handleAction(record, 'send', {}, t('notifications.sent'))
              }
            />
          </Tooltip>
        ) : null}
        {status === 'SENT' ? (
          <>
            <Tooltip title={t('table.tooltips.credited')}>
              <Button
                type="text"
                icon={
                  <DollarOutlined style={{ color: token.colorSuccess }} />
                }
                loading={isLoading('resolve', 'CREDITED')}
                onClick={() => openResolveModal(record, 'CREDITED')}
              />
            </Tooltip>
            <Tooltip title={t('table.tooltips.replaced')}>
              <Button
                type="text"
                icon={
                  <SwapOutlined style={{ color: token.colorInfo }} />
                }
                loading={isLoading('resolve', 'REPLACED')}
                onClick={() => openResolveModal(record, 'REPLACED')}
              />
            </Tooltip>
            <Tooltip title={t('table.tooltips.close')}>
              <Button
                type="text"
                icon={
                  <CheckCircleOutlined
                    style={{ color: token.colorTextSecondary }}
                  />
                }
                loading={isLoading('resolve', 'CLOSED')}
                onClick={() => openResolveModal(record, 'CLOSED')}
              />
            </Tooltip>
          </>
        ) : null}
        {status === 'DRAFT' || status === 'PENDING_VENDOR' ? (
          <Tooltip title={t('table.tooltips.cancel')}>
            <Button
              type="text"
              danger
              icon={<CloseCircleOutlined />}
              loading={isLoading('cancel')}
              onClick={() => confirmCancel(record)}
            />
          </Tooltip>
        ) : null}
      </Space>
    );
  };

  const columns: ColumnsType<IPurchaseReturn> = [
    {
      title: t('table.columns.returnNumber'),
      dataIndex: 'returnNumber',
      key: 'returnNumber',
      fixed: 'left',
      width: 170,
      render: (text: string, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong style={{ color: token.colorError }}>
            {text}
          </Text>
          {record.claimNumber ? (
            <Tag color="orange" style={{ fontSize: 10 }}>
              {record.claimNumber}
            </Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('table.columns.returnDate'),
      dataIndex: 'returnDate',
      key: 'returnDate',
      width: 120,
      render: (date: string) => formatDate(date),
    },
    {
      title: t('table.columns.poNumber'),
      dataIndex: ['purchaseOrder', 'poNumber'],
      key: 'poNumber',
      width: 160,
      render: (text: string, record) => (
        <Space orientation="vertical" size={0}>
          {text ? (
            <Tag color="blue">{text}</Tag>
          ) : (
            <Text type="secondary">-</Text>
          )}
          {record.purchaseOrder?.vendor?.name ? (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.purchaseOrder.vendor.name}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('table.columns.itemsCount'),
      key: 'itemsCount',
      width: 90,
      align: 'center',
      render: (_v, record) => (
        <Tag icon={<ContainerOutlined />}>
          {record.items?.length || 0}
        </Tag>
      ),
    },
    {
      title: t('table.columns.refundable'),
      key: 'refundable',
      width: 160,
      align: 'right',
      render: (_v, record) => (
        <Space orientation="vertical" size={0} align="end">
          <Text strong>
            {Number(record.totalRefundableAmount || 0).toLocaleString()}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.currency || 'VND'}
          </Text>
        </Space>
      ),
    },
    {
      title: t('detail.reasonCode'),
      key: 'reasonCode',
      width: 140,
      render: (_v, record) =>
        record.reasonCode ? (
          <Tag color="geekblue">{t(`modal.reasonCode.${record.reasonCode}`)}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: t('table.columns.status'),
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: PurchaseReturnStatus) => (
        <Tag color={STATUS_COLOR[status] || 'default'}>
          {t(`status.${status}`)}
        </Tag>
      ),
    },
    {
      title: t('table.columns.actions'),
      key: 'action',
      width: 230,
      fixed: 'right',
      render: (_value, record) => renderActions(record),
    },
  ];

  const statusTiles = useMemo(() => {
    if (!stats) return null;
    return [
      { key: 'DRAFT', label: t('stats.draft'), color: token.colorTextSecondary },
      { key: 'PENDING_VENDOR', label: t('stats.pendingVendor'), color: token.colorWarning },
      { key: 'SENT', label: t('stats.sent'), color: token.colorInfo },
      { key: 'CREDITED', label: t('stats.credited'), color: token.colorSuccess },
      { key: 'REPLACED', label: t('stats.replaced'), color: '#722ed1' },
      { key: 'CLOSED', label: t('stats.closed'), color: token.colorText },
      { key: 'CANCELLED', label: t('stats.cancelled'), color: token.colorError },
    ];
  }, [stats, t, token]);

  return (
    <>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <PageHeader
          title={t('title')}
          icon={<RollbackOutlined style={{ color: token.colorError }} />}
          description={t('description')}
        />
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              refreshData();
              fetchStats();
            }}
          >
            {locale === 'vi' ? 'Làm mới' : 'Refresh'}
          </Button>
          <Button
            type="primary"
            danger
            icon={<PlusOutlined />}
            size="large"
            style={{ borderRadius: 8 }}
            onClick={() => setIsModalOpen(true)}
          >
            {t('createBtn')}
          </Button>
        </Space>
      </div>

      {stats ? (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: 12,
                background: isDark
                  ? 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(15,23,42,0.65))'
                  : 'linear-gradient(135deg, rgba(59,130,246,0.12), #fff)',
              }}
            >
              <Statistic
                title={t('stats.totalRefundable')}
                value={stats.totalRefundableAmount}
                precision={0}
                suffix={stats ? 'VND' : ''}
                prefix={
                  <DollarOutlined style={{ color: token.colorPrimary }} />
                }
                styles={{ content: { color: token.colorPrimary, fontSize: 22 } }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {stats.total} {t('stats.total').toLowerCase()}
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: 12,
                background: isDark
                  ? 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(15,23,42,0.65))'
                  : 'linear-gradient(135deg, rgba(245,158,11,0.12), #fff)',
              }}
            >
              <Statistic
                title={t('stats.pendingValue')}
                value={stats.pendingVendorValue}
                precision={0}
                suffix="VND"
                prefix={
                  <CalendarOutlined style={{ color: token.colorWarning }} />
                }
                styles={{ content: { color: token.colorWarning, fontSize: 22 } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: 12,
                background: isDark
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(15,23,42,0.65))'
                  : 'linear-gradient(135deg, rgba(16,185,129,0.12), #fff)',
              }}
            >
              <Statistic
                title={t('stats.inTransitValue')}
                value={stats.inTransitValue}
                precision={0}
                suffix="VND"
                prefix={
                  <SendOutlined style={{ color: token.colorSuccess }} />
                }
                styles={{ content: { color: token.colorSuccess, fontSize: 22 } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{ borderRadius: 12 }}
              styles={{ body: { padding: 12 } }}
            >
              <Text
                type="secondary"
                style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}
              >
                {locale === 'vi' ? 'Trạng thái' : 'By status'}
              </Text>
              <div style={{ marginTop: 6 }}>
                {statusTiles?.map((s) => (
                  <div
                    key={s.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      padding: '2px 0',
                    }}
                  >
                    <span style={{ color: s.color }}>{s.label}</span>
                    <Text strong>{stats.byStatus[s.key as PurchaseReturnStatus] || 0}</Text>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      ) : null}

      <Card
        size="small"
        style={{ borderRadius: 12, marginBottom: 12 }}
        styles={{ body: { padding: 12 } }}
      >
        <Form
          form={filterForm}
          layout="inline"
          onValuesChange={(_changed, all) => {
            const next = {
              status: (all.status || '') as PurchaseReturnStatus | '',
              search: all.search || '',
              reasonCode: all.reasonCode || undefined,
              dateRange: all.dateRange ?? null,
              sort: all.sort || 'createdAt',
            };
            setFilters(next);
            setCurrent(1);
          }}
        >
          <Form.Item name="search" style={{ minWidth: 240 }}>
            <Input
              prefix={<SearchOutlined />}
              allowClear
              placeholder={t('table.filters.searchPlaceholder')}
            />
          </Form.Item>
          <Form.Item name="status" initialValue="">
            <Select
              style={{ minWidth: 180 }}
              placeholder={t('table.filters.status')}
              options={[
                { value: '', label: t('table.filters.statusAll') },
                ...STATUS_KEYS.map((s) => ({
                  value: s,
                  label: t(`status.${s}`),
                })),
              ]}
            />
          </Form.Item>
          <Form.Item name="reasonCode">
            <Select
              style={{ minWidth: 180 }}
              allowClear
              placeholder={t('table.filters.reasonCode')}
              options={REASON_CODE_KEYS.map((c) => ({
                value: c,
                label: t(`modal.reasonCode.${c}`),
              }))}
            />
          </Form.Item>
          <Form.Item name="dateRange">
            <DatePicker.RangePicker format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="sort" initialValue="createdAt">
            <Select
              style={{ minWidth: 160 }}
              options={[
                { value: 'createdAt', label: t('table.filters.sortNewest') },
                { value: 'returnDate', label: t('table.filters.sortReturnDate') },
                { value: 'amount', label: t('table.filters.sortAmount') },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                filterForm.resetFields();
                setFilters({});
                setCurrent(1);
              }}
            >
              {t('table.filters.reset')}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        variant="borderless"
        style={{
          borderRadius: 12,
          background: token.colorBgContainer,
          boxShadow: isDark
            ? '0 4px 20px rgba(0,0,0,0.5)'
            : '0 4px 20px rgba(0,0,0,0.03)',
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div className="premium-table">
          <Table
            columns={columns}
            dataSource={data}
            loading={loading}
            rowKey="_id"
            bordered={false}
            scroll={{ x: 1280 }}
            pagination={{
              current: meta.current,
              pageSize: meta.pageSize,
              total: meta.total,
              onChange: (page, size) => {
                setCurrent(page);
                setPageSize(size);
              },
            }}
          />
        </div>
      </Card>

      <PurchaseReturnModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        fetchData={() => {
          refreshData();
          fetchStats();
        }}
      />

      <DetailDrawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        record={detailRecord}
        loading={detailLoading}
      />

      <style jsx global>{`
        .premium-table .ant-table {
          background: transparent !important;
        }
        .premium-table .ant-table-thead > tr > th {
          background: ${isDark ? 'rgba(30, 41, 59, 0.5)' : '#fafafa'} !important;
          color: ${isDark ? '#8c8c8c' : '#595959'} !important;
          font-weight: 600 !important;
          border-bottom: 1px solid ${isDark ? '#303030' : '#f0f0f0'} !important;
        }
        .premium-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${isDark ? '#303030' : '#f0f0f0'} !important;
        }
        .premium-table .ant-table-placeholder {
          background: transparent !important;
        }
      `}</style>
    </>
  );
};

const DetailDrawer = ({
  open,
  onClose,
  record,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  record: IPurchaseReturn | null;
  loading: boolean;
}) => {
  const t = useTranslations('PurchaseReturn');
  const locale = useLocale();
  const { token } = theme.useToken();
  const { isDark } = useTheme();

  const stepCurrent = useMemo(() => {
    if (!record) return 0;
    switch (record.status) {
      case 'DRAFT':
        return 0;
      case 'PENDING_VENDOR':
        return 1;
      case 'SENT':
        return 2;
      case 'CREDITED':
      case 'REPLACED':
      case 'CLOSED':
        return 3;
      default:
        return 0;
    }
  }, [record]);

  const cardBg = isDark ? 'rgba(15, 23, 42, 0.55)' : '#fafafa';

  if (!record) {
    return (
      <Drawer open={open} onClose={onClose} size="large" title={t('detail.status')}>
        <Empty />
      </Drawer>
    );
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="large"
      title={
        <Space>
          <RollbackOutlined style={{ color: token.colorError }} />
          <Text strong>{record.returnNumber}</Text>
          <Tag color={STATUS_COLOR[record.status]}>
            {t(`status.${record.status}`)}
          </Tag>
        </Space>
      }
      loading={loading}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card size="small" style={{ borderRadius: 12, background: cardBg }}>
          <Steps
            size="small"
            current={stepCurrent}
            status={record.status === 'CANCELLED' ? 'error' : 'process'}
            items={[
              { title: t('status.DRAFT') },
              { title: t('status.PENDING_VENDOR') },
              { title: t('status.SENT') },
              { title: t('status.CREDITED') },
            ]}
          />
        </Card>

        <Card
          size="small"
          title={
            <Space>
              <ToolOutlined /> {locale === 'vi' ? 'Thông tin chung' : 'Summary'}
            </Space>
          }
          style={{ borderRadius: 12 }}
        >
          <Row gutter={[12, 8]}>
            <DetailField
              label={t('detail.po')}
              value={
                record.purchaseOrder?.poNumber ? (
                  <Tag color="blue">{record.purchaseOrder.poNumber}</Tag>
                ) : (
                  '-'
                )
              }
            />
            <DetailField
              label={t('detail.vendor')}
              value={record.purchaseOrder?.vendor?.name || '-'}
            />
            <DetailField
              label={t('detail.returnDate')}
              value={formatDate(record.returnDate)}
            />
            <DetailField
              label={t('detail.reasonCode')}
              value={
                record.reasonCode
                  ? t(`modal.reasonCode.${record.reasonCode}`)
                  : '-'
              }
            />
            <DetailField
              label={t('detail.claimNumber')}
              value={record.claimNumber || '-'}
            />
            <DetailField
              label={t('detail.reason')}
              value={record.reason || '-'}
            />
            <DetailField
              label={t('detail.totalRefundable')}
              value={
                <Text strong style={{ color: token.colorError }}>
                  {Number(record.totalRefundableAmount || 0).toLocaleString()}{' '}
                  {record.currency || 'VND'}
                </Text>
              }
            />
            <DetailField
              label={t('detail.creditNoteNumber')}
              value={record.creditNoteNumber || '-'}
            />
            <DetailField
              label={t('detail.replacementPo')}
              value={
                record.replacementPurchaseOrder?.poNumber ? (
                  <Tag color="purple">
                    {record.replacementPurchaseOrder.poNumber}
                  </Tag>
                ) : (
                  '-'
                )
              }
            />
            <DetailField
              label={t('detail.carrierTracking')}
              value={record.carrierTrackingRef || '-'}
            />
            <DetailField
              label={t('detail.expectedPickupAt')}
              value={
                record.expectedPickupAt ? formatDate(record.expectedPickupAt) : '-'
              }
            />
            <DetailField
              label={t('detail.createdBy')}
              value={record.createdByUsername || '-'}
            />
            <DetailField
              label={t('detail.createdAt')}
              value={
                record.createdAt
                  ? dayjs(record.createdAt).format('DD/MM/YYYY HH:mm')
                  : '-'
              }
            />
          </Row>
        </Card>

        <Card
          size="small"
          title={
            <Space>
              <ContainerOutlined /> {t('detail.itemsTitle')}
            </Space>
          }
          style={{ borderRadius: 12 }}
        >
          <Table
            size="small"
            rowKey={(r) => r._id || r.productId}
            pagination={false}
            dataSource={record.items || []}
            scroll={{ x: 640 }}
            columns={[
              {
                title: t('detail.product'),
                render: (_v, item) => (
                  <Space orientation="vertical" size={0}>
                    <Text>
                      {item.product?.vietnameseName || item.productId}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {item.product?.sku || '-'}
                    </Text>
                  </Space>
                ),
              },
              {
                title: t('detail.qty'),
                dataIndex: 'quantity',
                align: 'right',
                width: 80,
              },
              {
                title: t('detail.unit'),
                dataIndex: 'unit',
                width: 70,
              },
              {
                title: t('detail.unitPrice'),
                align: 'right',
                width: 120,
                render: (_v, item) =>
                  Number(item.unitPrice || 0).toLocaleString(),
              },
              {
                title: t('detail.lineRefund'),
                align: 'right',
                width: 130,
                render: (_v, item) => (
                  <Text strong style={{ color: token.colorError }}>
                    {Number(item.lineRefundAmount || 0).toLocaleString()}
                  </Text>
                ),
              },
              {
                title: t('detail.condition'),
                dataIndex: 'condition',
                width: 110,
                render: (cond: string | undefined) =>
                  cond ? (
                    <Tag>{t(`modal.condition.${cond}`)}</Tag>
                  ) : (
                    '-'
                  ),
              },
              {
                title: t('detail.batchNumber'),
                dataIndex: 'batchNumber',
                width: 110,
              },
              {
                title: t('detail.note'),
                dataIndex: 'note',
                ellipsis: true,
              },
            ]}
          />
        </Card>

        <Card
          size="small"
          title={
            <Space>
              <CreditCardOutlined /> {t('detail.workflowTitle')}
            </Space>
          }
          style={{ borderRadius: 12 }}
        >
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: 12,
              margin: 0,
              color: token.colorTextSecondary,
            }}
          >
            {record.settlementNote || '-'}
          </pre>
          {record.sentAt ? (
            <div style={{ marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('detail.sentBy')}: {record.sentByUsername || '-'} •{' '}
                {dayjs(record.sentAt).format('DD/MM/YYYY HH:mm')}
              </Text>
            </div>
          ) : null}
          {record.resolvedAt ? (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('detail.resolvedBy')}: {record.resolvedByUsername || '-'} •{' '}
                {dayjs(record.resolvedAt).format('DD/MM/YYYY HH:mm')}
              </Text>
            </div>
          ) : null}
        </Card>

        {record.attachments?.length ? (
          <Card
            size="small"
            title={t('detail.attachments')}
            style={{ borderRadius: 12 }}
          >
            <Space wrap>
              {record.attachments.map((a) => (
                <a
                  key={a._id || a.fileUrl}
                  href={a.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Tag color="cyan" icon={<ContainerOutlined />}>
                    {a.fileName || a.fileUrl}
                  </Tag>
                </a>
              ))}
            </Space>
          </Card>
        ) : null}
      </Space>
    </Drawer>
  );
};

const DetailField = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <Col xs={24} sm={12} md={8}>
    <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
      {label}
    </Text>
    <div style={{ marginTop: 2 }}>{value}</div>
  </Col>
);

export default PurchaseReturnTable;
