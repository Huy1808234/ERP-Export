'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Table, Tag, Space, Button, Input, Card, Badge, 
  Typography, Row, Col, Statistic, Drawer, 
  Timeline, theme, Tooltip, Empty, Avatar, Select, DatePicker
} from 'antd';
import { 
  SearchOutlined, ReloadOutlined, 
  HistoryOutlined, InboxOutlined, 
  WarningOutlined, AppstoreOutlined,
  StockOutlined,
  ExportOutlined,
  DeploymentUnitOutlined,
  StopOutlined,
  QuestionCircleOutlined,
  BarcodeOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/context/theme.context';
import { sendRequest } from '@/lib/api-client';
import { motion } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';
import { useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';
import { formatVietnamDate, formatVietnamTime } from '@/utils/date-time';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { Dayjs } from 'dayjs';

interface IInventoryItem {
  _id: string;
  sku: string;
  vietnameseName: string;
  englishName?: string;
  currentStock: number;
  reservedStock: number;
  quarantineStock?: number;
  minimumStock: number;
  unitOfMeasure: string;
}

interface IInventorySummary {
  totalStock: number;
  totalItems: number;
  lowStockCount: number;
  quarantineStock: number;
  quarantineItemCount: number;
}

interface IInventoryLedger {
  _id: string;
  transactionType: string;
  quantityChange: number;
  balanceAfter: number;
  referenceNumber?: string;
  referenceId?: string;
  lotNumber?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

interface InventoryListResponse {
  results: IInventoryItem[];
  meta: {
    total: number;
  };
  summary: IInventorySummary;
}

interface InventoryLedgerResponse {
  results: IInventoryLedger[];
  total?: number;
}

interface TransactionLabelConfig {
  color: string;
  label: string;
  icon: React.ReactNode;
}

type InventorySortOrder = 'ascend' | 'descend';
type InventorySortField =
  | 'vietnameseName'
  | 'currentStock'
  | 'reservedStock'
  | 'availableStock'
  | 'updatedAt';
type InventoryTableSorter = Parameters<NonNullable<TableProps<IInventoryItem>['onChange']>>[2];
type LedgerDateRange = [Dayjs, Dayjs] | null;
type InventoryStockStatus = 'QUARANTINE';

interface InventorySortConfig {
  field: InventorySortField;
  order: InventorySortOrder;
}

const DEFAULT_INVENTORY_SORT: InventorySortConfig = {
  field: 'availableStock',
  order: 'ascend',
};

const LEDGER_INITIAL_VISIBLE_COUNT = 20;
const LEDGER_VISIBLE_STEP = 20;
const LEDGER_DRAWER_DEFAULT_SIZE = 860;
const LEDGER_DRAWER_MIN_SIZE = 620;
const LEDGER_DRAWER_MAX_SIZE = 1120;
const LEDGER_TRANSACTION_TYPES = [
  'GOODS_RECEIPT',
  'SALES_DISPATCH',
  'ADJUSTMENT',
  'RETURN',
  'REJECTION',
  'RESERVE',
  'RELEASE',
] as const;

const getLedgerDrawerMaxSize = (): number => {
  if (typeof window === 'undefined') {
    return LEDGER_DRAWER_MAX_SIZE;
  }

  return Math.max(360, Math.min(LEDGER_DRAWER_MAX_SIZE, window.innerWidth - 16));
};

const clampLedgerDrawerSize = (size: number): number => {
  const maxSize = getLedgerDrawerMaxSize();
  const minSize = Math.min(LEDGER_DRAWER_MIN_SIZE, maxSize);

  return Math.max(minSize, Math.min(size, maxSize));
};

const getInventorySortParam = (sortConfig: InventorySortConfig): string => {
  return sortConfig.order === 'descend' ? `-${sortConfig.field}` : sortConfig.field;
};

const toInventorySortField = (field: string): InventorySortField | null => {
  if (
    field === 'vietnameseName' ||
    field === 'currentStock' ||
    field === 'reservedStock' ||
    field === 'availableStock' ||
    field === 'updatedAt'
  ) {
    return field;
  }

  return null;
};

const toInventorySortConfig = (sorter: InventoryTableSorter): InventorySortConfig => {
  const activeSorter = Array.isArray(sorter)
    ? sorter.find((item) => item.order)
    : sorter;

  if (activeSorter?.order !== 'ascend' && activeSorter?.order !== 'descend') {
    return DEFAULT_INVENTORY_SORT;
  }

  const rawField = String(activeSorter.columnKey ?? activeSorter.field ?? '');
  const field = toInventorySortField(rawField);

  if (!field) {
    return DEFAULT_INVENTORY_SORT;
  }

  return {
    field,
    order: activeSorter.order,
  };
};

const getInventorySortOrder = (
  sortConfig: InventorySortConfig,
  field: InventorySortField,
): InventorySortOrder | null => (sortConfig.field === field ? sortConfig.order : null);

const { Text } = Typography;
const { RangePicker } = DatePicker;

const InventoryPage = () => {
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const { formatNumber } = useCurrency();
  const t = useTranslations('Inventory');

  // --- States ---
  const [data, setData] = useState<IInventoryItem[]>([]);
  const [summary, setSummary] = useState<IInventorySummary>({
    totalStock: 0,
    totalItems: 0,
    lowStockCount: 0,
    quarantineStock: 0,
    quarantineItemCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current: 1, pageSize: 10, total: 0 });
  const { current, pageSize } = meta;
  const [searchText, setSearchText] = useState("");
  const [stockStatus, setStockStatus] = useState<InventoryStockStatus | undefined>();
  const [sortConfig, setSortConfig] = useState<InventorySortConfig>(DEFAULT_INVENTORY_SORT);

  // Ledger State
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<IInventoryItem | null>(null);
  const [ledgerData, setLedgerData] = useState<IInventoryLedger[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerSearchText, setLedgerSearchText] = useState('');
  const [ledgerTransactionType, setLedgerTransactionType] = useState<string | undefined>();
  const [ledgerDateRange, setLedgerDateRange] = useState<LedgerDateRange>(null);
  const [ledgerVisibleCount, setLedgerVisibleCount] = useState(LEDGER_INITIAL_VISIBLE_COUNT);
  const [ledgerDrawerSize, setLedgerDrawerSize] = useState(LEDGER_DRAWER_DEFAULT_SIZE);

  const handleLedgerDrawerResize = useCallback((nextSize: number) => {
    setLedgerDrawerSize(clampLedgerDrawerSize(nextSize));
  }, []);

  const getTransactionLabel = useCallback((type: string): TransactionLabelConfig => {
    const config: Record<string, TransactionLabelConfig> = {
      GOODS_RECEIPT: { color: 'green', label: t('transactionTypes.GOODS_RECEIPT'), icon: <InboxOutlined /> },
      SALES_DISPATCH: { color: 'blue', label: t('transactionTypes.SALES_DISPATCH'), icon: <ExportOutlined /> },
      ADJUSTMENT: { color: 'orange', label: t('transactionTypes.ADJUSTMENT'), icon: <DeploymentUnitOutlined /> },
      RETURN: { color: 'purple', label: t('transactionTypes.RETURN'), icon: <ReloadOutlined /> },
      REJECTION: { color: 'red', label: t('transactionTypes.REJECTION'), icon: <StopOutlined /> },
      RESERVE: { color: 'geekblue', label: t('transactionTypes.RESERVE'), icon: <StopOutlined /> },
      RELEASE: { color: 'cyan', label: t('transactionTypes.RELEASE'), icon: <ReloadOutlined /> },
    };

    return config[type] || { color: 'default', label: type, icon: <QuestionCircleOutlined /> };
  }, [t]);

  const ledgerTransactionOptions = useMemo(
    () => LEDGER_TRANSACTION_TYPES.map((type) => ({
      value: type,
      label: getTransactionLabel(type).label,
    })),
    [getTransactionLabel],
  );

  const filteredLedgerData = useMemo(() => {
    const normalizedSearch = ledgerSearchText.trim().toLowerCase();

    return ledgerData.filter((item) => {
      if (ledgerTransactionType && item.transactionType !== ledgerTransactionType) {
        return false;
      }

      if (ledgerDateRange) {
        const createdAt = new Date(item.createdAt).getTime();
        const startAt = ledgerDateRange[0].startOf('day').valueOf();
        const endAt = ledgerDateRange[1].endOf('day').valueOf();

        if (!Number.isFinite(createdAt) || createdAt < startAt || createdAt > endAt) {
          return false;
        }
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        item.referenceNumber,
        item.referenceId,
        item.lotNumber,
        item.notes,
        item.createdBy,
        item.transactionType,
      ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));
    });
  }, [ledgerData, ledgerDateRange, ledgerSearchText, ledgerTransactionType]);

  const visibleLedgerData = useMemo(
    () => filteredLedgerData.slice(0, ledgerVisibleCount),
    [filteredLedgerData, ledgerVisibleCount],
  );

  const hasMoreLedgerRows = visibleLedgerData.length < filteredLedgerData.length;

  useEffect(() => {
    setLedgerVisibleCount(LEDGER_INITIAL_VISIBLE_COUNT);
  }, [ledgerDateRange, ledgerSearchText, ledgerTransactionType, ledgerData.length]);

  useEffect(() => {
    const handleWindowResize = () => {
      setLedgerDrawerSize((currentSize) => clampLedgerDrawerSize(currentSize));
    };

    handleWindowResize();
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // --- Logic Fetch ---
  const fetchInventory = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<InventoryListResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory`,
        method: 'GET',
        queryParams: {
          current,
          pageSize,
          sort: getInventorySortParam(sortConfig),
          search: searchText || undefined,
          stockStatus,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        const inventoryResponse = res.data;
        setData(inventoryResponse.results);
        setMeta(prev => ({ ...prev, total: inventoryResponse.meta.total }));
        setSummary(inventoryResponse.summary);
      }
    } finally {
      setLoading(false);
    }
  }, [current, pageSize, searchText, sortConfig, stockStatus, accessToken]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const fetchLedger = async (product: IInventoryItem) => {
    if (!accessToken) return;

    setSelectedProduct(product);
    setLedgerOpen(true);
    setLedgerLoading(true);
    setLedgerData([]);
    setLedgerSearchText('');
    setLedgerTransactionType(undefined);
    setLedgerDateRange(null);
    setLedgerVisibleCount(LEDGER_INITIAL_VISIBLE_COUNT);
    try {
      const res = await sendRequest<IBackendRes<InventoryLedgerResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/ledger`,
        method: 'GET',
        queryParams: { productId: product._id },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) setLedgerData(res.data.results ?? []);
    } finally {
      setLedgerLoading(false);
    }
  };

  // --- Table Columns ---
  const columns: ColumnsType<IInventoryItem> = [
    {
      title: t('table.columns.product'),
      dataIndex: 'vietnameseName',
      key: 'vietnameseName',
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      sortOrder: getInventorySortOrder(sortConfig, 'vietnameseName'),
      render: (text: string, record: IInventoryItem) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.englishName || text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>SKU: {record.sku}</Text>
          {Number(record.quarantineStock || 0) > 0 ? (
            <Tag color="orange" style={{ width: 'fit-content' }}>
              {t('stockStatus.quarantine')}: {formatNumber(record.quarantineStock || 0)}
            </Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('table.columns.currentStock'),
      dataIndex: 'currentStock',
      key: 'currentStock',
      align: 'right' as const,
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder: getInventorySortOrder(sortConfig, 'currentStock'),
      render: (val: number) => (
        <Text strong style={{ fontSize: 16 }}>{formatNumber(val)}</Text>
      ),
    },
    {
      title: t('table.columns.reservedStock'),
      dataIndex: 'reservedStock',
      key: 'reservedStock',
      align: 'right' as const,
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder: getInventorySortOrder(sortConfig, 'reservedStock'),
      render: (val: number) => (
        <Text type="secondary">{formatNumber(val || 0)}</Text>
      ),
    },
    {
      title: t('table.columns.available'),
      key: 'availableStock',
      dataIndex: 'availableStock',
      align: 'right' as const,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      sortOrder: getInventorySortOrder(sortConfig, 'availableStock'),
      render: (_: unknown, record: IInventoryItem) => {
        const available = (record.currentStock || 0) - (record.reservedStock || 0);
        const isLow = available <= (record.minimumStock || 0);
        return (
          <Space>
            {isLow && available > 0 && <Badge status="warning" text={t('stockStatus.low')} style={{ fontSize: 11 }} />}
            {available <= 0 && <Badge status="error" text={t('stockStatus.out')} style={{ fontSize: 11 }} />}
            <Tag color={available > (record.minimumStock || 0) ? 'green' : 'volcano'} style={{ fontSize: 14, padding: '4px 12px', borderRadius: 6 }}>
              {formatNumber(available)}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: t('table.columns.actions'),
      key: 'action',
      align: 'center' as const,
      render: (_: unknown, record: IInventoryItem) => (
        <Button 
          type="link" 
          icon={<HistoryOutlined />} 
          onClick={() => fetchLedger(record)}
        >
          {t('actions.viewLedger')}
        </Button>
      ),
    },
  ];

  const ledgerTimelineItems = useMemo(() => visibleLedgerData.map((item) => {
    const config = getTransactionLabel(item.transactionType);
    const uom = selectedProduct?.unitOfMeasure || t('drawer.defaultUnit');

    return {
      key: item._id || `${item.transactionType}-${item.referenceId || item.referenceNumber || 'ref'}-${item.createdAt}`,
      title: (
        <div style={{ paddingRight: 12, textAlign: 'right' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{formatVietnamTime(item.createdAt)}</div>
          <div style={{ fontSize: 11, color: token.colorTextDescription }}>{formatVietnamDate(item.createdAt)}</div>
        </div>
      ),
      color: config.color,
      content: (
        <Card
          size="small"
          hoverable
          style={{
            borderRadius: 16,
            marginBottom: 16,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)'}`,
            background: isDark ? 'rgba(30, 41, 59, 0.4)' : '#ffffff',
            backdropFilter: 'blur(10px)',
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `${config.color}15`,
                    color: config.color,
                  }}
                >
                  {config.icon}
                </div>
                <Text strong style={{ fontSize: 15, letterSpacing: 0 }}>{config.label}</Text>
              </div>

              <Space wrap size={[8, 8]}>
                <Tooltip title={t('drawer.referenceTooltip')}>
                  <Tag
                    color="processing"
                    variant="filled"
                    style={{
                      borderRadius: 6,
                      fontWeight: 600,
                      padding: '2px 10px',
                      maxWidth: 220,
                      whiteSpace: 'normal',
                      wordBreak: 'break-all',
                    }}
                  >
                    #{item.referenceNumber || item.referenceId?.slice(0, 8)}
                  </Tag>
                </Tooltip>

                {item.lotNumber && (
                  <Tag icon={<BarcodeOutlined />} color="magenta" variant="filled" style={{ borderRadius: 6 }}>
                    {t('drawer.lot', { lot: item.lotNumber })}
                  </Tag>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 8px',
                    background: isDark ? '#334155' : '#f8fafc',
                    borderRadius: 6,
                    border: `1px solid ${isDark ? '#475569' : '#f1f5f9'}`,
                  }}
                >
                  <Avatar size={16} style={{ backgroundColor: token.colorPrimary, fontSize: 10 }}>
                    {String(item.createdBy || 'S').charAt(0).toUpperCase()}
                  </Avatar>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>
                    {item.createdBy || t('drawer.systemUser')}
                  </Text>
                </div>
              </Space>

              {item.notes && (
                <div
                  style={{
                    fontSize: 12,
                    marginTop: 10,
                    padding: '8px 12px',
                    background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#f9fafb',
                    borderRadius: 8,
                    borderLeft: `3px solid ${config.color}`,
                    color: isDark ? '#94a3b8' : '#64748b',
                    wordBreak: 'break-word',
                  }}
                >
                  {item.notes}
                </div>
              )}
            </div>

            <div
              style={{
                textAlign: 'right',
                paddingLeft: 20,
                borderLeft: `1px dashed ${isDark ? '#475569' : '#e2e8f0'}`,
                marginLeft: 'auto',
                minWidth: 104,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  fontFamily: 'Space Mono, monospace',
                  color: item.quantityChange > 0 ? '#10b981' : '#ef4444',
                  lineHeight: 1.2,
                }}
              >
                {item.quantityChange > 0 ? '+' : ''}{formatNumber(item.quantityChange)}
              </div>
              <div style={{ fontSize: 11, color: token.colorTextDescription, marginTop: 4, fontWeight: 500 }}>
                {uom.toUpperCase()}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: isDark ? '#94a3b8' : '#64748b',
                  marginTop: 8,
                  padding: '2px 8px',
                  background: isDark ? '#1e293b' : '#f1f5f9',
                  borderRadius: 4,
                  display: 'inline-block',
                }}
              >
                {t('drawer.balance')}: <Text strong style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>{formatNumber(item.balanceAfter)}</Text>
              </div>
            </div>
          </div>
        </Card>
      ),
    };
  }), [
    formatNumber,
    getTransactionLabel,
    isDark,
    selectedProduct?.unitOfMeasure,
    t,
    token.colorPrimary,
    token.colorTextDescription,
    visibleLedgerData,
  ]);

  return (
    <AdminPageScroll>
      <Row justify="space-between" align="bottom" style={{ marginBottom: '24px' }}>
        <Col>
          <PageHeader 
            title={t('title')} 
            icon={<InboxOutlined />} 
            description={t('description')} 
          />
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchInventory} size="large">{t('actions.refresh')}</Button>
            <Button type="primary" icon={<ExportOutlined />} size="large">{t('actions.exportReport')}</Button>
          </Space>
        </Col>
      </Row>

      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col xs={24} md={12} xl={6}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card variant="borderless" style={{ borderRadius: 20, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.02)' }}>
              <Statistic 
                title={<Text strong type="secondary">{t('stats.totalStock')}</Text>} 
                value={summary.totalStock} 
                precision={0}
                styles={{ content: { color: token.colorPrimary, fontWeight: 900, fontSize: 32 } }}
                prefix={<StockOutlined style={{ marginRight: 8 }} />} 
              />
              <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextDescription }}>{t('stats.totalStockDescription')}</div>
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card variant="borderless" style={{ borderRadius: 20, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.02)' }}>
              <Statistic 
                title={<Text strong style={{ color: token.colorError }}>{t('stats.lowStock')}</Text>} 
                value={summary.lowStockCount} 
                styles={{ content: { color: token.colorError, fontWeight: 900, fontSize: 32 } }}
                prefix={<WarningOutlined style={{ marginRight: 8 }} />} 
              />
              <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextDescription }}>{t('stats.lowStockDescription')}</div>
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card variant="borderless" style={{ borderRadius: 20, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.02)' }}>
              <Statistic 
                title={<Text strong type="secondary">{t('stats.productCatalog')}</Text>} 
                value={summary.totalItems} 
                styles={{ content: { color: '#8b5cf6', fontWeight: 900, fontSize: 32 } }}
                prefix={<AppstoreOutlined style={{ marginRight: 8 }} />} 
              />
              <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextDescription }}>{t('stats.productCatalogDescription')}</div>
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card variant="borderless" style={{ borderRadius: 20, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.02)' }}>
              <Statistic
                title={<Text strong style={{ color: '#fa8c16' }}>{t('stats.quarantineStock')}</Text>}
                value={summary.quarantineStock}
                precision={0}
                styles={{ content: { color: '#fa8c16', fontWeight: 900, fontSize: 32 } }}
                prefix={<StopOutlined style={{ marginRight: 8 }} />}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextDescription }}>
                {t('stats.quarantineStockDescription', { count: summary.quarantineItemCount })}
              </div>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* Main Table */}
      <Card 
        variant="borderless" 
        style={{ 
          borderRadius: 16, 
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.02)' 
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <Space wrap>
            <Input
              placeholder={t('filters.searchPlaceholder')}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setMeta((prev) => ({ ...prev, current: 1 }));
              }}
              style={{ width: 300, borderRadius: 8 }}
              size="large"
              allowClear
            />
            <Select<InventoryStockStatus>
              placeholder={t('filters.statusPlaceholder')}
              allowClear
              size="large"
              style={{ width: 220 }}
              value={stockStatus}
              options={[
                { value: 'QUARANTINE', label: t('stockStatus.quarantine') },
              ]}
              onChange={(value) => {
                setStockStatus(value);
                setMeta((prev) => ({ ...prev, current: 1 }));
              }}
            />
          </Space>
        </div>
        <Table 
          columns={columns} 
          dataSource={data} 
          rowKey={(record) => record._id || record.sku}
          loading={loading}
          onChange={(_, __, sorter, extra) => {
            if (extra.action === 'sort') {
              setSortConfig(toInventorySortConfig(sorter));
              setMeta((prev) => ({ ...prev, current: 1 }));
            }
          }}
          pagination={{
            current: meta.current,
            pageSize: meta.pageSize,
            total: meta.total,
            onChange: (page, size) => setMeta(prev => ({ ...prev, current: page, pageSize: size })),
          }}
        />
      </Card>

      {/* Drawer Ledger */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar shape="square" icon={<InboxOutlined />} style={{ background: token.colorPrimaryBg, color: token.colorPrimary }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t('drawer.title')}</div>
              <div style={{ fontSize: 12, fontWeight: 400, color: token.colorTextDescription }}>{selectedProduct?.englishName || selectedProduct?.vietnameseName}</div>
            </div>
          </div>
        }
        placement="right"
        size={ledgerDrawerSize}
        defaultSize={LEDGER_DRAWER_DEFAULT_SIZE}
        maxSize={LEDGER_DRAWER_MAX_SIZE}
        resizable={{
          onResize: handleLedgerDrawerResize,
          onResizeEnd: () => {
            setLedgerDrawerSize((currentSize) => clampLedgerDrawerSize(currentSize));
          },
        }}
        onClose={() => setLedgerOpen(false)}
        open={ledgerOpen}
        styles={{
          body: { padding: 24, background: isDark ? '#141414' : '#fafafa' },
          dragger: { width: 10, background: 'transparent' },
        }}
      >
        {ledgerLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>{t('drawer.loading')}</div>
        ) : ledgerData.length > 0 ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <div
              style={{
                position: 'sticky',
                top: -24,
                zIndex: 2,
                margin: '-24px -24px 0',
                padding: '16px 24px',
                background: isDark ? '#141414' : '#fafafa',
                borderBottom: `1px solid ${isDark ? '#262626' : '#f0f0f0'}`,
              }}
            >
              <div style={{ display: 'grid', gap: 8 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(180px, 1fr) minmax(160px, 190px) minmax(220px, 250px)',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder={t('drawer.filters.searchPlaceholder')}
                    value={ledgerSearchText}
                    onChange={(event) => setLedgerSearchText(event.target.value)}
                    style={{ width: '100%' }}
                  />
                  <Select
                    allowClear
                    placeholder={t('drawer.filters.transactionTypePlaceholder')}
                    options={ledgerTransactionOptions}
                    value={ledgerTransactionType}
                    onChange={(value) => setLedgerTransactionType(value)}
                    style={{ width: '100%' }}
                  />
                  <RangePicker
                    allowClear
                    format="DD/MM/YYYY"
                    placeholder={[
                      t('drawer.filters.startDatePlaceholder'),
                      t('drawer.filters.endDatePlaceholder'),
                    ]}
                    value={ledgerDateRange}
                    onChange={(dates) => {
                      setLedgerDateRange(dates && dates[0] && dates[1] ? [dates[0], dates[1]] : null);
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('drawer.showing', { count: visibleLedgerData.length, total: filteredLedgerData.length })}
                </Text>
              </div>
            </div>

            {filteredLedgerData.length > 0 ? (
              <>
                <Timeline
                  mode="start"
                  items={ledgerTimelineItems}
                />
                {hasMoreLedgerRows ? (
                  <div style={{ textAlign: 'center', paddingBottom: 8 }}>
                    <Button
                      onClick={() => setLedgerVisibleCount((value) => value + LEDGER_VISIBLE_STEP)}
                    >
                      {t('drawer.loadMore')}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <Empty description={t('drawer.noFilterResults')} />
            )}
          </Space>
        ) : (
          <Empty description={t('drawer.empty')} />
        )}
      </Drawer>
    </AdminPageScroll>
  );
};

export default InventoryPage;
