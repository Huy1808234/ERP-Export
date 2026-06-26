'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Table, Tag, Space, Button, Input, Card, Badge, 
  Typography, Divider, Tooltip, Row, Col, Statistic,
  Dropdown, Drawer, Avatar, notification, Popconfirm, theme, Select, Form, Slider, InputNumber, DatePicker
} from 'antd';
import {PlusOutlined, SearchOutlined, FilterOutlined, 
  ExportOutlined, EditOutlined, 
  DeleteOutlined, MoreOutlined, 
  ReloadOutlined, ShoppingOutlined,
  DollarCircleOutlined, InfoCircleOutlined,
  AppstoreOutlined, InboxOutlined,
  HistoryOutlined, ReconciliationOutlined,
  CheckCircleOutlined, CloseCircleOutlined} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/context/theme.context';
import { backendFetch, sendRequest } from '@/lib/api-client';
import ProductModal from './ProductModal';
import AdjustmentModal from './AdjustmentModal';
import { IProduct } from "@/types/product";
import type { ColumnsType, TableProps } from 'antd/es/table';
import { getAccessToken } from '@/lib/auth-token';
import { useHasMounted } from '@/hooks/useHasMounted';
import { getAccessRoleName } from '@/lib/access-control';
import type { Dayjs } from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface IMeta {
  current: number;
  pageSize: number;
  total: number;
}

interface ProductTableProps {
  categories: any[];
}

type ProductSortOrder = 'ascend' | 'descend';
type ProductSortField = 'sku' | 'vietnameseName' | 'priceVnd' | 'isActive' | 'updatedAt';
type ProductTableSorter = Parameters<NonNullable<TableProps<IProduct>['onChange']>>[2];
type LedgerDateRange = [Dayjs, Dayjs] | null;

interface ProductSortConfig {
  field: ProductSortField;
  order: ProductSortOrder;
}

interface ProductInventoryLedger {
  _id: string;
  transactionType: string;
  quantityChange: number | string;
  balanceAfter: number | string;
  unitPrice?: number | string | null;
  referenceId?: string | null;
  referenceNumber?: string | null;
  lotNumber?: string | null;
  createdBy?: string | null;
  notes?: string | null;
  isQuarantine?: boolean;
  createdAt?: string | null;
}

const DEFAULT_PRODUCT_SORT: ProductSortConfig = {
  field: 'updatedAt',
  order: 'descend',
};

const getProductSortParam = (sortConfig: ProductSortConfig): string => {
  return sortConfig.order === 'descend' ? `-${sortConfig.field}` : sortConfig.field;
};

const toProductSortField = (field: string): ProductSortField | null => {
  if (
    field === 'sku' ||
    field === 'vietnameseName' ||
    field === 'priceVnd' ||
    field === 'isActive' ||
    field === 'updatedAt'
  ) {
    return field;
  }

  return null;
};

const toProductSortConfig = (sorter: ProductTableSorter): ProductSortConfig => {
  const activeSorter = Array.isArray(sorter)
    ? sorter.find((item) => item.order)
    : sorter;

  if (activeSorter?.order !== 'ascend' && activeSorter?.order !== 'descend') {
    return DEFAULT_PRODUCT_SORT;
  }

  const rawField = String(activeSorter.columnKey ?? activeSorter.field ?? '');
  const field = toProductSortField(rawField);

  if (!field) {
    return DEFAULT_PRODUCT_SORT;
  }

  return {
    field,
    order: activeSorter.order,
  };
};

const getProductSortOrder = (
  sortConfig: ProductSortConfig,
  field: ProductSortField,
): ProductSortOrder | null => (sortConfig.field === field ? sortConfig.order : null);

const inventoryTransactionColor: Record<string, string> = {
  GOODS_RECEIPT: 'green',
  SALES_DISPATCH: 'volcano',
  ADJUSTMENT: 'blue',
  RETURN: 'purple',
  REJECTION: 'red',
  RESERVE: 'gold',
  RELEASE: 'cyan',
};

const formatLedgerNumber = (value: number | string | null | undefined) => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : '-';
};

const ProductTable = ({ categories }: ProductTableProps) => {
  const hasMounted = useHasMounted();
  const { data: session } = useSession();
  const tUom = useTranslations('UOM');
  const tProduct = useTranslations('ProductTable');
  const [api, contextHolder] = notification.useNotification();
  const { token } = theme.useToken();
  const accessToken = getAccessToken(session);
  const currentUsername = session?.user?.username || session?.user?.name || '';
  const currentRoleName = getAccessRoleName(session?.user);
  const canApproveProductChanges = ['ADMIN', 'SUPER ADMIN', 'SUPER_ADMIN', 'DIRECTOR', 'MANAGER', 'PURCHASING', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT'].includes(currentRoleName);

  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({});

  // --- States ---
  const [products, setProducts] = useState<IProduct[]>([]);
  const [meta, setMeta] = useState<IMeta>({ current: 1, pageSize: 10, total: 0 });
  const { current, pageSize } = meta;
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [summary, setSummary] = useState({ 
    total: 0, 
    activeCount: 0, 
    avgPrice: 0, 
    categoryCount: 0,
    categories: [] as string[],
    unitCounts: [] as { unit: string, count: number }[] 
  });

  // Tự động chọn đơn vị đầu tiên nếu chưa chọn
  useEffect(() => {
    if (!selectedUnit && summary.unitCounts && summary.unitCounts.length > 0) {
      setSelectedUnit(summary.unitCounts[0].unit);
    }
  }, [summary.unitCounts, selectedUnit]);

  const currentUnitCount = summary.unitCounts?.find(u => u.unit === selectedUnit)?.count || 0;
  const [isFetching, setIsFetching] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
      setMeta(prev => ({ ...prev, current: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchText]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dataUpdate, setDataUpdate] = useState<IProduct | null>(null);

  const [isAdjOpen, setIsAdjOpen] = useState(false);
  const [productForAdj, setProductForAdj] = useState<IProduct | null>(null);
  const [isLedgerDrawerOpen, setIsLedgerDrawerOpen] = useState(false);
  const [productForLedger, setProductForLedger] = useState<IProduct | null>(null);
  const [ledgerRows, setLedgerRows] = useState<ProductInventoryLedger[]>([]);
  const [ledgerDateRange, setLedgerDateRange] = useState<LedgerDateRange>(null);
  const [isFetchingLedger, setIsFetchingLedger] = useState(false);
  const [isChangeDrawerOpen, setIsChangeDrawerOpen] = useState(false);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [isFetchingChanges, setIsFetchingChanges] = useState(false);

  // --- Advanced Filter States ---
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterForm] = Form.useForm();
  const [filters, setFilters] = useState<any>({});
  const [sortConfig, setSortConfig] = useState<ProductSortConfig>(DEFAULT_PRODUCT_SORT);

  // --- 2. Logic Fetch Dữ liệu ---
  const fetchCurrencyRates = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies`,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const next: Record<string, number> = {};
      for (const c of res?.data ?? []) {
        const code = c?.code;
        if (!code) continue;

        const list = Array.isArray(c.exchangeRates) ? c.exchangeRates : [];
        const normalized = (r: any) => (r?.rateType || 'TRANSFER') as string;
        const latest =
          list.find((r: any) => r?.isActive && normalized(r) === 'TRANSFER')?.rate ??
          list.find((r: any) => normalized(r) === 'TRANSFER')?.rate;

        if (latest) next[code] = Number(latest);
      }

      setCurrencyRates(next);
    } catch {
      // silent
    }
  }, [accessToken]);

  const fetchProducts = useCallback(async () => {
    if (!accessToken) return;
    setIsFetching(true);
    try {
      const sortStr = getProductSortParam(sortConfig);

      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products`,
        method: 'GET',
        queryParams: {
          current,
          pageSize,
          sort: sortStr,
          ...(debouncedSearchText ? { search: debouncedSearchText } : {}),
          ...filters
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.data) {
        setProducts(res.data.results);
        setMeta(prev => ({ 
          ...prev, 
          total: res.data.totalItems || 0 
        }));
        if (res.data.summary) {
          setSummary(prev => ({ ...prev, ...res.data.summary }));
        }
      }
    } finally {
      setIsFetching(false);
    }
  }, [current, pageSize, debouncedSearchText, filters, sortConfig, accessToken]);

  const fetchProductChangeRequests = useCallback(async () => {
    if (!accessToken) return;
    setIsFetchingChanges(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products/change-requests`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 50 },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setChangeRequests(res?.data?.results ?? []);
    } finally {
      setIsFetchingChanges(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchCurrencyRates();
    fetchProducts();
    fetchProductChangeRequests();
  }, [fetchProducts, fetchCurrencyRates, fetchProductChangeRequests]);

  // --- 3. Hành động (Actions) ---
  const handleDelete = useCallback(async (id: string) => {
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products/${id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res?.data) {
      api.success({ title: tProduct('notifications.deleteSuccess') });
      fetchProducts();
    }
  }, [accessToken, api, fetchProducts, tProduct]);

  const handleResetFilters = () => {
    filterForm.resetFields();
    setFilters({});
    setMeta(prev => ({ ...prev, current: 1 }));
    setIsFilterOpen(false);
  };

  const onFilterFinish = (values: any) => {
    const formattedFilters: any = {};
    
    // Exact matches
    if (values.unitOfMeasure) formattedFilters.unitOfMeasure = values.unitOfMeasure;
    if (values.isActive !== undefined) formattedFilters.isActive = values.isActive;
    if (values.exportCurrency) formattedFilters.exportCurrency = values.exportCurrency;
    if (values.hsCode) formattedFilters.hsCode = values.hsCode;
    if (values.category) formattedFilters.category = values.category;
    if (values.brand) formattedFilters.brand = values.brand;

    // Range: Price
    if (values.priceRange && (values.priceRange[0] > 0 || values.priceRange[1] < 10000000)) {
      formattedFilters.defaultExportPrice = { 
        $gte: values.priceRange[0], 
        $lte: values.priceRange[1] 
      };
    }

    // Range: CBM
    if (values.cbmRange && (values.cbmRange[0] > 0 || values.cbmRange[1] < 1)) {
      formattedFilters.cbmPerCarton = {
        $gte: values.cbmRange[0],
        $lte: values.cbmRange[1]
      };
    }

    // Stock min
    if (values.minStock) {
        formattedFilters.currentStock = { $gte: values.minStock };
    }

    setFilters(formattedFilters);
    setMeta(prev => ({ ...prev, current: 1 }));
    setIsFilterOpen(false);
  };

  const handleExport = async () => {
    if (!accessToken) return;
    try {
      api.info({ title: tProduct('notifications.preparingExcel'), placement: 'topRight' });
      const queryParams = new URLSearchParams({
        ...(debouncedSearchText ? { search: debouncedSearchText } : {}),
        sort: getProductSortParam(sortConfig),
        ...filters
      });
      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products/export?${queryParams.toString()}`;
      const response = await backendFetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `DS_San_Pham_${new Date().getTime()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
        api.success({ title: tProduct('notifications.exportSuccess') });
      }
    } catch {
      api.error({ title: tProduct('notifications.exportError') });
    }
  };

  const fetchProductLedger = useCallback(async (product: IProduct) => {
    if (!accessToken || !product._id) return;

    setProductForLedger(product);
    setIsLedgerDrawerOpen(true);
    setIsFetchingLedger(true);
    setLedgerDateRange(null);

    try {
      const res = await sendRequest<IBackendRes<{ results: ProductInventoryLedger[]; total?: number }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/ledger`,
        method: 'GET',
        queryParams: { productId: product._id },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      setLedgerRows(res?.data?.results ?? []);
    } catch {
      api.error({ title: 'Không tải được lịch sử kho', description: product.sku });
      setLedgerRows([]);
    } finally {
      setIsFetchingLedger(false);
    }
  }, [accessToken, api]);

  const filteredLedgerRows = useMemo(() => {
    if (!ledgerDateRange) {
      return ledgerRows;
    }

    const startAt = ledgerDateRange[0].startOf('day').valueOf();
    const endAt = ledgerDateRange[1].endOf('day').valueOf();

    return ledgerRows.filter((row) => {
      if (!row.createdAt) {
        return false;
      }

      const createdAt = new Date(row.createdAt).getTime();
      return Number.isFinite(createdAt) && createdAt >= startAt && createdAt <= endAt;
    });
  }, [ledgerDateRange, ledgerRows]);

  const handleApproveChange = async (record: any) => {
    const isMatrixRequest = !!record.approvalWorkflowRequestId;
    const res = await sendRequest<IBackendRes<any>>({
      url: isMatrixRequest
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/approval-matrix/requests/${record.approvalWorkflowRequestId}/approve`
        : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products/change-requests/${record._id}/approve`,
      method: 'PATCH',
      body: { note: 'Approved from product admin' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      api.success({ title: 'Đã duyệt thay đổi sản phẩm', description: record.requestNumber });
      fetchProducts();
      fetchProductChangeRequests();
    } else {
      api.error({ title: 'Không duyệt được thay đổi', description: res?.message });
    }
  };

  const handleRejectChange = async (record: any) => {
    const isMatrixRequest = !!record.approvalWorkflowRequestId;
    const res = await sendRequest<IBackendRes<any>>({
      url: isMatrixRequest
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/approval-matrix/requests/${record.approvalWorkflowRequestId}/reject`
        : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products/change-requests/${record._id}/reject`,
      method: 'PATCH',
      body: { reason: 'Rejected from product admin' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      api.success({ title: 'Đã từ chối thay đổi sản phẩm', description: record.requestNumber });
      fetchProductChangeRequests();
    } else {
      api.error({ title: 'Không từ chối được thay đổi', description: res?.message });
    }
  };

  const ledgerColumns: ColumnsType<ProductInventoryLedger> = useMemo(() => [
    {
      title: 'Thời điểm',
      dataIndex: 'createdAt',
      width: 150,
      render: (value: string | null) => (
        <Space orientation="vertical" size={0}>
          <Text>{value ? new Date(value).toLocaleDateString('vi-VN') : '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Loại giao dịch',
      dataIndex: 'transactionType',
      width: 170,
      render: (value: string, record) => (
        <Space orientation="vertical" size={2}>
          <Tag color={inventoryTransactionColor[value] || 'default'}>{value}</Tag>
          {record.isQuarantine ? <Tag color="warning">Quarantine</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantityChange',
      align: 'right',
      width: 110,
      render: (value: number | string) => {
        const numeric = Number(value || 0);
        const color = numeric > 0 ? token.colorSuccess : numeric < 0 ? token.colorError : token.colorText;
        return <Text strong style={{ color }}>{numeric > 0 ? '+' : ''}{formatLedgerNumber(numeric)}</Text>;
      },
    },
    {
      title: 'Tồn sau',
      dataIndex: 'balanceAfter',
      align: 'right',
      width: 110,
      render: (value: number | string) => <Text strong>{formatLedgerNumber(value)}</Text>,
    },
    {
      title: 'Đơn giá',
      dataIndex: 'unitPrice',
      align: 'right',
      width: 130,
      render: (value: number | string | null) => (
        value === null || value === undefined ? <Text type="secondary">-</Text> : <Text>{formatLedgerNumber(value)}</Text>
      ),
    },
    {
      title: 'Lot / Batch',
      dataIndex: 'lotNumber',
      width: 160,
      render: (value: string | null) => value ? <Tag color="geekblue">{value}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: 'Chứng từ',
      key: 'reference',
      width: 220,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.referenceNumber || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.referenceId || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Người tạo',
      dataIndex: 'createdBy',
      width: 130,
      render: (value: string | null) => value || '-',
    },
    {
      title: 'Ghi chú',
      dataIndex: 'notes',
      width: 260,
      render: (value: string | null) => (
        <Text style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{value || '-'}</Text>
      ),
    },
  ], [token]);

  // --- 4. Cấu hình Columns ---
  const columns: ColumnsType<IProduct> = useMemo(() => [
    {
      title: tProduct('table.columns.sku'),
      dataIndex: 'sku',
      key: 'sku',
      fixed: 'left',
      width: 180,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      sortOrder: getProductSortOrder(sortConfig, 'sku'),
      render: (text: string, record: IProduct) => (
        <Space>
          <Avatar 
            src={record.imageUrl} 
            shape="square" 
            icon={<InboxOutlined />} 
            style={{ backgroundColor: token.colorFillTertiary }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text strong style={{ color: token.colorPrimary }}>{text}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: tProduct('table.columns.name'),
      dataIndex: 'vietnameseName',
      key: 'vietnameseName',
      width: 250,
      ellipsis: true,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      sortOrder: getProductSortOrder(sortConfig, 'vietnameseName'),
      render: (text: string, record: IProduct) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>{record.englishName}</Text>
        </div>
      ),
    },
    {
      title: tProduct('table.columns.logistics'),
      width: 180,
      render: (_: any, record: IProduct) => (
        <Space orientation="vertical" size={0}>
          <Text type="secondary" style={{ fontSize: '11px' }}>HS: {record.hsCode || '---'}</Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>Cat: {record.category || '---'}</Text>
          <Space>
            <Tag color="blue">{record.unitOfMeasure ? tUom(record.unitOfMeasure) : '-'}</Tag>
            {record.cbmPerCarton && (
              <Tooltip title="Thể tích (CBM/Carton)">
                <Tag color="orange">{record.cbmPerCarton} m³</Tag>
              </Tooltip>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: tProduct('table.columns.price'),
      dataIndex: 'defaultExportPrice',
      key: 'priceVnd',
      width: 160,
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder: getProductSortOrder(sortConfig, 'priceVnd'),
      render: (price: number, record: IProduct) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <Text strong style={{ color: token.colorError }}>
            {price?.toLocaleString()} {record.exportCurrency}
          </Text>
          {record.exportCurrency && record.exportCurrency !== 'VND' && currencyRates[record.exportCurrency] && price ? (
            <Text type="secondary" style={{ fontSize: '10px' }}>
              ≈ {(price * currencyRates[record.exportCurrency]).toLocaleString()} VND
            </Text>
          ) : null}
          {record.preferredSupplier && (
            <Text type="secondary" style={{ fontSize: '10px' }}>
              NCC: {record.preferredSupplier.name}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: tProduct('table.columns.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      width: 150,
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder: getProductSortOrder(sortConfig, 'isActive'),
      render: (active: boolean) => (
        <Badge 
          status={active ? 'success' : 'default'} 
          text={
            <Tag color={active ? 'cyan' : 'default'} style={{ borderRadius: '12px' }}>
              {active ? tProduct('status.ACTIVE') : tProduct('status.INACTIVE')}
            </Tag>
          } 
        />
      )
    },
    {
      title: tProduct('table.columns.actions'),
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_: any, record: IProduct) => (
        <Space size="small">
          <Tooltip title={tProduct('actions.edit')}>
            <Button 
              type="text" 
              icon={<EditOutlined style={{ color: '#1890ff' }} />} 
              onClick={() => { setDataUpdate(record); setIsModalOpen(true); }}
            />
          </Tooltip>
          <Dropdown
            menu={{ 
              items: [
                {
                  key: 'adjust',
                  icon: <ReconciliationOutlined />,
                  label: tProduct('actions.adjust'),
                  onClick: () => { setProductForAdj(record); setIsAdjOpen(true); }
                },
                {
                  key: 'ledger',
                  icon: <HistoryOutlined />,
                  label: tProduct('actions.ledger'),
                  onClick: () => fetchProductLedger(record),
                },
                { type: 'divider' },
                { 
                  key: 'delete', 
                  icon: <DeleteOutlined />, 
                  label: (
                    <Popconfirm
                      title={tProduct('table.confirmDelete')}
                      onConfirm={() => handleDelete(record._id!)}
                      okText={tProduct('actions.delete')} cancelText="Hủy"
                    >
                      <span>{tProduct('actions.delete')}</span>
                    </Popconfirm>
                  ), 
                  danger: true 
                },
              ] 
            }}
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ], [currencyRates, fetchProductLedger, handleDelete, sortConfig, tProduct, tUom, token]);

  const { isDark } = useTheme();

  return (
    <>
      {contextHolder}
      
      {/* Header */}
      <Row justify="space-between" align="bottom" style={{ marginBottom: '24px' }}>
        <Col>
          <PageHeader 
        title={tProduct('title')} 
        icon={<InboxOutlined />} 
        description={tProduct('subtitle')} 
      />
          <Text type="secondary">{tProduct('description')}</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ExportOutlined />} size="large" onClick={handleExport}>{tProduct('actions.export')}</Button>
            <Button
              icon={<HistoryOutlined />}
              size="large"
              onClick={() => {
                setIsChangeDrawerOpen(true);
                fetchProductChangeRequests();
              }}
            >
              {tProduct('changeRequests.openButton')}
              {changeRequests.filter((request) => request.status === 'PENDING_APPROVAL').length > 0
                ? ` (${changeRequests.filter((request) => request.status === 'PENDING_APPROVAL').length})`
                : ''}
            </Button>
            <Button 
              type="primary" icon={<PlusOutlined />} size="large" 
              onClick={() => { setDataUpdate(null); setIsModalOpen(true); }}
              style={{ borderRadius: '8px' }}
            >
              {tProduct('actions.add')}
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Quick Stats */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px' }}>
            <Statistic 
              title={<Text type="secondary">{tProduct('stats.total')}</Text>} 
              value={summary.categoryCount} 
              prefix={<AppstoreOutlined style={{ color: token.colorPrimary }} />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px' }}>
            <Statistic 
              title={<Text type="secondary">{tProduct('stats.active')}</Text>} 
              value={summary.activeCount} 
              styles={{ content: { color: token.colorSuccess } }}
              prefix={<ShoppingOutlined />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px' }}>
            <Statistic 
              title={
                <Dropdown
                  menu={{
                    items: (summary.unitCounts || [])
                      .filter(u => u && u.unit)
                      .map((u, index) => ({
                        key: `${u.unit}-${index}`,
                        label: tUom(u.unit),
                        onClick: () => setSelectedUnit(u.unit)
                      }))
                  }}
                  trigger={['click']}
                >
                  <Space style={{ cursor: 'pointer' }}>
                    <Text type="secondary">{tProduct('stats.unit', { unit: selectedUnit ? tUom(selectedUnit) : '---' })}</Text>
                    <EditOutlined style={{ fontSize: '10px', color: token.colorPrimary }} />
                  </Space>
                </Dropdown>
              } 
              value={currentUnitCount} 
              prefix={<InfoCircleOutlined />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px' }}>
            <Statistic 
              title={<Text type="secondary">{tProduct('stats.avgPrice')}</Text>} 
              value={summary.avgPrice} 
              precision={1}
              prefix={<DollarCircleOutlined style={{ color: '#faad14' }} />} 
            />
          </Card>
        </Col>
      </Row>

      {/* Main Table Container */}
      <Card 
        variant="borderless" 
        style={{ 
          borderRadius: '12px', 
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)' 
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between' }}>
          <Space size="large">
            <Input
              placeholder={tProduct('table.searchPlaceholder')} 
              prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 400 }}
              size="large"
              allowClear
            />
            <Button 
              icon={<FilterOutlined />} 
              size="large"
              onClick={() => setIsFilterOpen(true)}
              type={Object.keys(filters).length > 0 ? "primary" : "default"}
            >
              {tProduct('table.advancedFilter')} {Object.keys(filters).length > 0 && `(${Object.keys(filters).length})`}
            </Button>
            <Button icon={<ReloadOutlined />} size="large" onClick={fetchProducts} />
          </Space>

          {selectedRowKeys.length > 0 && (
            <Space>
              <span style={{ color: token.colorTextSecondary }}>{tProduct('table.selectedCount', { count: selectedRowKeys.length })}</span>
              <Popconfirm
                title={tProduct('table.confirmBulkDelete', { count: selectedRowKeys.length })}
                onConfirm={async () => {
                  const res = await sendRequest<IBackendRes<any>>({
                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products/bulk-delete`,
                    method: 'POST',
                    body: { ids: selectedRowKeys },
                    headers: { Authorization: `Bearer ${accessToken}` },
                  });
                  if (res?.data) {
                    api.success({ title: tProduct('notifications.bulkDeleteSuccess'), description: res.message });
                    setSelectedRowKeys([]);
                    fetchProducts();
                  }
                }}
                okText={tProduct('actions.bulkDelete')}
                cancelText={tProduct('actions.cancel')}
                okButtonProps={{ danger: true }}
              >
                <Button danger type="primary" icon={<DeleteOutlined />}>{tProduct('actions.bulkDelete')}</Button>
              </Popconfirm>
            </Space>
          )}
        </div>

        <Table 
          columns={columns} 
          dataSource={products}
          rowKey={(record) => record._id || record.sku}
          loading={isFetching}
          scroll={{ x: 1200 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          onChange={(_, __, sorter, extra) => {
            if (extra.action === 'sort') {
              setSortConfig(toProductSortConfig(sorter));
              setMeta((prev) => ({ ...prev, current: 1 }));
            }
          }}
          pagination={{
            current: meta.current,
            pageSize: meta.pageSize,
            total: meta.total,
            showSizeChanger: true,
            showTotal: (total) => tProduct('table.totalItems', { total }),
            onChange: (page, size) => setMeta({ ...meta, current: page, pageSize: size }),
          }}
        />
      </Card>

      {/* Advanced Filter Drawer */}
      {hasMounted && (
      <Drawer
        title={<Space><FilterOutlined /> {tProduct('filter.title')}</Space>}
        placement="right"
        onClose={() => setIsFilterOpen(false)}
        open={isFilterOpen}
        size="default"
        extra={
          <Space>
            <Button onClick={handleResetFilters}>{tProduct('actions.reset')}</Button>
            <Button type="primary" onClick={() => filterForm.submit()}>{tProduct('actions.apply')}</Button>
          </Space>
        }
      >
        <Form
          form={filterForm}
          layout="vertical"
          onFinish={onFilterFinish}
          initialValues={{
            isActive: undefined,
            priceRange: [0, 10000000],
            cbmRange: [0, 1]
          }}
        >
          <Divider titlePlacement="left" style={{ marginTop: 0 }}>{tProduct('filter.general')}</Divider>
          
          <Form.Item label={tProduct('filter.status')} name="isActive">
            <Select allowClear placeholder={tProduct('filter.statusPlaceholder')}>
              <Select.Option value={true}>{tProduct('status.ACTIVE')}</Select.Option>
              <Select.Option value={false}>{tProduct('status.INACTIVE')}</Select.Option>
            </Select>
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label={tProduct('filter.uom')} name="unitOfMeasure">
                <Select allowClear placeholder="UoM">
                  <Select.Option value="SETS">SETS</Select.Option>
                  <Select.Option value="PCS">PCS</Select.Option>
                  <Select.Option value="TONS">TONS</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={tProduct('filter.currency')} name="exportCurrency">
                <Select allowClear placeholder="Currency">
                  <Select.Option value="USD">USD</Select.Option>
                  <Select.Option value="VND">VND</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label={tProduct('filter.hsCode')} name="hsCode">
            <Input placeholder={tProduct('filter.hsPlaceholder')} allowClear />
          </Form.Item>

          <Divider titlePlacement="left">{tProduct('filter.logistics')}</Divider>
          
          <Form.Item label={tProduct('filter.category')} name="category">
            <Select 
              allowClear 
              placeholder={tProduct('filter.categoryPlaceholder')}
              options={Array.from(new Set(categories
                .filter(c => c && c.name)
                .map(c => c.name)))
                .map(name => ({
                  value: name,
                  label: name
                }))}
            />
          </Form.Item>



          <Form.Item label={tProduct('filter.cbmRange')} name="cbmRange">
            <Slider range min={0} max={1} step={0.01} 
              marks={{ 0: '0', 0.5: '0.5', 1: '1' }}
            />
          </Form.Item>

          <Form.Item label={tProduct('filter.minStock')} name="minStock">
            <InputNumber style={{ width: '100%' }} placeholder={tProduct('filter.minStockPlaceholder')} />
          </Form.Item>

          <Divider titlePlacement="left">{tProduct('filter.finance')}</Divider>

          <Form.Item label={tProduct('filter.priceRange')} name="priceRange">
            <Slider 
              range 
              min={0} 
              max={10000000} 
              step={100000}
              tooltip={{ formatter: (val) => `${val?.toLocaleString()} USD` }}
            />
          </Form.Item>
        </Form>
      </Drawer>
      )}

      {hasMounted && (
      <Drawer
        title={<Space><HistoryOutlined /> {tProduct('changeRequests.title')}</Space>}
        placement="right"
        open={isChangeDrawerOpen}
        size={1120}
        onClose={() => setIsChangeDrawerOpen(false)}
        extra={<Button icon={<ReloadOutlined />} onClick={fetchProductChangeRequests}>{tProduct('changeRequests.reload')}</Button>}
      >
        <Table
          rowKey="_id"
          loading={isFetchingChanges}
          dataSource={changeRequests}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1000 }}
          tableLayout="fixed"
          columns={[
            {
              title: tProduct('changeRequests.columns.request'),
              key: 'request',
              width: 190,
              render: (_, record: any) => (
                <Space orientation="vertical" size={0}>
                  <Text strong style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 }}>{record.requestNumber}</Text>
                  <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 }}>
                    {record.product?.sku || record.productId} - {record.product?.vietnameseName || ''}
                  </Text>
                </Space>
              ),
            },
            {
              title: tProduct('changeRequests.columns.changes'),
              key: 'changes',
              width: 290,
              render: (_, record: any) => (
                <Space wrap size={[4, 4]} style={{ maxWidth: 270 }}>
                  {(record.changedFields || []).map((change: any) => (
                    <Tag
                      key={`${record._id}-${change.field}`}
                      color="blue"
                      style={{ maxWidth: 270, whiteSpace: 'normal', lineHeight: 1.35 }}
                    >
                      {change.field}
                      {change.before !== undefined && change.after !== undefined
                        ? `: ${String(change.before ?? '-') } → ${String(change.after ?? '-')}`
                        : ''}
                    </Tag>
                  ))}
                </Space>
              ),
            },
            {
              title: tProduct('changeRequests.columns.status'),
              dataIndex: 'status',
              width: 140,
              render: (status: string) => (
                <Tag color={status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'error' : 'processing'}>
                  {tProduct(`changeRequests.status.${status}`)}
                </Tag>
              ),
            },
            {
              title: tProduct('changeRequests.columns.matrixAudit'),
              key: 'approvalAudit',
              width: 145,
              render: (_, record: any) => (
                <Space orientation="vertical" size={0}>
                  {record.approvalWorkflowRequestId ? <Tag color="volcano">{tProduct('changeRequests.matrix')}</Tag> : <Tag>{tProduct('changeRequests.legacy')}</Tag>}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {record.fieldDecisionAudit?.[0]?.decidedByUsername
                      || record.approvedByUsername
                      || record.rejectedByUsername
                      || tProduct('changeRequests.unprocessed')}
                  </Text>
                </Space>
              ),
            },
            {
              title: tProduct('changeRequests.columns.creator'),
              dataIndex: 'requestedByUsername',
              width: 140,
              render: (value: string) => (
                <Text style={{ whiteSpace: 'nowrap' }}>{value || '-'}</Text>
              ),
            },
            ...(canApproveProductChanges && changeRequests.some((request) => request.status === 'PENDING_APPROVAL')
              ? [{
                  title: tProduct('changeRequests.columns.actions'),
                  key: 'actions',
                  width: 95,
                  render: (_: unknown, record: any) => (
                    record.status === 'PENDING_APPROVAL' ? (
                      <Space>
                        <Tooltip title={tProduct('changeRequests.approve')}>
                          <Button
                            type="text"
                            disabled={!record.approvalWorkflowRequestId && record.requestedByUsername === currentUsername && !['ADMIN', 'SUPER ADMIN', 'SUPER_ADMIN'].includes(currentRoleName)}
                            icon={<CheckCircleOutlined style={{ color: token.colorSuccess }} />}
                            onClick={() => handleApproveChange(record)}
                          />
                        </Tooltip>
                        <Tooltip title={tProduct('changeRequests.reject')}>
                          <Button type="text" icon={<CloseCircleOutlined style={{ color: token.colorError }} />} onClick={() => handleRejectChange(record)} />
                        </Tooltip>
                      </Space>
                    ) : null
                  ),
                }]
              : []),
          ]}
        />
      </Drawer>
      )}

      <ProductModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        fetchData={fetchProducts}
        dataUpdate={dataUpdate}
        categories={categories}
      />

      <AdjustmentModal
        isOpen={isAdjOpen}
        setIsOpen={setIsAdjOpen}
        product={productForAdj}
        fetchData={fetchProducts}
      />

      {hasMounted && (
        <Drawer
          title={(
            <Space>
              <HistoryOutlined />
              <span>Lịch sử kho</span>
              {productForLedger ? <Tag color="blue">{productForLedger.sku}</Tag> : null}
            </Space>
          )}
          placement="right"
          open={isLedgerDrawerOpen}
          size={980}
          onClose={() => setIsLedgerDrawerOpen(false)}
          extra={(
            <Button
              icon={<ReloadOutlined />}
              onClick={() => productForLedger && fetchProductLedger(productForLedger)}
              disabled={!productForLedger}
            >
              Tải lại
            </Button>
          )}
        >
          {productForLedger ? (
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Card variant="borderless" style={{ background: token.colorFillQuaternary }}>
                <Space orientation="vertical" size={2}>
                  <Text strong>{productForLedger.vietnameseName || productForLedger.englishName || productForLedger.sku}</Text>
                  <Text type="secondary">
                    Tồn hiện tại: <Text strong>{formatLedgerNumber(productForLedger.currentStock)}</Text>
                    {' '}· SKU: {productForLedger.sku}
                  </Text>
                </Space>
              </Card>
              <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                <RangePicker
                  allowClear
                  format="DD/MM/YYYY"
                  placeholder={['Từ ngày', 'Đến ngày']}
                  value={ledgerDateRange}
                  onChange={(dates) => {
                    setLedgerDateRange(dates && dates[0] && dates[1] ? [dates[0], dates[1]] : null);
                  }}
                  style={{ width: 280, maxWidth: '100%' }}
                />
                <Text type="secondary">
                  Hiển thị {filteredLedgerRows.length}/{ledgerRows.length} dòng
                </Text>
              </Space>
              <Table<ProductInventoryLedger>
                rowKey="_id"
                size="small"
                loading={isFetchingLedger}
                columns={ledgerColumns}
                dataSource={filteredLedgerRows}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                scroll={{ x: 1440 }}
              />
            </Space>
          ) : null}
        </Drawer>
      )}
    </>
  );
};

export default ProductTable;
