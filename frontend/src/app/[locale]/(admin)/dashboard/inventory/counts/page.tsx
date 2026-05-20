'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Badge,
  Button,
  Card,
  Col,
  Input,
  Row,
  Segmented,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AuditOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import { canReadCostFields } from '@/lib/field-access';
import { formatCurrency, formatVND } from '@/utils/format';

const { Text } = Typography;

type CountStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'CANCELLED';
type ValuationMethod = 'FIFO' | 'AVG';

interface IInventoryCountItem {
  _id: string;
  productId: string;
  product?: {
    _id: string;
    sku: string;
    vietnameseName: string;
    unitOfMeasure?: string | null;
  };
  systemQuantity: number;
  countedQuantity: number;
  varianceQuantity: number;
  unitCost: number;
  varianceValue: number;
  note?: string | null;
}

interface IInventoryCount {
  _id: string;
  countNumber: string;
  countDate: string;
  warehouseName: string;
  status: CountStatus;
  createdByUsername: string;
  submittedByUsername?: string | null;
  submittedAt?: string | null;
  approvedByUsername?: string | null;
  approvedAt?: string | null;
  items?: IInventoryCountItem[];
}

interface IValuationLine {
  productId: string;
  sku: string;
  productName: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  unitCost: number;
  inventoryValue: number;
  valuationMethod: ValuationMethod;
}

interface IValuationReport {
  method: ValuationMethod;
  generatedAt: string;
  totalQuantity: number;
  totalValue: number;
  lines: IValuationLine[];
}

const statusConfig: Record<CountStatus, { badge: 'default' | 'processing' | 'success' | 'warning' }> = {
  DRAFT: { badge: 'default' },
  SUBMITTED: { badge: 'processing' },
  APPROVED: { badge: 'success' },
  CANCELLED: { badge: 'warning' },
};

const InventoryCountsPage = () => {
  const t = useTranslations('InventoryCounts');
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const canViewCost = canReadCostFields(session?.user);
  const currentUsername = session?.user?.username || session?.user?.name || '';
  const currentRoleName = String(
    typeof (session?.user as any)?.role === 'string'
      ? (session?.user as any)?.role
      : session?.user?.role?.name || '',
  ).toUpperCase();
  const canCreateOrSubmitCount = ['ADMIN', 'WAREHOUSE'].includes(currentRoleName);
  const canApproveCount = ['ADMIN', 'SUPER ADMIN', 'MANAGER', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT'].includes(currentRoleName);
  const { message } = App.useApp();

  const [counts, setCounts] = useState<IInventoryCount[]>([]);
  const [valuation, setValuation] = useState<IValuationReport | null>(null);
  const [method, setMethod] = useState<ValuationMethod>('FIFO');
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [loadingValuation, setLoadingValuation] = useState(false);
  const [search, setSearch] = useState('');

  const fetchCounts = useCallback(async () => {
    if (!accessToken) return;
    setLoadingCounts(true);
    try {
      const res = await sendRequest<IBackendRes<{ results: IInventoryCount[] }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/counts`,
        method: 'GET',
        queryParams: { pageSize: 20 },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setCounts(res?.data?.results ?? []);
    } finally {
      setLoadingCounts(false);
    }
  }, [accessToken]);

  const fetchValuation = useCallback(async () => {
    if (!accessToken) return;
    setLoadingValuation(true);
    try {
      const res = await sendRequest<IBackendRes<IValuationReport>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/valuation`,
        method: 'GET',
        queryParams: { method },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setValuation(res?.data ?? null);
    } finally {
      setLoadingValuation(false);
    }
  }, [accessToken, method]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    fetchValuation();
  }, [fetchValuation]);

  const filteredCounts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return counts;

    return counts.filter((record) => (
      record.countNumber.toLowerCase().includes(keyword)
      || record.warehouseName.toLowerCase().includes(keyword)
      || record.createdByUsername.toLowerCase().includes(keyword)
    ));
  }, [counts, search]);

  const createSnapshotCount = async () => {
    if (!accessToken || !canCreateOrSubmitCount) return;
    const res = await sendRequest<IBackendRes<IInventoryCount>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/counts`,
      method: 'POST',
      body: { warehouseName: 'Main Warehouse', countDate: dayjs().format('YYYY-MM-DD') },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res?.data) {
      message.success(t('messages.createSuccess'));
      fetchCounts();
    } else {
      message.error(res?.message || t('messages.createError'));
    }
  };

  const submitCount = async (record: IInventoryCount) => {
    if (!accessToken || !canCreateOrSubmitCount) return;
    const res = await sendRequest<IBackendRes<IInventoryCount>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/counts/${record._id}/submit`,
      method: 'PATCH',
      body: {},
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res?.data) {
      message.success(t('messages.submitSuccess'));
      fetchCounts();
    } else {
      message.error(res?.message || t('messages.submitError'));
    }
  };

  const approveCount = async (record: IInventoryCount) => {
    if (!accessToken) return;
    const res = await sendRequest<IBackendRes<IInventoryCount>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/counts/${record._id}/approve`,
      method: 'PATCH',
      body: { approvalNote: `Approved from admin at ${dayjs().format('YYYY-MM-DD HH:mm')}` },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res?.data) {
      message.success(t('messages.approveSuccess'));
      fetchCounts();
      fetchValuation();
    } else {
      message.error(res?.message || t('messages.approveError'));
    }
  };

  const countColumns: ColumnsType<IInventoryCount> = [
    {
      title: t('countTable.countNumber'),
      key: 'countNumber',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.countNumber}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.warehouseName}</Text>
        </Space>
      ),
    },
    {
      title: t('countTable.countDate'),
      dataIndex: 'countDate',
      key: 'countDate',
      render: (value: string) => dayjs(value).format('DD/MM/YYYY'),
    },
    {
      title: t('countTable.status'),
      dataIndex: 'status',
      key: 'status',
      render: (value: CountStatus) => (
        <Badge status={statusConfig[value]?.badge ?? 'default'} text={t(`status.${value}`)} />
      ),
    },
    {
      title: t('countTable.variance'),
      key: 'variance',
      align: 'right',
      render: (_, record) => {
        const varianceQty = (record.items ?? []).reduce((sum, item) => sum + Number(item.varianceQuantity || 0), 0);
        const varianceValue = (record.items ?? []).reduce((sum, item) => sum + Number(item.varianceValue || 0), 0);
        return (
          <Space orientation="vertical" size={0} align="end">
            <Tag color={varianceQty === 0 ? 'green' : 'orange'}>{formatCurrency(varianceQty, 2)}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {canViewCost ? formatVND(Math.abs(varianceValue)) : t('hiddenByPermission')}
            </Text>
          </Space>
        );
      },
    },
    {
      title: t('countTable.handler'),
      key: 'actor',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.approvedByUsername || record.submittedByUsername || record.createdByUsername}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.approvedAt ? dayjs(record.approvedAt).format('DD/MM/YYYY HH:mm') : record.submittedAt ? dayjs(record.submittedAt).format('DD/MM/YYYY HH:mm') : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: t('countTable.actions'),
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space orientation="horizontal">
          <Button
            icon={<SendOutlined />}
            disabled={record.status !== 'DRAFT' || !canCreateOrSubmitCount}
            onClick={() => submitCount(record)}
          >
            {t('actions.submit')}
          </Button>
          <Button
            type="primary"
            ghost
            icon={<CheckCircleOutlined />}
            disabled={
              record.status !== 'SUBMITTED'
              || !canApproveCount
              || (
                record.submittedByUsername === currentUsername
                && currentRoleName !== 'ADMIN'
                && currentRoleName !== 'SUPER ADMIN'
              )
            }
            onClick={() => approveCount(record)}
          >
            {t('actions.approve')}
          </Button>
        </Space>
      ),
    },
  ];

  const itemColumns: ColumnsType<IInventoryCountItem> = [
    {
      title: t('itemTable.product'),
      key: 'product',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.product?.sku || record.productId}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.product?.vietnameseName || '-'}</Text>
        </Space>
      ),
    },
    { title: t('itemTable.systemQuantity'), dataIndex: 'systemQuantity', key: 'systemQuantity', align: 'right', render: (value: number) => formatCurrency(value, 2) },
    { title: t('itemTable.countedQuantity'), dataIndex: 'countedQuantity', key: 'countedQuantity', align: 'right', render: (value: number) => formatCurrency(value, 2) },
    {
      title: t('itemTable.varianceQuantity'),
      dataIndex: 'varianceQuantity',
      key: 'varianceQuantity',
      align: 'right',
      render: (value: number) => <Tag color={Number(value) === 0 ? 'green' : 'orange'}>{formatCurrency(value, 2)}</Tag>,
    },
    ...(canViewCost ? [
      { title: t('itemTable.unitCost'), dataIndex: 'unitCost', key: 'unitCost', align: 'right' as const, render: (value: number) => formatVND(value || 0) },
      { title: t('itemTable.varianceValue'), dataIndex: 'varianceValue', key: 'varianceValue', align: 'right' as const, render: (value: number) => formatVND(Math.abs(value || 0)) },
    ] : []),
  ];

  const valuationColumns: ColumnsType<IValuationLine> = [
    {
      title: t('valuationTable.product'),
      key: 'product',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.sku}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.productName}</Text>
        </Space>
      ),
    },
    { title: t('valuationTable.currentStock'), dataIndex: 'currentStock', key: 'currentStock', align: 'right', render: (value: number) => formatCurrency(value, 2) },
    { title: t('valuationTable.reservedStock'), dataIndex: 'reservedStock', key: 'reservedStock', align: 'right', render: (value: number) => formatCurrency(value, 2) },
    ...(canViewCost ? [
      { title: t('valuationTable.unitCost'), dataIndex: 'unitCost', key: 'unitCost', align: 'right' as const, render: (value: number) => formatVND(value || 0) },
      { title: t('valuationTable.inventoryValue'), dataIndex: 'inventoryValue', key: 'inventoryValue', align: 'right' as const, render: (value: number) => <Text strong>{formatVND(value || 0)}</Text> },
    ] : []),
  ];

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('title')}
        icon={<FileSearchOutlined />}
        description={t('description')}
        extra={(
          <Space orientation="horizontal">
            <Button icon={<ReloadOutlined />} onClick={() => { fetchCounts(); fetchValuation(); }}>
              {t('actions.reload')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canCreateOrSubmitCount} onClick={createSnapshotCount}>
              {t('actions.create')}
            </Button>
          </Space>
        )}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card variant="borderless">
            <Statistic title={t('stats.totalQuantity')} value={valuation?.totalQuantity ?? 0} precision={2} prefix={<AuditOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card variant="borderless">
            <Statistic
              title={t('stats.totalValue')}
              value={canViewCost ? (valuation?.totalValue ?? 0) : 0}
              formatter={(value) => canViewCost ? formatVND(Number(value || 0)) : t('hiddenByPermission')}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card variant="borderless">
            <Statistic title={t('stats.pendingCounts')} value={counts.filter((record) => record.status === 'SUBMITTED').length} />
          </Card>
        </Col>
      </Row>

      <Card
        variant="borderless"
        title={t('sections.counts')}
        extra={(
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 300 }}
          />
        )}
        style={{ marginBottom: 16 }}
      >
        <Table<IInventoryCount>
          rowKey="_id"
          columns={countColumns}
          dataSource={filteredCounts}
          loading={loadingCounts}
          expandable={{
            expandedRowRender: (record) => (
              <Table<IInventoryCountItem>
                rowKey="_id"
                columns={itemColumns}
                dataSource={record.items ?? []}
                pagination={false}
                size="small"
              />
            ),
          }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Card
        variant="borderless"
        title={t('sections.valuation')}
        extra={(
          <Segmented
            value={method}
            options={[
              { label: 'FIFO', value: 'FIFO' },
              { label: 'AVG', value: 'AVG' },
            ]}
            onChange={(value) => setMethod(value as ValuationMethod)}
          />
        )}
      >
        <Table<IValuationLine>
          rowKey="productId"
          columns={valuationColumns}
          dataSource={valuation?.lines ?? []}
          loading={loadingValuation}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>
    </AdminPageScroll>
  );
};

export default InventoryCountsPage;
