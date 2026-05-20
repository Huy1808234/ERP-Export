'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Input,
  Modal,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ReactNode } from 'react';
import {
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ContainerOutlined,
  DollarOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShoppingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { useTheme } from '@/context/theme.context';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import { canReadCostFields } from '@/lib/field-access';

const { Text } = Typography;
const { TextArea } = Input;

type ApprovalCenterType =
  | 'PURCHASE_REQUEST'
  | 'PURCHASE_ORDER'
  | 'QUOTATION'
  | 'PROFORMA_INVOICE'
  | 'SALES_CONTRACT'
  | 'TRADE_FINANCE'
  | 'INVENTORY_COUNT'
  | 'PRODUCT_CHANGE_REQUEST'
  | 'APPROVAL_WORKFLOW';

type ApprovalStepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';

type ApprovalLineItem = {
  _id?: string;
  productId?: string;
  productName?: string;
  quantity?: number | string;
  estimatedPrice?: number | string;
  unitPrice?: number | string;
  unit?: string | null;
  note?: string | null;
  varianceValue?: number | string;
  varianceQuantity?: number | string;
  systemQuantity?: number | string;
  countedQuantity?: number | string;
  product?: {
    _id?: string;
    sku?: string | null;
    vietnameseName?: string | null;
  } | null;
};

type ChangedFieldLine = {
  field: string;
  before?: unknown;
  after?: unknown;
};

type ApprovalWorkflowStepLine = {
  _id?: string;
  stepOrder: number;
  approverRoleName: string;
  approverUsername?: string | null;
  status: ApprovalStepStatus;
  actedByUsername?: string | null;
  note?: string | null;
};

type ApprovalData = {
  _id?: string;
  amount?: number | string;
  amountVnd?: number | string;
  bankReference?: string | null;
  countDate?: string | null;
  currency?: string | null;
  department?: string | null;
  documentType?: string | null;
  exchangeRate?: number | string | null;
  expectedDate?: string | null;
  items?: ApprovalLineItem[];
  metadata?: {
    sku?: string;
    reason?: string;
    changedFields?: ChangedFieldLine[];
  };
  note?: string | null;
  priority?: string | null;
  project?: string | null;
  purpose?: string | null;
  requesterUsername?: string | null;
  steps?: ApprovalWorkflowStepLine[];
  type?: string | null;
  warehouseName?: string | null;
};

type ApprovalListItem = {
  _id: string;
  type: ApprovalCenterType;
  number: string;
  description?: string | null;
  requestedBy?: string | null;
  requestedAt: string;
  totalAmount?: number | string | null;
  data?: ApprovalData;
};

type TypeConfig = {
  color: string;
  label: string;
  icon: ReactNode;
};

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('vi-VN').format(Number(value || 0));

const formatChangeValue = (canViewCost: boolean, field: string, value: unknown) => {
  if (!canViewCost && ['purchasePriceVnd', 'defaultExportPrice', 'unitCost', 'cogs'].includes(field)) {
    return 'Hidden by permission';
  }
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

const rowLabel = (line: ApprovalLineItem) =>
  line._id || line.productId || line.product?._id || `${line.product?.sku || line.productName || 'line'}-${line.quantity || 0}`;

const ApprovalsPage = () => {
  const t = useTranslations('Approvals');
  const tCommon = useTranslations('Common');
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const canViewCost = canReadCostFields(session?.user);
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const { modal, notification } = App.useApp();

  const [items, setItems] = useState<ApprovalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ApprovalListItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const headers = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    [accessToken],
  );

  const fetchApprovals = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<ApprovalListItem[]>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/approvals/pending`,
        method: 'GET',
        headers,
      });
      setItems(res?.data || []);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const typeConfigs = useMemo<Partial<Record<ApprovalCenterType, TypeConfig>>>(() => ({
    PURCHASE_REQUEST: { color: 'green', label: t('types.PURCHASE_REQUEST'), icon: <FileProtectOutlined /> },
    PURCHASE_ORDER: { color: 'blue', label: t('types.PURCHASE_ORDER'), icon: <ShoppingOutlined /> },
    QUOTATION: { color: 'geekblue', label: t('types.QUOTATION'), icon: <FileSearchOutlined /> },
    PROFORMA_INVOICE: { color: 'gold', label: t('types.PROFORMA_INVOICE'), icon: <FileProtectOutlined /> },
    SALES_CONTRACT: { color: 'purple', label: t('types.SALES_CONTRACT'), icon: <ContainerOutlined /> },
    TRADE_FINANCE: { color: 'cyan', label: t('types.TRADE_FINANCE'), icon: <DollarOutlined /> },
    INVENTORY_COUNT: { color: 'lime', label: t('types.INVENTORY_COUNT'), icon: <AuditOutlined /> },
    PRODUCT_CHANGE_REQUEST: { color: 'magenta', label: t('types.PRODUCT_CHANGE_REQUEST'), icon: <FileSearchOutlined /> },
    APPROVAL_WORKFLOW: { color: 'volcano', label: t('types.APPROVAL_WORKFLOW'), icon: <SafetyCertificateOutlined /> },
  }), [t]);

  const getTypeConfig = (type: ApprovalCenterType): TypeConfig =>
    typeConfigs[type] || { color: 'default', label: type, icon: <ClockCircleOutlined /> };

  const handleApprove = async (item: ApprovalListItem) => {
    modal.confirm({
      title: t('modals.approveTitle'),
      content: t('modals.approveContent', { number: item.number }),
      okText: t('actions.approveNow'),
      okButtonProps: { type: 'primary' },
      onOk: async () => {
        try {
          const res = await sendRequest<IBackendRes<unknown>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/approvals/${item._id}/approve`,
            method: 'POST',
            body: { type: item.type },
            headers,
          });
          if (res?.data) {
            notification.success({
              title: tCommon('success'),
              description: t('notifications.approveSuccess', { number: item.number }),
            });
            fetchApprovals();
          }
        } catch {
          notification.error({ title: tCommon('error'), description: t('notifications.actionError') });
        }
      },
    });
  };

  const handleReject = async () => {
    if (!selectedItem) return;
    if (!rejectReason.trim()) {
      notification.warning({ title: tCommon('warning'), description: t('notifications.reasonRequired') });
      return;
    }

    try {
      const res = await sendRequest<IBackendRes<unknown>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/approvals/${selectedItem._id}/reject`,
        method: 'POST',
        body: { type: selectedItem.type, reason: rejectReason },
        headers,
      });
      if (res?.data) {
        notification.success({
          title: tCommon('success'),
          description: t('notifications.rejectSuccess', { number: selectedItem.number }),
        });
        setRejectModalOpen(false);
        setRejectReason('');
        setSelectedItem(null);
        fetchApprovals();
      }
    } catch {
      notification.error({ title: tCommon('error'), description: t('notifications.actionError') });
    }
  };

  const renderDetailSummary = (record: ApprovalListItem) => {
    const data = record.data || {};
    const isTradeFinance = record.type === 'TRADE_FINANCE';
    const isInventoryCount = record.type === 'INVENTORY_COUNT';
    const isWorkflow = record.type === 'APPROVAL_WORKFLOW';
    const isProductChangeWorkflow = isWorkflow && data.documentType === 'PRODUCT_CHANGE_REQUEST';
    const calculatedTotal = isTradeFinance
      ? Number(data.amount || 0)
      : isInventoryCount
        ? (data.items || []).reduce((sum, item) => sum + Math.abs(Number(item.varianceValue || 0)), 0)
        : isWorkflow
          ? Number(data.amountVnd || data.amount || 0)
          : (data.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.estimatedPrice || item.unitPrice || 0), 0);
    const canShowAmount = canViewCost || isTradeFinance || (isWorkflow && !isProductChangeWorkflow);

    return (
      <Card
        size="small"
        title={<Space><FileSearchOutlined />{t('details.title')}</Space>}
        variant="borderless"
        style={{ borderRadius: 12, background: isDark ? '#1e293b' : '#fff' }}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          {data.department ? <Text>{t('details.dept')}: <Text strong>{data.department}</Text></Text> : null}
          {data.project ? <Text>{t('details.project')}: <Text strong>{data.project}</Text></Text> : null}
          {data.purpose ? <Text>{t('details.purpose')}: {data.purpose}</Text> : null}
          {data.expectedDate ? <Text>{t('details.expectedDate')}: {dayjs(data.expectedDate).format('DD/MM/YYYY')}</Text> : null}
          {data.priority ? <Tag color={data.priority === 'HIGH' ? 'red' : data.priority === 'MEDIUM' ? 'orange' : 'blue'}>{data.priority}</Tag> : null}
          {data.documentType ? <Tag>{data.documentType}</Tag> : null}
          {data.requesterUsername ? <Text>{t('details.workflow.requester')}: <Text strong>{data.requesterUsername}</Text></Text> : null}
          {data.metadata?.sku ? <Text>SKU: <Text strong>{data.metadata.sku}</Text></Text> : null}
          {data.metadata?.reason ? <Text>{data.metadata.reason}</Text> : null}
          <Divider style={{ margin: 0 }} />
          <Statistic
            title={isInventoryCount ? t('details.inventory.totalVariance') : isWorkflow ? t('details.workflow.amount') : t('details.totalValue')}
            value={canShowAmount ? calculatedTotal : 0}
            suffix={canShowAmount ? 'VND' : undefined}
            formatter={(value) => canShowAmount ? money(String(value)) : 'Hidden by permission'}
            styles={{ content: { color: '#10b981', fontWeight: 800, fontSize: 24 } }}
          />
        </Space>
      </Card>
    );
  };

  const renderDetailLines = (record: ApprovalListItem) => {
    const data = record.data || {};

    if (record.type === 'TRADE_FINANCE') {
      return (
        <Space orientation="vertical" size="middle" style={{ width: '100%', padding: 16 }}>
          <Text>{t('details.payment.method')}: <Text strong>{data.type || '-'}</Text></Text>
          <Text>{t('details.payment.currency')}: <Text strong>{data.currency || '-'}</Text></Text>
          <Text>{t('details.payment.rate')}: <Text strong>{money(data.exchangeRate)}</Text></Text>
          <Text>{t('details.payment.bankRef')}: <Text code>{data.bankReference || t('details.payment.noRef')}</Text></Text>
          {data.note ? <Text>{data.note}</Text> : null}
        </Space>
      );
    }

    if (record.type === 'APPROVAL_WORKFLOW') {
      return (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {data.metadata?.changedFields?.length ? (
            <Table<ChangedFieldLine>
              dataSource={data.metadata.changedFields}
              pagination={false}
              size="small"
              rowKey={(line) => `${data._id || record._id}-${line.field}`}
              columns={[
                { title: 'Field', dataIndex: 'field', width: 180, render: (field) => <Tag color="magenta">{field}</Tag> },
                { title: 'Before', key: 'before', render: (_, line) => <Text>{formatChangeValue(canViewCost, line.field, line.before)}</Text> },
                { title: 'After', key: 'after', render: (_, line) => <Text strong>{formatChangeValue(canViewCost, line.field, line.after)}</Text> },
              ]}
            />
          ) : null}
          <Table<ApprovalWorkflowStepLine>
            dataSource={data.steps || []}
            pagination={false}
            size="small"
            rowKey={(line) => line._id || `${record._id}-${line.stepOrder}`}
            columns={[
              { title: t('details.workflow.stepOrder'), dataIndex: 'stepOrder', align: 'center', width: 90 },
              { title: t('details.workflow.approver'), key: 'approver', render: (_, line) => <Text strong>{line.approverUsername || line.approverRoleName}</Text> },
              { title: t('details.workflow.status'), dataIndex: 'status', align: 'center', render: (status) => <Tag color={status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'error' : 'processing'}>{status}</Tag> },
              { title: t('details.workflow.actedBy'), dataIndex: 'actedByUsername', render: (value) => value || '-' },
              { title: t('details.columns.note'), dataIndex: 'note', render: (note) => <Text type="secondary">{note || '-'}</Text> },
            ]}
          />
        </Space>
      );
    }

    return (
      <Table<ApprovalLineItem>
        dataSource={data.items || []}
        pagination={false}
        size="small"
        rowKey={rowLabel}
        columns={[
          { title: t('details.columns.product'), key: 'product', render: (_, line) => <Text strong>{line.product?.vietnameseName || line.product?.sku || line.productId || line.productName || '-'}</Text> },
          { title: t('details.columns.qty'), dataIndex: 'quantity', align: 'center', width: 90, render: (quantity) => <Badge count={Number(quantity || 0)} color="blue" /> },
          { title: t('details.columns.unit'), dataIndex: 'unit', align: 'center', width: 90, render: (unit) => <Text type="secondary">{unit || 'PCS'}</Text> },
          ...(record.type === 'INVENTORY_COUNT'
            ? [
                { title: t('details.inventory.systemQuantity'), dataIndex: 'systemQuantity', align: 'right' as const, render: (value: number | string) => <Text>{money(value)}</Text> },
                { title: t('details.inventory.countedQuantity'), dataIndex: 'countedQuantity', align: 'right' as const, render: (value: number | string) => <Text>{money(value)}</Text> },
                { title: t('details.inventory.varianceQuantity'), dataIndex: 'varianceQuantity', align: 'right' as const, render: (value: number | string) => <Tag color={Number(value) === 0 ? 'green' : 'orange'}>{money(value)}</Tag> },
              ]
            : []),
          ...(canViewCost
            ? [
                { title: t('details.columns.price'), key: 'price', align: 'right' as const, render: (_: unknown, line: ApprovalLineItem) => <Text>{money(line.estimatedPrice || line.unitPrice)}</Text> },
                { title: t('details.columns.total'), key: 'total', align: 'right' as const, render: (_: unknown, line: ApprovalLineItem) => <Text strong style={{ color: '#f59e0b' }}>{money(Number(line.quantity || 0) * Number(line.estimatedPrice || line.unitPrice || 0))}</Text> },
              ]
            : []),
          { title: t('details.columns.note'), dataIndex: 'note', render: (note) => <Text type="secondary">{note || '-'}</Text> },
        ]}
      />
    );
  };

  const columns: ColumnsType<ApprovalListItem> = [
    {
      title: t('table.columns.type'),
      dataIndex: 'type',
      render: (type: ApprovalCenterType) => {
        const config = getTypeConfig(type);
        return <Tag color={config.color} icon={config.icon}>{config.label}</Tag>;
      },
    },
    {
      title: t('table.columns.number'),
      dataIndex: 'number',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t('table.columns.requestor'),
      dataIndex: 'requestedBy',
      render: (text?: string | null) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <Text>{text || 'system'}</Text>
        </Space>
      ),
    },
    {
      title: t('table.columns.date'),
      dataIndex: 'requestedAt',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: t('table.columns.actions'),
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => handleApprove(record)}
            style={{ background: token.colorSuccess, borderColor: token.colorSuccess }}
          >
            {t('actions.approve')}
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseCircleOutlined />}
            onClick={() => {
              setSelectedItem(record);
              setRejectModalOpen(true);
            }}
          >
            {t('actions.reject')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <AdminPageScroll>
      <Row justify="space-between" align="bottom" style={{ marginBottom: 24 }}>
        <Col>
          <PageHeader title={t('title')} icon={<SafetyCertificateOutlined />} description={t('description')} />
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={fetchApprovals} size="large">{t('refreshBtn')}</Button>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} md={8}>
          <Card variant="borderless" style={{ borderRadius: 16 }}>
            <Statistic
              title={t('stats.pendingCount')}
              value={items.length}
              prefix={<ClockCircleOutlined style={{ color: token.colorWarning }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ borderRadius: 16 }} styles={{ body: { padding: 0 } }}>
        <Table<ApprovalListItem>
          columns={columns}
          dataSource={items}
          rowKey="_id"
          loading={loading}
          expandable={{
            expandedRowRender: (record) => (
              <div
                style={{
                  padding: 24,
                  background: isDark ? 'rgba(30, 41, 59, 0.4)' : 'linear-gradient(to right bottom, #f8fafc, #f1f5f9)',
                  borderRadius: 16,
                  margin: '8px 16px',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                }}
              >
                <Row gutter={[24, 24]}>
                  <Col xs={24} md={8}>{renderDetailSummary(record)}</Col>
                  <Col xs={24} md={16}>
                    <Card
                      size="small"
                      title={<Space><ContainerOutlined />{record.type === 'APPROVAL_WORKFLOW' ? t('details.workflow.stepsTitle') : t('details.itemsTitle')}</Space>}
                      variant="borderless"
                      style={{ borderRadius: 12, background: isDark ? '#1e293b' : '#fff' }}
                    >
                      {renderDetailLines(record)}
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          }}
          pagination={false}
          locale={{ emptyText: <Empty description={t('table.empty')} /> }}
        />
      </Card>

      <Modal
        title={t('modals.rejectTitle', { number: selectedItem?.number || '' })}
        open={rejectModalOpen}
        onOk={handleReject}
        onCancel={() => setRejectModalOpen(false)}
        okText={t('modals.confirmReject')}
        okButtonProps={{ danger: true }}
        cancelText={tCommon('cancel')}
        destroyOnHidden
        mask={{ closable: false }}
      >
        <div style={{ marginTop: 16 }}>
          <Text strong>{t('modals.rejectReason')}:</Text>
          <TextArea
            rows={4}
            placeholder={t('modals.rejectPlaceholder')}
            style={{ marginTop: 8 }}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
          />
        </div>
      </Modal>
    </AdminPageScroll>
  );
};

export default ApprovalsPage;
