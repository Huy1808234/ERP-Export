'use client';

import {
    ApartmentOutlined,
    ArrowDownOutlined,
    ArrowUpOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    DollarOutlined,
    FilterOutlined,
    ReloadOutlined,
    ShoppingCartOutlined,
    TruckOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import {
    Alert,
    Avatar,
    Button,
    Card,
    Col,
    DatePicker,
    Empty,
    Progress,
    Row,
    Skeleton,
    Space,
    Tabs,
    Tag,
    Timeline,
    Typography,
} from 'antd';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useLocale, useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/context/theme.context';
import { dashboardSurfaceStyle, chartCardStyle, metricCardStyle, makeSoftPanelStyle } from './styles';
import { EmptyState } from './components/EmptyState';
import { TrendChart } from './charts/TrendChart';
import { ShipmentDonutChart } from './charts/ShipmentDonutChart';
import { FinanceAgingChart } from './charts/FinanceAgingChart';
import { DashboardTrendPoint, DashboardChartPoint } from './types';
import {
    dashboardService,
    DashboardExecutiveData,
    DashboardKpiDrilldown,
    DashboardLowStockProduct,
} from '@/services/dashboard.service';
import { useCurrency } from '@/hooks/useCurrency';
import { canReadCostFields } from '@/lib/field-access';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const DASHBOARD_FRONTEND_CACHE_TTL_MS = 60_000;
const DASHBOARD_MANUAL_REFRESH_COOLDOWN_MS = 30_000;
const DSO_TARGET_DAYS = 60;

const SHIP_STATUS_COLOR: Record<string, string> = {
    BOOKED: 'blue',
    LOADING: 'orange',
    CUSTOMS_CLEARED: 'cyan',
    ON_BOARD: 'geekblue',
    ARRIVED: 'green',
    CLOSED: 'default',
};

const STATUS_COLORS = ['#38bdf8', '#22c55e', '#f59e0b', '#a78bfa', '#fb7185', '#14b8a6'];

type DashboardTabKey = 'overview' | 'sales' | 'logistics' | 'finance';
type DashboardBusinessAlertTone = 'danger' | 'warning' | 'info';
type UnknownRecord = Record<string, unknown>;

interface DashboardDataCacheEntry {
    executive: DashboardExecutiveData | null;
    drilldown: DashboardKpiDrilldown | null;
    fetchedAt: number;
}

// Exported to types.ts

interface DashboardMetricConfig {
    key: string;
    title: string;
    value: ReactNode;
    subtitle?: ReactNode;
    icon: ReactNode;
    color: string;
    trend?: number;
    trendLabel?: string;
}

interface DashboardBusinessAlert {
    id: string;
    tone: DashboardBusinessAlertTone;
    title: string;
    description: string;
}

const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});
const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const getNumber = (value: unknown, fallback = 0): number => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
};
const getString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const compactPercent = (value?: unknown): string => `${getNumber(value).toFixed(1)}%`;
const normalizeStatusKey = (status?: unknown): string => String(status || '').trim().toUpperCase();

const getLogisticsCostRiskColor = (ratioPercent?: unknown): string => {
    const ratio = getNumber(ratioPercent);
    if (ratio >= 15) return '#ef4444';
    if (ratio >= 8) return '#f59e0b';
    return '#22c55e';
};

const getDsoRiskColor = (dsoDays?: unknown): string => {
    const days = getNumber(dsoDays);
    if (days >= 90) return '#ef4444';
    if (days >= 60) return '#f59e0b';
    return '#22c55e';
};



const getLowStockThreshold = (product: DashboardLowStockProduct): number => {
    const productRecord = asRecord(product);
    const threshold = getNumber(productRecord.safetyStock ?? productRecord.minimumStock, 100);
    return Math.max(threshold || 100, 1);
};

const getLowStockRatioPercent = (product: DashboardLowStockProduct): number => {
    const productRecord = asRecord(product);
    return Math.min((getNumber(productRecord.currentStock) / getLowStockThreshold(product)) * 100, 100);
};

const getLowStockColor = (ratioPercent: number): string => {
    if (ratioPercent <= 35) return '#ef4444';
    if (ratioPercent <= 70) return '#f59e0b';
    return '#22c55e';
};

const getBusinessAlertColor = (tone: DashboardBusinessAlertTone): string => {
    if (tone === 'danger') return '#ef4444';
    if (tone === 'warning') return '#f59e0b';
    return '#38bdf8';
};

const makeShareChartData = (items: Array<{ label: string; value: number; statusKey?: string }>): DashboardChartPoint[] => {
    const total = items.reduce((sum, item) => sum + getNumber(item.value), 0);
    if (total <= 0) return [];

    return items
        .filter((item) => getNumber(item.value) > 0)
        .map((item) => ({
            label: item.label,
            value: Number(((getNumber(item.value) / total) * 100).toFixed(1)),
            secondary: getNumber(item.value),
            statusKey: item.statusKey,
        }));
};

// Exported to styles.ts

const makeDashboardSurfaceStyle = dashboardSurfaceStyle;
const makeCardStyle = chartCardStyle;

const SectionHeader = ({
    title,
    description,
    action,
    isDark,
}: {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    isDark: boolean;
}) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
            <Title level={5} style={{ margin: 0, fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a' }}>
                {title}
            </Title>
            {description ? (
                <Text style={{ display: 'block', marginTop: 4, color: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}>
                    {description}
                </Text>
            ) : null}
        </div>
        {action}
    </div>
);

const MetricCard = ({ metric, loading, isDark }: { metric: DashboardMetricConfig; loading: boolean; isDark: boolean }) => {
    const hasTrend = typeof metric.trend === 'number';
    const trendIsUp = getNumber(metric.trend) >= 0;

    return (
        <Card
            variant="borderless"
            className="dashboard-metric-card"
            style={{ ...metricCardStyle(isDark), height: '100%', overflow: 'hidden', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
            styles={{ body: { padding: 16 } }}
        >
            <Skeleton loading={loading} active paragraph={{ rows: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, minHeight: 96 }}>
                    <div style={{ minWidth: 0 }}>
                        <Text style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4, color: isDark ? '#94a3b8' : '#64748b' }}>
                            {metric.title}
                        </Text>
                        <div style={{ marginTop: 10, fontSize: 24, fontWeight: 950, lineHeight: 1.1, color: isDark ? '#f8fafc' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                            {metric.value}
                        </div>
                        {metric.subtitle ? (
                            <Text style={{ display: 'block', marginTop: 8, fontSize: 12, color: isDark ? '#cbd5e1' : '#64748b' }}>
                                {metric.subtitle}
                            </Text>
                        ) : null}
                        {hasTrend ? (
                            <Space size={6} style={{ marginTop: 12 }}>
                                <span
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '3px 8px',
                                        borderRadius: 999,
                                        background: trendIsUp ? 'rgba(34, 197, 94, 0.14)' : 'rgba(239, 68, 68, 0.14)',
                                        color: trendIsUp ? '#22c55e' : '#ef4444',
                                        fontSize: 12,
                                        fontWeight: 900,
                                    }}
                                >
                                    {trendIsUp ? <ArrowUpOutlined style={{ marginRight: 4 }} /> : <ArrowDownOutlined style={{ marginRight: 4 }} />}
                                    {Math.abs(getNumber(metric.trend)).toFixed(1)}%
                                </span>
                                <Text style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>{metric.trendLabel}</Text>
                            </Space>
                        ) : null}
                    </div>
                    <div
                        style={{
                            width: 46,
                            height: 46,
                            flex: '0 0 46px',
                            borderRadius: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 20,
                            background: `linear-gradient(135deg, ${metric.color}, ${metric.color}cc)`,
                            boxShadow: `0 16px 32px -18px ${metric.color}`,
                        }}
                    >
                        {metric.icon}
                    </div>
                </div>
            </Skeleton>
        </Card>
    );
};

// Exported to EmptyState.tsx

const AdminDashboard = () => {
    const t = useTranslations('Dashboard');
    const locale = useLocale();
    const numberLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
    const { data: session } = useSession();
    const { isDark } = useTheme();
    const { formatVND } = useCurrency();
    const canViewCost = canReadCostFields(session?.user);

    const dashboardText = useCallback((key: string, fallback: string) => {
        try {
            return t.has(key) ? t(key) : fallback;
        } catch {
            return fallback;
        }
    }, [t]);

    const [loading, setLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState<string | null>(null);
    const [data, setData] = useState<DashboardExecutiveData | null>(null);
    const [drilldown, setDrilldown] = useState<DashboardKpiDrilldown | null>(null);
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()]);
    const [activeTab, setActiveTab] = useState<DashboardTabKey>('overview');
    const [partnerTab, setPartnerTab] = useState<'customers' | 'suppliers'>('customers');
    const [marginTab, setMarginTab] = useState<'market' | 'product'>('market');
    const [activeLogisticsStatus, setActiveLogisticsStatus] = useState<string | null>(null);
    const [manualRefreshLockedUntil, setManualRefreshLockedUntil] = useState(0);
    const [refreshClock, setRefreshClock] = useState(0);
    const [chartRefreshing, setChartRefreshing] = useState(false);

    const dashboardDataCacheRef = useRef<Record<string, DashboardDataCacheEntry>>({});

    const sessionUser = asRecord(session?.user);
    const username = getString(sessionUser.username, 'anonymous');
    const dataRecord = asRecord(data);
    const drilldownRecord = asRecord(drilldown);
    const director = asRecord(dataRecord.director);
    const sales = asRecord(dataRecord.sales);
    const logistics = asRecord(dataRecord.logistics);
    const cashflowForecast = asRecord(director.cashflowForecast);

    const dateRangePresets = useMemo(() => {
        const now = dayjs();
        const quarterStartMonth = Math.floor(now.month() / 3) * 3;
        const quarterStart = now.month(quarterStartMonth).startOf('month');

        return [
            { label: dashboardText('presetToday', 'Hôm nay'), value: [now.startOf('day'), now.endOf('day')] as [Dayjs, Dayjs] },
            { label: dashboardText('presetThisMonth', 'Tháng này'), value: [now.startOf('month'), now.endOf('day')] as [Dayjs, Dayjs] },
            { label: dashboardText('presetThisQuarter', 'Quý này'), value: [quarterStart, now.endOf('day')] as [Dayjs, Dayjs] },
            { label: dashboardText('presetThisYear', 'Năm nay'), value: [now.startOf('year'), now.endOf('day')] as [Dayjs, Dayjs] },
        ];
    }, [dashboardText]);

    const getDashboardDataCacheKey = useCallback((start?: string, end?: string) => `${username}:${start || 'default'}:${end || 'default'}`, [username]);

    const fetchDashboardData = useCallback(async (
        start?: string,
        end?: string,
        options?: { force?: boolean; showGlobalLoading?: boolean },
    ) => {
        const cacheKey = getDashboardDataCacheKey(start, end);
        const cached = dashboardDataCacheRef.current[cacheKey];
        const now = Date.now();
        const shouldShowGlobalLoading = options?.showGlobalLoading !== false;

        setDashboardError(null);

        if (!options?.force && cached && now - cached.fetchedAt < DASHBOARD_FRONTEND_CACHE_TTL_MS) {
            setData(cached.executive);
            setDrilldown(cached.drilldown);
            if (shouldShowGlobalLoading) setLoading(false);
            return;
        }

        if (shouldShowGlobalLoading) setLoading(true);

        try {
            const [summaryRes, drilldownRes] = await Promise.all([
                dashboardService.getExecutive(start, end),
                dashboardService.getKpiDrilldown(start, end),
            ]);

            const executiveData = summaryRes?.data || null;
            const drilldownData = drilldownRes?.data || null;

            dashboardDataCacheRef.current[cacheKey] = {
                executive: executiveData,
                drilldown: drilldownData,
                fetchedAt: now,
            };

            setData(executiveData);
            setDrilldown(drilldownData);
        } catch (error) {
            console.error('Lỗi tải dữ liệu Dashboard:', error);
            setDashboardError(dashboardText('loadError', 'Không tải được dữ liệu dashboard. Vui lòng thử lại.'));
        } finally {
            if (shouldShowGlobalLoading) setLoading(false);
        }
    }, [dashboardText, getDashboardDataCacheKey]);

    useEffect(() => {
        fetchDashboardData(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'));
    }, [dateRange, fetchDashboardData]);

    useEffect(() => {
        if (!manualRefreshLockedUntil || Date.now() >= manualRefreshLockedUntil) return;

        const timer = window.setInterval(() => {
            const now = Date.now();
            setRefreshClock(now);
            if (now >= manualRefreshLockedUntil) {
                setManualRefreshLockedUntil(0);
                window.clearInterval(timer);
            }
        }, 1000);

        return () => window.clearInterval(timer);
    }, [manualRefreshLockedUntil]);

    const refreshDashboardData = useCallback(() => {
        const now = Date.now();
        if (now < manualRefreshLockedUntil || loading || chartRefreshing) return;

        setManualRefreshLockedUntil(now + DASHBOARD_MANUAL_REFRESH_COOLDOWN_MS);
        setRefreshClock(now);
        setChartRefreshing(true);
        fetchDashboardData(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'), {
            force: true,
            showGlobalLoading: false,
        }).finally(() => setChartRefreshing(false));
    }, [chartRefreshing, dateRange, fetchDashboardData, loading, manualRefreshLockedUntil]);

    const kpis = {
        revenueVnd: getNumber(director.revenueVnd),
        orders: getNumber(sales.totalPIs),
        activeShipments: getNumber(sales.activeShipments || sales.pendingShipments),
        customers: getNumber(director.totalCustomers),
        revenueGrowth: getNumber(director.revenueGrowth),
        orderGrowth: getNumber(sales.poGrowth),
        shipmentGrowth: getNumber(logistics.shipmentGrowth),
        conversionRate: getNumber(sales.conversionRate),
        pendingInquiries: getNumber(sales.pendingInquiries),
        submittedInquiries: getNumber(sales.submittedInquiries),
        quotedInquiries: getNumber(sales.quotedInquiries),
        onTimeRate: getNumber(director.onTimeRate),
        logisticsCostRatio: getNumber(director.logisticsCostRatio),
    };

    const historyRows = asArray<UnknownRecord>(director.history);
    const trendData: DashboardTrendPoint[] = historyRows.map((item) => {
        const revenue = getNumber(item.revenue);
        const profit = getNumber(item.profit);
        return {
            label: dayjs(getString(item.month)).isValid() ? dayjs(getString(item.month)).format('MMM YYYY') : getString(item.month, '-'),
            revenueMillion: Math.round(revenue / 1_000_000),
            orders: getNumber(item.orders),
            gpm: revenue > 0 && typeof item.profit === 'number' ? Number(((profit / revenue) * 100).toFixed(1)) : undefined,
        };
    });

    const statusBreakdown = asRecord(logistics.statusBreakdown);
    const shipmentStatusData = useMemo(() => makeShareChartData(
        Object.entries(statusBreakdown).map(([key, value]) => ({
            label: dashboardText(key.toLowerCase(), key),
            value: getNumber(value),
            statusKey: normalizeStatusKey(key),
        })),
    ), [dashboardText, statusBreakdown]);
    const activeStatusLabel = shipmentStatusData.find((point) => point.statusKey === activeLogisticsStatus)?.label || null;

    useEffect(() => {
        if (!activeLogisticsStatus || shipmentStatusData.length === 0) return;
        const stillExists = shipmentStatusData.some((point) => point.statusKey === activeLogisticsStatus);
        if (!stillExists) setActiveLogisticsStatus(null);
    }, [activeLogisticsStatus, shipmentStatusData]);

    const arAging = asRecord(director.arAging);
    const financeAgingData: DashboardChartPoint[] = [
        { label: dashboardText('agingCurrent', 'Current'), value: getNumber(arAging.current) },
        { label: '1-30d', value: getNumber(arAging.days_30) },
        { label: '31-60d', value: getNumber(arAging.days_60) },
        { label: '61-90d', value: getNumber(arAging.days_90) },
        { label: '>90d', value: getNumber(arAging.over_90) },
    ];
    const totalArAgingVnd = financeAgingData.reduce((sum, bucket) => sum + bucket.value, 0);
    const overdueArAgingVnd = financeAgingData.slice(1).reduce((sum, bucket) => sum + bucket.value, 0);

    const dso = asRecord(drilldownRecord.dso);
    const dsoDays = getNumber(dso.dsoDays || director.dso);
    const overdueInvoiceCount = getNumber(dso.overdueInvoiceCount);
    const overdueAmountVnd = getNumber(dso.overdueAmountVnd);

    const grossMarginByMarket = asArray<UnknownRecord>(drilldownRecord.grossMarginByMarket);
    const grossMarginByProduct = asArray<UnknownRecord>(drilldownRecord.grossMarginByProduct);
    const activeMarginRows = (marginTab === 'market' ? grossMarginByMarket : grossMarginByProduct)
        .filter((row) => typeof row.grossProfitMarginPercent === 'number')
        .slice(0, 5);
    const lowMarginMarket = canViewCost
        ? [...grossMarginByMarket].filter((row) => typeof row.grossProfitMarginPercent === 'number').sort((a, b) => getNumber(a.grossProfitMarginPercent) - getNumber(b.grossProfitMarginPercent))[0]
        : undefined;
    const lowMarginProduct = canViewCost
        ? [...grossMarginByProduct].filter((row) => typeof row.grossProfitMarginPercent === 'number').sort((a, b) => getNumber(a.grossProfitMarginPercent) - getNumber(b.grossProfitMarginPercent))[0]
        : undefined;

    const logisticsRevenue = asRecord(drilldownRecord.logisticsRevenue);
    const logisticsShipments = asArray<UnknownRecord>(logisticsRevenue.shipments);
    const filteredLogisticsShipments = (activeLogisticsStatus
        ? logisticsShipments.filter((shipment) => normalizeStatusKey(shipment.status) === activeLogisticsStatus)
        : logisticsShipments).slice(0, 6);
    const highestLogisticsShipment = canViewCost
        ? [...logisticsShipments]
            .filter((shipment) => getNumber(shipment.logisticsCostRatioPercent) > 0)
            .sort((a, b) => getNumber(b.logisticsCostRatioPercent) - getNumber(a.logisticsCostRatioPercent))[0]
        : undefined;
    const highestLogisticsCostRatio = getNumber(highestLogisticsShipment?.logisticsCostRatioPercent);

    const lowStockProducts = asArray<DashboardLowStockProduct>(dataRecord.lowStockProducts);
    const partnerRows = partnerTab === 'customers' ? asArray<UnknownRecord>(director.topBuyers) : asArray<UnknownRecord>(director.topSuppliers);
    const upcomingShipments = asArray<UnknownRecord>(logistics.upcomingShipments);
    const recentInquiries = asArray<UnknownRecord>(sales.recentInquiries);
    const topInventoryTurnover = asArray<UnknownRecord>(drilldownRecord.inventoryTurnoverByProduct).slice(0, 5);
    const expiringLcs = asArray<UnknownRecord>(logistics.expiringLCs);

    const businessAlerts: DashboardBusinessAlert[] = [
        ...(lowMarginMarket && getNumber(lowMarginMarket.grossProfitMarginPercent) < 25 ? [{
            id: `market-${getString(lowMarginMarket.key, getString(lowMarginMarket.label))}`,
            tone: 'warning' as const,
            title: dashboardText('lowMarketGpmAlertTitle', 'Thị trường có GPM thấp'),
            description: `${getString(lowMarginMarket.label)}: ${compactPercent(lowMarginMarket.grossProfitMarginPercent)} · ${dashboardText('revenue', 'Doanh thu')}: ${formatVND(getNumber(lowMarginMarket.revenueVnd))}`,
        }] : []),
        ...(lowMarginProduct && getNumber(lowMarginProduct.grossProfitMarginPercent) < 20 ? [{
            id: `product-${getString(lowMarginProduct.key, getString(lowMarginProduct.label))}`,
            tone: 'danger' as const,
            title: dashboardText('lowProductGpmAlertTitle', 'Dòng sản phẩm cần rà soát giá vốn'),
            description: `${getString(lowMarginProduct.label)}: ${compactPercent(lowMarginProduct.grossProfitMarginPercent)} · ${dashboardText('revenue', 'Doanh thu')}: ${formatVND(getNumber(lowMarginProduct.revenueVnd))}`,
        }] : []),
        ...(overdueInvoiceCount > 0 ? [{
            id: 'overdue-ar',
            tone: 'danger' as const,
            title: dashboardText('overdueArAlertTitle', 'Công nợ phải thu quá hạn'),
            description: `${overdueInvoiceCount} ${dashboardText('overdueAr', 'khoản quá hạn')} · ${formatVND(overdueAmountVnd)}`,
        }] : []),
        ...(highestLogisticsShipment && highestLogisticsCostRatio >= 15 ? [{
            id: `logistics-${getString(highestLogisticsShipment._id, getString(highestLogisticsShipment.shipmentNumber))}`,
            tone: 'info' as const,
            title: dashboardText('highLogisticsCostAlertTitle', 'Lô hàng có tỷ lệ logistics cao'),
            description: `${getString(highestLogisticsShipment.shipmentNumber)}: ${compactPercent(highestLogisticsShipment.logisticsCostRatioPercent)} · ${getString(highestLogisticsShipment.buyerName, dashboardText('unknownBuyer', 'Chưa rõ người mua'))}`,
        }] : []),
    ].slice(0, 4);

    const metricsByTab: Record<DashboardTabKey, DashboardMetricConfig[]> = {
        overview: [
            {
                key: 'revenue',
                title: dashboardText('revenue', 'Doanh thu'),
                value: formatVND(kpis.revenueVnd),
                subtitle: dashboardText('totalRevenue', 'Tổng doanh thu trong kỳ'),
                icon: <DollarOutlined />,
                color: '#38bdf8',
                trend: kpis.revenueGrowth,
                trendLabel: dashboardText('vsLastMonth', 'so với kỳ trước'),
            },
            {
                key: 'orders',
                title: dashboardText('orders', 'Đơn hàng'),
                value: kpis.orders.toLocaleString(numberLocale),
                subtitle: `${dashboardText('conversionRate', 'Tỷ lệ chuyển đổi')}: ${compactPercent(kpis.conversionRate)}`,
                icon: <ShoppingCartOutlined />,
                color: '#f59e0b',
                trend: kpis.orderGrowth,
                trendLabel: dashboardText('vsLastMonth', 'so với kỳ trước'),
            },
            {
                key: 'shipments',
                title: dashboardText('shipments', 'Lô hàng'),
                value: kpis.activeShipments.toLocaleString(numberLocale),
                subtitle: `${dashboardText('onTimeShipment', 'Đúng hạn')}: ${compactPercent(kpis.onTimeRate)}`,
                icon: <TruckOutlined />,
                color: '#22c55e',
                trend: kpis.shipmentGrowth,
                trendLabel: dashboardText('vsLastMonth', 'so với kỳ trước'),
            },
            {
                key: 'dso',
                title: dashboardText('dso', 'DSO'),
                value: `${dsoDays} ${dashboardText('days', 'ngày')}`,
                subtitle: `${overdueInvoiceCount} ${dashboardText('overdueAr', 'khoản quá hạn')}`,
                icon: <ClockCircleOutlined />,
                color: getDsoRiskColor(dsoDays),
            },
        ],
        sales: [
            {
                key: 'salesRevenue',
                title: dashboardText('revenue', 'Doanh thu'),
                value: formatVND(kpis.revenueVnd),
                subtitle: dashboardText('salesTrendChartDesc', 'Diễn biến doanh thu theo lịch sử.'),
                icon: <DollarOutlined />,
                color: '#38bdf8',
                trend: kpis.revenueGrowth,
                trendLabel: dashboardText('vsLastMonth', 'so với kỳ trước'),
            },
            {
                key: 'salesOrders',
                title: dashboardText('orders', 'Đơn hàng'),
                value: kpis.orders.toLocaleString(numberLocale),
                subtitle: `${dashboardText('confirmedContracts', 'Hợp đồng xác nhận')}: ${getNumber(sales.confirmedContracts)}`,
                icon: <ShoppingCartOutlined />,
                color: '#f59e0b',
                trend: kpis.orderGrowth,
                trendLabel: dashboardText('vsLastMonth', 'so với kỳ trước'),
            },
            {
                key: 'customers',
                title: dashboardText('customers', 'Khách hàng'),
                value: kpis.customers.toLocaleString(numberLocale),
                subtitle: dashboardText('customerPortfolio', 'Danh mục khách hàng đang theo dõi'),
                icon: <ApartmentOutlined />,
                color: '#a78bfa',
            },
            {
                key: 'pendingInquiries',
                title: dashboardText('pendingInquiries', 'RFQ cần xử lý'),
                value: kpis.pendingInquiries.toLocaleString(numberLocale),
                subtitle: `${dashboardText('newInquiries', 'Mới trong kỳ')}: ${kpis.submittedInquiries.toLocaleString(numberLocale)} / ${dashboardText('quoted', 'Đã báo giá')}: ${kpis.quotedInquiries.toLocaleString(numberLocale)}`,
                icon: <ClockCircleOutlined />,
                color: kpis.pendingInquiries > 0 ? '#f59e0b' : '#22c55e',
            },
            {
                key: 'conversionRate',
                title: dashboardText('conversionRate', 'Tỷ lệ chuyển đổi'),
                value: compactPercent(kpis.conversionRate),
                subtitle: dashboardText('salesPipelineHealth', 'Sức khỏe phễu bán hàng (Pipeline)'),
                icon: <CheckCircleOutlined />,
                color: '#22c55e',
            },
        ],
        logistics: [
            {
                key: 'activeShipments',
                title: dashboardText('activeShipments', 'Lô hàng đang xử lý'),
                value: kpis.activeShipments.toLocaleString(numberLocale),
                subtitle: activeStatusLabel ? `${dashboardText('filteredByStatus', 'Đang lọc')}: ${activeStatusLabel}` : dashboardText('shipmentOperationLoad', 'Tải vận hành logistics'),
                icon: <TruckOutlined />,
                color: '#22c55e',
                trend: kpis.shipmentGrowth,
                trendLabel: dashboardText('vsLastMonth', 'so với kỳ trước'),
            },
            {
                key: 'onTimeShipment',
                title: dashboardText('onTimeShipment', 'Giao hàng đúng hạn'),
                value: compactPercent(kpis.onTimeRate),
                subtitle: dashboardText('onTimeShipmentDesc', 'Tỷ lệ giao hàng đúng hạn'),
                icon: <CheckCircleOutlined />,
                color: '#38bdf8',
            },
            {
                key: 'logisticsCostRatio',
                title: dashboardText('logisticsRevenue', 'Chi phí logistics / DT'),
                value: canViewCost ? compactPercent(kpis.logisticsCostRatio) : dashboardText('hiddenByPermission', 'Ẩn theo quyền'),
                subtitle: dashboardText('logisticsCostOverRevenue', 'Tỷ lệ chi phí logistics trên doanh thu'),
                icon: <DollarOutlined />,
                color: getLogisticsCostRiskColor(kpis.logisticsCostRatio),
            },
            {
                key: 'expiringLc',
                title: dashboardText('expiringLc', 'LC sắp hết hạn'),
                value: expiringLcs.length.toLocaleString(numberLocale),
                subtitle: dashboardText('next14Days', 'Trong 14 ngày tới'),
                icon: <ClockCircleOutlined />,
                color: '#f59e0b',
            },
        ],
        finance: [
            {
                key: 'cashflow',
                title: dashboardText('cashflow30d', 'Dòng tiền 30 ngày'),
                value: formatVND(getNumber(cashflowForecast.netVnd)),
                subtitle: `${dashboardText('cashIn', 'Thu')} ${formatVND(getNumber(cashflowForecast.inflowVnd))} / ${dashboardText('cashOut', 'Chi')} ${formatVND(getNumber(cashflowForecast.outflowVnd))}`,
                icon: <DollarOutlined />,
                color: getNumber(cashflowForecast.netVnd) >= 0 ? '#22c55e' : '#ef4444',
            },
            {
                key: 'dso',
                title: dashboardText('dso', 'DSO'),
                value: `${dsoDays} ${dashboardText('days', 'ngày')}`,
                subtitle: dashboardText('dsoLong', 'Days Sales Outstanding'),
                icon: <ClockCircleOutlined />,
                color: getDsoRiskColor(dsoDays),
            },
            {
                key: 'overdueAr',
                title: dashboardText('overdueAr', 'AR quá hạn'),
                value: overdueInvoiceCount.toLocaleString(numberLocale),
                subtitle: formatVND(overdueAmountVnd),
                icon: <WarningOutlined />,
                color: overdueInvoiceCount > 0 ? '#ef4444' : '#22c55e',
            },
            {
                key: 'totalOpenAr',
                title: dashboardText('totalOpenAr', 'Tổng AR mở'),
                value: formatVND(totalArAgingVnd),
                subtitle: `${dashboardText('overdueAr', 'Quá hạn')}: ${formatVND(overdueArAgingVnd)}`,
                icon: <ApartmentOutlined />,
                color: '#f59e0b',
            },
        ],
    };

    const dashboardTabs = [
        { key: 'overview', label: dashboardText('tabOverview', 'Tổng quan') },
        { key: 'sales', label: dashboardText('tabSales', 'Bán hàng & Doanh thu') },
        { key: 'logistics', label: dashboardText('tabLogistics', 'Vận tải & Kho bãi') },
        { key: 'finance', label: dashboardText('tabFinance', 'Tài chính') },
    ];

    const manualRefreshRemainingSeconds = Math.max(0, Math.ceil((manualRefreshLockedUntil - refreshClock) / 1000));
    const isManualRefreshDisabled = loading || chartRefreshing || manualRefreshRemainingSeconds > 0;
    const renderHeroChart = () => {
        if (activeTab === 'logistics') return <ShipmentDonutChart data={shipmentStatusData as DashboardChartPoint[]} activeStatus={activeLogisticsStatus} onStatusChange={setActiveLogisticsStatus} />;
        if (activeTab === 'finance') return <FinanceAgingChart data={financeAgingData as DashboardChartPoint[]} />;
        return <TrendChart data={trendData as DashboardTrendPoint[]} canViewCost={canViewCost} />;
    };

    const heroTitle = activeTab === 'logistics'
        ? dashboardText('logisticsShareChartTitle', 'Tỷ trọng trạng thái lô hàng')
        : activeTab === 'finance'
            ? dashboardText('financeShareChartTitle', 'Phân tích tuổi nợ (AR Aging)')
            : dashboardText('overviewTrendChartTitle', 'Xu hướng doanh thu và đơn hàng');

    const heroDescription = activeTab === 'logistics'
        ? dashboardText('logisticsShareChartDesc', 'Theo dõi tải vận hành theo từng trạng thái lô hàng.')
        : activeTab === 'finance'
            ? dashboardText('financeShareChartDesc', 'Giá trị phải thu còn mở theo nhóm tuổi nợ.')
            : dashboardText('overviewTrendChartDesc', 'Biểu đồ chính kết hợp doanh thu, đơn hàng và GPM theo lịch sử.');

    const renderBusinessAnalysisPanel = () => (
        <Card variant="borderless" style={{ ...makeCardStyle(isDark), height: '100%' }} styles={{ body: { padding: 18, height: '100%' } }}>
            <SectionHeader
                title={dashboardText('businessAnalysis', 'Phân tích kinh doanh')}
                description={dashboardText('businessAnalysisDesc', 'Tập trung vào biên lợi nhuận, doanh thu và điểm cần tối ưu.')}
                isDark={isDark}
                action={!canViewCost ? <Tag color="gold">{dashboardText('hiddenByPermission', 'Ẩn theo quyền')}</Tag> : null}
            />
            <Tabs
                size="small"
                activeKey={marginTab}
                onChange={(key) => setMarginTab(key as 'market' | 'product')}
                items={[
                    { key: 'market', label: dashboardText('byMarket', 'Theo thị trường') },
                    { key: 'product', label: dashboardText('byProduct', 'Theo sản phẩm') },
                ]}
                style={{ marginBottom: 16 }}
            />
            {canViewCost && activeMarginRows.length ? (
                <Space orientation="vertical" size={14} style={{ width: '100%' }}>
                    {activeMarginRows.map((row) => {
                        const gpm = getNumber(row.grossProfitMarginPercent);
                        const color = gpm < 20 ? '#ef4444' : gpm < 30 ? '#f59e0b' : '#10b981';
                        return (
                            <div key={getString(row.key, getString(row.label))} style={{ ...makeSoftPanelStyle(isDark), padding: 16 }}>
                                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <Text strong ellipsis style={{ maxWidth: 280, color: isDark ? '#f8fafc' : '#0f172a', fontSize: 14 }}>{getString(row.label, '-')}</Text>
                                    <Text strong style={{ color, fontSize: 15 }}>{compactPercent(gpm)}</Text>
                                </Space>
                                <Progress percent={Math.min(gpm, 100)} showInfo={false} strokeColor={{ '0%': `${color}88`, '100%': color }} railColor={isDark ? 'rgba(148, 163, 184, 0.1)' : '#f1f5f9'} size={8} />
                                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 6 }}>{dashboardText('revenue', 'Doanh thu')}: <span style={{ color: isDark ? '#cbd5e1' : '#475569', fontWeight: 500 }}>{formatVND(getNumber(row.revenueVnd))}</span></Text>
                            </div>
                        );
                    })}
                </Space>
            ) : (
                <EmptyState title={dashboardText('noData', 'Chưa có dữ liệu')} description={canViewCost ? dashboardText('noData', 'Chưa có dữ liệu') : dashboardText('hiddenByPermission', 'Ẩn theo quyền')} isDark={isDark} />
            )}
        </Card>
    );

    const renderFinanceFocusPanel = () => (
        <Card variant="borderless" style={{ ...makeCardStyle(isDark), height: '100%' }} styles={{ body: { padding: 18, height: '100%' } }}>
            <SectionHeader
                title={dashboardText('financeFocus', 'Trọng tâm tài chính')}
                description={dashboardText('financeFocusDesc', 'Theo dõi DSO, AR mở và hóa đơn quá hạn.')}
                isDark={isDark}
            />
            <Row gutter={[12, 12]} align="stretch">
                <Col xs={24} sm={8}>
                    <div style={{ ...makeSoftPanelStyle(isDark), padding: 14, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Text type="secondary">{dashboardText('dso', 'DSO')}</Text>
                        <Title level={3} style={{ margin: '6px 0', color: getDsoRiskColor(dsoDays) }}>{dsoDays}</Title>
                        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                            <Progress percent={Math.min((dsoDays / DSO_TARGET_DAYS) * 100, 100)} showInfo={false} strokeColor={getDsoRiskColor(dsoDays)} />
                        </div>
                    </div>
                </Col>
                <Col xs={24} sm={8}>
                    <div style={{ ...makeSoftPanelStyle(isDark), padding: 14, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Text type="secondary">{dashboardText('overdueAr', 'AR quá hạn')}</Text>
                        <Title level={3} style={{ margin: '6px 0', color: overdueInvoiceCount > 0 ? '#ef4444' : '#22c55e' }}>{overdueInvoiceCount}</Title>
                        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                            <Text>{formatVND(overdueAmountVnd)}</Text>
                        </div>
                    </div>
                </Col>
                <Col xs={24} sm={8}>
                    <div style={{ ...makeSoftPanelStyle(isDark), padding: 14, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Text type="secondary">{dashboardText('totalOpenAr', 'Tổng AR mở')}</Text>
                        <Title level={3} style={{ margin: '6px 0' }}>{formatVND(totalArAgingVnd)}</Title>
                        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                            <Text type="secondary">{formatVND(overdueArAgingVnd)} {dashboardText('overdueAr', 'quá hạn')}</Text>
                        </div>
                    </div>
                </Col>
            </Row>
        </Card>
    );

    const renderLogisticsFocusPanel = () => (
        <Card variant="borderless" style={{ ...makeCardStyle(isDark), height: '100%' }} styles={{ body: { padding: 18, height: '100%' } }}>
            <SectionHeader
                title={dashboardText('logisticsRevenue', 'Theo dõi lô hàng')}
                description={activeStatusLabel ? `${dashboardText('filteredByStatus', 'Đang lọc trạng thái')}: ${activeStatusLabel}` : dashboardText('logisticsRevenueDrilldown', 'Doanh thu và tỷ lệ chi phí theo lô hàng.')}
                isDark={isDark}
                action={activeLogisticsStatus ? <Button type="text" size="small" onClick={() => setActiveLogisticsStatus(null)}>{dashboardText('clearFilter', 'Bỏ lọc')}</Button> : null}
            />
            {filteredLogisticsShipments.length ? (
                <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                    {filteredLogisticsShipments.map((shipment) => {
                        const ratioColor = getLogisticsCostRiskColor(shipment.logisticsCostRatioPercent);
                        return (
                            <div key={getString(shipment._id, getString(shipment.shipmentNumber))} style={{ ...makeSoftPanelStyle(isDark), display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, padding: 12 }}>
                                <div style={{ minWidth: 0 }}>
                                    <Text strong ellipsis style={{ display: 'block', color: isDark ? '#e2e8f0' : '#0f172a' }}>{getString(shipment.shipmentNumber, '-')}</Text>
                                    <Text type="secondary" ellipsis style={{ display: 'block' }}>{getString(shipment.buyerName, dashboardText('unknownBuyer', 'Chưa rõ người mua'))}</Text>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <Text strong>{formatVND(getNumber(shipment.revenueVnd))}</Text>
                                    <br />
                                    <Text style={{ color: ratioColor }}>{canViewCost ? compactPercent(shipment.logisticsCostRatioPercent) : dashboardText('hiddenByPermission', 'Ẩn theo quyền')}</Text>
                                </div>
                            </div>
                        );
                    })}
                </Space>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={dashboardText('noData', 'Chưa có dữ liệu')} />}
        </Card>
    );

    const renderInventoryPanel = () => (
        <Card variant="borderless" style={{ ...makeCardStyle(isDark), height: '100%' }} styles={{ body: { padding: 18, height: '100%' } }}>
            <SectionHeader
                title={dashboardText('inventoryTurnover', 'Vòng quay tồn kho')}
                description={dashboardText('inventoryTurnoverDesc', 'Top sản phẩm theo số lượng bán và turnover.')}
                isDark={isDark}
            />
            {topInventoryTurnover.length ? (
                <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                    {topInventoryTurnover.map((item, index) => (
                        <div key={getString(item._id, getString(item.sku, String(index)))} style={{ ...makeSoftPanelStyle(isDark), display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: 10 }}>
                            <Avatar size={24} style={{ background: STATUS_COLORS[index % STATUS_COLORS.length] }}>{index + 1}</Avatar>
                            <Text ellipsis style={{ color: isDark ? '#e2e8f0' : '#0f172a' }}>{getString(item.productName, getString(item.sku, '-'))}</Text>
                            <Text strong>{getNumber(item.turnover).toFixed(2)}x</Text>
                        </div>
                    ))}
                </Space>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={dashboardText('noData', 'Chưa có dữ liệu')} />}
        </Card>
    );

    const renderActionRail = () => (
        <Space orientation="vertical" size={14} style={{ width: '100%' }}>
            <Card variant="borderless" style={makeCardStyle(isDark)} styles={{ body: { padding: 16 } }}>
                <SectionHeader title={dashboardText('businessAlerts', 'Cảnh báo điều hành')} isDark={isDark} />
                {businessAlerts.length ? (
                    <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                        {businessAlerts.map((alert) => {
                            const color = getBusinessAlertColor(alert.tone);
                            return (
                                <div key={alert.id} style={{ display: 'flex', gap: 10, padding: 12, borderRadius: 14, background: `${color}14`, border: `1px solid ${color}33` }}>
                                    <WarningOutlined style={{ color, marginTop: 3 }} />
                                    <div style={{ minWidth: 0 }}>
                                        <Text strong style={{ color }}>{alert.title}</Text>
                                        <Text style={{ display: 'block', fontSize: 12, color: isDark ? '#cbd5e1' : '#64748b' }}>{alert.description}</Text>
                                    </div>
                                </div>
                            );
                        })}
                    </Space>
                ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={dashboardText('noBusinessAlert', 'Không có cảnh báo nổi bật')} />}
            </Card>

            {activeTab === 'sales' ? (
                <Card variant="borderless" style={makeCardStyle(isDark)} styles={{ body: { padding: 16 } }}>
                    <SectionHeader title={dashboardText('recentInquiries', 'RFQ mới từ Customer Portal')} isDark={isDark} />
                    {recentInquiries.length ? (
                        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                            {recentInquiries.map((inquiry) => (
                                <div key={getString(inquiry._id, getString(inquiry.inquiryNumber))} style={{ ...makeSoftPanelStyle(isDark), padding: 12 }}>
                                    <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Space orientation="vertical" size={2} style={{ minWidth: 0 }}>
                                            <Text strong ellipsis style={{ maxWidth: 190, color: isDark ? '#f8fafc' : '#0f172a' }}>
                                                {getString(inquiry.inquiryNumber, getString(inquiry._id, '-'))}
                                            </Text>
                                            <Text type="secondary" ellipsis style={{ maxWidth: 210, fontSize: 12 }}>
                                                {getString(inquiry.customerName, '-')} · {getNumber(inquiry.lineCount, 1)} SKU
                                            </Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {getString(inquiry.incoterm, '-')} {getString(inquiry.destinationPort) ? `· ${getString(inquiry.destinationPort)}` : ''}
                                            </Text>
                                        </Space>
                                        <Tag color={normalizeStatusKey(inquiry.status) === 'IN_REVIEW' ? 'blue' : 'gold'} style={{ margin: 0 }}>
                                            {getString(inquiry.status, 'SUBMITTED')}
                                        </Tag>
                                    </Space>
                                </div>
                            ))}
                        </Space>
                    ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={dashboardText('noRecentInquiry', 'Chưa có RFQ cần xử lý')} />}
                </Card>
            ) : null}

            <Card variant="borderless" style={makeCardStyle(isDark)} styles={{ body: { padding: 16 } }}>
                <SectionHeader title={dashboardText('lowStockProducts', 'Sản phẩm sắp hết hàng')} isDark={isDark} />
                {lowStockProducts.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {lowStockProducts.slice(0, 5).map((product) => {
                            const productRecord = asRecord(product);
                            const ratio = getLowStockRatioPercent(product);
                            const color = getLowStockColor(ratio);
                            const currentStock = getNumber(productRecord.currentStock);
                            const threshold = getLowStockThreshold(product);
                            return (
                                <div key={getString(productRecord._id, getString(productRecord.sku, getString(productRecord.productName)))}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, alignItems: 'flex-end' }}>
                                        <Text strong ellipsis style={{ maxWidth: 180, color: isDark ? '#e2e8f0' : '#334155', fontSize: 13 }}>{getString(productRecord.sku, getString(productRecord.productName, '-'))}</Text>
                                        <Text style={{ color, fontSize: 12, fontWeight: 600 }}>{currentStock.toLocaleString(numberLocale)} / {threshold.toLocaleString(numberLocale)}</Text>
                                    </div>
                                    <Progress percent={ratio} showInfo={false} strokeColor={color} railColor={isDark ? 'rgba(148, 163, 184, 0.12)' : '#e2e8f0'} size={6} style={{ marginBottom: 0 }} />
                                </div>
                            );
                        })}
                    </div>
                ) : <EmptyState title={dashboardText('noLowStockProduct', 'Không có sản phẩm sắp hết hàng')} description="" isDark={isDark} />}
            </Card>

            <Card variant="borderless" style={makeCardStyle(isDark)} styles={{ body: { padding: 16 } }}>
                <SectionHeader
                    title={partnerTab === 'customers' ? dashboardText('topCustomers', 'Top khách hàng') : dashboardText('topSuppliers', 'Top nhà cung cấp')}
                    isDark={isDark}
                    action={(
                        <Tabs
                            size="small"
                            activeKey={partnerTab}
                            onChange={(key) => setPartnerTab(key as 'customers' | 'suppliers')}
                            items={[
                                { key: 'customers', label: dashboardText('customers', 'Khách hàng') },
                                { key: 'suppliers', label: dashboardText('suppliers', 'NCC') },
                            ]}
                        />
                    )}
                />
                {partnerRows.length ? (() => {
                    const maxVal = Math.max(...partnerRows.map(p => getNumber(p.total || p.revenueVnd || p.amountVnd)), 1);
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                            {partnerRows.slice(0, 5).map((partner, index) => {
                                const val = getNumber(partner.total || partner.revenueVnd || partner.amountVnd);
                                const percent = (val / maxVal) * 100;
                                const barColor = index === 0 ? '#06b6d4' : index === 1 ? '#38bdf8' : (isDark ? '#334155' : '#94a3b8');
                                return (
                                    <div key={getString(partner._id, getString(partner.name, String(index)))}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <Text ellipsis style={{ maxWidth: 160, color: isDark ? '#f8fafc' : '#0f172a', fontSize: 13, fontWeight: 500 }}>{getString(partner.name, '-')}</Text>
                                            <Text strong style={{ fontSize: 13, color: isDark ? '#cbd5e1' : '#475569' }}>{formatVND(val)}</Text>
                                        </div>
                                        <div style={{ width: '100%', height: 8, background: isDark ? 'rgba(148, 163, 184, 0.1)' : '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                                            <div style={{ width: `${percent}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.3s' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })() : <EmptyState title={dashboardText('noData', 'Chưa có dữ liệu')} description="" isDark={isDark} />}
            </Card>

            <Card variant="borderless" style={makeCardStyle(isDark)} styles={{ body: { padding: 16 } }}>
                <SectionHeader title={dashboardText('upcomingShipments', 'Lô hàng sắp tới')} isDark={isDark} />
                {upcomingShipments.length ? (
                    <div style={{ ...makeSoftPanelStyle(isDark), padding: '20px 16px 4px 16px' }}>
                        <Timeline
                            items={upcomingShipments.slice(0, 5).map((shipment) => ({
                                color: SHIP_STATUS_COLOR[normalizeStatusKey(shipment.status)] || '#3b82f6',
                                content: (
                                    <div style={{ marginBottom: 12 }}>
                                        <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Space orientation="vertical" size={2}>
                                                <Text strong style={{ color: isDark ? '#f8fafc' : '#0f172a', fontSize: 14 }}>{getString(shipment.number || shipment.shipmentNumber, '-')}</Text>
                                                <Text type="secondary" style={{ fontSize: 12 }}>ETA: {shipment.eta ? dayjs(getString(shipment.eta)).format('DD/MM/YYYY') : dashboardText('unknownDate', 'Chưa có ngày')}</Text>
                                            </Space>
                                            <Tag style={{ margin: 0, borderRadius: 4 }} color={SHIP_STATUS_COLOR[normalizeStatusKey(shipment.status)] || 'processing'}>{getString(shipment.status, '-')}</Tag>
                                        </Space>
                                    </div>
                                ),
                            }))}
                        />
                    </div>
                ) : <EmptyState title={dashboardText('noUpcomingShipment', 'Không có lô hàng sắp tới')} description="" isDark={isDark} />}
            </Card>
        </Space>
    );

    const renderSecondaryPanels = () => {
        if (activeTab === 'finance') {
            return (
                <Row gutter={[20, 20]} align="stretch">
                    <Col xs={24} lg={12}>{renderFinanceFocusPanel()}</Col>
                    <Col xs={24} lg={12}>{renderBusinessAnalysisPanel()}</Col>
                </Row>
            );
        }
        if (activeTab === 'logistics') {
            return (
                <Row gutter={[20, 20]} align="stretch">
                    <Col xs={24} lg={14}>{renderLogisticsFocusPanel()}</Col>
                    <Col xs={24} lg={10}>{renderInventoryPanel()}</Col>
                </Row>
            );
        }
        return (
            <Row gutter={[20, 20]} align="stretch">
                <Col xs={24} lg={12}>{renderBusinessAnalysisPanel()}</Col>
                <Col xs={24} lg={12}>{renderFinanceFocusPanel()}</Col>
            </Row>
        );
    };

    return (
        <div style={makeDashboardSurfaceStyle(isDark)}>
            <style>{`
                .dashboard-metric-card:hover {
                    transform: translateY(-4px);
                    box-shadow: ${isDark ? '0 12px 24px -6px rgba(0,0,0,0.6)' : '0 12px 24px -6px rgba(15,23,42,0.1)'} !important;
                }
                .dashboard-hero-split {
                    grid-template-columns: minmax(220px, 0.9fr) minmax(230px, 1fr);
                }
                @media (max-width: 760px) {
                    .dashboard-hero-split { grid-template-columns: 1fr !important; }
                }
            `}</style>

            {/* 1. Header Area: Z-Pattern Top */}
            <Card variant="borderless" style={{ ...makeCardStyle(isDark, 16), marginBottom: 20 }} styles={{ body: { padding: 20 } }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div style={{ minWidth: 0 }}>
                        <Space size={8} style={{ marginBottom: 8 }}>
                            <Tag color="cyan">Mini ERP</Tag>
                            <Tag color={canViewCost ? 'green' : 'gold'}>{canViewCost ? dashboardText('fullAccess', 'Đầy đủ dữ liệu') : dashboardText('limitedAccess', 'Dữ liệu giới hạn')}</Tag>
                        </Space>
                        <Title level={2} style={{ margin: 0, fontWeight: 950, color: isDark ? '#f8fafc' : '#0f172a' }}>
                            {dashboardText('executiveDashboard', 'Bảng điều hành')}
                        </Title>
                        <Text style={{ display: 'block', marginTop: 6, color: isDark ? '#94a3b8' : '#64748b' }}>
                            {dashboardText('dashboardSubtitle', 'Tổng hợp KPI, xu hướng và cảnh báo vận hành theo thời gian thực tế.')}
                        </Text>
                    </div>

                    <Space wrap size={10} align="start">
                        <RangePicker
                            allowClear={false}
                            value={dateRange}
                            presets={dateRangePresets}
                            onChange={(dates) => {
                                if (!dates?.[0] || !dates?.[1]) return;
                                setDateRange([dates[0], dates[1]]);
                            }}
                        />
                        <Button
                            type="primary"
                            icon={<ReloadOutlined spin={chartRefreshing} />}
                            disabled={isManualRefreshDisabled}
                            onClick={refreshDashboardData}
                        >
                            {manualRefreshRemainingSeconds > 0
                                ? `${dashboardText('refreshIn', 'Làm mới sau')} ${manualRefreshRemainingSeconds}s`
                                : dashboardText('refresh', 'Làm mới')}
                        </Button>
                    </Space>
                </div>

                <Tabs
                    activeKey={activeTab}
                    onChange={(key) => setActiveTab(key as DashboardTabKey)}
                    items={dashboardTabs.map((tab) => ({ key: tab.key, label: tab.label }))}
                    style={{ marginBottom: -16 }}
                />
            </Card>

            {dashboardError ? <Alert type="error" showIcon title={dashboardError} style={{ marginBottom: 20 }} /> : null}

            {/* 2. KPI Cards: Z-Pattern Middle-Top */}
            <Row gutter={[20, 20]} align="stretch" style={{ marginBottom: 20 }}>
                {metricsByTab[activeTab].map((metric) => (
                    <Col key={metric.key} xs={24} sm={12} xl={6}>
                        <MetricCard metric={metric} loading={loading} isDark={isDark} />
                    </Col>
                ))}
            </Row>

            {/* 3. Main Chart & Action Rail: Z-Pattern Middle */}
            <Row gutter={[20, 20]} align="stretch" style={{ marginBottom: 20 }}>
                {/* Main Revenue/Orders Chart - 16 cols */}
                <Col xs={24} lg={16}>
                    <Card variant="borderless" style={{ ...makeCardStyle(isDark, 16), height: '100%' }} styles={{ body: { padding: 20, height: '100%', display: 'flex', flexDirection: 'column' } }}>
                        <SectionHeader
                            title={heroTitle}
                            description={heroDescription}
                            isDark={isDark}
                            action={<Tag icon={<FilterOutlined />} color={activeStatusLabel ? 'cyan' : 'default'}>{activeStatusLabel || dashboardText('allData', 'Tất cả dữ liệu')}</Tag>}
                        />
                        <div style={{ flex: 1, minHeight: 360 }}>
                            <Skeleton loading={loading} active paragraph={{ rows: 8 }}>
                                {renderHeroChart()}
                            </Skeleton>
                        </div>
                    </Card>
                </Col>

                {/* Alerts / Low Stock / Upcoming - 8 cols */}
                <Col xs={24} lg={8}>
                    {renderActionRail()}
                </Col>
            </Row>

            {/* 4. Secondary Analysis: Z-Pattern Bottom */}
            {renderSecondaryPanels()}
        </div>
    );
};

export default AdminDashboard;
