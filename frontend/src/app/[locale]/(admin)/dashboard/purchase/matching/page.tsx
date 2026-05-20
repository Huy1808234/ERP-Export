'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Table, Tag, Space, Button, Card, Typography,
  Row, Col, Statistic, theme, Badge,
  Progress, Alert, Empty, Spin
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import {
  AuditOutlined, CheckCircleOutlined,
  WarningOutlined, CloseCircleOutlined,
  SyncOutlined, FileSearchOutlined,
  DollarOutlined, InboxOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/context/theme.context';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { useCurrency } from '@/hooks/useCurrency';
import { getSetting } from '@/services/settings.service';

const { Text, Title } = Typography;

type MatchingDetail = {
  po: any;
  grns: any[];
  invoices: any[];
};

type MatchingRules = {
  quantityTolerance: number;
  priceTolerancePercent: number;
};

type MatchingLine = {
  key: string;
  productId: string;
  productName: string;
  sku?: string;
  unit?: string;
  orderedQty: number;
  grnReceivedQty: number;
  grnRejectedQty: number;
  acceptedQty: number;
  invoicedQty: number;
  poUnitPrice: number;
  invoiceUnitPrice: number;
  quantityMatched: boolean;
  priceMatched: boolean;
  currency: string;
  status: 'MATCHED' | 'MISSING_GRN' | 'MISSING_INVOICE' | 'QTY_VARIANCE' | 'PRICE_VARIANCE';
};

const DEFAULT_MATCHING_RULES: MatchingRules = {
  quantityTolerance: 0,
  priceTolerancePercent: 0,
};

const THREE_WAY_MATCHING_QTY_TOLERANCE_KEY = 'THREE_WAY_MATCHING_QTY_TOLERANCE';
const THREE_WAY_MATCHING_PRICE_TOLERANCE_PERCENT_KEY = 'THREE_WAY_MATCHING_PRICE_TOLERANCE_PERCENT';

const toNumber = (value: unknown): number => {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const withinAbsoluteTolerance = (a: number, b: number, tolerance: number): boolean => {
  return Math.abs(a - b) <= Math.max(0, tolerance) + 0.0001;
};

const withinPercentTolerance = (expected: number, actual: number, tolerancePercent: number): boolean => {
  if (expected === 0) return withinAbsoluteTolerance(expected, actual, 0);
  const variancePercent = (Math.abs(actual - expected) / Math.abs(expected)) * 100;
  return variancePercent <= Math.max(0, tolerancePercent) + 0.0001;
};

const listFromResponse = (res: any): any[] => {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.results)) return res.data.results;
  return [];
};

const getProductLabel = (item: any): string => (
  item?.product?.vietnameseName
  || item?.product?.englishName
  || item?.product?.name
  || item?.productName
  || '-'
);

const buildMatchingLines = (
  detail?: MatchingDetail,
  rules: MatchingRules = DEFAULT_MATCHING_RULES,
): MatchingLine[] => {
  if (!detail?.po?.items) return [];

  const grnItems = detail.grns.flatMap((grn) => grn.items || []);
  const invoiceItems = detail.invoices.flatMap((invoice) => invoice.items || []);

  return detail.po.items.map((poItem: any) => {
    const productId = poItem.productId;
    const relatedGrnItems = grnItems.filter((item: any) => item.productId === productId);
    const relatedInvoiceItems = invoiceItems.filter((item: any) => item.productId === productId);

    const orderedQty = toNumber(poItem.quantity);
    const grnReceivedQty = relatedGrnItems.reduce((sum: number, item: any) => sum + toNumber(item.quantityReceived), 0);
    const grnRejectedQty = relatedGrnItems.reduce((sum: number, item: any) => sum + toNumber(item.quantityRejected), 0);
    const acceptedQty = grnReceivedQty - grnRejectedQty;
    const invoicedQty = relatedInvoiceItems.reduce((sum: number, item: any) => sum + toNumber(item.quantity), 0);
    const poUnitPrice = toNumber(poItem.unitPrice);
    const invoiceAmount = relatedInvoiceItems.reduce((sum: number, item: any) => {
      const lineAmount = toNumber(item.amount);
      return sum + (lineAmount > 0 ? lineAmount : toNumber(item.quantity) * toNumber(item.unitPrice));
    }, 0);
    const invoiceUnitPrice = invoicedQty > 0
      ? invoiceAmount / invoicedQty
      : toNumber(relatedInvoiceItems[0]?.unitPrice);

    const hasGrn = grnReceivedQty > 0;
    const hasInvoice = invoicedQty > 0;
    const quantityMatched = hasGrn
      && hasInvoice
      && withinAbsoluteTolerance(acceptedQty, invoicedQty, rules.quantityTolerance)
      && invoicedQty <= orderedQty + rules.quantityTolerance;
    const priceMatched = hasInvoice && withinPercentTolerance(
      poUnitPrice,
      invoiceUnitPrice,
      rules.priceTolerancePercent,
    );

    let status: MatchingLine['status'] = 'MATCHED';
    if (!hasGrn) status = 'MISSING_GRN';
    else if (!hasInvoice) status = 'MISSING_INVOICE';
    else if (!quantityMatched) status = 'QTY_VARIANCE';
    else if (!priceMatched) status = 'PRICE_VARIANCE';

    return {
      key: poItem._id || productId,
      productId,
      productName: getProductLabel(poItem),
      sku: poItem.product?.sku,
      unit: poItem.unit || poItem.product?.unit || poItem.product?.uom || '',
      orderedQty,
      grnReceivedQty,
      grnRejectedQty,
      acceptedQty,
      invoicedQty,
      poUnitPrice,
      invoiceUnitPrice,
      quantityMatched,
      priceMatched,
      currency: detail.po?.currency || 'VND',
      status,
    };
  });
};

const summarizeDetail = (
  record: any,
  detail?: MatchingDetail,
  rules: MatchingRules = DEFAULT_MATCHING_RULES,
) => {
  const po = detail?.po || record;
  const lines = buildMatchingLines(detail, rules);
  const hasGrn = detail ? detail.grns.length > 0 : ['PARTIAL_RECEIPT', 'RECEIVED', 'COMPLETED'].includes(record.status);
  const hasInvoice = detail ? detail.invoices.length > 0 : record.status === 'COMPLETED';
  const hasPo = Boolean(po?._id);
  const allMatched = detail ? lines.length > 0 && lines.every((line) => line.status === 'MATCHED') : false;
  const blocked = detail ? !allMatched : false;
  const progress = [hasPo, hasGrn, hasInvoice].filter(Boolean).length * 33 + (allMatched ? 1 : 0);

  return {
    po,
    lines,
    hasPo,
    hasGrn,
    hasInvoice,
    allMatched,
    blocked,
    progress,
    poTotal: toNumber(po?.totalAmount),
    invoiceTotal: detail?.invoices.reduce((sum, invoice) => sum + toNumber(invoice.totalAmount), 0) || 0,
    totalRejected: lines.reduce((sum, line) => sum + line.grnRejectedQty, 0),
    totalAccepted: lines.reduce((sum, line) => sum + line.acceptedQty, 0),
    totalInvoiced: lines.reduce((sum, line) => sum + line.invoicedQty, 0),
  };
};

const ThreeWayMatchingPage = () => {
  const t = useTranslations('ThreeWayMatching');
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedPoId = searchParams.get('poId');
  const { formatMoney, formatNumber } = useCurrency();
  const selectedPoInitializedRef = useRef<string | null>(null);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [detailsByPoId, setDetailsByPoId] = useState<Record<string, MatchingDetail>>({});
  const [detailLoadingByPoId, setDetailLoadingByPoId] = useState<Record<string, boolean>>({});
  const [matchingRules, setMatchingRules] = useState<MatchingRules>(DEFAULT_MATCHING_RULES);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    Promise.all([
      getSetting(THREE_WAY_MATCHING_QTY_TOLERANCE_KEY, accessToken),
      getSetting(THREE_WAY_MATCHING_PRICE_TOLERANCE_PERCENT_KEY, accessToken),
    ])
      .then(([qtySetting, priceSetting]) => {
        if (cancelled) return;

        const quantityTolerance = Number(qtySetting?.value ?? DEFAULT_MATCHING_RULES.quantityTolerance);
        const priceTolerancePercent = Number(priceSetting?.value ?? DEFAULT_MATCHING_RULES.priceTolerancePercent);

        setMatchingRules({
          quantityTolerance: Number.isFinite(quantityTolerance) ? quantityTolerance : DEFAULT_MATCHING_RULES.quantityTolerance,
          priceTolerancePercent: Number.isFinite(priceTolerancePercent) ? priceTolerancePercent : DEFAULT_MATCHING_RULES.priceTolerancePercent,
        });
      })
      .catch(() => {
        if (!cancelled) setMatchingRules(DEFAULT_MATCHING_RULES);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const fetchMatchingDetail = useCallback(async (poId: string, force = false) => {
    if (!accessToken || (!force && detailsByPoId[poId]) || detailLoadingByPoId[poId]) return;

    setDetailLoadingByPoId((prev) => ({ ...prev, [poId]: true }));
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [poRes, grnRes, invoiceRes] = await Promise.all([
        sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders/${poId}`,
          method: 'GET',
          headers,
        }),
        sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/goods-receipts`,
          method: 'GET',
          queryParams: { current: 1, pageSize: 100, purchaseOrderId: poId },
          headers,
        }),
        sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/vendor-invoices`,
          method: 'GET',
          queryParams: { current: 1, pageSize: 100, purchaseOrderId: poId },
          headers,
        }),
      ]);

      setDetailsByPoId((prev) => ({
        ...prev,
        [poId]: {
          po: poRes?.data,
          grns: listFromResponse(grnRes),
          invoices: listFromResponse(invoiceRes),
        },
      }));
    } finally {
      setDetailLoadingByPoId((prev) => ({ ...prev, [poId]: false }));
    }
  }, [accessToken, detailLoadingByPoId, detailsByPoId]);

  const fetchPOs = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 50 },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        const items = Array.isArray(res.data) ? res.data : (res.data.results || []);
        const sortedItems = selectedPoId
          ? [...items].sort((a, b) => (a._id === selectedPoId ? -1 : b._id === selectedPoId ? 1 : 0))
          : items;
        setData(sortedItems);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedPoId]);

  useEffect(() => {
    fetchPOs();
  }, [fetchPOs]);

  useEffect(() => {
    if (!selectedPoId) return;
    if (selectedPoInitializedRef.current === selectedPoId) return;

    selectedPoInitializedRef.current = selectedPoId;
    setExpandedRowKeys([selectedPoId]);
    fetchMatchingDetail(selectedPoId);
  }, [fetchMatchingDetail, selectedPoId]);

  const stats = useMemo(() => {
    const summaries = data.map((record) => summarizeDetail(record, detailsByPoId[record._id], matchingRules));
    return {
      matched: summaries.filter((summary) => summary.allMatched).length,
      waitingInvoice: summaries.filter((summary) => summary.hasGrn && !summary.hasInvoice).length,
    };
  }, [data, detailsByPoId, matchingRules]);

  const statusTag = (status: MatchingLine['status']) => {
    const config = {
      MATCHED: { color: 'green', icon: <CheckCircleOutlined />, label: t('detail.status.MATCHED') },
      MISSING_GRN: { color: 'default', icon: <InboxOutlined />, label: t('detail.status.MISSING_GRN') },
      MISSING_INVOICE: { color: 'gold', icon: <WarningOutlined />, label: t('detail.status.MISSING_INVOICE') },
      QTY_VARIANCE: { color: 'orange', icon: <WarningOutlined />, label: t('detail.status.QTY_VARIANCE') },
      PRICE_VARIANCE: { color: 'red', icon: <CloseCircleOutlined />, label: t('detail.status.PRICE_VARIANCE') },
    }[status];

    return <Tag color={config.color} icon={config.icon}>{config.label}</Tag>;
  };

  const openPoAction = useCallback((poId: string, action: 'grn' | 'invoice') => {
    router.push(`/dashboard/purchase-orders?poId=${poId}&action=${action}`);
  }, [router]);

  const detailColumns: ColumnsType<MatchingLine> = [
    {
      title: t('detail.columns.product'),
      dataIndex: 'productName',
      key: 'product',
      width: 260,
      render: (_: string, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.productName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>SKU: {record.sku || '-'}</Text>
        </Space>
      ),
    },
    {
      title: t('detail.columns.orderedQty'),
      dataIndex: 'orderedQty',
      key: 'orderedQty',
      align: 'right',
      render: (value) => formatNumber(value),
    },
    {
      title: t('detail.columns.acceptedQty'),
      dataIndex: 'acceptedQty',
      key: 'acceptedQty',
      align: 'right',
      render: (value) => <Text strong style={{ color: token.colorSuccess }}>{formatNumber(value)}</Text>,
    },
    {
      title: t('detail.columns.rejectedQty'),
      dataIndex: 'grnRejectedQty',
      key: 'grnRejectedQty',
      align: 'right',
      render: (value) => <Text type={value > 0 ? 'danger' : 'secondary'}>{formatNumber(value)}</Text>,
    },
    {
      title: t('detail.columns.invoiceQty'),
      dataIndex: 'invoicedQty',
      key: 'invoicedQty',
      align: 'right',
      render: (value) => formatNumber(value),
    },
    {
      title: t('detail.columns.poPrice'),
      dataIndex: 'poUnitPrice',
      key: 'poUnitPrice',
      align: 'right',
      render: (value, record) => formatMoney(value, record.currency),
    },
    {
      title: t('detail.columns.invoicePrice'),
      dataIndex: 'invoiceUnitPrice',
      key: 'invoiceUnitPrice',
      align: 'right',
      render: (value, record) => value > 0 ? formatMoney(value, record.currency) : '-',
    },
    {
      title: t('detail.columns.result'),
      key: 'status',
      render: (_, record) => statusTag(record.status),
    },
  ];

  const renderMatchingDetail = (record: any) => {
    const detail = detailsByPoId[record._id];
    const isDetailLoading = detailLoadingByPoId[record._id];
    const summary = summarizeDetail(record, detail, matchingRules);
    const currency = summary.po?.currency || record.currency || 'VND';

    if (isDetailLoading && !detail) {
      return (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <Spin />
          <div style={{ marginTop: 12 }}><Text type="secondary">{t('expand.loading')}</Text></div>
        </div>
      );
    }

    if (!detail) {
      return (
        <div style={{ padding: 24 }}>
          <Button icon={<SyncOutlined />} onClick={() => fetchMatchingDetail(record._id)}>
            {t('detail.loadNow')}
          </Button>
        </div>
      );
    }

    const alertType = summary.allMatched ? 'success' : 'warning';
    const alertTitle = summary.allMatched ? t('detail.readyTitle') : t('detail.blockedTitle');
    const alertDescription = summary.allMatched
      ? t('detail.readyDescription')
      : !summary.hasGrn
        ? t('detail.missingGrnDescription')
        : !summary.hasInvoice
          ? t('detail.missingInvoiceDescription')
          : t('detail.blockedDescription');
    const nextAction = !summary.hasGrn
      ? {
          label: t('detail.actions.createGrn'),
          icon: <InboxOutlined />,
          onClick: () => openPoAction(summary.po?._id || record._id, 'grn'),
        }
      : !summary.hasInvoice
        ? {
            label: t('detail.actions.createInvoice'),
            icon: <DollarOutlined />,
            onClick: () => openPoAction(summary.po?._id || record._id, 'invoice'),
          }
        : null;

    return (
      <div style={{ padding: '20px 32px', background: isDark ? '#1d1d1d' : '#f8fafc', borderRadius: 8 }}>
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ marginBottom: 4 }}>
              {t('expand.title', { poNumber: summary.po?.poNumber || record.poNumber })}
            </Title>
            <Text type="secondary">{summary.po?.vendor?.name || record.vendor?.name || '-'}</Text>
          </div>

          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Card size="small">
                <Statistic title="PO" value={formatMoney(summary.poTotal, currency)} prefix={<AuditOutlined />} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card size="small">
                <Statistic
                  title="GRN"
                  value={`${formatNumber(summary.totalAccepted)} / ${formatNumber(summary.lines.reduce((sum, line) => sum + line.orderedQty, 0))}`}
                  prefix={<InboxOutlined />}
                  styles={{ content: { color: summary.hasGrn ? token.colorSuccess : token.colorWarning } }}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card size="small">
                <Statistic
                  title="INV"
                  value={summary.invoiceTotal ? formatMoney(summary.invoiceTotal, currency) : t('detail.noInvoiceShort')}
                  prefix={<DollarOutlined />}
                  styles={{ content: { color: summary.hasInvoice ? token.colorSuccess : token.colorWarning } }}
                />
              </Card>
            </Col>
          </Row>

          <Alert
            title={alertTitle}
            description={alertDescription}
            type={alertType}
            showIcon
            action={nextAction ? (
              <Button
                type="primary"
                icon={nextAction.icon}
                onClick={nextAction.onClick}
              >
                {nextAction.label}
              </Button>
            ) : undefined}
          />

          <Table
            size="small"
            rowKey="key"
            columns={detailColumns}
            dataSource={summary.lines}
            pagination={false}
            scroll={{ x: 980 }}
          />
        </Space>
      </div>
    );
  };

  const columns: ColumnsType<any> = [
    {
      title: t('table.columns.po'),
      dataIndex: 'poNumber',
      key: 'poNumber',
      render: (text: string, record: any) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.vendor?.name}</Text>
        </Space>
      ),
    },
    {
      title: t('table.columns.poValue'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      render: (val: number, record: any) => <Text strong>{formatMoney(val, record.currency || 'VND')}</Text>
    },
    {
      title: t('table.columns.matchingStatus'),
      key: 'matchingStatus',
      width: '35%',
      render: (_: any, record: any) => {
        const detail = detailsByPoId[record._id];
        const summary = summarizeDetail(record, detail, matchingRules);
        const progressColor = summary.allMatched
          ? token.colorSuccess
          : summary.blocked
            ? token.colorWarning
            : token.colorInfo;

        return (
          <div style={{ padding: '8px 0' }}>
            <Row gutter={8}>
              <Col span={8}>
                <Badge status={summary.hasPo ? 'success' : 'default'} text="PO" />
              </Col>
              <Col span={8}>
                <Badge status={summary.hasGrn ? 'success' : 'processing'} text="GRN" />
              </Col>
              <Col span={8}>
                <Badge status={summary.hasInvoice ? 'success' : 'warning'} text="INV" />
              </Col>
            </Row>
            <Progress
              percent={Math.min(summary.progress, 100)}
              size="small"
              showInfo={false}
              strokeColor={progressColor}
              style={{ marginTop: 8 }}
            />
          </div>
        );
      }
    },
    {
      title: t('table.columns.actions'),
      key: 'action',
      align: 'center',
      render: (_: any, record: any) => (
        <Button
          type="primary"
          ghost
          icon={<FileSearchOutlined />}
          size="small"
          onClick={() => {
            setExpandedRowKeys((prev) => prev.includes(record._id)
              ? prev.filter((key) => key !== record._id)
              : [record._id]);
            fetchMatchingDetail(record._id);
          }}
        >
          {t('table.actionBtn')}
        </Button>
      ),
    },
  ];

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('title')}
        icon={<AuditOutlined />}
        description={t('description')}
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title={t('stats.matchedPO')}
              value={stats.matched}
              styles={{ content: { color: token.colorSuccess } }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic
              title={t('stats.waitingInvoice')}
              value={stats.waitingInvoice}
              styles={{ content: { color: token.colorWarning } }}
              prefix={<SyncOutlined spin={loading} />}
            />
          </Card>
        </Col>
      </Row>

      <Alert
        title={t('ruleAlert.title')}
        description={t('ruleAlert.description')}
        type="info"
        showIcon
        style={{ marginBottom: 24, borderRadius: 12 }}
      />

      <Card variant="borderless" style={{ borderRadius: 16 }} styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description={t('table.emptyText')} /> }}
          rowClassName={(record) => record._id === selectedPoId ? 'three-way-selected-row' : ''}
          expandable={{
            expandedRowKeys,
            onExpand: (expanded, record) => {
              setExpandedRowKeys(expanded ? [record._id] : []);
              if (expanded) fetchMatchingDetail(record._id);
            },
            expandedRowRender: renderMatchingDetail,
          }}
        />
      </Card>

      <style jsx global>{`
        .three-way-selected-row > td {
          background: ${isDark ? 'rgba(22, 119, 255, 0.16)' : '#eff6ff'} !important;
        }
      `}</style>
    </AdminPageScroll>
  );
};

export default ThreeWayMatchingPage;
