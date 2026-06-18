'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Row, Col, Card, Statistic, Table, Typography, 
  Tabs, theme, Spin, Button, Progress, Space, Divider, Empty, Badge, Tooltip,
  Tag, Modal, Input, Select
} from 'antd';
import type { TableColumnsType } from 'antd';
import { 
  RiseOutlined, FallOutlined, 
  DollarCircleOutlined,
  HistoryOutlined,
  ArrowUpOutlined,
  BarChartOutlined, BankOutlined,
  FileExcelOutlined,
  WalletOutlined,
  ArrowRightOutlined,
  FilterOutlined,
  DoubleRightOutlined,
  ReloadOutlined,
  LineChartOutlined,
  SearchOutlined,
  ExportOutlined
} from '@ant-design/icons';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, 
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import Link from 'next/link';
import { sendRequest } from '@/lib/api-client';
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import dayjs, { type Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useTranslations } from 'next-intl';

const { Text, Title } = Typography;

interface IAccountingReportsProps {
  accessToken: string;
  dateRange: [Dayjs | null, Dayjs | null] | null;
  canViewCost: boolean;
}

type ReportQueryParams = {
  startDate?: string;
  endDate?: string;
};

type MoneyPeriod = {
  revenue?: number;
  cogs?: number;
  expenses?: number;
  netProfit?: number;
  lines?: { key: string; label: string; prefixes: string[]; amount: number; isDeduction: boolean }[];
};

type AccountingSummaryReport = {
  current?: MoneyPeriod;
  previous?: MoneyPeriod;
};

type AgingReport = {
  current?: number;
  days_30?: number;
  days_60?: number;
  days_90?: number;
  over_90?: number;
};

type AgingBucketKey = 'current' | 'days_30' | 'days_60' | 'days_90' | 'over_90';

type AgingBreakdown = Record<AgingBucketKey, number>;

type PartnerAgingItem = {
  _id: string;
  partner_id: string;
  partnerName: string;
  documentNumber: string | null;
  referenceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  remainingAmountVnd: number;
  overdueDays: number;
  bucket: AgingBucketKey;
  status: string;
  createdByUsername: string | null;
};

type PartnerAgingRow = {
  _id: string;
  partnerName: string;
  totalOpenVnd: number;
  itemCount: number;
  earliestDueDate: string | null;
  worstOverdueDays: number;
  aging: AgingBreakdown;
  items: PartnerAgingItem[];
};

type AgingDetailTotals = AgingBreakdown & {
  totalOpenVnd: number;
  partnerCount: number;
  itemCount: number;
};

type AgingDetailResponse = {
  results?: PartnerAgingRow[];
  totals?: AgingDetailTotals;
  meta?: {
    current?: number;
    pageSize?: number;
    pages?: number;
    total?: number;
  };
};

type AgingDetailKind = 'ar' | 'ap';

type AgingDetailModalState = {
  open: boolean;
  kind: AgingDetailKind;
  current: number;
  pageSize: number;
  search: string;
};

type BalanceSheetLine = {
  key?: string;
  code?: string;
  name: string;
  balance: number;
  bold?: boolean;
};

type BalanceSheetReport = {
  assets?: BalanceSheetLine[];
  liabilities?: BalanceSheetLine[];
  equity?: BalanceSheetLine[];
};

type TrendReportLine = {
  month: string;
  revenue?: number;
  netProfit?: number;
};

type CashFlowReport = {
  operatingInflow?: number;
  operatingOutflow?: number;
  netCashFlow?: number;
};

type RatioReport = {
  currentRatio?: number;
  grossMargin?: number;
  netMargin?: number;
  inventoryTurnover?: number;
};

type PieLine = {
  name: string;
  value: number;
};

type ProfitLossRow = {
  key: string;
  label: string;
  curr?: number;
  prev?: number;
  bold?: boolean;
  indent?: boolean;
  color?: string;
  drilldownPrefixes?: string[];
};

const formatAccountingNumber = (val: number | undefined, color?: string, tokenColorError?: string, currency: 'VND' | 'USD' = 'VND') => {
  if (val === undefined) return null;
  const num = currency === 'USD' ? val / 25000 : val;
  if (Math.abs(num) < 0.01) return <span style={{ color }}>-</span>;
  const maxFraction = currency === 'USD' ? 2 : 0;
  if (num < 0) return <span style={{ color: tokenColorError || 'red' }}>({Math.abs(num).toLocaleString(undefined, { maximumFractionDigits: maxFraction })})</span>;
  return <span style={{ color }}>{num.toLocaleString(undefined, { maximumFractionDigits: maxFraction })}</span>;
};

const toNumber = (value: unknown) => Number(value || 0);
const formatMoneyText = (value: unknown) => `${toNumber(value).toLocaleString()} VND`;
const formatCurrencyText = (value: unknown, currency = 'VND') => (
  `${toNumber(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency || 'VND'}`
);
const agingTotal = (aging?: AgingReport | null) =>
  toNumber(aging?.current) +
  toNumber(aging?.days_30) +
  toNumber(aging?.days_60) +
  toNumber(aging?.days_90) +
  toNumber(aging?.over_90);
const ratioPercent = (value?: number) => Number(value || 0) * 100;
const createEmptyAgingDetailTotals = (): AgingDetailTotals => ({
  current: 0,
  days_30: 0,
  days_60: 0,
  days_90: 0,
  over_90: 0,
  totalOpenVnd: 0,
  partnerCount: 0,
  itemCount: 0,
});

const bucketColor: Record<AgingBucketKey, string> = {
  current: 'success',
  days_30: 'warning',
  days_60: 'orange',
  days_90: 'volcano',
  over_90: 'error',
};

const AccountingReports: React.FC<IAccountingReportsProps> = ({ accessToken, dateRange, canViewCost }) => {
  const { token } = theme.useToken();
  const t = useTranslations('Accounting');
  const [loading, setLoading] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState<'VND'|'USD'>('VND');
  const [summary, setSummary] = useState<AccountingSummaryReport | null>(null);
  const [apAging, setApAging] = useState<AgingReport | null>(null);
  const [arAging, setArAging] = useState<AgingReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [trend, setTrend] = useState<TrendReportLine[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null);
  const [ratios, setRatios] = useState<RatioReport | null>(null);
  const [agingDetailModal, setAgingDetailModal] = useState<AgingDetailModalState>({
    open: false,
    kind: 'ar',
    current: 1,
    pageSize: 10,
    search: '',
  });
  const [agingDetailSearchDraft, setAgingDetailSearchDraft] = useState('');
  const [agingDetailRows, setAgingDetailRows] = useState<PartnerAgingRow[]>([]);
  const [agingDetailTotals, setAgingDetailTotals] = useState<AgingDetailTotals>(createEmptyAgingDetailTotals);
  const [agingDetailMeta, setAgingDetailMeta] = useState({ current: 1, pageSize: 10, pages: 0, total: 0 });
  const [agingDetailLoading, setAgingDetailLoading] = useState(false);
  const [agingDetailExporting, setAgingDetailExporting] = useState(false);
  const [agingDetailError, setAgingDetailError] = useState<string | null>(null);

  const [plDrilldownModal, setPLDrilldownModal] = useState<{ open: boolean; record: ProfitLossRow | null; data: any[]; loading: boolean; meta: { current: number; pageSize: number; total: number } }>({
    open: false,
    record: null,
    data: [],
    loading: false,
    meta: { current: 1, pageSize: 10, total: 0 },
  });

  const fetchPLDrilldown = useCallback(async (record: ProfitLossRow, current: number = 1, pageSize: number = 10) => {
    if (!record.drilldownPrefixes) return;
    setPLDrilldownModal(prev => ({ ...prev, loading: true, record, open: true }));
    try {
      const queryParams = new URLSearchParams({
        accountCodes: record.drilldownPrefixes.join(','),
        current: current.toString(),
        pageSize: pageSize.toString(),
        ...(dateRange && dateRange[0] ? { startDate: dateRange[0].toISOString() } : {}),
        ...(dateRange && dateRange[1] ? { endDate: dateRange[1].toISOString() } : {}),
      });
      const res = await sendRequest<any>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/pl-drilldown?${queryParams.toString()}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setPLDrilldownModal(prev => ({ 
        ...prev, 
        loading: false, 
        data: res.data?.results || [],
        meta: {
          current: Number(res.data?.meta?.current || current),
          pageSize: Number(res.data?.meta?.pageSize || pageSize),
          total: Number(res.data?.meta?.total || 0),
        }
      }));
    } catch (err) {
      console.error('Fetch drilldown failed', err);
      setPLDrilldownModal(prev => ({ ...prev, loading: false }));
    }
  }, [accessToken, dateRange]);

  const openPLDrilldown = useCallback((record: ProfitLossRow) => {
    fetchPLDrilldown(record);
  }, [fetchPLDrilldown]);

  const closePLDrilldown = useCallback(() => {
    setPLDrilldownModal({ open: false, record: null, data: [], loading: false, meta: { current: 1, pageSize: 10, total: 0 } });
  }, []);

  const requestAgingDetails = useCallback(async (
    kind: AgingDetailKind,
    current: number,
    pageSize: number,
    search: string,
  ) => {
    if (!accessToken) return null;
    const endpoint = kind === 'ar' ? 'ar-aging-details' : 'ap-aging-details';
    const res = await sendRequest<IBackendRes<AgingDetailResponse>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/${endpoint}`,
      method: 'GET',
      queryParams: {
        current,
        pageSize,
        ...(search.trim() ? { search: search.trim() } : {}),
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return res?.data ?? null;
  }, [accessToken]);

  const fetchAgingDetails = useCallback(async () => {
    if (!agingDetailModal.open || !accessToken) return;
    setAgingDetailLoading(true);
    setAgingDetailError(null);
    try {
      const report = await requestAgingDetails(
        agingDetailModal.kind,
        agingDetailModal.current,
        agingDetailModal.pageSize,
        agingDetailModal.search,
      );

      if (!report) {
        setAgingDetailRows([]);
        setAgingDetailTotals(createEmptyAgingDetailTotals());
        setAgingDetailMeta((prev) => ({ ...prev, total: 0, pages: 0 }));
        setAgingDetailError(t('reports.agingDetails.loadError'));
        return;
      }

      setAgingDetailRows(report.results ?? []);
      setAgingDetailTotals(report.totals ?? createEmptyAgingDetailTotals());
      setAgingDetailMeta({
        current: report.meta?.current ?? agingDetailModal.current,
        pageSize: report.meta?.pageSize ?? agingDetailModal.pageSize,
        pages: report.meta?.pages ?? 0,
        total: report.meta?.total ?? 0,
      });
    } finally {
      setAgingDetailLoading(false);
    }
  }, [accessToken, agingDetailModal, requestAgingDetails, t]);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const queryParams: ReportQueryParams = {};
      if (dateRange && dateRange[0] && dateRange[1]) {
        queryParams.startDate = dateRange[0].startOf('day').toISOString();
        queryParams.endDate = dateRange[1].endOf('day').toISOString();
      }

      const [summaryRes, apRes, arRes, balanceRes, trendRes, cashRes, ratioRes] = await Promise.all([
        sendRequest<IBackendRes<AccountingSummaryReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/summary`,
          method: 'GET',
          queryParams,
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<AgingReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/aging`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<AgingReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/ar-aging`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<BalanceSheetReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/balance-sheet`,
          method: 'GET',
          queryParams,
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<TrendReportLine[]>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/trend`,
          method: 'GET',
          queryParams,
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<CashFlowReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/cash-flow`,
          method: 'GET',
          queryParams,
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<RatioReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/ratios`,
          method: 'GET',
          queryParams,
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      ]);

      if (summaryRes?.data) setSummary(summaryRes.data);
      if (apRes?.data) setApAging(apRes.data);
      if (arRes?.data) setArAging(arRes.data);
      if (balanceRes?.data) setBalanceSheet(balanceRes.data);
      if (trendRes?.data) setTrend(trendRes.data);
      if (cashRes?.data) setCashFlow(cashRes.data);
      if (ratioRes?.data) setRatios(ratioRes.data);
    } finally {
      setLoading(false);
    }
  }, [accessToken, dateRange]);

  const getTraceabilityUrl = useCallback((type: string, id: string) => {
    switch (type) {
      case 'SALES_CONTRACT': return `/dashboard/sales-contract?id=${id}`;
      case 'SHIPMENT': return `/dashboard/shipment?id=${id}`;
      case 'COMMERCIAL_INVOICE': return `/dashboard/document?id=${id}`;
      case 'GOODS_RECEIPT': return `/dashboard/goods-receipt?id=${id}`;
      case 'PAYMENT': return `/dashboard/finance?tab=payment&id=${id}`;
      case 'RECEIPT': return `/dashboard/finance?tab=receipt&id=${id}`;
      case 'PURCHASE_ORDER': return `/dashboard/purchase-orders?id=${id}`;
      case 'VENDOR_INVOICE': return `/dashboard/vendor-invoice?id=${id}`;
      default: return '#';
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchAgingDetails();
  }, [fetchAgingDetails]);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const protectedRows = canViewCost ? [
      [t('reports.export.rows.cogs'), summary?.current?.cogs, summary?.previous?.cogs],
      [t('reports.export.rows.expenses'), summary?.current?.expenses, summary?.previous?.expenses],
      [t('reports.export.rows.netProfit'), summary?.current?.netProfit, summary?.previous?.netProfit],
    ] : [];
    
    const summaryData = [
      [t('reports.export.plTitle')],
      [t('reports.export.fromDate'), dateRange?.[0]?.format('DD/MM/YYYY')],
      [t('reports.export.toDate'), dateRange?.[1]?.format('DD/MM/YYYY')],
      [""],
      [t('reports.export.metric'), t('reports.export.currentPeriod'), t('reports.export.previousPeriod')],
      [t('reports.export.rows.revenue'), summary?.current?.revenue, summary?.previous?.revenue],
      [t('reports.export.rows.cogs'), summary?.current?.cogs, summary?.previous?.cogs],
      [t('reports.export.rows.expenses'), summary?.current?.expenses, summary?.previous?.expenses],
      [t('reports.export.rows.netProfit'), summary?.current?.netProfit, summary?.previous?.netProfit]
    ];
    summaryData.splice(6, 3, ...protectedRows);
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "P&L");

    const bsData = [
      [t('reports.export.balanceSheetTitle')],
      [""],
      [t('reports.export.account'), t('reports.export.balance')],
      [`--- ${t('reports.balanceSheet.assets').toUpperCase()} ---`],
      ...(balanceSheet?.assets || []).map((asset) => [asset.name, asset.balance]),
      [""],
      [`--- ${t('reports.balanceSheet.liabilitiesEquity').toUpperCase()} ---`],
      ...(balanceSheet?.liabilities || []).map((liability) => [liability.name, liability.balance]),
      ...(balanceSheet?.equity || []).map((equity) => [equity.name, equity.balance]),
    ];
    const wsBS = XLSX.utils.aoa_to_sheet(bsData);
    XLSX.utils.book_append_sheet(wb, wsBS, "Balance Sheet");

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `${t('reports.export.filePrefix')}_${dayjs().format('YYYYMMDD')}.xlsx`);
  };


  const COLORS = [token.colorPrimary, '#13c2c2', '#fa8c16', '#eb2f96', '#722ed1', '#2f54eb'];

  const assetPieData: PieLine[] = (balanceSheet?.assets || []).map((asset) => ({ name: asset.name, value: asset.balance }));
  const equityLiabPieData = [
    ...(balanceSheet?.liabilities || []),
    ...(balanceSheet?.equity || [])
  ].map((item) => ({ name: item.name, value: item.balance }));

  const calculateTrend = (curr?: number, prev?: number) => {
    const currentValue = Number(curr || 0);
    const previousValue = Number(prev || 0);
    if (!previousValue) return 0;
    return ((currentValue - previousValue) / previousValue) * 100;
  };

  const renderTrendTag = (value: number, isExpense = false) => {
    if (Math.abs(value) < 0.1) {
      return (
        <Tag color="default" variant="filled" style={{ borderRadius: 20, padding: '0 8px' }}>
          {Math.abs(value).toFixed(1)}%
        </Tag>
      );
    }
    const isPos = value > 0;
    const color = isPos ? (isExpense ? 'error' : 'success') : (isExpense ? 'success' : 'error');
    return (
      <Tag color={color} variant="filled" style={{ borderRadius: 20, padding: '0 8px' }}>
        <Space orientation="horizontal" size={4}>
          {isPos ? <RiseOutlined /> : <FallOutlined />}
          {Math.abs(value).toFixed(1)}%
        </Space>
      </Tag>
    );
  };

  const getBucketLabel = useCallback((bucket: AgingBucketKey) => {
    if (bucket === 'current') return t('reports.aging.current');
    if (bucket === 'days_30') return t('reports.aging.days30');
    if (bucket === 'days_60') return t('reports.aging.days60');
    if (bucket === 'days_90') return t('reports.aging.days90');
    return t('reports.aging.over90');
  }, [t]);

  const formatOverdueDays = useCallback((days: number) => (
    days > 0
      ? t('reports.agingDetails.daysOverdue', { days })
      : t('reports.agingDetails.notOverdue')
  ), [t]);

  const openAgingDetails = useCallback((kind: AgingDetailKind) => {
    setAgingDetailSearchDraft('');
    setAgingDetailRows([]);
    setAgingDetailTotals(createEmptyAgingDetailTotals());
    setAgingDetailMeta({ current: 1, pageSize: 10, pages: 0, total: 0 });
    setAgingDetailError(null);
    setAgingDetailModal({
      open: true,
      kind,
      current: 1,
      pageSize: 10,
      search: '',
    });
  }, []);

  const closeAgingDetails = useCallback(() => {
    setAgingDetailModal((prev) => ({ ...prev, open: false }));
  }, []);

  const applyAgingDetailSearch = useCallback((value: string) => {
    setAgingDetailModal((prev) => ({
      ...prev,
      current: 1,
      search: value.trim(),
    }));
  }, []);

  const exportAgingDetails = useCallback(async () => {
    if (!accessToken) return;
    setAgingDetailExporting(true);
    try {
      const exportRows: PartnerAgingRow[] = [];
      let currentPage = 1;
      let totalPages = 1;

      do {
        const report = await requestAgingDetails(
          agingDetailModal.kind,
          currentPage,
          100,
          agingDetailModal.search,
        );
        exportRows.push(...(report?.results ?? []));
        totalPages = Math.max(Number(report?.meta?.pages || 1), 1);
        currentPage += 1;
      } while (currentPage <= totalPages);

      const title = agingDetailModal.kind === 'ar'
        ? t('reports.agingDetails.arTitle')
        : t('reports.agingDetails.apTitle');
      const summaryRows: Array<Array<string | number | null>> = [
        [title],
        [t('reports.agingDetails.exportedAt'), dayjs().format('DD/MM/YYYY HH:mm')],
        [t('reports.agingDetails.totalOpen'), agingDetailTotals.totalOpenVnd],
        [''],
        [
          t('reports.agingDetails.partner'),
          t('reports.agingDetails.itemCount'),
          t('reports.agingDetails.totalOpen'),
          t('reports.aging.current'),
          t('reports.aging.days30'),
          t('reports.aging.days60'),
          t('reports.aging.days90'),
          t('reports.aging.over90'),
          t('reports.agingDetails.earliestDueDate'),
          t('reports.agingDetails.worstOverdue'),
        ],
        ...exportRows.map((row) => [
          row.partnerName,
          row.itemCount,
          row.totalOpenVnd,
          row.aging.current,
          row.aging.days_30,
          row.aging.days_60,
          row.aging.days_90,
          row.aging.over_90,
          row.earliestDueDate,
          row.worstOverdueDays,
        ]),
      ];
      const itemRows: Array<Array<string | number | null>> = [
        [
          t('reports.agingDetails.partner'),
          t('reports.agingDetails.document'),
          t('reports.agingDetails.reference'),
          t('reports.agingDetails.issueDate'),
          t('reports.agingDetails.dueDate'),
          t('reports.agingDetails.currency'),
          t('reports.agingDetails.originalAmount'),
          t('reports.agingDetails.paidAmount'),
          t('reports.agingDetails.remaining'),
          'VND',
          t('reports.agingDetails.bucket'),
          t('reports.agingDetails.status'),
        ],
        ...exportRows.flatMap((row) => row.items.map((item) => [
          row.partnerName,
          item.documentNumber,
          item.referenceNumber,
          item.issueDate,
          item.dueDate,
          item.currency,
          item.originalAmount,
          item.paidAmount,
          item.remainingAmount,
          item.remainingAmountVnd,
          getBucketLabel(item.bucket),
          item.status,
        ])),
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemRows), 'Open Items');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(
        new Blob([wbout], { type: 'application/octet-stream' }),
        `${t('reports.agingDetails.exportFilePrefix')}_${agingDetailModal.kind.toUpperCase()}_${dayjs().format('YYYYMMDD')}.xlsx`,
      );
    } finally {
      setAgingDetailExporting(false);
    }
  }, [accessToken, agingDetailModal.kind, agingDetailModal.search, agingDetailTotals.totalOpenVnd, getBucketLabel, requestAgingDetails, t]);

  const agingDetailColumns = useMemo<TableColumnsType<PartnerAgingRow>>(() => [
    {
      title: agingDetailModal.kind === 'ar' ? t('reports.agingDetails.customer') : t('reports.agingDetails.vendor'),
      key: 'partner',
      width: 260,
      render: (_value: unknown, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.partnerName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record._id}</Text>
        </Space>
      ),
    },
    {
      title: t('reports.agingDetails.totalOpen'),
      dataIndex: 'totalOpenVnd',
      key: 'totalOpenVnd',
      align: 'right',
      sorter: (left, right) => left.totalOpenVnd - right.totalOpenVnd,
      render: (value: number) => <Text strong>{formatMoneyText(value)}</Text>,
    },
    {
      title: t('reports.aging.current'),
      key: 'current',
      align: 'right',
      render: (_value: unknown, record) => formatMoneyText(record.aging.current),
    },
    {
      title: t('reports.aging.days30'),
      key: 'days_30',
      align: 'right',
      render: (_value: unknown, record) => formatMoneyText(record.aging.days_30),
    },
    {
      title: t('reports.aging.days60'),
      key: 'days_60',
      align: 'right',
      render: (_value: unknown, record) => formatMoneyText(record.aging.days_60),
    },
    {
      title: t('reports.aging.over60'),
      key: 'over_60',
      align: 'right',
      render: (_value: unknown, record) => formatMoneyText(record.aging.days_90 + record.aging.over_90),
    },
    {
      title: t('reports.agingDetails.itemCount'),
      dataIndex: 'itemCount',
      key: 'itemCount',
      width: 110,
      align: 'center',
    },
    {
      title: t('reports.agingDetails.worstOverdue'),
      dataIndex: 'worstOverdueDays',
      key: 'worstOverdueDays',
      width: 150,
      render: (value: number) => (
        <Tag color={value > 0 ? 'error' : 'success'}>{formatOverdueDays(value)}</Tag>
      ),
    },
  ], [agingDetailModal.kind, formatOverdueDays, t]);

  const agingDetailItemColumns = useMemo<TableColumnsType<PartnerAgingItem>>(() => [
    {
      title: t('reports.agingDetails.document'),
      key: 'document',
      width: 230,
      render: (_value: unknown, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.documentNumber || record._id}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.referenceNumber || '-'}</Text>
        </Space>
      ),
    },
    {
      title: t('reports.agingDetails.dueDate'),
      key: 'dueDate',
      width: 150,
      render: (_value: unknown, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.dueDate ? dayjs(record.dueDate).format('DD/MM/YYYY') : '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{formatOverdueDays(record.overdueDays)}</Text>
        </Space>
      ),
    },
    {
      title: t('reports.agingDetails.originalAmount'),
      key: 'originalAmount',
      align: 'right',
      render: (_value: unknown, record) => formatCurrencyText(record.originalAmount, record.currency),
    },
    {
      title: t('reports.agingDetails.paidAmount'),
      key: 'paidAmount',
      align: 'right',
      render: (_value: unknown, record) => formatCurrencyText(record.paidAmount, record.currency),
    },
    {
      title: t('reports.agingDetails.remaining'),
      key: 'remaining',
      align: 'right',
      render: (_value: unknown, record) => (
        <Space orientation="vertical" size={0} align="end">
          <Text strong>{formatCurrencyText(record.remainingAmount, record.currency)}</Text>
          {record.currency !== 'VND' ? (
            <Text type="secondary" style={{ fontSize: 12 }}>{formatMoneyText(record.remainingAmountVnd)}</Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('reports.agingDetails.bucket'),
      dataIndex: 'bucket',
      key: 'bucket',
      width: 120,
      render: (value: AgingBucketKey) => <Tag color={bucketColor[value]}>{getBucketLabel(value)}</Tag>,
    },
    {
      title: t('reports.agingDetails.status'),
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value: string) => <Tag>{value}</Tag>,
    },
  ], [formatOverdueDays, getBucketLabel, t]);

  const agingDetailTitle = agingDetailModal.kind === 'ar'
    ? t('reports.agingDetails.arTitle')
    : t('reports.agingDetails.apTitle');
  const agingDetailModuleHref = agingDetailModal.kind === 'ar'
    ? '/dashboard/account-receivables'
    : '/dashboard/account-payables';
  const agingDetailOverdueTotal = agingDetailTotals.days_30
    + agingDetailTotals.days_60
    + agingDetailTotals.days_90
    + agingDetailTotals.over_90;

  if (loading && !summary) return (
    <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: token.colorBgContainer, borderRadius: 16 }}>
      <Spin size="large" description={t('reports.loading')} />
    </div>
  );

  return (
    <div style={{ marginTop: 24 }}>
      {/* --- Top Header KPI Cards --- */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ borderRadius: 16, background: `linear-gradient(135deg, ${token.colorPrimary}10 0%, ${token.colorPrimary}20 100%)` }}>
            <Statistic 
              title={<Space orientation="horizontal" size={4}><RiseOutlined /> {t('reports.kpi.netRevenue')}</Space>}
              value={summary?.current?.revenue}
              suffix="VND"
              styles={{ content: { color: token.colorPrimary, fontWeight: 700, fontSize: 24 } }}
            />
            <div style={{ marginTop: 8 }}>
              {renderTrendTag(calculateTrend(summary?.current?.revenue, summary?.previous?.revenue))}
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{t('reports.kpi.comparedPreviousPeriod')}</Text>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ borderRadius: 16, background: `linear-gradient(135deg, ${token.colorSuccess}10 0%, ${token.colorSuccess}20 100%)` }}>
            <Statistic 
              title={<Space orientation="horizontal" size={4}><DollarCircleOutlined /> {t('reports.kpi.netProfit')}</Space>}
              value={canViewCost ? summary?.current?.netProfit : 0}
              formatter={(value) => canViewCost ? Number(value || 0).toLocaleString() : t('reports.hiddenByPermission')}
              suffix={canViewCost ? 'VND' : undefined}
              styles={{ content: { color: token.colorSuccess, fontWeight: 700, fontSize: 24 } }}
            />
            <div style={{ marginTop: 8 }}>
              {canViewCost ? renderTrendTag(calculateTrend(summary?.current?.netProfit, summary?.previous?.netProfit)) : <Tag>read:cost_fields</Tag>}
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{t('reports.kpi.comparedPreviousPeriod')}</Text>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ borderRadius: 16, background: `linear-gradient(135deg, ${token.colorWarning}10 0%, ${token.colorWarning}20 100%)` }}>
            <Statistic 
              title={<Space orientation="horizontal" size={4}><WalletOutlined /> {t('reports.kpi.netCashFlow')}</Space>}
              value={cashFlow?.netCashFlow}
              suffix="VND"
              styles={{ content: { color: token.colorWarningText, fontWeight: 700, fontSize: 24 } }}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color={toNumber(cashFlow?.netCashFlow) >= 0 ? 'success' : 'error'} variant="filled" style={{ borderRadius: 20 }}>
                {toNumber(cashFlow?.netCashFlow) >= 0 ? t('reports.kpi.positiveCashFlow') : t('reports.kpi.negativeCashFlow')}
              </Tag>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ borderRadius: 16, background: `linear-gradient(135deg, ${token.colorInfo}10 0%, ${token.colorInfo}20 100%)` }}>
            <Statistic 
              title={<Space orientation="horizontal" size={4}><HistoryOutlined /> {t('reports.kpi.customerReceivables')}</Space>}
              value={agingTotal(arAging)}
              suffix="VND"
              styles={{ content: { color: token.colorInfoText, fontWeight: 700, fontSize: 24 } }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('reports.kpi.customerDebtTotal')}</Text>
            </div>
          </Card>
        </Col>
      </Row>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Space orientation="horizontal">
          <Button icon={<FilterOutlined />} variant="outlined">{t('actions.advancedFilters')}</Button>
          <Button icon={<FileExcelOutlined />} type="primary" onClick={exportToExcel} style={{ borderRadius: 8 }}>{t('actions.exportExcel')}</Button>
        </Space>
      </div>
      
      <Tabs 
        defaultActiveKey="pl"
        destroyOnHidden
        items={[
          {
            key: 'pl',
            label: <Space orientation="horizontal"><BarChartOutlined />{t('tabs.pl')}</Space>,
            children: (
              <Row gutter={[24, 24]}>
                <Col span={16}>
                  <Card variant="borderless" style={{ borderRadius: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                      <div>
                        <Title level={4} style={{ margin: 0 }}>{t('reports.sections.financialTrend')}</Title>
                        <Text type="secondary">{t('reports.sections.financialTrendDescription')}</Text>
                      </div>
                      <Space orientation="horizontal" size={16}>
                        <Badge color={token.colorPrimary} text={t('reports.chart.revenue')} />
                        {canViewCost && <Badge color={token.colorSuccess} text={t('reports.chart.profit')} />}
                      </Space>
                    </div>
                    <div style={{ height: 400, width: '100%', minWidth: 0 }}>
                      <SafeResponsiveContainer height={400}>
                        <AreaChart data={trend}>
                          <defs>
                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={token.colorPrimary} stopOpacity={0.15}/>
                              <stop offset="95%" stopColor={token.colorPrimary} stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={token.colorSuccess} stopOpacity={0.15}/>
                              <stop offset="95%" stopColor={token.colorSuccess} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={token.colorBorderSecondary} />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: token.colorTextSecondary}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} tick={{fill: token.colorTextSecondary}} />
                          <ReTooltip 
                            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '12px' }}
                            formatter={(value: unknown) => [formatMoneyText(value), '']}
                          />
                          <Area type="monotone" dataKey="revenue" stroke={token.colorPrimary} fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                          {canViewCost && <Area type="monotone" dataKey="netProfit" stroke={token.colorSuccess} fillOpacity={1} fill="url(#colorProf)" strokeWidth={3} strokeDasharray="5 5" />}
                        </AreaChart>
                      </SafeResponsiveContainer>
                    </div>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card variant="borderless" style={{ borderRadius: 16, height: '100%' }} title={<Title level={5} style={{margin: 0}}>{t('reports.sections.performanceRatios')}</Title>}>
                    {canViewCost ? <Space orientation="vertical" style={{ width: '100%' }} size={24}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text type="secondary">{t('reports.ratios.grossMargin')}</Text>
                          <Text strong>{ratioPercent(ratios?.grossMargin).toFixed(1)}%</Text>
                        </div>
                        <Progress percent={Math.round(ratioPercent(ratios?.grossMargin))} status="active" strokeColor={token.colorSuccess} showInfo={false} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text type="secondary">{t('reports.ratios.netMargin')}</Text>
                          <Text strong>{ratioPercent(ratios?.netMargin).toFixed(1)}%</Text>
                        </div>
                        <Progress percent={Math.round(ratioPercent(ratios?.netMargin))} status="active" strokeColor={token.colorPrimary} showInfo={false} />
                      </div>
                      <Divider style={{ margin: '12px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">{t('reports.ratios.inventoryTurnover')}</Text>
                        <Text strong>{t('reports.ratios.turnoverValue', { value: (ratios?.inventoryTurnover || 0).toFixed(2) })}</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">{t('reports.ratios.currentRatio')}</Text>
                        <Tag color={(ratios?.currentRatio || 0) >= 1 ? 'cyan' : 'warning'}>
                          {t('reports.ratios.currentRatioValue', { value: (ratios?.currentRatio || 0).toFixed(2) })}
                        </Tag>
                      </div>
                    </Space> : (
                      <Empty description={t('reports.noCostPermission')} />
                    )}
                  </Card>
                </Col>
                <Col span={24}>
                  <Card 
                    variant="borderless" 
                    style={{ borderRadius: 16 }} 
                    styles={{ body: { padding: 0 } }}
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
                        <Title level={5} style={{ margin: 0 }}>{t('reports.sections.plDetail') || 'P&L Details'}</Title>
                        <Select 
                          value={displayCurrency} 
                          onChange={setDisplayCurrency} 
                          style={{ width: 120 }}
                          options={[
                            { value: 'VND', label: 'VND' },
                            { value: 'USD', label: 'USD (Rate 25,000)' }
                          ]}
                        />
                      </div>
                    }
                  >
                    <Table<ProfitLossRow>
                      pagination={false} 
                      rowKey="key"
                      sticky={{ offsetHeader: 0 }}
                      dataSource={[
                        ...(summary?.current?.lines?.find(l => l.key === 'revenue') ? [{ 
                          key: '1', 
                          label: summary.current.lines.find(l => l.key === 'revenue')!.label.replace(/^\d+\.\s*/, ''), 
                          curr: summary.current.lines.find(l => l.key === 'revenue')!.amount, 
                          prev: summary.previous?.lines?.find(l => l.key === 'revenue')?.amount, 
                          bold: true,
                          drilldownPrefixes: summary.current.lines.find(l => l.key === 'revenue')!.prefixes
                        }] : [{ key: '1', label: t('reports.plRows.revenue'), curr: summary?.current?.revenue, prev: summary?.previous?.revenue, bold: true }]),
                        
                        { key: '2', label: t('reports.plRows.deductions'), curr: 0, prev: 0, indent: true },
                        { key: '3', label: t('reports.plRows.netRevenue'), curr: summary?.current?.revenue, prev: summary?.previous?.revenue, bold: true },
                        
                        ...(canViewCost ? [
                          ...(summary?.current?.lines?.find(l => l.key === 'cogs') ? [{
                            key: '4', 
                            label: summary.current.lines.find(l => l.key === 'cogs')!.label.replace(/^\d+\.\s*/, ''), 
                            curr: -summary.current.lines.find(l => l.key === 'cogs')!.amount, 
                            prev: -(summary.previous?.lines?.find(l => l.key === 'cogs')?.amount || 0), 
                            color: token.colorError, 
                            indent: true,
                            drilldownPrefixes: summary.current.lines.find(l => l.key === 'cogs')!.prefixes
                          }] : [{ key: '4', label: t('reports.plRows.cogs'), curr: -(summary?.current?.cogs || 0), prev: -(summary?.previous?.cogs || 0), color: token.colorError, indent: true }]),
                          
                          { key: '5', label: t('reports.plRows.grossProfit'), curr: ((summary?.current?.revenue || 0) - (summary?.current?.cogs || 0)), prev: ((summary?.previous?.revenue || 0) - (summary?.previous?.cogs || 0)), bold: true, color: token.colorSuccess },
                          
                          ...(summary?.current?.lines?.find(l => l.key === 'expenses') ? [{
                            key: '6', 
                            label: summary.current.lines.find(l => l.key === 'expenses')!.label.replace(/^\d+\.\s*/, ''), 
                            curr: -summary.current.lines.find(l => l.key === 'expenses')!.amount, 
                            prev: -(summary.previous?.lines?.find(l => l.key === 'expenses')?.amount || 0), 
                            color: token.colorError, 
                            indent: true,
                            drilldownPrefixes: summary.current.lines.find(l => l.key === 'expenses')!.prefixes
                          }] : [{ key: '6', label: t('reports.plRows.operatingExpenses'), curr: -(summary?.current?.expenses || 0), prev: -(summary?.previous?.expenses || 0), color: token.colorError, indent: true }]),
                          
                          { key: '7', label: t('reports.plRows.operatingNetProfit'), curr: summary?.current?.netProfit, prev: summary?.previous?.netProfit, bold: true, color: token.colorPrimary },
                        ] : [
                          { key: 'hidden', label: t('reports.plRows.hiddenCost'), curr: undefined, prev: undefined, bold: true, color: token.colorTextSecondary },
                        ]),
                      ]}
                      columns={[
                        { 
                          title: t('reports.columns.metric'),
                          dataIndex: 'label', 
                          key: 'label',
                          render: (text, record) => (
                            <Text strong={record.bold} style={{ paddingLeft: record.indent ? 24 : 0 }}>{text}</Text>
                          )
                        },
                        { 
                          title: t('reports.columns.currentPeriod'),
                          dataIndex: 'curr', 
                          key: 'curr', 
                          align: 'right',
                          render: (val, record) => (
                            <Text strong={record.bold}>{formatAccountingNumber(val, record.color, token.colorError, displayCurrency)}</Text>
                          )
                        },
                        { 
                          title: t('reports.columns.previousPeriod'),
                          dataIndex: 'prev', 
                          key: 'prev', 
                          align: 'right',
                          render: (val, record) => (
                            <Text type="secondary" style={{ opacity: 0.7 }}>{formatAccountingNumber(val, record.color, token.colorError, displayCurrency)}</Text>
                          )
                        },
                        {
                          title: t('reports.columns.changePercent'),
                          key: 'trend',
                          align: 'center',
                          render: (_value, record) => {
                            if (record.curr === undefined || record.prev === undefined) return <Text type="secondary">-</Text>;
                            const trendValue = calculateTrend(record.curr, record.prev);
                            const isExpense = record.color === token.colorError;
                            return renderTrendTag(trendValue, isExpense);
                          }
                        },
                        { 
                          title: t('reports.columns.details'),
                          key: 'action', 
                          align: 'center',
                          render: (_, record) => (
                            <Space>
                              {record.drilldownPrefixes && (
                                <Tooltip title={t('actions.traceLedger')}>
                                  <Button type="text" shape="circle" icon={<LineChartOutlined />} onClick={() => openPLDrilldown(record)} />
                                </Tooltip>
                              )}
                              {record.drilldownPrefixes && (
                                <Tooltip title={t('reports.actions.drilldown')}>
                                  <Button type="text" shape="circle" icon={<SearchOutlined />} onClick={() => openPLDrilldown(record)} />
                                </Tooltip>
                              )}
                            </Space>
                          )
                        },
                      ]}
                    />
                  </Card>
                </Col>
              </Row>
            )
          },
          {
            key: 'bs',
            label: <Space orientation="horizontal"><BankOutlined />{t('tabs.balanceSheet')}</Space>,
            children: (
              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <Card title={t('reports.balanceSheet.assetStructure')} variant="borderless" style={{ borderRadius: 16 }}>
                    <div style={{ height: 200, display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '60%', height: 200, minWidth: 0 }}>
                        <SafeResponsiveContainer height={200}>
                          <PieChart>
                            <Pie data={assetPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                              {assetPieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <ReTooltip formatter={(value: unknown) => formatMoneyText(value)} />
                          </PieChart>
                        </SafeResponsiveContainer>
                      </div>
                      <div style={{ width: '40%', paddingLeft: 16 }}>
                        <Space orientation="vertical" style={{ width: '100%' }} size={4}>
                          {assetPieData.map((item, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                              <Badge color={COLORS[index % COLORS.length]} text={<Text style={{fontSize: 12}}>{item.name}</Text>} />
                            </div>
                          ))}
                        </Space>
                      </div>
                    </div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title={t('reports.balanceSheet.capitalStructure')} variant="borderless" style={{ borderRadius: 16 }}>
                    <div style={{ height: 200, display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '60%', height: 200, minWidth: 0 }}>
                        <SafeResponsiveContainer height={200}>
                          <PieChart>
                            <Pie data={equityLiabPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                              {equityLiabPieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                            </Pie>
                            <ReTooltip formatter={(value: unknown) => formatMoneyText(value)} />
                          </PieChart>
                        </SafeResponsiveContainer>
                      </div>
                      <div style={{ width: '40%', paddingLeft: 16 }}>
                        <Space orientation="vertical" style={{ width: '100%' }} size={4}>
                          {equityLiabPieData.map((item, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                              <Badge color={COLORS[(index + 2) % COLORS.length]} text={<Text style={{fontSize: 12}}>{item.name}</Text>} />
                            </div>
                          ))}
                        </Space>
                      </div>
                    </div>
                  </Card>
                </Col>
                <Col span={24}>
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Table<BalanceSheetLine>
                        title={() => <Text strong><ArrowUpOutlined style={{color: token.colorSuccess}} /> {t('reports.balanceSheet.assets')}</Text>}
                        size="small"
                        pagination={false}
                        rowKey="name"
                        dataSource={[
                          ...(balanceSheet?.assets || []),
                          { name: t('reports.balanceSheet.totalAssets'), balance: (balanceSheet?.assets || []).reduce((sum, asset) => sum + asset.balance, 0), bold: true }
                        ]}
                        columns={[
                          { title: t('reports.columns.account'), dataIndex: 'name', key: 'name', render: (text: string, record) => <Text strong={record.bold} style={{paddingLeft: record.bold ? 0 : 12}}>{text}</Text> },
                          { title: t('reports.columns.balance'), dataIndex: 'balance', key: 'balance', align: 'right', render: (value: number, record) => <Text strong={record.bold}>{value?.toLocaleString()}</Text> }
                        ]}
                      />
                    </Col>
                    <Col span={12}>
                      <Table<BalanceSheetLine>
                        title={() => <Text strong><ArrowUpOutlined style={{color: token.colorInfo}} /> {t('reports.balanceSheet.liabilitiesEquity')}</Text>}
                        size="small"
                        pagination={false}
                        rowKey="name"
                        dataSource={[
                          ...(balanceSheet?.liabilities || []),
                          ...(balanceSheet?.equity || []),
                          { name: t('reports.balanceSheet.totalLiabilitiesEquity'), balance: [...(balanceSheet?.liabilities || []), ...(balanceSheet?.equity || [])].reduce((sum, line) => sum + line.balance, 0), bold: true }
                        ]}
                        columns={[
                          { title: t('reports.columns.account'), dataIndex: 'name', key: 'name', render: (text: string, record) => <Text strong={record.bold} style={{paddingLeft: record.bold ? 0 : 12}}>{text}</Text> },
                          { title: t('reports.columns.balance'), dataIndex: 'balance', key: 'balance', align: 'right', render: (value: number, record) => <Text strong={record.bold}>{value?.toLocaleString()}</Text> }
                        ]}
                      />
                    </Col>
                  </Row>
                </Col>
              </Row>
            )
          },
          {
            key: 'cf',
            label: <Space orientation="horizontal"><WalletOutlined />{t('tabs.cashFlow')}</Space>,
            children: (
              <Card variant="borderless" style={{ borderRadius: 16 }}>
                <Row gutter={[32, 32]}>
                  <Col span={16}>
                    <Title level={4}>{t('reports.cashFlow.operatingCashFlow')}</Title>
                    <div style={{ height: 300, width: '100%', minWidth: 0 }}>
                      <SafeResponsiveContainer height={300}>
                        <BarChart data={[
                          { name: t('reports.cashFlow.inflow'), value: toNumber(cashFlow?.operatingInflow), fill: token.colorSuccess },
                          { name: t('reports.cashFlow.outflow'), value: -toNumber(cashFlow?.operatingOutflow), fill: token.colorError },
                          { name: t('reports.cashFlow.netCashFlow'), value: toNumber(cashFlow?.netCashFlow), fill: token.colorPrimary },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} />
                          <YAxis axisLine={false} tickLine={false} />
                          <ReTooltip formatter={(value: unknown) => formatMoneyText(value)} />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ background: token.colorFillAlter, padding: 24, borderRadius: 16, height: '100%' }}>
                      <Title level={5}>{t('reports.cashFlow.summary')}</Title>
                      <Divider />
                      <Space orientation="vertical" size={20} style={{width: '100%'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                          <Text type="secondary">{t('reports.cashFlow.salesCollections')}</Text>
                          <Text strong>{cashFlow?.operatingInflow?.toLocaleString()}</Text>
                        </div>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                          <Text type="secondary">{t('reports.cashFlow.vendorPayments')}</Text>
                          <Text strong style={{color: token.colorError}}>-{cashFlow?.operatingOutflow?.toLocaleString()}</Text>
                        </div>
                        <Divider style={{margin: '8px 0'}} />
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                          <Text strong>{t('reports.cashFlow.netCashFlow')}</Text>
                          <Text strong style={{color: token.colorPrimary, fontSize: 18}}>{cashFlow?.netCashFlow?.toLocaleString()}</Text>
                        </div>
                      </Space>
                    </div>
                  </Col>
                </Row>
              </Card>
            )
          },
          {
            key: 'aging',
            label: <Space orientation="horizontal"><HistoryOutlined />{t('tabs.aging')}</Space>,
            children: (
              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <Card title={t('reports.aging.arTitle')} variant="borderless" style={{ borderRadius: 16 }}>
                    <div style={{ height: 250, width: '100%', minWidth: 0 }}>
                      <SafeResponsiveContainer height={250}>
                        <BarChart data={[
                          { name: t('reports.aging.current'), value: arAging?.current || 0, fill: token.colorSuccess },
                          { name: t('reports.aging.days30'), value: arAging?.days_30 || 0, fill: token.colorWarning },
                          { name: t('reports.aging.days60'), value: arAging?.days_60 || 0, fill: '#fa8c16' },
                          { name: t('reports.aging.over60'), value: (arAging?.days_90 || 0) + (arAging?.over_90 || 0), fill: token.colorError },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                          <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} axisLine={false} tickLine={false} />
                          <ReTooltip formatter={(value: unknown) => formatMoneyText(value)} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    </div>
                    <Divider />
                    <Button
                      type="link"
                      icon={<DoubleRightOutlined />}
                      style={{padding: 0}}
                      onClick={() => openAgingDetails('ar')}
                    >
                      {t('actions.viewDebtors')}
                    </Button>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title={t('reports.aging.apTitle')} variant="borderless" style={{ borderRadius: 16 }}>
                    <div style={{ height: 250, width: '100%', minWidth: 0 }}>
                      <SafeResponsiveContainer height={250}>
                        <BarChart data={[
                          { name: t('reports.aging.current'), value: apAging?.current || 0, fill: token.colorSuccess },
                          { name: t('reports.aging.days30'), value: apAging?.days_30 || 0, fill: token.colorWarning },
                          { name: t('reports.aging.days60'), value: apAging?.days_60 || 0, fill: '#fa8c16' },
                          { name: t('reports.aging.over60'), value: (apAging?.days_90 || 0) + (apAging?.over_90 || 0), fill: token.colorError },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                          <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} axisLine={false} tickLine={false} />
                          <ReTooltip formatter={(value: unknown) => formatMoneyText(value)} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                      </SafeResponsiveContainer>
                    </div>
                    <Divider />
                    <Button
                      type="link"
                      icon={<DoubleRightOutlined />}
                      style={{padding: 0}}
                      onClick={() => openAgingDetails('ap')}
                    >
                      {t('actions.viewCreditors')}
                    </Button>
                  </Card>
                </Col>
              </Row>
            )
          }
        ]}
      />
      <Modal
        width={1180}
        title={agingDetailTitle}
        open={agingDetailModal.open}
        onCancel={closeAgingDetails}
        footer={[
          <Link key="module" href={agingDetailModuleHref}>
            <Button>{t('reports.agingDetails.openFullModule')}</Button>
          </Link>,
          <Button key="refresh" icon={<ReloadOutlined />} onClick={fetchAgingDetails} loading={agingDetailLoading}>
            {t('actions.refresh')}
          </Button>,
          <Button
            key="export"
            type="primary"
            icon={<FileExcelOutlined />}
            onClick={exportAgingDetails}
            loading={agingDetailExporting}
            disabled={agingDetailTotals.partnerCount === 0}
          >
            {t('actions.exportExcel')}
          </Button>,
          <Button key="close" onClick={closeAgingDetails}>
            {t('actions.close')}
          </Button>,
        ]}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={6}>
              <Card size="small" variant="borderless">
                <Statistic
                  title={t('reports.agingDetails.totalOpen')}
                  value={agingDetailTotals.totalOpenVnd}
                  formatter={(value) => formatMoneyText(value)}
                />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card size="small" variant="borderless">
                <Statistic
                  title={t('reports.agingDetails.overdueTotal')}
                  value={agingDetailOverdueTotal}
                  formatter={(value) => formatMoneyText(value)}
                />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card size="small" variant="borderless">
                <Statistic title={t('reports.agingDetails.partnerCount')} value={agingDetailTotals.partnerCount} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card size="small" variant="borderless">
                <Statistic title={t('reports.agingDetails.itemCount')} value={agingDetailTotals.itemCount} />
              </Card>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <Text type="secondary">
              {t('reports.agingDetails.summary', {
                partners: agingDetailTotals.partnerCount,
                items: agingDetailTotals.itemCount,
                amount: formatMoneyText(agingDetailTotals.totalOpenVnd),
              })}
            </Text>
            <Input.Search
              allowClear
              value={agingDetailSearchDraft}
              placeholder={t('reports.agingDetails.searchPlaceholder')}
              onChange={(event) => {
                setAgingDetailSearchDraft(event.target.value);
                if (!event.target.value) applyAgingDetailSearch('');
              }}
              onSearch={applyAgingDetailSearch}
              style={{ width: 360, maxWidth: '100%' }}
            />
          </div>

          {agingDetailError ? (
            <Text type="danger">{agingDetailError}</Text>
          ) : null}

          <Table<PartnerAgingRow>
            rowKey="_id"
            columns={agingDetailColumns}
            dataSource={agingDetailRows}
            loading={agingDetailLoading}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reports.agingDetails.noData')} /> }}
            scroll={{ x: 1120 }}
            expandable={{
              expandedRowRender: (record) => (
                <Table<PartnerAgingItem>
                  rowKey="_id"
                  columns={agingDetailItemColumns}
                  dataSource={record.items}
                  pagination={false}
                  size="small"
                  scroll={{ x: 980 }}
                  locale={{ emptyText: t('reports.agingDetails.noData') }}
                />
              ),
              rowExpandable: (record) => record.items.length > 0,
            }}
            pagination={{
              current: agingDetailMeta.current,
              pageSize: agingDetailMeta.pageSize,
              total: agingDetailMeta.total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => t('reports.agingDetails.partnerTotal', { total }),
            }}
            onChange={(pagination) => {
              setAgingDetailModal((prev) => ({
                ...prev,
                current: pagination.current || 1,
                pageSize: pagination.pageSize || prev.pageSize,
              }));
            }}
          />
        </Space>
      </Modal>

      {/* --- P&L Drilldown Modal --- */}
      <Modal
        title={<Space><SearchOutlined /> {t('reports.actions.drilldown')} - {plDrilldownModal.record?.label}</Space>}
        open={plDrilldownModal.open}
        onCancel={closePLDrilldown}
        footer={null}
        width={900}
      >
        <Table
          rowKey="_id"
          loading={plDrilldownModal.loading}
          dataSource={plDrilldownModal.data}
          pagination={{ 
            current: plDrilldownModal.meta.current, 
            pageSize: plDrilldownModal.meta.pageSize, 
            total: plDrilldownModal.meta.total 
          }}
          onChange={(pagination) => {
            if (plDrilldownModal.record) {
              fetchPLDrilldown(plDrilldownModal.record, pagination.current || 1, pagination.pageSize || 10);
            }
          }}
          columns={[
            { 
              title: t('reports.columns.date') || 'Date', 
              dataIndex: ['journalEntry', 'entryDate'], 
              render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-' 
            },
            { title: t('reports.columns.account') || 'Account Code', dataIndex: 'accountCode' },
            { 
              title: t('reports.columns.reference') || 'Reference / Document', 
              render: (_, record) => (
                <Text>
                  {record.journalEntry?.referenceId ? (
                    <Link href={getTraceabilityUrl(record.journalEntry.referenceType, record.journalEntry.referenceId)} target="_blank">
                      <Space size={4}>
                        <Text style={{ color: token.colorPrimary }}>{`${record.journalEntry.referenceType}: ${record.journalEntry.referenceId}`}</Text>
                        <ExportOutlined style={{ fontSize: 12, color: token.colorPrimary }} />
                      </Space>
                    </Link>
                  ) : record.journalEntry?.entryNumber}
                </Text>
              ) 
            },
            { 
              title: t('reports.columns.debit') || 'Debit', 
              dataIndex: 'debit', 
              align: 'right', 
              render: (val) => formatAccountingNumber(Number(val) || 0) 
            },
            { 
              title: t('reports.columns.credit') || 'Credit', 
              dataIndex: 'credit', 
              align: 'right', 
              render: (val) => formatAccountingNumber(Number(val) || 0) 
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default AccountingReports;


