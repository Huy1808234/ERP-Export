'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Table, Tag, Space, Button, Input, Card, Badge,
  Typography, Divider, Tooltip, Row, Col, Statistic,
  Dropdown, Drawer, Avatar, notification, Popconfirm, Tabs, theme, Select, Form, Empty, Skeleton
} from 'antd';
import {
  PlusOutlined, SearchOutlined, FilterOutlined,
  ExportOutlined, HistoryOutlined, EditOutlined,
  DeleteOutlined, MoreOutlined, GlobalOutlined,
  TeamOutlined, WarningOutlined,
  ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined,
  LockOutlined, EyeOutlined, FileTextOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { Progress } from 'antd'; // Add Progress component
import { useSession } from 'next-auth/react';
import { useTheme } from '@/context/theme.context';
import { backendFetch, sendRequest } from '@/lib/api-client';
import { GLOBAL_EXCHANGE_RATE } from '@/constants/currency.config';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCurrency } from '@/hooks/useCurrency';
import { useHasMounted } from '@/hooks/useHasMounted';
import PartnerCreateModal from './partner.create';
import PartnerUpdateModal from './partner.update';
import QuotationDetailModal from '../quotation/quotation.detail';
import ProformaInvoiceDetailModal from '../proforma-invoice/pi.detail';
import PurchaseOrderDetailModal from '../purchase-order/purchase-order.detail';
import VendorInvoiceDetailModal from '../vendor-invoice/vendor-invoice.detail';
import ShipmentDetailDrawer from '../shipment/shipment.detail';
import type { ColumnsType } from 'antd/es/table';
import type { IVendorInvoice } from '@/types/vendor-invoice';
import { getAccessToken } from '@/lib/auth-token';
import { buildCountryOptions, buildRegionOptions } from '@/constants/geo';

const { Title, Text } = Typography;

// --- 1. Định nghĩa Interfaces chuẩn ---
interface IPartner {
  _id: string;
  name: string;
  partnerType: 'CUSTOMER' | 'SUPPLIER' | 'LOGISTICS';
  country: string;
  region: string;
  taxCode: string;
  defaultPaymentTerm: string;
  defaultCurrency: string;
  creditLimit: number;
  currentDebt: number; // Accounts Receivable (Khách nợ mình)
  apBalance?: number;   // Accounts Payable (Mình nợ NCC)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  isActive: boolean;
  creditCurrency?: string;
  // NCC/Logistics Scores
  qualityScore?: number;
  deliveryScore?: number;
  priceScore?: number;
  vendorCategory?: string;
  isManualRisk?: boolean;
  manualRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface IMeta {
  current: number;
  pageSize: number;
  total: number;
}

type PartnerListResponse = {
  results: IPartner[];
  totalItems: number;
};

type HistoryDateRange = 'ALL' | '30_DAYS' | 'THIS_YEAR';

type PartnerHistoryCollection<TItem> = {
  total: number;
  items: TItem[];
};

type PartnerHistoryPartner = Pick<IPartner, '_id' | 'name' | 'partnerType' | 'defaultCurrency' | 'apBalance'>;

type PartnerHistoryDateFields = {
  createdAt?: string | Date;
  updatedAt?: string | Date;
  orderDate?: string | Date;
  invoiceDate?: string | Date;
  dueDate?: string | Date;
  etd?: string | Date;
};

type PartnerHistoryDocumentBase = PartnerHistoryDateFields & {
  _id: string;
  status?: string;
  currency?: string;
  totalAmount?: number | string;
  amount?: number | string;
  paidAmount?: number | string;
};

type PartnerHistoryQuotation = PartnerHistoryDocumentBase & {
  quotationNumber?: string;
};

type PartnerHistoryProformaInvoice = PartnerHistoryDocumentBase & {
  piNumber?: string;
};

type PartnerHistoryPurchaseOrder = PartnerHistoryDocumentBase & {
  poNumber?: string;
  items?: unknown[];
};

type PartnerHistoryVendorInvoice = PartnerHistoryDocumentBase & {
  invoiceNumber?: string;
  purchaseOrderId?: string;
  taxRate?: number;
  taxAmount?: number;
  note?: string;
  attachments?: string[];
  purchaseOrder?: {
    _id?: string;
    poNumber?: string;
    totalAmount?: number;
  };
};

type PartnerHistoryShipment = PartnerHistoryDocumentBase & {
  shipmentNumber?: string;
  blNumber?: string;
};

type PartnerHistoryPayable = PartnerHistoryDocumentBase & {
  invoiceNumber?: string;
};

type PartnerHistoryPayableSummary = {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  openCount: number;
  overdueCount: number;
};

type PartnerHistoryResponse = {
  partner: PartnerHistoryPartner;
  quotations: PartnerHistoryCollection<PartnerHistoryQuotation>;
  proformaInvoices: PartnerHistoryCollection<PartnerHistoryProformaInvoice>;
  shipments: PartnerHistoryCollection<PartnerHistoryShipment>;
  purchaseOrders: PartnerHistoryCollection<PartnerHistoryPurchaseOrder>;
  vendorInvoices: PartnerHistoryCollection<PartnerHistoryVendorInvoice>;
  payables: PartnerHistoryCollection<PartnerHistoryPayable> & {
    summary: PartnerHistoryPayableSummary;
  };
  lastActivityAt?: string | Date | null;
};

type PartnerHistoryDocumentDetail =
  | { type: 'quotation'; recordRef: string }
  | { type: 'proformaInvoice'; record: PartnerHistoryProformaInvoice }
  | { type: 'purchaseOrder'; recordRef: string }
  | { type: 'vendorInvoice'; record: PartnerHistoryVendorInvoice }
  | { type: 'shipment'; recordRef: string }
  | null;

type PartnerFilters = Partial<Pick<IPartner, 'country' | 'isActive' | 'partnerType' | 'region' | 'riskLevel'>>;
type PartnerSortField = 'balance' | 'name' | 'partnerType' | 'updatedAt';
type PartnerSortOrder = 'ascend' | 'descend';
type PartnerSortConfig = {
  field: PartnerSortField;
  order: PartnerSortOrder;
};
type PartnerTableProps = {
  linkedPartnerRef?: string;
  linkedPartnerType?: string;
};

const DEFAULT_PARTNER_SORT: PartnerSortConfig = {
  field: 'updatedAt',
  order: 'descend',
};

const PARTNER_HISTORY_DRAWER_DEFAULT_SIZE = 560;
const PARTNER_HISTORY_DRAWER_MIN_SIZE = 420;
const PARTNER_HISTORY_DRAWER_MAX_SIZE = 960;

const getPartnerHistoryDrawerMaxSize = (): number => {
  if (typeof window === 'undefined') {
    return PARTNER_HISTORY_DRAWER_MAX_SIZE;
  }

  return Math.max(360, Math.min(PARTNER_HISTORY_DRAWER_MAX_SIZE, window.innerWidth - 16));
};

const clampPartnerHistoryDrawerSize = (size: number): number => {
  const maxSize = getPartnerHistoryDrawerMaxSize();
  const minSize = Math.min(PARTNER_HISTORY_DRAWER_MIN_SIZE, maxSize);

  return Math.max(minSize, Math.min(size, maxSize));
};

const cleanPartnerFilters = (values: PartnerFilters): PartnerFilters => {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as PartnerFilters;
};

const toPartnerTypeFilter = (value?: string): IPartner['partnerType'] | null => {
  if (value === 'CUSTOMER' || value === 'SUPPLIER' || value === 'LOGISTICS') {
    return value;
  }

  return null;
};

const getHistoryStatusColor = (status?: string): string => {
  const normalizedStatus = status?.toUpperCase();

  switch (normalizedStatus) {
    case 'COMPLETED':
    case 'CONVERTED':
    case 'ACCEPTED':
    case 'APPROVED':
    case 'RECEIVED':
    case 'PAID':
    case 'ARRIVED':
      return 'success';
    case 'SENT':
    case 'PARTIAL':
    case 'PARTIAL_RECEIPT':
    case 'CUSTOMS_CLEARED':
    case 'ON_BOARD':
      return 'processing';
    case 'PENDING':
    case 'PENDING_APPROVAL':
    case 'LOADING':
      return 'warning';
    case 'CANCELLED':
    case 'CANCELED':
    case 'REJECTED':
    case 'EXPIRED':
    case 'VOID':
    case 'OVERDUE':
      return 'error';
    case 'CLOSED':
      return 'purple';
    default:
      return 'default';
  }
};

const toDate = (value?: string | Date): Date | null => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getHistoryDocumentDate = (item: PartnerHistoryDateFields): Date | null => (
  toDate(item.updatedAt)
  ?? toDate(item.createdAt)
  ?? toDate(item.orderDate)
  ?? toDate(item.invoiceDate)
  ?? toDate(item.etd)
  ?? toDate(item.dueDate)
);

const isWithinHistoryDateRange = (item: PartnerHistoryDateFields, range: HistoryDateRange): boolean => {
  if (range === 'ALL') return true;

  const documentDate = getHistoryDocumentDate(item);
  if (!documentDate) return false;

  const now = new Date();
  if (range === 'THIS_YEAR') {
    return documentDate.getFullYear() === now.getFullYear();
  }

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  return documentDate >= thirtyDaysAgo;
};

const filterHistoryItems = <TItem extends PartnerHistoryDateFields>(
  items: TItem[],
  searchText: string,
  dateRange: HistoryDateRange,
  getSearchValues: (item: TItem) => Array<string | number | null | undefined>,
): TItem[] => {
  const normalizedSearchText = searchText.trim().toLowerCase();

  return items.filter((item) => {
    if (!isWithinHistoryDateRange(item, dateRange)) return false;
    if (!normalizedSearchText) return true;

    return getSearchValues(item)
      .some((value) => String(value ?? '').toLowerCase().includes(normalizedSearchText));
  });
};

const toPartnerSortField = (value: unknown): PartnerSortField | null => {
  if (value === 'balance' || value === 'name' || value === 'partnerType' || value === 'updatedAt') {
    return value;
  }

  return null;
};

const toPartnerSortConfig = (sorter: unknown): PartnerSortConfig => {
  if (!sorter || Array.isArray(sorter)) return DEFAULT_PARTNER_SORT;

  const sortRecord = sorter as { columnKey?: unknown; field?: unknown; order?: unknown };
  if (sortRecord.order !== 'ascend' && sortRecord.order !== 'descend') {
    return DEFAULT_PARTNER_SORT;
  }

  const field = toPartnerSortField(sortRecord.columnKey) ?? toPartnerSortField(sortRecord.field);
  if (!field) return DEFAULT_PARTNER_SORT;

  return {
    field,
    order: sortRecord.order,
  };
};

const PartnerTable = ({ linkedPartnerRef, linkedPartnerType }: PartnerTableProps) => {
  const { data: session } = useSession();
  const [api, contextHolder] = notification.useNotification();
  const accessToken = getAccessToken(session);
  const t = useTranslations('Partner');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const regionOptions = useMemo(() => buildRegionOptions(t), [t]);
  const countryOptions = useMemo(() => buildCountryOptions(locale), [locale]);
  const router = useRouter();
  const hasMounted = useHasMounted();
  const linkedPartnerTypeFilter = useMemo(() => toPartnerTypeFilter(linkedPartnerType), [linkedPartnerType]);

  // --- States ---
  const [partners, setPartners] = useState<IPartner[]>([]);
  const [meta, setMeta] = useState<IMeta>({ current: 1, pageSize: 10, total: 0 });
  const [isFetching, setIsFetching] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
      setMeta(prev => ({ ...prev, current: 1 }));
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [searchText]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [dataUpdate, setDataUpdate] = useState<IPartner | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<PartnerHistoryResponse | null>(null);
  const [historyDrawerSize, setHistoryDrawerSize] = useState(PARTNER_HISTORY_DRAWER_DEFAULT_SIZE);
  const [openedPartnerRef, setOpenedPartnerRef] = useState<string | null>(null);
  const [historySearchText, setHistorySearchText] = useState('');
  const [historyDateRange, setHistoryDateRange] = useState<HistoryDateRange>('ALL');
  const [historyDocumentDetail, setHistoryDocumentDetail] = useState<PartnerHistoryDocumentDetail>(null);

  const handleHistoryDrawerResize = useCallback((nextSize: number) => {
    setHistoryDrawerSize(clampPartnerHistoryDrawerSize(nextSize));
  }, []);

  // --- Advanced Filter States ---
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterForm] = Form.useForm();
  const [filters, setFilters] = useState<PartnerFilters>(() => (
    linkedPartnerTypeFilter ? { partnerType: linkedPartnerTypeFilter } : {}
  ));
  const activeFilterCount = Object.keys(filters).length;
  const [sortConfig, setSortConfig] = useState<PartnerSortConfig>(DEFAULT_PARTNER_SORT);

  // --- 2. Logic Fetch Dữ liệu (useCallback để tối ưu) ---
  const { formatMoney, formatVND } = useCurrency();
  const { token } = theme.useToken();
  const { isDark } = useTheme();

  const { current, pageSize } = meta;

  const fetchPartners = useCallback(async () => {
    if (!accessToken) return;
    setIsFetching(true);
    try {
      // Build sort string for backend (e.g., "name,asc" or "-currentDebt")
      let sortStr: string = sortConfig.field;
      if (sortConfig.order === 'descend') sortStr = `-${sortStr}`;
      const activeFilters = cleanPartnerFilters(filters);

      const res = await sendRequest<IBackendRes<PartnerListResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
        method: 'GET',
        queryParams: {
          current,
          pageSize,
          sort: sortStr,
          ...(debouncedSearchText ? { search: debouncedSearchText } : {}),
          ...activeFilters
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const partnerList = res?.data;
      if (partnerList) {
        setPartners(partnerList.results);
        setMeta(prev => ({ ...prev, total: partnerList.totalItems }));
      }
    } finally {
      setIsFetching(false);
    }
  }, [current, pageSize, debouncedSearchText, filters, sortConfig, accessToken]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  useEffect(() => {
    if (!linkedPartnerTypeFilter) return;

    filterForm.setFieldsValue({ partnerType: linkedPartnerTypeFilter });
    setFilters((currentFilters) => {
      if (currentFilters.partnerType === linkedPartnerTypeFilter) {
        return currentFilters;
      }

      return cleanPartnerFilters({ ...currentFilters, partnerType: linkedPartnerTypeFilter });
    });
    setMeta(prev => ({ ...prev, current: 1 }));
  }, [filterForm, linkedPartnerTypeFilter]);

  useEffect(() => {
    const handleWindowResize = () => {
      setHistoryDrawerSize((currentSize) => clampPartnerHistoryDrawerSize(currentSize));
    };

    handleWindowResize();
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // --- 3. Hành động (Actions) ---
  const confirmDelete = useCallback(async (id: string) => {
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners/${id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res?.data) {
      notification.success({ title: t('notifications.deleteSuccess') });
      fetchPartners();
    } else {
      notification.error({ title: t('notifications.errorTitle'), description: res?.message });
    }
  }, [accessToken, t, fetchPartners]);

  const openHistoryByRef = useCallback(async (partnerRef: string): Promise<boolean> => {
    if (!accessToken) return false;

    setHistorySearchText('');
    setHistoryDateRange('ALL');
    setHistoryDocumentDetail(null);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryData(null);
    try {
      const res = await sendRequest<IBackendRes<PartnerHistoryResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners/${partnerRef}/history`,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        setHistoryData(res.data);
        return true;
      }

      setHistoryOpen(false);
      return false;
    } finally {
      setHistoryLoading(false);
    }
  }, [accessToken]);

  const closeHistoryDrawer = useCallback(() => {
    setHistoryOpen(false);
    setHistoryDocumentDetail(null);
  }, []);

  const openHistory = useCallback(async (record: IPartner) => {
    await openHistoryByRef(record._id);
  }, [openHistoryByRef]);

  useEffect(() => {
    if (!accessToken || !linkedPartnerRef || openedPartnerRef === linkedPartnerRef) return;

    let cancelled = false;

    const openLinkedPartner = async (): Promise<void> => {
      await openHistoryByRef(linkedPartnerRef);
      if (!cancelled) {
        setOpenedPartnerRef(linkedPartnerRef);
      }
    };

    void openLinkedPartner();

    return () => {
      cancelled = true;
    };
  }, [accessToken, linkedPartnerRef, openedPartnerRef, openHistoryByRef]);

  const historyDateLocale = locale === 'vi' ? 'vi-VN' : 'en-US';

  const formatHistoryDate = useCallback((value?: string | Date): string => {
    const date = toDate(value);
    return date ? date.toLocaleDateString(historyDateLocale) : tCommon('noData');
  }, [historyDateLocale, tCommon]);

  const openDashboardModule = useCallback((modulePath: string) => {
    router.push(`/${locale}${modulePath}`);
  }, [locale, router]);

  const refreshDocumentDetail = useCallback(() => undefined, []);

  const toVendorInvoiceDetailRecord = useCallback((record: PartnerHistoryVendorInvoice): IVendorInvoice => {
    const partner = historyData?.partner;
    const vendorInvoiceStatus = record.status === 'PAID' || record.status === 'CANCELLED' ? record.status : 'PENDING';
    const invoiceDate = toDate(record.invoiceDate ?? record.createdAt ?? record.updatedAt)?.toISOString() ?? new Date().toISOString();

    return {
      _id: record._id,
      invoiceNumber: record.invoiceNumber ?? record._id,
      purchaseOrderId: record.purchaseOrderId ?? record.purchaseOrder?._id ?? '',
      purchaseOrder: {
        _id: record.purchaseOrder?._id ?? '',
        poNumber: record.purchaseOrder?.poNumber ?? '',
        totalAmount: Number(record.purchaseOrder?.totalAmount ?? 0),
      },
      vendorId: partner?._id ?? '',
      vendor: {
        _id: partner?._id ?? '',
        name: partner?.name ?? '',
      },
      invoiceDate,
      dueDate: record.dueDate ? String(record.dueDate) : undefined,
      amount: Number(record.amount ?? record.totalAmount ?? 0),
      taxRate: record.taxRate,
      taxAmount: Number(record.taxAmount ?? 0),
      totalAmount: Number(record.totalAmount ?? record.amount ?? 0),
      currency: record.currency ?? partner?.defaultCurrency ?? 'VND',
      status: vendorInvoiceStatus,
      note: record.note,
      attachments: record.attachments,
      createdAt: String(record.createdAt ?? invoiceDate),
    };
  }, [historyData?.partner]);

  const renderHistoryControls = () => (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      <Col xs={24} md={14}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder={t('history.searchPlaceholder')}
          value={historySearchText}
          onChange={(event) => setHistorySearchText(event.target.value)}
        />
      </Col>
      <Col xs={24} md={10}>
        <Select
          value={historyDateRange}
          onChange={setHistoryDateRange}
          style={{ width: '100%' }}
          options={[
            { value: 'ALL', label: t('history.periodAll') },
            { value: '30_DAYS', label: t('history.period30Days') },
            { value: 'THIS_YEAR', label: t('history.periodThisYear') },
          ]}
        />
      </Col>
    </Row>
  );

  const renderHistoryStatusBadge = (status?: string) => (
    status ? (
      <Tag color={getHistoryStatusColor(status)} style={{ borderRadius: 4, fontSize: 10, marginInlineEnd: 0 }}>
        {status}
      </Tag>
    ) : null
  );

  const renderHistoryList = <TItem extends PartnerHistoryDocumentBase,>({
    items,
    total,
    emptyDescription,
    modulePath,
    createLabel,
    titleOf,
    metaOf,
    amountOf,
    searchValuesOf,
    onOpen,
  }: {
    items: TItem[];
    total: number;
    emptyDescription: string;
    modulePath: string;
    createLabel?: string;
    titleOf: (item: TItem) => string;
    metaOf: (item: TItem) => React.ReactNode;
    amountOf?: (item: TItem) => React.ReactNode;
    searchValuesOf: (item: TItem) => Array<string | number | null | undefined>;
    onOpen?: (item: TItem) => void;
  }) => {
    const filteredItems = filterHistoryItems(items, historySearchText, historyDateRange, searchValuesOf);
    const hasActiveFilter = historySearchText.trim().length > 0 || historyDateRange !== 'ALL';
    const emptyText = hasActiveFilter ? t('history.noMatch') : emptyDescription;
    const summaryText = hasActiveFilter
      ? t('history.filteredSummary', { shown: filteredItems.length, loaded: items.length })
      : t('history.recentSummary', { shown: items.length, total });

    if (filteredItems.length === 0) {
      return (
        <Empty description={emptyText} style={{ padding: '28px 0' }}>
          <Space wrap>
            <Button icon={<FileTextOutlined />} onClick={() => openDashboardModule(modulePath)}>
              {t('history.viewAll')}
            </Button>
            {createLabel ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openDashboardModule(modulePath)}>
                {createLabel}
              </Button>
            ) : null}
          </Space>
        </Empty>
      );
    }

    return (
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {filteredItems.map((item) => {
          const canOpen = Boolean(onOpen);
          const openRecord = () => onOpen?.(item);

          return (
            <div
              key={item._id}
              className="partner-history-document-card"
              role={canOpen ? 'button' : undefined}
              tabIndex={canOpen ? 0 : undefined}
              onClick={canOpen ? openRecord : undefined}
              onKeyDown={(event) => {
                if (!canOpen) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openRecord();
                }
              }}
              style={{
                padding: 16,
                background: isDark ? '#1e293b' : '#f8f9fa',
                borderRadius: 12,
                border: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                cursor: canOpen ? 'pointer' : 'default',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <Space size={8} wrap style={{ marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 14 }}>{titleOf(item)}</Text>
                  {renderHistoryStatusBadge(item.status)}
                </Space>
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {metaOf(item)}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 150 }}>
                {amountOf ? amountOf(item) : null}
                {canOpen ? (
                  <div style={{ marginTop: 6 }}>
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={(event) => {
                        event.stopPropagation();
                        openRecord();
                      }}
                    >
                      {t('history.openDetail')}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          paddingTop: 4,
        }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{summaryText}</Text>
          <Button size="small" icon={<FileTextOutlined />} onClick={() => openDashboardModule(modulePath)}>
            {t('history.viewAll')}
          </Button>
        </div>
      </Space>
    );
  };

  const renderHistoryTabs = () => {
    if (!historyData) return [];

    const partnerCurrency = historyData.partner.defaultCurrency ?? 'VND';

    if (historyData.partner.partnerType === 'SUPPLIER') {
      return [
        {
          key: 'purchaseOrders',
          label: `${t('history.purchaseOrders')} (${historyData.purchaseOrders.total})`,
          children: renderHistoryList<PartnerHistoryPurchaseOrder>({
            items: historyData.purchaseOrders.items,
            total: historyData.purchaseOrders.total,
            emptyDescription: t('history.noPurchaseOrders'),
            modulePath: '/dashboard/purchase-orders',
            createLabel: t('history.createPurchaseOrder'),
            titleOf: (item) => item.poNumber ?? item._id,
            metaOf: (item) => (
              <>
                {formatHistoryDate(item.orderDate ?? item.updatedAt)}
                {' · '}
                {(item.items ?? []).length} {t('history.items')}
              </>
            ),
            amountOf: (item) => (
              <Text strong style={{ color: token.colorSuccess, fontSize: 15 }}>
                {formatMoney(Number(item.totalAmount ?? 0), item.currency ?? partnerCurrency)}
              </Text>
            ),
            searchValuesOf: (item) => [item.poNumber, item.status, item.currency, item.totalAmount],
            onOpen: (item) => setHistoryDocumentDetail({ type: 'purchaseOrder', recordRef: item._id }),
          }),
        },
        {
          key: 'vendorInvoices',
          label: `${t('history.vendorInvoices')} (${historyData.vendorInvoices.total})`,
          children: renderHistoryList<PartnerHistoryVendorInvoice>({
            items: historyData.vendorInvoices.items,
            total: historyData.vendorInvoices.total,
            emptyDescription: t('history.noVendorInvoices'),
            modulePath: '/dashboard/vendor-invoice',
            createLabel: t('history.createVendorInvoice'),
            titleOf: (item) => item.invoiceNumber ?? item._id,
            metaOf: (item) => (
              <>
                {t('history.purchaseOrderRef')}: {item.purchaseOrder?.poNumber ?? item.purchaseOrderId ?? tCommon('noData')}
              </>
            ),
            amountOf: (item) => (
              <Text strong style={{ color: token.colorInfo, fontSize: 15 }}>
                {formatMoney(Number(item.totalAmount ?? item.amount ?? 0), item.currency ?? partnerCurrency)}
              </Text>
            ),
            searchValuesOf: (item) => [item.invoiceNumber, item.purchaseOrder?.poNumber, item.purchaseOrderId, item.status, item.currency],
            onOpen: (item) => setHistoryDocumentDetail({ type: 'vendorInvoice', record: item }),
          }),
        },
        {
          key: 'payables',
          label: `${t('history.payables')} (${historyData.payables.total})`,
          children: (
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Row gutter={12}>
                <Col span={12}>
                  <Statistic
                    title={t('history.remaining')}
                    value={historyData.payables.summary.remainingAmount}
                    formatter={(value) => formatMoney(Number(value), partnerCurrency)}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title={t('history.overdue')}
                    value={historyData.payables.summary.overdueCount}
                    styles={{ content: { color: token.colorError } }}
                  />
                </Col>
              </Row>
              {renderHistoryList<PartnerHistoryPayable>({
                items: historyData.payables.items,
                total: historyData.payables.total,
                emptyDescription: t('history.noPayables'),
                modulePath: '/dashboard/account-payables',
                titleOf: (item) => item.invoiceNumber ?? item._id,
                metaOf: (item) => (
                  <>
                    {t('history.dueDate')}: {formatHistoryDate(item.dueDate)}
                  </>
                ),
                amountOf: (item) => {
                  const remaining = Math.max(Number(item.amount ?? 0) - Number(item.paidAmount ?? 0), 0);
                  return (
                    <Text strong style={{ color: token.colorError, fontSize: 15 }}>
                      {formatMoney(remaining, item.currency ?? partnerCurrency)}
                    </Text>
                  );
                },
                searchValuesOf: (item) => [item.invoiceNumber, item.status, item.currency, item.amount],
                onOpen: () => openDashboardModule('/dashboard/account-payables'),
              })}
            </Space>
          ),
        },
      ];
    }

    if (historyData.partner.partnerType === 'LOGISTICS') {
      return [
        {
          key: 'shipments',
          label: `${t('history.shipments')} (${historyData.shipments.total})`,
          children: renderHistoryList<PartnerHistoryShipment>({
            items: historyData.shipments.items,
            total: historyData.shipments.total,
            emptyDescription: t('history.noShipments'),
            modulePath: '/dashboard/shipment',
            createLabel: t('history.createShipment'),
            titleOf: (item) => item.shipmentNumber ?? item._id,
            metaOf: (item) => (
              <>
                ETD: {formatHistoryDate(item.etd)}
                {' · '}
                B/L: {item.blNumber ?? tCommon('noData')}
              </>
            ),
            searchValuesOf: (item) => [item.shipmentNumber, item.blNumber, item.status],
            onOpen: (item) => setHistoryDocumentDetail({ type: 'shipment', recordRef: item._id }),
          }),
        },
        {
          key: 'payables',
          label: `${t('history.payables')} (${historyData.payables.total})`,
          children: (
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Statistic
                title={t('history.totalPayables')}
                value={historyData.payables.summary.remainingAmount || historyData.partner.apBalance || 0}
                formatter={(value) => formatMoney(Number(value), partnerCurrency)}
                styles={{ content: { color: token.colorError } }}
              />
              {renderHistoryList<PartnerHistoryPayable>({
                items: historyData.payables.items,
                total: historyData.payables.total,
                emptyDescription: t('history.noPayables'),
                modulePath: '/dashboard/account-payables',
                titleOf: (item) => item.invoiceNumber ?? item._id,
                metaOf: (item) => (
                  <>
                    {t('history.dueDate')}: {formatHistoryDate(item.dueDate)}
                  </>
                ),
                amountOf: (item) => {
                  const remaining = Math.max(Number(item.amount ?? 0) - Number(item.paidAmount ?? 0), 0);
                  return (
                    <Text strong style={{ color: token.colorError, fontSize: 15 }}>
                      {formatMoney(remaining, item.currency ?? partnerCurrency)}
                    </Text>
                  );
                },
                searchValuesOf: (item) => [item.invoiceNumber, item.status, item.currency, item.amount],
                onOpen: () => openDashboardModule('/dashboard/account-payables'),
              })}
            </Space>
          ),
        },
      ];
    }

    return [
      {
        key: 'quotations',
        label: `${t('history.quotations')} (${historyData.quotations.total})`,
        children: renderHistoryList<PartnerHistoryQuotation>({
          items: historyData.quotations.items,
          total: historyData.quotations.total,
          emptyDescription: t('history.noQuotations'),
          modulePath: '/dashboard/quotation',
          createLabel: t('history.createQuotation'),
          titleOf: (item) => item.quotationNumber ?? item._id,
          metaOf: (item) => formatHistoryDate(item.updatedAt ?? item.createdAt),
          amountOf: (item) => (
            <Text strong style={{ color: token.colorSuccess, fontSize: 15 }}>
              {formatMoney(Number(item.totalAmount ?? 0), item.currency ?? partnerCurrency)}
            </Text>
          ),
          searchValuesOf: (item) => [item.quotationNumber, item.status, item.currency, item.totalAmount],
          onOpen: (item) => setHistoryDocumentDetail({ type: 'quotation', recordRef: item._id }),
        }),
      },
      {
        key: 'proformaInvoices',
        label: `${t('history.piInvoices')} (${historyData.proformaInvoices.total})`,
        children: renderHistoryList<PartnerHistoryProformaInvoice>({
          items: historyData.proformaInvoices.items,
          total: historyData.proformaInvoices.total,
          emptyDescription: t('history.noPI'),
          modulePath: '/dashboard/proforma-invoice',
          createLabel: t('history.createPI'),
          titleOf: (item) => item.piNumber ?? item._id,
          metaOf: (item) => formatHistoryDate(item.updatedAt ?? item.createdAt),
          amountOf: (item) => (
            <Text strong style={{ color: token.colorInfo, fontSize: 15 }}>
              {formatMoney(Number(item.totalAmount ?? 0), item.currency ?? partnerCurrency)}
            </Text>
          ),
          searchValuesOf: (item) => [item.piNumber, item.status, item.currency, item.totalAmount],
          onOpen: (item) => setHistoryDocumentDetail({ type: 'proformaInvoice', record: item }),
        }),
      },
    ];
  };

  const handleResetFilters = () => {
    filterForm.resetFields();
    setFilters({});
    setMeta(prev => ({ ...prev, current: 1 }));
    setIsFilterOpen(false);
  };

  const onFilterFinish = (values: PartnerFilters) => {
    setFilters(cleanPartnerFilters(values));
    setMeta(prev => ({ ...prev, current: 1 }));
    setIsFilterOpen(false);
  };

  const handleExport = async () => {
    if (!accessToken) return;

    try {
      api.info({ title: t('notifications.preparingExcel'), placement: 'topRight' });

      const exportParams = {
        sort: sortConfig.order === 'descend' ? `-${sortConfig.field}` : sortConfig.field,
        ...(debouncedSearchText ? { search: debouncedSearchText } : {}),
        ...cleanPartnerFilters(filters)
      };
      const queryParams = new URLSearchParams(
        Object.entries(exportParams).map(([key, value]) => [key, String(value)]),
      );

      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners/export?${queryParams.toString()}`;

      const response = await backendFetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        const filename = locale === 'vi' ? 'DS_Doi_Tac' : 'Partner_List';
        a.download = `${filename}_${new Date().toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US').replace(/\//g, '-')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
        api.success({ title: t('notifications.exportSuccess'), placement: 'topRight' });
      } else {
        const errorData = await response.json();
        api.error({
          title: t('notifications.exportError'),
          description: errorData?.message || (locale === 'vi' ? 'Không thể tải file' : 'Could not download file'),
          placement: 'topRight'
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      api.error({ title: t('notifications.connectionError'), placement: 'topRight' });
    }
  };

  // --- 4. Cấu hình Columns (AntD 5 chuẩn chỉnh) ---
  const getSortOrder = useCallback((field: PartnerSortField) => (
    sortConfig.field === field ? sortConfig.order : null
  ), [sortConfig]);

  const columns: ColumnsType<IPartner> = useMemo(() => [
    {
      title: t('table.partner'),
      dataIndex: 'name',
      fixed: 'left',
      width: 280,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      sortOrder: getSortOrder('name'),
      render: (text: string, record: IPartner) => (
        <Space size="middle">
          <Avatar
            shape="square" size={42}
            style={{ backgroundColor: '#e6f7ff', color: '#1890ff', borderRadius: '8px', fontWeight: 'bold' }}
          >
            {text.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text strong style={{ fontSize: '14px' }}>{text}</Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              <GlobalOutlined /> {record.country || (locale === 'vi' ? 'Việt Nam' : 'Vietnam')}
              {record.region ? ` (${record.region})` : ''}
              {record.taxCode ? ` | ${t('table.taxCode')}: ${record.taxCode}` : ''}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: t('table.type'),
      dataIndex: 'partnerType',
      width: 150,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      sortOrder: getSortOrder('partnerType'),
      render: (type: string) => {
        let color = 'processing';
        let label = t('types.customer');

        if (type === 'SUPPLIER') {
          color = 'warning';
          label = t('types.supplier');
        } else if (type === 'LOGISTICS') {
          color = 'geekblue';
          label = t('types.logistics');
        }

        return (
          <Tag color={color} style={{ borderRadius: '20px', padding: '0 12px' }}>
            {label}
          </Tag>
        );
      },
    },
    {
      title: t('table.debt'),
      key: 'balance',
      width: 240,
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder: getSortOrder('balance'),
      render: (_: any, record: IPartner) => {
        const isBuyer = record.partnerType === 'CUSTOMER';
        const currency = record.defaultCurrency || 'USD';

        const isVnd = currency === 'VND';
        
        // Trust the API: Debt values are already converted to Partner's Currency by Backend
        const primaryBalance = isBuyer ? (record.currentDebt || 0) : (record.apBalance || 0); 
        const balanceVnd = isVnd ? primaryBalance : (primaryBalance * GLOBAL_EXCHANGE_RATE);
        
        const limit = record.creditLimit || 0;
        
        // Available Credit (Hạn mức còn lại)
        const availableCredit = limit > 0 ? Math.max(limit - primaryBalance, 0) : 0;
        const isOverLimit = limit > 0 && primaryBalance > limit;

        // Usage calculation (Both are in the same currency now)
        const rawUsage = limit > 0 ? (primaryBalance / limit) * 100 : 0;
        const usagePercent = Math.min(rawUsage, 100);
        
        // Professional Formatting: show < 0.01% for micro-debts
        let displayUsage: string;
        if (rawUsage > 0 && rawUsage < 0.01) {
          displayUsage = '< 0.01';
        } else if (rawUsage > 0 && rawUsage < 1) {
          displayUsage = rawUsage.toFixed(2);
        } else {
          displayUsage = Math.round(usagePercent).toString();
        }

        const balanceLabel = isBuyer ? t('debt.receivable') : t('debt.payable');

        // Traffic Light System (Hệ thống đèn tín hiệu rủi ro)
        let statusColor = token.colorSuccess;
        let statusText = t('debt.safe');
        if (isOverLimit) {
          statusColor = token.colorError;
          statusText = t('debt.overLimit');
        } else if (usagePercent > 90) {
          statusColor = token.colorError;
          statusText = t('debt.alarm');
        } else if (usagePercent > 60) {
          statusColor = token.colorWarning;
          statusText = t('debt.attention');
        }

        return (
          <div style={{ padding: '4px 0' }}>
            {/* 1. Debt Display */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <Text type="secondary" style={{ fontSize: '11px' }}>{balanceLabel}</Text>
              <Text strong style={{ fontSize: '13px', color: isOverLimit ? token.colorError : token.colorInfo }}>
                {formatMoney(primaryBalance, currency)}
              </Text>
            </div>

            {/* 2. Currency Conversion Hint (Only if primary is not VND) */}
            {!isVnd && primaryBalance > 0 && (
              <div style={{ textAlign: 'right', marginTop: -2 }}>
                <Text type="secondary" style={{ fontSize: '10px', fontStyle: 'italic' }}>
                  (~ {formatVND(balanceVnd)})
                </Text>
              </div>
            )}

            {/* 3. Credit Limit Logic (Buyer Only) */}
            {isBuyer && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px dashed ${isDark ? '#334155' : '#f0f0f0'}` }}>
                <Tooltip title={
                  <div style={{ padding: '4px' }}>
                    <div>{t('debt.limit')}: <b>{formatMoney(limit, currency)}</b></div>
                    <div>{t('debt.used')}: <b>{formatMoney(primaryBalance, currency)}</b></div>
                    <Divider style={{ margin: '4px 0', borderColor: 'rgba(255,255,255,0.2)' }} />
                    <div>{t('debt.available')}: <b style={{ color: '#52c41a' }}>{formatMoney(availableCredit, currency)}</b></div>
                  </div>
                }>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                     <Space size={4}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor }} />
                        <span style={{ fontSize: '10px', color: '#8c8c8c' }}>{t('debt.usage')}:</span>
                     </Space>
                     <Text strong style={{ fontSize: '11px', color: usagePercent > 90 ? token.colorError : undefined }}>
                        {displayUsage}%
                     </Text>
                  </div>
                  
                  <Progress
                    percent={usagePercent}
                    size={[100, 4] as any} // Narrower height for professional look
                    showInfo={false}
                    strokeColor={statusColor}
                    railColor={isDark ? '#303030' : '#f0f0f0'}
                  />

                  {limit > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                      <Text type="secondary" style={{ fontSize: '9px', textTransform: 'uppercase' }}>{statusText}</Text>
                      <Text style={{ fontSize: '9px', color: token.colorSuccess }}>
                        {t('debt.remaining')}: {formatMoney(availableCredit, currency)}
                      </Text>
                    </div>
                  )}
                </Tooltip>
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: t('table.risk'),
      key: 'risk',
      width: 220,
      render: (_: any, record: IPartner) => {
        if (record.partnerType === 'CUSTOMER') {
          const riskConfig = {
            LOW: { color: 'success', text: t('risk.low') },
            MEDIUM: { color: 'warning', text: t('risk.medium') },
            HIGH: { color: 'error', text: t('risk.high') }
          };
          const config = riskConfig[record.riskLevel] || riskConfig.LOW;
          return (
            <Space>
              <Tag color={config.color} style={{ borderRadius: '4px' }}>
                {config.text}
              </Tag>
              {record.isManualRisk && (
                <Tooltip title={t('risk.manualHint')}>
                  <LockOutlined style={{ color: token.colorTextDescription, fontSize: '12px' }} />
                </Tooltip>
              )}
            </Space>
          );
        }

        const scores = [record.qualityScore || 0, record.deliveryScore || 0, record.priceScore || 0];
        const hasScore = scores.some(s => s > 0);
        const avgScore = hasScore ? (scores.reduce((a, b) => a + b, 0) / 3) : 0;

        if (hasScore) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Tooltip title={`${t('risk.capacityScore')}: ${record.qualityScore} | ${t('risk.delivery')}: ${record.deliveryScore} | ${t('risk.price')}: ${record.priceScore}`}>
                <Tag color="cyan" style={{ width: 'fit-content' }}>
                  {t('risk.capacityScore')}: {avgScore.toFixed(1)}
                </Tag>
              </Tooltip>
              {record.vendorCategory && <Text type="secondary" style={{ fontSize: 11 }}>{t('risk.industry')}: {record.vendorCategory}</Text>}
            </div>
          );
        }

        return <Text type="secondary" italic style={{ fontSize: 12 }}>{t('risk.noAssessment')}</Text>;
      }
    },
    {
      title: t('table.status'),
      dataIndex: 'isActive',
      width: 120,
      render: (active: boolean) => (
        <Badge status={active ? 'success' : 'default'} text={active ? t('status.active') : t('status.inactive')} />
      )
    },
    {
      title: t('table.actions'),
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_: any, record: IPartner) => (
        <Space size="small">
          <Tooltip title={tCommon('edit')}>
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#1890ff' }} />}
              onClick={() => { setDataUpdate(record); setIsUpdateModalOpen(true); }}
            />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                { key: '1', icon: <HistoryOutlined />, label: t('table.history'), onClick: () => openHistory(record) },
                {
                  key: '2',
                  icon: <DeleteOutlined />,
                  label: (
                    <Popconfirm
                      title={t('notifications.confirmDelete')}
                      onConfirm={() => confirmDelete(record._id)}
                      okText={tCommon('delete')}
                      cancelText={tCommon('cancel')}
                      okButtonProps={{ danger: true }}
                    >
                      <span style={{ color: token.colorError }}>{tCommon('delete')}</span>
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
  ], [
    confirmDelete,
    formatMoney,
    formatVND,
    getSortOrder,
    isDark,
    locale,
    openHistory,
    t,
    tCommon,
    token,
  ]);

  return (
    <div style={{
      backgroundColor: 'transparent',
      transition: 'all 0.3s ease'
    }}>
      {contextHolder}

      {/* 1. Header Section */}
      <Row justify="space-between" align="bottom" style={{ marginBottom: '24px' }}>
        <Col>
          <PageHeader
            title={t('title')}
            icon={<TeamOutlined />}
            description={t('subtitle')}
          />
          <Text type="secondary">{t('systemDescription')}</Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ExportOutlined />}
              size="large"
              style={{ borderRadius: '8px' }}
              onClick={handleExport}
            >
              {t('exportExcel')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => setIsCreateModalOpen(true)}
              style={{ borderRadius: '8px', height: '40px' }}
            >
              {t('addPartner')}
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 2. Dashboard Stats Cards */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>{t('stats.totalPartners')}</Text>}
              value={meta.total}
              prefix={<TeamOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />}
              styles={{ content: { color: isDark ? '#f8fafc' : undefined } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>{t('stats.receivable')}</Text>}
              value={partners.filter(p => p.partnerType === 'CUSTOMER').reduce((sum, p) => {
                const currency = p.defaultCurrency || 'USD';
                const amount = p.currentDebt || 0;
                const amountVnd = currency === 'VND' ? amount : (amount * GLOBAL_EXCHANGE_RATE);
                return sum + amountVnd;
              }, 0)}
              formatter={(val) => new Intl.NumberFormat('vi-VN').format(Number(val))}
              styles={{ content: { color: '#52c41a', fontSize: '20px' } }}
              prefix={<ArrowDownOutlined style={{ color: '#52c41a' }} />}
              suffix={<Text type="secondary" style={{ fontSize: 12, marginLeft: 4, color: isDark ? '#64748b' : undefined }}>₫</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>{t('stats.payable')}</Text>}
              value={partners.filter(p => p.partnerType !== 'CUSTOMER').reduce((sum, p) => {
                const actualCurrency = p.defaultCurrency || (p.partnerType === 'SUPPLIER' ? 'USD' : 'VND');
                const amount = p.apBalance || 0;
                const amountVnd = actualCurrency === 'VND' ? amount : (amount * GLOBAL_EXCHANGE_RATE);
                return sum + amountVnd;
              }, 0)}
              formatter={(val) => new Intl.NumberFormat('vi-VN').format(Number(val))}
              styles={{ content: { color: '#fa8c16', fontSize: '20px' } }}
              prefix={<ArrowUpOutlined style={{ color: '#fa8c16' }} />}
              suffix={<Text type="secondary" style={{ fontSize: 12, marginLeft: 4, color: isDark ? '#64748b' : undefined }}>₫</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>{t('stats.riskWarning')}</Text>}
              value={partners.filter(p => p.riskLevel === 'HIGH').length}
              styles={{ content: { color: '#cf1322' } }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 3. Main Data Section */}
      <Card
        variant="borderless"
        style={{
          borderRadius: '12px',
          background: isDark ? '#1e293b' : token.colorBgContainer,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)'
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between' }}>
          <Space size="large">
            <Input
              placeholder={t('table.searchPlaceholder')}
              prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setMeta(prev => ({ ...prev, current: 1 }));
              }}
              style={{ width: 400 }}
              size="large"
              allowClear
            />
            <Button
              icon={<FilterOutlined />}
              size="large"
              onClick={() => setIsFilterOpen(true)}
              type={activeFilterCount > 0 ? "primary" : "default"}
            >
              {t('table.advancedFilter')} {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              size="large"
              onClick={fetchPartners}
            />
          </Space>

          {selectedRowKeys.length > 0 && (
            <Space>
              <span style={{ color: token.colorTextSecondary }}>{t('table.selectedCount', { count: selectedRowKeys.length })}</span>
              <Popconfirm
                title={t('table.confirmBulkDelete', { count: selectedRowKeys.length })}
                onConfirm={async () => {
                  const res = await sendRequest<IBackendRes<any>>({
                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners/bulk-delete`,
                    method: 'POST',
                    body: { ids: selectedRowKeys },
                    headers: { Authorization: `Bearer ${accessToken}` },
                  });
                  if (res?.data) {
                    api.success({ title: tCommon('success'), description: res.message });
                    setSelectedRowKeys([]);
                    fetchPartners();
                  }
                }}
                okText={t('table.bulkDelete')}
                cancelText={t('table.reset')}
                okButtonProps={{ danger: true }}
              >
                <Button danger type="primary" icon={<DeleteOutlined />}>{t('table.bulkDelete')}</Button>
              </Popconfirm>
            </Space>
          )}
        </div>

        <div className="premium-table">
          <Table
            rowKey={(record: any) => record._id || record.code || record.taxCode}
            columns={columns}
            dataSource={partners}
            loading={isFetching}
            scroll={{ x: 1300 }}
            bordered={false}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            onChange={(pagination, _tableFilters, sorter, extra) => {
              const nextSortConfig = toPartnerSortConfig(sorter);

              setMeta(prev => ({
                ...prev,
                current: extra.action === 'sort' ? 1 : pagination.current || 1,
                pageSize: pagination.pageSize || 10
              }));

              setSortConfig(nextSortConfig);
            }}
            pagination={{
              current: meta.current,
              pageSize: meta.pageSize,
              total: meta.total,
              showSizeChanger: true,
              showTotal: (total) => t('table.totalCount', { total }),
            }}
          />
        </div>
      </Card>

      {/* 4. Modals & Drawer */}
      <PartnerCreateModal
        isCreateModalOpen={isCreateModalOpen}
        setIsCreateModalOpen={setIsCreateModalOpen}
        fetchPartners={fetchPartners}
      />

      {dataUpdate && (
        <PartnerUpdateModal
          isUpdateModalOpen={isUpdateModalOpen}
          setIsUpdateModalOpen={setIsUpdateModalOpen}
          fetchPartners={fetchPartners}
          dataUpdate={dataUpdate}
          setDataUpdate={setDataUpdate}
        />
      )}

      <Drawer
        title={
          <Space>
            <FilterOutlined />
            <span>{t('table.advancedFilter').toUpperCase()}</span>
          </Space>
        }
        placement="right"
        onClose={() => setIsFilterOpen(false)}
        open={isFilterOpen}
        size="default"
        forceRender={hasMounted}
        extra={
          <Space>
            <Button onClick={handleResetFilters}>{t('table.reset')}</Button>
            <Button type="primary" onClick={() => filterForm.submit()}>{t('table.apply')}</Button>
          </Space>
        }
      >
        <Form
          form={filterForm}
          layout="vertical"
          onFinish={onFilterFinish}
          initialValues={filters}
        >
          <Form.Item label={t('table.partnerType')} name="partnerType">
            <Select
              allowClear
              disabled={!!linkedPartnerTypeFilter}
              placeholder={t('table.allTypes')}
              options={[
                { value: 'CUSTOMER', label: `${t('types.customer')} (Buyer)` },
                { value: 'SUPPLIER', label: `${t('types.supplier')} (Vendor)` },
                { value: 'LOGISTICS', label: t('types.logistics') },
              ]}
            />
          </Form.Item>

          <Form.Item label={t('table.region')} name="region">
            <Select
              allowClear
              placeholder={t('table.allRegions')}
              options={regionOptions}
            />
          </Form.Item>

          <Form.Item label={t('table.riskLevel')} name="riskLevel">
            <Select
              allowClear
              placeholder={t('table.allRisks')}
              options={[
                { value: 'LOW', label: t('risk.low') },
                { value: 'MEDIUM', label: t('risk.medium') },
                { value: 'HIGH', label: t('risk.high') },
              ]}
            />
          </Form.Item>

          <Form.Item label={t('table.activeStatus')} name="isActive">
            <Select
              allowClear
              placeholder={t('table.allStatus')}
              options={[
                { value: true, label: t('status.active') },
                { value: false, label: t('status.inactive') },
              ]}
            />
          </Form.Item>

          <Divider />

          <Form.Item label={t('table.country')} name="country">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={countryOptions}
              placeholder={t('form.placeholders.country')}
            />
          </Form.Item>

        </Form>
      </Drawer>

      <Drawer
        title={<Space><HistoryOutlined /> {t('table.historyTitle')}</Space>}
        size={historyDrawerSize}
        defaultSize={PARTNER_HISTORY_DRAWER_DEFAULT_SIZE}
        maxSize={PARTNER_HISTORY_DRAWER_MAX_SIZE}
        resizable={{
          onResize: handleHistoryDrawerResize,
          onResizeEnd: () => {
            setHistoryDrawerSize((currentSize) => clampPartnerHistoryDrawerSize(currentSize));
          },
        }}
        onClose={closeHistoryDrawer}
        open={historyOpen}
        destroyOnHidden
        styles={{ dragger: { width: 10, background: 'transparent' } }}
      >
        {historyLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : historyData ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Title level={4} style={{ marginBottom: 4 }}>{historyData.partner.name}</Title>
              <Text type="secondary">{t('history.subtitle')}</Text>
              {historyData.lastActivityAt ? (
                <div style={{ marginTop: 6 }}>
                  <Tag color="blue">{t('history.lastActivity')}: {formatHistoryDate(historyData.lastActivityAt)}</Tag>
                </div>
              ) : null}
            </div>
            <Divider style={{ margin: '4px 0' }} />
            {renderHistoryControls()}
            <Tabs items={renderHistoryTabs()} />
          </Space>
        ) : (
          <Empty description={tCommon('noData')} />
        )}
      </Drawer>

      {historyDocumentDetail?.type === 'quotation' ? (
        <QuotationDetailModal
          quotationId={historyDocumentDetail.recordRef}
          open
          onClose={() => setHistoryDocumentDetail(null)}
          onSuccess={refreshDocumentDetail}
        />
      ) : null}

      {historyDocumentDetail?.type === 'proformaInvoice' ? (
        <ProformaInvoiceDetailModal
          open
          setOpen={(open) => {
            if (!open) setHistoryDocumentDetail(null);
          }}
          piData={historyDocumentDetail.record}
          fetchPIs={refreshDocumentDetail}
        />
      ) : null}

      {historyDocumentDetail?.type === 'purchaseOrder' ? (
        <PurchaseOrderDetailModal
          poId={historyDocumentDetail.recordRef}
          open
          onClose={() => setHistoryDocumentDetail(null)}
          onSuccess={refreshDocumentDetail}
        />
      ) : null}

      {historyDocumentDetail?.type === 'vendorInvoice' ? (
        <VendorInvoiceDetailModal
          isOpen
          setIsOpen={(open) => {
            if (!open) setHistoryDocumentDetail(null);
          }}
          data={toVendorInvoiceDetailRecord(historyDocumentDetail.record)}
        />
      ) : null}

      {historyDocumentDetail?.type === 'shipment' ? (
        <ShipmentDetailDrawer
          shipmentId={historyDocumentDetail.recordRef}
          open
          onClose={() => setHistoryDocumentDetail(null)}
          onSuccess={refreshDocumentDetail}
        />
      ) : null}

      <style jsx global>{`
        .premium-table .ant-table {
          background: transparent !important;
        }
        .premium-table .ant-table-thead > tr > th {
          background: ${isDark ? 'rgba(30, 41, 59, 0.5)' : '#fafafa'} !important;
          color: ${isDark ? '#8c8c8c' : '#595959'} !important;
          font-weight: 600 !important;
          border-bottom: 1px solid ${isDark ? '#334155' : '#f0f0f0'} !important;
        }
        .premium-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${isDark ? '#334155' : '#f0f0f0'} !important;
          color: ${isDark ? '#e2e8f0' : 'inherit'} !important;
        }
        .premium-table .ant-table-placeholder {
          background: transparent !important;
        }
        .partner-history-document-card {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .partner-history-document-card:hover {
          border-color: ${token.colorPrimary} !important;
          box-shadow: 0 8px 24px ${isDark ? 'rgba(15, 23, 42, 0.35)' : 'rgba(15, 23, 42, 0.08)'};
          transform: translateY(-1px);
        }
        .partner-history-document-card:focus-visible {
          outline: 2px solid ${token.colorPrimary};
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
};

export default PartnerTable;
