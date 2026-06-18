'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Col,
  Input,
  InputNumber,
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
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
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

interface IInventoryCountDraftLine {
  countedQuantity: number;
  note?: string | null;
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

interface IValuationComparison {
  fifoTotalValue: number;
  avgTotalValue: number;
  difference: number;
  isSame: boolean;
}

const statusConfig: Record<CountStatus, { badge: 'default' | 'processing' | 'success' | 'warning' }> = {
  DRAFT: { badge: 'default' },
  SUBMITTED: { badge: 'processing' },
  APPROVED: { badge: 'success' },
  CANCELLED: { badge: 'warning' },
};

const buildDraftLines = (records: IInventoryCount[]) => records.reduce<Record<string, Record<string, IInventoryCountDraftLine>>>((acc, record) => {
  acc[record._id] = (record.items ?? []).reduce<Record<string, IInventoryCountDraftLine>>((lineAcc, item) => {
    lineAcc[item.productId] = {
      countedQuantity: Number(item.countedQuantity || 0),
      note: item.note ?? null,
    };
    return lineAcc;
  }, {});
  return acc;
}, {});

const getVarianceTagColor = (value: number) => {
  if (value === 0) return 'green';
  return value < 0 ? 'red' : 'orange';
};

const InventoryCountsPage = () => {
  const t = useTranslations('InventoryCounts');
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const valuationSectionRef = useRef<HTMLDivElement>(null);
  const accessToken = getAccessToken(session);
  const canViewCost = canReadCostFields(session?.user);
  const currentRoleName = String(
    typeof (session?.user as any)?.role === 'string'
      ? (session?.user as any)?.role
      : session?.user?.role?.name || '',
  ).toUpperCase();
  const canCreateOrSubmitCount = ['ADMIN', 'WAREHOUSE'].includes(currentRoleName);
  const { message } = App.useApp();

  const [counts, setCounts] = useState<IInventoryCount[]>([]);
  const [valuation, setValuation] = useState<IValuationReport | null>(null);
  const [valuationComparison, setValuationComparison] = useState<IValuationComparison | null>(null);
  const [method, setMethod] = useState<ValuationMethod>('FIFO');
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [loadingValuation, setLoadingValuation] = useState(false);
  const [search, setSearch] = useState('');
  const [countDrafts, setCountDrafts] = useState<Record<string, Record<string, IInventoryCountDraftLine>>>({});
  const [savingCountId, setSavingCountId] = useState<string | null>(null);

  const getDraftItem = useCallback((countId: string, item: IInventoryCountItem): IInventoryCountItem => {
    const draftLine = countDrafts[countId]?.[item.productId];
    const countedQuantity = Number(draftLine?.countedQuantity ?? item.countedQuantity ?? 0);
    const varianceQuantity = countedQuantity - Number(item.systemQuantity || 0);

    return {
      ...item,
      countedQuantity,
      varianceQuantity,
      varianceValue: varianceQuantity * Number(item.unitCost || 0),
      note: draftLine?.note ?? item.note ?? null,
    };
  }, [countDrafts]);

  const getCountPayload = useCallback((record: IInventoryCount) => (record.items ?? []).map((item) => {
    const draftItem = getDraftItem(record._id, item);
    return {
      productId: draftItem.productId,
      countedQuantity: Number(draftItem.countedQuantity || 0),
      note: draftItem.note || undefined,
    };
  }), [getDraftItem]);

  const applyUpdatedCount = useCallback((updatedCount: IInventoryCount) => {
    setCounts((prev) => prev.map((record) => (record._id === updatedCount._id ? updatedCount : record)));
    setCountDrafts((prev) => ({
      ...prev,
      ...buildDraftLines([updatedCount]),
    }));
  }, []);

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
      const results = res?.data?.results ?? [];
      setCounts(results);
      setCountDrafts(buildDraftLines(results));
    } finally {
      setLoadingCounts(false);
    }
  }, [accessToken]);

  const fetchValuation = useCallback(async () => {
    if (!accessToken) return;
    setLoadingValuation(true);
    try {
      const [fifoRes, avgRes] = await Promise.all([
        sendRequest<IBackendRes<IValuationReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/valuation`,
          method: 'GET',
          queryParams: { method: 'FIFO' },
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<IValuationReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/valuation`,
          method: 'GET',
          queryParams: { method: 'AVG' },
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      const fifoReport = fifoRes?.data ?? null;
      const avgReport = avgRes?.data ?? null;
      const selectedReport = method === 'FIFO' ? fifoReport : avgReport;
      const fifoTotalValue = Number(fifoReport?.totalValue || 0);
      const avgTotalValue = Number(avgReport?.totalValue || 0);
      const difference = Math.abs(fifoTotalValue - avgTotalValue);

      setValuation(selectedReport);
      setValuationComparison({
        fifoTotalValue,
        avgTotalValue,
        difference,
        isSame: difference < 1,
      });
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

  useEffect(() => {
    const section = searchParams.get('section') || searchParams.get('tab');
    const methodParam = searchParams.get('method')?.toUpperCase();

    if (methodParam === 'FIFO' || methodParam === 'AVG') {
      setMethod(methodParam);
    }

    if (section === 'valuation') {
      window.setTimeout(() => {
        valuationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, [searchParams]);

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

  const updateDraftCountedQuantity = (countId: string, productId: string, value: number | null) => {
    const countedQuantity = Number(value ?? 0);

    setCountDrafts((prev) => ({
      ...prev,
      [countId]: {
        ...(prev[countId] ?? {}),
        [productId]: {
          ...(prev[countId]?.[productId] ?? {}),
          countedQuantity,
        },
      },
    }));

    setCounts((prev) => prev.map((record) => {
      if (record._id !== countId) return record;

      return {
        ...record,
        items: (record.items ?? []).map((item) => {
          if (item.productId !== productId) return item;

          const varianceQuantity = countedQuantity - Number(item.systemQuantity || 0);
          return {
            ...item,
            countedQuantity,
            varianceQuantity,
            varianceValue: varianceQuantity * Number(item.unitCost || 0),
          };
        }),
      };
    }));
  };

  const saveDraftCount = async (record: IInventoryCount) => {
    if (!accessToken || !canCreateOrSubmitCount || record.status !== 'DRAFT') return;

    setSavingCountId(record._id);
    try {
      const res = await sendRequest<IBackendRes<IInventoryCount>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/counts/${record._id}/items`,
        method: 'PATCH',
        body: { items: getCountPayload(record) },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        applyUpdatedCount(res.data);
        message.success(t('messages.saveSuccess'));
      } else {
        message.error(res?.message || t('messages.saveError'));
      }
    } finally {
      setSavingCountId(null);
    }
  };

  const submitCount = async (record: IInventoryCount) => {
    if (!accessToken || !canCreateOrSubmitCount) return;
    const res = await sendRequest<IBackendRes<IInventoryCount>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/counts/${record._id}/submit`,
      method: 'PATCH',
      body: { items: getCountPayload(record) },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res?.data) {
      applyUpdatedCount(res.data);
      message.success(t('messages.submitSuccess'));
      fetchCounts();
    } else {
      message.error(res?.message || t('messages.submitError'));
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
            <Tag color={getVarianceTagColor(varianceQty)}>{formatCurrency(varianceQty, 2)}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {canViewCost ? formatVND(varianceValue) : t('hiddenByPermission')}
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
          {record.status === 'SUBMITTED' && (
            <Button href="/dashboard/approvals" icon={<FileSearchOutlined />}>
              {t('actions.openApproval')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const getItemColumns = (count: IInventoryCount): ColumnsType<IInventoryCountItem> => {
    const canEditDraft = count.status === 'DRAFT' && canCreateOrSubmitCount;

    return [
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
    {
      title: t('itemTable.countedQuantity'),
      dataIndex: 'countedQuantity',
      key: 'countedQuantity',
      align: 'right',
      render: (value: number, record) => canEditDraft ? (
        <InputNumber<number>
          min={0}
          precision={2}
          value={Number(value || 0)}
          controls={false}
          onChange={(nextValue) => updateDraftCountedQuantity(count._id, record.productId, nextValue)}
          style={{ width: 128 }}
        />
      ) : formatCurrency(value, 2),
    },
    {
      title: t('itemTable.varianceQuantity'),
      dataIndex: 'varianceQuantity',
      key: 'varianceQuantity',
      align: 'right',
      render: (value: number) => <Tag color={getVarianceTagColor(Number(value || 0))}>{formatCurrency(value, 2)}</Tag>,
    },
    ...(canViewCost ? [
      { title: t('itemTable.unitCost'), dataIndex: 'unitCost', key: 'unitCost', align: 'right' as const, render: (value: number) => formatVND(value || 0) },
      { title: t('itemTable.varianceValue'), dataIndex: 'varianceValue', key: 'varianceValue', align: 'right' as const, render: (value: number) => formatVND(value || 0) },
    ] : []),
    ];
  };

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
            expandedRowRender: (record) => {
              const canEditDraft = record.status === 'DRAFT' && canCreateOrSubmitCount;
              const draftItems = (record.items ?? []).map((item) => getDraftItem(record._id, item));

              return (
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                  {canEditDraft && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <Text type="secondary">{t('draftEntryHint')}</Text>
                      <Button
                        size="small"
                        icon={<SaveOutlined />}
                        loading={savingCountId === record._id}
                        onClick={() => saveDraftCount(record)}
                      >
                        {t('actions.saveDraft')}
                      </Button>
                    </div>
                  )}
                  <Table<IInventoryCountItem>
                    rowKey="_id"
                    columns={getItemColumns(record)}
                    dataSource={draftItems}
                    pagination={false}
                    size="small"
                  />
                </Space>
              );
            },
          }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <div ref={valuationSectionRef}>
        <Card
          variant="borderless"
          title={(
            <Space orientation="horizontal" wrap>
              <span>{t('sections.valuation')}</span>
              <Tag color={method === 'FIFO' ? 'blue' : 'purple'}>
                {t('valuation.methodInUse', { method: valuation?.method || method })}
              </Tag>
            </Space>
          )}
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
          <Space orientation="vertical" size={12} style={{ width: '100%', marginBottom: 16 }}>
            <Alert
              type="info"
              showIcon
              title={t(`valuation.${method}.title`)}
              description={t(`valuation.${method}.description`)}
            />
            {valuationComparison && canViewCost ? (
              <Alert
                type={valuationComparison.isSame ? 'warning' : 'success'}
                showIcon
                title={
                  valuationComparison.isSame
                    ? t('valuation.sameResultTitle')
                    : t('valuation.differentResultTitle', { difference: formatVND(valuationComparison.difference) })
                }
                description={
                  valuationComparison.isSame
                    ? t('valuation.sameResultDescription')
                    : t('valuation.differentResultDescription', {
                        fifo: formatVND(valuationComparison.fifoTotalValue),
                        avg: formatVND(valuationComparison.avgTotalValue),
                      })
                }
              />
            ) : null}
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('valuation.generatedAt', {
                time: valuation?.generatedAt ? dayjs(valuation.generatedAt).format('DD/MM/YYYY HH:mm:ss') : '-',
              })}
            </Text>
          </Space>
          <Table<IValuationLine>
            rowKey="productId"
            columns={valuationColumns}
            dataSource={valuation?.lines ?? []}
            loading={loadingValuation}
            pagination={{ pageSize: 10, showSizeChanger: true }}
          />
        </Card>
      </div>
    </AdminPageScroll>
  );
};

export default InventoryCountsPage;
