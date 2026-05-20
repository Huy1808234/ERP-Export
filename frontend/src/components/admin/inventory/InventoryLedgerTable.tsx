'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Typography, Card, Space, Input, DatePicker, Select, App } from 'antd';
import { theme } from 'antd';
import { HistoryOutlined, SearchOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/context/theme.context';
import { getAccessToken } from '@/lib/auth-token';
import { formatVietnamDate, formatVietnamTime } from '@/utils/date-time';
import type { ColumnsType, TableProps } from 'antd/es/table';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const TRANSACTION_TYPES = [
  'GOODS_RECEIPT',
  'SALES_DISPATCH',
  'ADJUSTMENT',
  'RETURN',
  'REJECTION',
  'RESERVE',
  'RELEASE',
] as const;

const TRANSACTION_COLORS: Record<string, string> = {
  GOODS_RECEIPT: 'green',
  SALES_DISPATCH: 'blue',
  ADJUSTMENT: 'orange',
  RETURN: 'red',
  REJECTION: 'volcano',
  RESERVE: 'purple',
  RELEASE: 'cyan',
};

interface InventoryLedgerProduct {
  sku?: string;
  vietnameseName?: string;
  englishName?: string;
}

interface InventoryLedgerRecord {
  _id: string;
  productId: string;
  product?: InventoryLedgerProduct;
  lotNumber?: string | null;
  transactionType: string;
  referenceNumber?: string | null;
  quantityChange: number;
  balanceAfter: number;
  notes?: string | null;
  createdAt: string;
}

type LedgerSortOrder = 'ascend' | 'descend';
type LedgerSortField =
  | 'createdAt'
  | 'productSku'
  | 'lotNumber'
  | 'transactionType'
  | 'referenceNumber'
  | 'quantityChange'
  | 'balanceAfter';
type LedgerTableSorter = Parameters<NonNullable<TableProps<InventoryLedgerRecord>['onChange']>>[2];

interface LedgerSortConfig {
  field: LedgerSortField;
  order: LedgerSortOrder;
}

const DEFAULT_LEDGER_SORT: LedgerSortConfig = {
  field: 'createdAt',
  order: 'descend',
};

const getLedgerSortParam = (sortConfig: LedgerSortConfig): string => {
  return sortConfig.order === 'descend' ? `-${sortConfig.field}` : sortConfig.field;
};

const toLedgerSortField = (field: string): LedgerSortField | null => {
  if (
    field === 'createdAt' ||
    field === 'productSku' ||
    field === 'lotNumber' ||
    field === 'transactionType' ||
    field === 'referenceNumber' ||
    field === 'quantityChange' ||
    field === 'balanceAfter'
  ) {
    return field;
  }

  return null;
};

const toLedgerSortConfig = (sorter: LedgerTableSorter): LedgerSortConfig => {
  const activeSorter = Array.isArray(sorter)
    ? sorter.find((item) => item.order)
    : sorter;

  if (activeSorter?.order !== 'ascend' && activeSorter?.order !== 'descend') {
    return DEFAULT_LEDGER_SORT;
  }

  const rawField = String(activeSorter.columnKey ?? activeSorter.field ?? '');
  const field = toLedgerSortField(rawField);

  if (!field) {
    return DEFAULT_LEDGER_SORT;
  }

  return {
    field,
    order: activeSorter.order,
  };
};

const getLedgerSortOrder = (
  sortConfig: LedgerSortConfig,
  field: LedgerSortField,
): LedgerSortOrder | null => (sortConfig.field === field ? sortConfig.order : null);

const InventoryLedgerTable = () => {
  const { data: session } = useSession();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const t = useTranslations('InventoryLedger');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InventoryLedgerRecord[]>([]);
  const [meta, setMeta] = useState({ current: 1, pageSize: 15, total: 0 });
  const { current, pageSize } = meta;
  const [sortConfig, setSortConfig] = useState<LedgerSortConfig>(DEFAULT_LEDGER_SORT);

  const [referenceNumber, setReferenceNumber] = useState('');
  const [transactionType, setTransactionType] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const accessToken = getAccessToken(session);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);

    const queryParams: Record<string, string | number> = {
      current,
      pageSize,
      sort: getLedgerSortParam(sortConfig),
    };

    if (referenceNumber) queryParams.referenceNumber = referenceNumber;
    if (transactionType) queryParams.transactionType = transactionType;
    if (dateRange) {
      queryParams.startDate = dateRange[0].startOf('day').toISOString();
      queryParams.endDate = dateRange[1].endOf('day').toISOString();
    }

    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/audit-trail`,
        method: 'GET',
        queryParams,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        setData(res.data.results);
        setMeta((prev) => ({ ...prev, total: res.data.meta.total }));
      }
    } catch {
      message.error(t('notifications.loadError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, current, pageSize, sortConfig, referenceNumber, transactionType, dateRange, message, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const transactionOptions = TRANSACTION_TYPES.map((type) => ({
    value: type,
    label: t(`transactionTypes.${type}`),
  }));

  const columns: ColumnsType<InventoryLedgerRecord> = [
    {
      title: t('table.columns.dateTime'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder: getLedgerSortOrder(sortConfig, 'createdAt'),
      render: (value: string) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{formatVietnamDate(value)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{formatVietnamTime(value, true)}</Text>
        </Space>
      ),
    },
    {
      title: t('table.columns.product'),
      dataIndex: 'product',
      key: 'productSku',
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      sortOrder: getLedgerSortOrder(sortConfig, 'productSku'),
      render: (product?: InventoryLedgerProduct) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{product?.sku}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {product?.englishName || product?.vietnameseName}
          </Text>
        </Space>
      ),
    },
    {
      title: t('table.columns.lotNumber'),
      dataIndex: 'lotNumber',
      key: 'lotNumber',
      width: 130,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      sortOrder: getLedgerSortOrder(sortConfig, 'lotNumber'),
      render: (value: string) => value ? <Tag color="blue" className="rounded-md">{value}</Tag> : '-',
    },
    {
      title: t('table.columns.transactionType'),
      dataIndex: 'transactionType',
      key: 'transactionType',
      width: 160,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      sortOrder: getLedgerSortOrder(sortConfig, 'transactionType'),
      render: (value: string) => (
        <Tag color={TRANSACTION_COLORS[value] || 'default'} className="rounded-md font-semibold">
          {t.has(`transactionTypes.${value}`) ? t(`transactionTypes.${value}`) : value}
        </Tag>
      ),
    },
    {
      title: t('table.columns.reference'),
      dataIndex: 'referenceNumber',
      key: 'referenceNumber',
      width: 180,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      sortOrder: getLedgerSortOrder(sortConfig, 'referenceNumber'),
      render: (value: string) => value ? (
        <Text
          code
          style={{
            background: isDark ? '#0f172a' : '#f1f5f9',
            color: token.colorText,
            borderColor: token.colorBorderSecondary,
          }}
        >
          {value}
        </Text>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: t('table.columns.quantity'),
      dataIndex: 'quantityChange',
      key: 'quantityChange',
      align: 'right' as const,
      width: 120,
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder: getLedgerSortOrder(sortConfig, 'quantityChange'),
      render: (value: number) => (
        <Text strong style={{ color: value > 0 ? '#10b981' : '#ef4444' }}>
          {value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString()}
        </Text>
      ),
    },
    {
      title: t('table.columns.balanceAfter'),
      dataIndex: 'balanceAfter',
      key: 'balanceAfter',
      align: 'right' as const,
      width: 120,
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder: getLedgerSortOrder(sortConfig, 'balanceAfter'),
      render: (value: number) => <Text strong style={{ color: token.colorText }}>{value?.toLocaleString()}</Text>,
    },
    {
      title: t('table.columns.notes'),
      dataIndex: 'notes',
      render: (value: string) => <Text type="secondary" italic>{value || '-'}</Text>,
    },
  ];

  return (
    <div style={{ backgroundColor: 'transparent', transition: 'all 0.3s ease' }}>
      <PageHeader
        title={t('title')}
        icon={<HistoryOutlined />}
        description={t('description')}
      />

      <Card
        variant="borderless"
        style={{
          marginTop: 24,
          borderRadius: 16,
          overflow: 'hidden',
          background: isDark ? '#1e293b' : token.colorBgContainer,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)',
        }}
        styles={{ body: { padding: 24 } }}
      >
        <Space className="mb-6 w-full justify-between" size="large" wrap>
          <Space size="middle" wrap>
            <Input
              placeholder={t('filters.referencePlaceholder')}
              prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
              onChange={(event) => {
                setReferenceNumber(event.target.value);
                setMeta((prev) => ({ ...prev, current: 1 }));
              }}
              style={{ width: 260 }}
              className="rounded-lg"
              size="large"
              allowClear
            />
            <RangePicker
              className="rounded-lg"
              size="large"
              onChange={(dates) => {
                setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null);
                setMeta((prev) => ({ ...prev, current: 1 }));
              }}
            />
            <Select
              placeholder={t('filters.transactionTypePlaceholder')}
              className="w-48"
              size="large"
              allowClear
              onChange={(value) => {
                setTransactionType(value);
                setMeta((prev) => ({ ...prev, current: 1 }));
              }}
              options={transactionOptions}
            />
          </Space>

          <Text type="secondary" className="hidden lg:block italic">
            {t('summary', { count: data.length, total: meta.total })}
          </Text>
        </Space>

        <Table
          rowKey={(record) => record._id || `${record.productId}-${record.transactionType}-${record.createdAt}`}
          columns={columns}
          dataSource={data}
          loading={loading}
          onChange={(_, __, sorter, extra) => {
            if (extra.action === 'sort') {
              setSortConfig(toLedgerSortConfig(sorter));
              setMeta((prev) => ({ ...prev, current: 1 }));
            }
          }}
          pagination={{
            ...meta,
            showSizeChanger: true,
            className: 'px-4',
            onChange: (page, size) => setMeta({ ...meta, current: page, pageSize: size }),
          }}
          className="premium-table"
          size="middle"
        />
      </Card>

      <style jsx global>{`
        .premium-table .ant-table {
          background: transparent !important;
        }
        .premium-table .ant-table-thead > tr > th {
          background: ${isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc'} !important;
          color: ${isDark ? '#94a3b8' : '#64748b'} !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          font-size: 11px !important;
          letter-spacing: 0.05em !important;
          border-bottom: 1px solid ${isDark ? '#334155' : '#e2e8f0'} !important;
        }
        .premium-table .ant-table-tbody > tr > td {
          background: transparent !important;
          color: ${isDark ? '#e2e8f0' : token.colorText} !important;
          border-bottom: 1px solid ${isDark ? '#334155' : '#e2e8f0'} !important;
        }
        .premium-table .ant-table-row:hover > td {
          background: ${isDark ? 'rgba(51, 65, 85, 0.45)' : '#f1f5f9'} !important;
        }
        .premium-table .ant-table-placeholder {
          background: transparent !important;
        }
      `}</style>
    </div>
  );
};

export default InventoryLedgerTable;
