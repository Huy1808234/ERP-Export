'use client'

import {
    ApartmentOutlined,
    ArrowDownOutlined,
    ArrowUpOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseOutlined,
    DollarOutlined,
    DownloadOutlined,
    GlobalOutlined,
    HolderOutlined,
    ShoppingCartOutlined,
    TruckOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Tag, Timeline, Typography, Avatar, Space, Button, DatePicker, Skeleton, theme, Progress, Drawer, Checkbox, Empty } from 'antd';
import { type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/context/theme.context';
import {
    ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { motion } from 'framer-motion';
import {
    dashboardService,
    DashboardExecutiveData,
    DashboardKpiDrilldown,
    DashboardLowStockProduct,
    DashboardPartnerLine,
    DashboardUpcomingShipment,
    MarginDrilldownLine,
} from '@/services/dashboard.service';
import dayjs from 'dayjs';
import { MoreOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { Dropdown, Tabs } from 'antd';

import { useTranslations } from 'next-intl';
import { useCurrency } from '@/hooks/useCurrency';
import { GLOBAL_EXCHANGE_RATE } from '@/constants/currency.config';
import { useSession } from 'next-auth/react';
import { canReadCostFields } from '@/lib/field-access';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const SHIP_STATUS_COLOR: Record<string, string> = {
    BOOKED: 'blue', LOADING: 'orange', CUSTOMS_CLEARED: 'cyan', ON_BOARD: 'geekblue', ARRIVED: 'green', CLOSED: 'default',
};
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

type ChartTooltipName = string | number;

interface RevenueChartPoint {
    month: string;
    revenue: number;
    orders: number;
}

interface ShipmentStat {
    name: string;
    value: number;
}

const compactPercent = (value?: number) => `${Number(value || 0).toFixed(1)}%`;

interface DashboardMetricCardProps {
    _id?: string;
    label: string;
    value: ReactNode;
    icon: ReactNode;
    color: string;
    loading: boolean;
    isDark: boolean;
    caption?: ReactNode;
    action?: ReactNode;
    valueColor?: string;
    onClick?: () => void;
    isEditing?: boolean;
    isDragging?: boolean;
    isPressing?: boolean;
    dragHandle?: ReactNode;
    editAction?: ReactNode;
    resizeHandle?: ReactNode;
    draggable?: boolean;
    onDragStart?: (event: DragEvent<HTMLElement>) => void;
    onDragEnd?: () => void;
    onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp?: () => void;
    onPointerLeave?: () => void;
    onPointerCancel?: () => void;
    trend?: {
        value: number;
        isUp: boolean;
        label: string;
    };
}

interface EmptyInsightProps {
    icon: ReactNode;
    title: string;
    description: string;
    color: string;
    isDark: boolean;
}

interface DashboardSectionHeaderProps {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    isDark: boolean;
}

type DashboardTabKey = 'overview' | 'sales' | 'logistics' | 'finance';
type DashboardWidgetGroup = 'overview' | 'sales' | 'logistics' | 'finance';
type DashboardWidgetType = 'metric' | 'insight' | 'worklist';
type DashboardWidgetSize = 'small' | 'medium';
type DashboardRolePresetKey = 'director' | 'sales' | 'logistics' | 'finance';

type DashboardWidgetId =
    | 'revenue'
    | 'orders'
    | 'shipments'
    | 'customers'
    | 'cashflow'
    | 'logisticsRatio'
    | 'onTimeShipment'
    | 'expiringLc'
    | 'salesFocus'
    | 'logisticsFocus'
    | 'accountingFocus';

interface DashboardWidgetDefinition {
    _id: DashboardWidgetId;
    tabs: DashboardTabKey[];
    group: DashboardWidgetGroup;
    type: DashboardWidgetType;
    size: DashboardWidgetSize;
    title: string;
    value: ReactNode;
    icon: ReactNode;
    color: string;
    caption?: ReactNode;
    action?: ReactNode;
    valueColor?: string;
    trend?: DashboardMetricCardProps['trend'];
    span: DashboardWidgetSpan;
    detail: ReactNode;
}

interface DashboardWidgetSpan {
    xs: number;
    md?: number;
    lg?: number;
    xl?: number;
}

interface DashboardWidgetPreferences {
    visible: Record<DashboardWidgetId, boolean>;
    order: DashboardWidgetId[];
    spans?: Partial<Record<DashboardWidgetId, DashboardWidgetSpan>>;
}

interface DashboardWidgetResizeSession {
    widgetId: DashboardWidgetId;
    startX: number;
    startSpan: DashboardWidgetGridSpan;
}

const DASHBOARD_WIDGET_STORAGE_KEY = 'miniErp.dashboard.widgets.v1';
const DASHBOARD_WIDGET_ORDER: DashboardWidgetId[] = [
    'revenue',
    'orders',
    'shipments',
    'customers',
    'cashflow',
    'logisticsRatio',
    'onTimeShipment',
    'expiringLc',
    'salesFocus',
    'logisticsFocus',
    'accountingFocus',
];

const DEFAULT_WIDGET_VISIBILITY = DASHBOARD_WIDGET_ORDER.reduce<Record<DashboardWidgetId, boolean>>((visibility, widgetId) => {
    visibility[widgetId] = true;
    return visibility;
}, {} as Record<DashboardWidgetId, boolean>);

const WIDGET_GROUP_ORDER: DashboardWidgetGroup[] = ['overview', 'sales', 'logistics', 'finance'];
const DASHBOARD_WIDGET_SPAN_STEPS = [6, 8, 12, 16, 24] as const;
type DashboardWidgetGridSpan = typeof DASHBOARD_WIDGET_SPAN_STEPS[number];

const makeWidgetVisibility = (visibleWidgetIds: DashboardWidgetId[]): Record<DashboardWidgetId, boolean> =>
    DASHBOARD_WIDGET_ORDER.reduce<Record<DashboardWidgetId, boolean>>((visibility, widgetId) => {
        visibility[widgetId] = visibleWidgetIds.includes(widgetId);
        return visibility;
    }, {} as Record<DashboardWidgetId, boolean>);

const DASHBOARD_ROLE_PRESET_ORDER: Record<DashboardRolePresetKey, DashboardWidgetId[]> = {
    director: DASHBOARD_WIDGET_ORDER,
    sales: ['revenue', 'orders', 'customers', 'salesFocus', 'cashflow', 'shipments', 'onTimeShipment', 'expiringLc', 'logisticsRatio', 'logisticsFocus', 'accountingFocus'],
    logistics: ['shipments', 'onTimeShipment', 'logisticsRatio', 'logisticsFocus', 'orders', 'customers', 'revenue', 'cashflow', 'expiringLc', 'salesFocus', 'accountingFocus'],
    finance: ['cashflow', 'accountingFocus', 'revenue', 'expiringLc', 'orders', 'customers', 'shipments', 'salesFocus', 'logisticsRatio', 'onTimeShipment', 'logisticsFocus'],
};

const DASHBOARD_ROLE_PRESET_VISIBILITY: Record<DashboardRolePresetKey, Record<DashboardWidgetId, boolean>> = {
    director: DEFAULT_WIDGET_VISIBILITY,
    sales: makeWidgetVisibility(['revenue', 'orders', 'customers', 'salesFocus', 'cashflow', 'shipments']),
    logistics: makeWidgetVisibility(['shipments', 'onTimeShipment', 'logisticsRatio', 'logisticsFocus', 'orders']),
    finance: makeWidgetVisibility(['cashflow', 'accountingFocus', 'revenue', 'expiringLc', 'orders']),
};

const isDashboardWidgetId = (value: string): value is DashboardWidgetId =>
    DASHBOARD_WIDGET_ORDER.includes(value as DashboardWidgetId);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object';

const isDashboardWidgetGridSpan = (value: number): value is DashboardWidgetGridSpan =>
    DASHBOARD_WIDGET_SPAN_STEPS.includes(value as DashboardWidgetGridSpan);

const normalizeDashboardWidgetGridSpan = (value?: number): DashboardWidgetGridSpan => {
    const numericValue = Number(value || 12);
    return DASHBOARD_WIDGET_SPAN_STEPS.reduce<DashboardWidgetGridSpan>((nearest, span) => (
        Math.abs(span - numericValue) < Math.abs(nearest - numericValue) ? span : nearest
    ), 12);
};

const makeDashboardWidgetSpan = (xl: DashboardWidgetGridSpan): DashboardWidgetSpan => ({
    xs: 24,
    md: xl > 12 ? 24 : 12,
    lg: xl,
    xl,
});

const parseDashboardWidgetSpan = (value: unknown): DashboardWidgetSpan | null => {
    if (!isRecord(value)) return null;
    const xl = Number(value.xl ?? value.lg ?? value.md);
    if (!isDashboardWidgetGridSpan(xl)) return null;
    return makeDashboardWidgetSpan(xl);
};

const normalizeRoleName = (value: unknown): string =>
    typeof value === 'string' ? value.trim().toUpperCase() : '';

const getDashboardRolePreset = (user: unknown): DashboardRolePresetKey => {
    if (!isRecord(user)) return 'director';

    const role = user.role;
    const roleName = normalizeRoleName(
        typeof role === 'string'
            ? role
            : isRecord(role)
                ? role.name
                : user.roleName,
    );

    if (roleName.includes('SALES')) return 'sales';
    if (roleName.includes('LOGISTICS') || roleName.includes('WAREHOUSE') || roleName.includes('INVENTORY')) return 'logistics';
    if (roleName.includes('ACCOUNT') || roleName.includes('FINANCE') || roleName.includes('TREASURY')) return 'finance';

    return 'director';
};

const dashboardCardStyle = (isDark: boolean, radius = 20) => ({
    borderRadius: radius,
    background: isDark ? '#1e293b' : '#fff',
    border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
    boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.35)' : '0 10px 15px -3px rgba(15, 23, 42, 0.05)',
});

const DashboardMetricCard = ({
    _id,
    label,
    value,
    icon,
    color,
    loading,
    isDark,
    caption,
    action,
    valueColor,
    onClick,
    isEditing,
    isDragging,
    isPressing,
    dragHandle,
    editAction,
    resizeHandle,
    draggable,
    onDragStart,
    onDragEnd,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    onPointerCancel,
    trend,
}: DashboardMetricCardProps) => (
    <Card
        className={[
            'dashboard-widget-card',
            isEditing ? 'dashboard-widget-card--jiggle' : '',
            isDragging ? 'dashboard-widget-card--dragging' : '',
            isPressing ? 'dashboard-widget-card--pressing' : '',
        ].filter(Boolean).join(' ')}
        data-widget-id={_id}
        hoverable={Boolean(onClick) && !isEditing}
        draggable={draggable}
        onClick={onClick}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onPointerCancel={onPointerCancel}
        variant="borderless"
        style={{
            ...dashboardCardStyle(isDark),
            cursor: isEditing ? 'grab' : onClick ? 'pointer' : 'default',
            border: isEditing ? `1px dashed ${color}` : dashboardCardStyle(isDark).border,
            boxShadow: isEditing
                ? `0 0 0 3px ${color}16, 0 10px 15px -3px rgba(15, 23, 42, 0.08)`
                : dashboardCardStyle(isDark).boxShadow,
            touchAction: isEditing ? 'none' : 'manipulation',
            position: 'relative',
        }}
        styles={{ body: { padding: 16 } }}
    >
        <Skeleton loading={loading} active paragraph={{ rows: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, minHeight: 76 }}>
                <div style={{ minWidth: 0 }}>
                    <Space size={8} style={{ marginBottom: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: 850, textTransform: 'uppercase', color: isDark ? '#cbd5e1' : '#475569', letterSpacing: 0 }}>
                            {label}
                        </Text>
                        {action}
                    </Space>
                    <div style={{ fontSize: 23, fontWeight: 850, color: valueColor || (isDark ? '#f8fafc' : '#111827'), lineHeight: 1.15, letterSpacing: 0 }}>
                        {value}
                    </div>
                    {caption ? (
                        <Text style={{ display: 'block', marginTop: 8, fontSize: 12, color: isDark ? '#cbd5e1' : '#64748b' }}>
                            {caption}
                        </Text>
                    ) : null}
                    {trend ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '3px 8px',
                                    borderRadius: 8,
                                    backgroundColor: trend.isUp ? '#dcfce7' : '#fee2e2',
                                    color: trend.isUp ? '#047857' : '#b91c1c',
                                    fontSize: 12,
                                    fontWeight: 800,
                                }}
                            >
                                {trend.isUp ? <ArrowUpOutlined style={{ marginRight: 4 }} /> : <ArrowDownOutlined style={{ marginRight: 4 }} />}
                                {Math.abs(trend.value)}%
                            </div>
                            <Text style={{ fontSize: 12, color: isDark ? '#cbd5e1' : '#64748b' }}>{trend.label}</Text>
                        </div>
                    ) : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flex: '0 0 auto' }}>
                    {isEditing ? (
                        <Space size={4} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                            {dragHandle}
                            {editAction}
                        </Space>
                    ) : null}
                    <div
                        style={{
                            width: 42,
                            height: 42,
                            flex: '0 0 42px',
                            borderRadius: 14,
                            background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 19,
                            boxShadow: `0 8px 16px -4px ${color}55`,
                        }}
                    >
                        {icon}
                    </div>
                </div>
            </div>
        </Skeleton>
        {isEditing && resizeHandle ? (
            <div className="dashboard-widget-resize-control">
                {resizeHandle}
            </div>
        ) : null}
    </Card>
);

const EmptyInsight = ({ icon, title, description, color, isDark }: EmptyInsightProps) => (
    <div
        style={{
            minHeight: 132,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 8,
            padding: '18px 12px',
            borderRadius: 16,
            background: isDark ? 'rgba(15, 23, 42, 0.35)' : '#f8fafc',
            border: isDark ? '1px dashed #334155' : '1px dashed #dbe3ef',
        }}
    >
        <div
            style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `${color}18`,
                color,
                fontSize: 22,
            }}
        >
            {icon}
        </div>
        <Text strong style={{ color: isDark ? '#e2e8f0' : '#334155' }}>{title}</Text>
        <Text style={{ maxWidth: 320, color: isDark ? '#cbd5e1' : '#64748b', fontSize: 12 }}>{description}</Text>
    </div>
);

const DashboardSectionHeader = ({ title, description, action, isDark }: DashboardSectionHeaderProps) => (
    <div
        style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 16,
            margin: '26px 0 12px',
        }}
    >
        <div style={{ minWidth: 0 }}>
            <Title level={5} style={{ margin: 0, fontWeight: 850, color: isDark ? '#f8fafc' : '#0f172a' }}>
                {title}
            </Title>
            {description ? (
                <Text style={{ display: 'block', marginTop: 4, color: isDark ? '#cbd5e1' : '#64748b', fontSize: 13 }}>
                    {description}
                </Text>
            ) : null}
        </div>
        {action}
    </div>
);

const AdminDashboard = () => {
    const t = useTranslations('Dashboard');
    const dashboardText = useCallback((key: string, fallback: string) => {
        return t.has(key) ? t(key) : fallback;
    }, [t]);
    const { data: session } = useSession();
    const canViewCost = canReadCostFields(session?.user);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<DashboardExecutiveData | null>(null);
    const [drilldown, setDrilldown] = useState<DashboardKpiDrilldown | null>(null);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);
    const [currency, setCurrency] = useState<'VND' | 'USD'>('VND');
    const [activePartnerTab, setActivePartnerTab] = useState<'1' | '2'>('1');
    const [activeMarginTab, setActiveMarginTab] = useState<'market' | 'product'>('market');
    const [activeDashboardTab, setActiveDashboardTab] = useState<DashboardTabKey>('overview');
    const [customizeOpen, setCustomizeOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [activeWidgetId, setActiveWidgetId] = useState<DashboardWidgetId | null>(null);
    const [draggedWidgetId, setDraggedWidgetId] = useState<DashboardWidgetId | null>(null);
    const [longPressWidgetId, setLongPressWidgetId] = useState<DashboardWidgetId | null>(null);
    const [resizingWidgetId, setResizingWidgetId] = useState<DashboardWidgetId | null>(null);
    const [preferencesHydrated, setPreferencesHydrated] = useState(false);
    const [widgetVisibility, setWidgetVisibility] = useState<Record<DashboardWidgetId, boolean>>(DEFAULT_WIDGET_VISIBILITY);
    const [widgetOrder, setWidgetOrder] = useState<DashboardWidgetId[]>(DASHBOARD_WIDGET_ORDER);
    const [widgetSpanOverrides, setWidgetSpanOverrides] = useState<Partial<Record<DashboardWidgetId, DashboardWidgetSpan>>>({});
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suppressNextWidgetClickRef = useRef(false);
    const resizeSessionRef = useRef<DashboardWidgetResizeSession | null>(null);

    const { token } = theme.useToken();
    const { isDark } = useTheme();
    const { formatVND, formatMoney, formatCompact } = useCurrency();

    const fetchDashboardData = async (start?: string, end?: string) => {
        setLoading(true);
        try {
            const [summaryRes, drilldownRes] = await Promise.all([
                dashboardService.getExecutive(start, end),
                dashboardService.getKpiDrilldown(start, end),
            ]);
            setData(summaryRes?.data || null);
            setDrilldown(drilldownRes?.data || null);
        } catch (error) {
            console.error("Lỗi tải dữ liệu Dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'));
    }, [dateRange]);

    useEffect(() => {
        try {
            const rawPreferences = window.localStorage.getItem(DASHBOARD_WIDGET_STORAGE_KEY);
            if (!rawPreferences) {
                setPreferencesHydrated(true);
                return;
            }

            const parsed = JSON.parse(rawPreferences) as Partial<DashboardWidgetPreferences>;
            const parsedOrder = Array.isArray(parsed.order)
                ? parsed.order.filter((widgetId): widgetId is DashboardWidgetId => typeof widgetId === 'string' && isDashboardWidgetId(widgetId))
                : [];
            const mergedOrder = [
                ...parsedOrder,
                ...DASHBOARD_WIDGET_ORDER.filter((widgetId) => !parsedOrder.includes(widgetId)),
            ];

            setWidgetVisibility({
                ...DEFAULT_WIDGET_VISIBILITY,
                ...(parsed.visible || {}),
            });
            setWidgetOrder(mergedOrder);
            if (isRecord(parsed.spans)) {
                const parsedSpans = Object.entries(parsed.spans).reduce<Partial<Record<DashboardWidgetId, DashboardWidgetSpan>>>((spans, [widgetId, value]) => {
                    if (!isDashboardWidgetId(widgetId)) return spans;
                    const span = parseDashboardWidgetSpan(value);
                    if (span) spans[widgetId] = span;
                    return spans;
                }, {});
                setWidgetSpanOverrides(parsedSpans);
            }
        } catch {
            setWidgetVisibility(DEFAULT_WIDGET_VISIBILITY);
            setWidgetOrder(DASHBOARD_WIDGET_ORDER);
            setWidgetSpanOverrides({});
        } finally {
            setPreferencesHydrated(true);
        }
    }, []);

    useEffect(() => {
        if (!preferencesHydrated) return;

        const preferences: DashboardWidgetPreferences = {
            visible: widgetVisibility,
            order: widgetOrder,
            spans: widgetSpanOverrides,
        };
        window.localStorage.setItem(DASHBOARD_WIDGET_STORAGE_KEY, JSON.stringify(preferences));
    }, [preferencesHydrated, widgetOrder, widgetSpanOverrides, widgetVisibility]);

    // Mapping dữ liệu từ Backend (director, sales, logistics)
    const kpis = {
        revenueVnd: data?.director?.revenueVnd || 0,
        poCount: data?.sales?.totalPIs || 0,
        activeShipments: data?.sales?.pendingShipments || 0,
        customerCount: data?.director?.totalCustomers || 0
    };
    
    const chartData: RevenueChartPoint[] = data?.director?.history?.map((item) => ({
        month: dayjs(item.month).format('MMM YYYY'),
        revenue: Math.round(item.revenue / 1000000), 
        orders: item.orders
    })) || [];

    const shipmentStats: ShipmentStat[] = data?.logistics?.statusBreakdown ?
        Object.entries(data.logistics.statusBreakdown).map(([key, value]) => ({
            name: t(key.toLowerCase()),
            value
        })) : [];

    // Logic quy đổi USD tạm tính (Ưu tiên tỷ giá từ Backend, nếu không có dùng hằng số Global)
    const EXCHANGE_RATE = data?.director?.exchangeRate || GLOBAL_EXCHANGE_RATE;
    const displayRevenue = currency === 'VND'
        ? formatVND(kpis.revenueVnd)
        : formatMoney(kpis.revenueVnd / EXCHANGE_RATE, 'USD');

    const marginRows: MarginDrilldownLine[] = activeMarginTab === 'market'
        ? (drilldown?.grossMarginByMarket || [])
        : (drilldown?.grossMarginByProduct || []);
    const topInventoryTurnover = drilldown?.inventoryTurnoverByProduct?.slice(0, 5) || [];
    const logisticsShipments = drilldown?.logisticsRevenue?.shipments?.slice(0, 5) || [];
    const lowStockProducts = data?.lowStockProducts || [];
    const partnerRows = activePartnerTab === '1'
        ? (data?.director?.topBuyers || [])
        : (data?.director?.topSuppliers || []);
    const upcomingShipments = data?.logistics?.upcomingShipments || [];

    const dashboardTabs = useMemo(() => [
        { key: 'overview' as const, label: dashboardText('tabOverview', 'Tổng quan') },
        { key: 'sales' as const, label: dashboardText('tabSales', 'Sales & Doanh thu') },
        { key: 'logistics' as const, label: dashboardText('tabLogistics', 'Logistics & Kho bãi') },
        { key: 'finance' as const, label: dashboardText('tabFinance', 'Tài chính') },
    ], [dashboardText]);

    const currencyAction = (
        <Button
            size="small"
            type="text"
            icon={<GlobalOutlined style={{ fontSize: 10 }} />}
            onClick={(event) => {
                event.stopPropagation();
                setCurrency(currency === 'VND' ? 'USD' : 'VND');
            }}
            style={{
                height: 24,
                borderRadius: 8,
                background: isDark ? '#334155' : '#e0f2fe',
                color: isDark ? '#e2e8f0' : '#075985',
                fontSize: 11,
                fontWeight: 800,
            }}
        >
            {currency}
        </Button>
    );

    const roleFocus: DashboardWidgetDefinition[] = [
        {
            _id: 'salesFocus',
            tabs: ['overview', 'sales'],
            group: 'sales',
            type: 'insight',
            size: 'medium',
            title: t('salesExport'),
            value: formatVND(drilldown?.grossMarginByMarket?.[0]?.revenueVnd || kpis.revenueVnd),
            caption: t('marketRevenueLeader'),
            icon: <ShoppingCartOutlined />,
            color: '#3b82f6',
            valueColor: '#3b82f6',
            span: { xs: 24, md: 12, xl: 8 },
            detail: (
                <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                    {(drilldown?.grossMarginByMarket || []).slice(0, 5).map((row) => (
                        <Space key={row.key} style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text>{row.label}</Text>
                            <Text strong>{formatVND(row.revenueVnd)}</Text>
                        </Space>
                    ))}
                </Space>
            ),
        },
        {
            _id: 'logisticsFocus',
            tabs: ['overview', 'logistics'],
            group: 'logistics',
            type: 'insight',
            size: 'medium',
            title: t('logisticsWarehouse'),
            value: canViewCost ? compactPercent(drilldown?.logisticsRevenue?.logisticsCostRatioPercent) : t('hiddenByPermission'),
            caption: t('logisticsCostOverRevenue'),
            icon: <TruckOutlined />,
            color: '#10b981',
            valueColor: '#10b981',
            span: { xs: 24, md: 12, xl: 8 },
            detail: (
                <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                    {logisticsShipments.map((shipment) => (
                        <Space key={shipment._id} style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text>{shipment.shipmentNumber}</Text>
                            <Text strong>{canViewCost ? compactPercent(shipment.logisticsCostRatioPercent) : t('hiddenByPermission')}</Text>
                        </Space>
                    ))}
                </Space>
            ),
        },
        {
            _id: 'accountingFocus',
            tabs: ['overview', 'finance'],
            group: 'finance',
            type: 'insight',
            size: 'medium',
            title: t('accounting'),
            value: `${drilldown?.dso?.dsoDays || data?.director?.dso || 0} ${t('days')}`,
            caption: `${drilldown?.dso?.overdueInvoiceCount || 0} ${t('overdueAr')}`,
            icon: <ClockCircleOutlined />,
            color: '#f59e0b',
            valueColor: '#f59e0b',
            span: { xs: 24, md: 12, xl: 8 },
            detail: (
                <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                    {(drilldown?.dso?.topOverdueInvoices || []).slice(0, 5).map((invoice) => (
                        <Space key={invoice._id} style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text>{invoice.invoiceNumber}</Text>
                            <Text strong>{formatVND(invoice.openAmountVnd)}</Text>
                        </Space>
                    ))}
                </Space>
            ),
        },
    ];

    const dashboardWidgets: DashboardWidgetDefinition[] = [
        {
            _id: 'revenue',
            tabs: ['overview', 'sales', 'finance'],
            group: 'overview',
            type: 'metric',
            size: 'small',
            title: t('revenue'),
            value: displayRevenue,
            icon: <DollarOutlined />,
            color: '#3b82f6',
            action: currencyAction,
            trend: { value: data?.director?.revenueGrowth || 0, isUp: (data?.director?.revenueGrowth || 0) >= 0, label: t('vsLastMonth') },
            span: { xs: 24, md: 12, xl: 6 },
            detail: (
                <Space orientation="vertical" size={8}>
                    <Text>{dashboardText('selectedRange', 'Khoảng dữ liệu')}: {dateRange[0].format('YYYY-MM-DD')} - {dateRange[1].format('YYYY-MM-DD')}</Text>
                    <Text>{dashboardText('exchangeRate', 'Tỷ giá')}: {EXCHANGE_RATE.toLocaleString('vi-VN')}</Text>
                    <Text>{t('marketRevenueLeader')}: {formatVND(drilldown?.grossMarginByMarket?.[0]?.revenueVnd || 0)}</Text>
                </Space>
            ),
        },
        {
            _id: 'orders',
            tabs: ['overview', 'sales'],
            group: 'sales',
            type: 'metric',
            size: 'small',
            title: t('orders'),
            value: kpis.poCount,
            icon: <ShoppingCartOutlined />,
            color: '#f59e0b',
            trend: { value: data?.sales?.poGrowth || 0, isUp: true, label: t('vsLastMonth') },
            span: { xs: 24, md: 12, xl: 6 },
            detail: (
                <Space orientation="vertical" size={8}>
                    <Text>{dashboardText('confirmedContracts', 'Hợp đồng đã xác nhận')}: {data?.sales?.confirmedContracts || 0}</Text>
                    <Text>{dashboardText('conversionRate', 'Tỷ lệ chuyển đổi')}: {compactPercent(data?.sales?.conversionRate)}</Text>
                </Space>
            ),
        },
        {
            _id: 'shipments',
            tabs: ['overview', 'logistics'],
            group: 'logistics',
            type: 'metric',
            size: 'small',
            title: t('shipments'),
            value: kpis.activeShipments,
            icon: <TruckOutlined />,
            color: '#10b981',
            trend: { value: data?.logistics?.shipmentGrowth || 0, isUp: (data?.logistics?.shipmentGrowth || 0) >= 0, label: t('vsLastMonth') },
            span: { xs: 24, md: 12, xl: 6 },
            detail: (
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                    {upcomingShipments.slice(0, 5).map((shipment) => (
                        <Space key={shipment._id || shipment.number} style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text>{shipment.number}</Text>
                            <Tag color={SHIP_STATUS_COLOR[shipment.status] || 'processing'}>{shipment.status}</Tag>
                        </Space>
                    ))}
                </Space>
            ),
        },
        {
            _id: 'customers',
            tabs: ['overview', 'sales'],
            group: 'sales',
            type: 'metric',
            size: 'small',
            title: t('customers'),
            value: kpis.customerCount,
            icon: <ApartmentOutlined />,
            color: '#8b5cf6',
            trend: { value: 12.5, isUp: true, label: t('vsLastMonth') },
            span: { xs: 24, md: 12, xl: 6 },
            detail: (
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                    {partnerRows.slice(0, 5).map((partner) => (
                        <Space key={partner._id} style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text>{partner.name}</Text>
                            <Text strong>{formatVND(partner.total)}</Text>
                        </Space>
                    ))}
                </Space>
            ),
        },
        {
            _id: 'cashflow',
            tabs: ['overview', 'finance'],
            group: 'finance',
            type: 'metric',
            size: 'small',
            title: t('cashflow30d'),
            value: formatVND(data?.director?.cashflowForecast?.netVnd || 0),
            caption: `${t('cashIn')} ${formatVND(data?.director?.cashflowForecast?.inflowVnd || 0)} / ${t('cashOut')} ${formatVND(data?.director?.cashflowForecast?.outflowVnd || 0)}`,
            icon: <DollarOutlined />,
            color: (data?.director?.cashflowForecast?.netVnd || 0) >= 0 ? '#10b981' : '#ef4444',
            valueColor: (data?.director?.cashflowForecast?.netVnd || 0) >= 0 ? '#059669' : '#dc2626',
            span: { xs: 24, md: 12, xl: 6 },
            detail: (
                <Space orientation="vertical" size={8}>
                    <Text>{t('cashIn')}: {formatVND(data?.director?.cashflowForecast?.inflowVnd || 0)}</Text>
                    <Text>{t('cashOut')}: {formatVND(data?.director?.cashflowForecast?.outflowVnd || 0)}</Text>
                </Space>
            ),
        },
        {
            _id: 'logisticsRatio',
            tabs: ['overview', 'logistics'],
            group: 'logistics',
            type: 'metric',
            size: 'small',
            title: t('logisticsRevenue'),
            value: canViewCost ? compactPercent(data?.director?.logisticsCostRatio) : t('hiddenByPermission'),
            caption: t('logisticsCostOverRevenue'),
            icon: <TruckOutlined />,
            color: '#3b82f6',
            valueColor: '#2563eb',
            span: { xs: 24, md: 12, xl: 6 },
            detail: <Text>{t('logisticsRevenueDrilldown')}</Text>,
        },
        {
            _id: 'onTimeShipment',
            tabs: ['overview', 'logistics'],
            group: 'logistics',
            type: 'metric',
            size: 'small',
            title: t('onTimeShipment'),
            value: compactPercent(data?.director?.onTimeRate),
            caption: t('onTimeShipmentDesc'),
            icon: <CheckCircleOutlined />,
            color: '#10b981',
            valueColor: '#059669',
            span: { xs: 24, md: 12, xl: 6 },
            detail: <Text>{t('onTimeShipmentDesc')}</Text>,
        },
        {
            _id: 'expiringLc',
            tabs: ['overview', 'finance'],
            group: 'finance',
            type: 'worklist',
            size: 'small',
            title: t('expiringLc'),
            value: data?.logistics?.expiringLCs?.length || 0,
            caption: t('next14Days'),
            icon: <ClockCircleOutlined />,
            color: '#f59e0b',
            valueColor: '#d97706',
            span: { xs: 24, md: 12, xl: 6 },
            detail: <Text>{t('next14Days')}</Text>,
        },
        ...roleFocus,
    ];

    const widgetById = new Map<DashboardWidgetId, DashboardWidgetDefinition>(
        dashboardWidgets.map((widget) => [widget._id, widget]),
    );
    const visibleDashboardWidgets = widgetOrder
        .map((widgetId) => widgetById.get(widgetId))
        .filter((widget): widget is DashboardWidgetDefinition => Boolean(widget))
        .filter((widget) => widget.tabs.includes(activeDashboardTab) && widgetVisibility[widget._id]);
    const editableDashboardWidgets = widgetOrder
        .map((widgetId) => widgetById.get(widgetId))
        .filter((widget): widget is DashboardWidgetDefinition => Boolean(widget))
        .filter((widget) => widget.tabs.includes(activeDashboardTab));
    const dashboardWidgetsToRender = isEditing ? editableDashboardWidgets : visibleDashboardWidgets;
    const selectedWidget = activeWidgetId ? widgetById.get(activeWidgetId) || null : null;
    const isOverviewTab = activeDashboardTab === 'overview';
    const isSalesTab = activeDashboardTab === 'sales';
    const isLogisticsTab = activeDashboardTab === 'logistics';
    const isFinanceTab = activeDashboardTab === 'finance';
    const showRevenueChart = isOverviewTab || isSalesTab || isFinanceTab;
    const showShipmentStatus = isOverviewTab || isLogisticsTab;
    const showLowStockPanel = isOverviewTab || isLogisticsTab;
    const showPartnerPanel = isOverviewTab || isSalesTab;
    const showUpcomingShipmentPanel = isOverviewTab || isLogisticsTab;
    const rolePresetKey = getDashboardRolePreset(session?.user);
    const visibleWidgetCount = widgetOrder.filter((widgetId) => widgetVisibility[widgetId]).length;
    const widgetGroupLabels: Record<DashboardWidgetGroup, string> = {
        overview: dashboardText('widgetGroupOverview', 'Tổng quan'),
        sales: dashboardText('widgetGroupSales', 'Sales & Doanh thu'),
        logistics: dashboardText('widgetGroupLogistics', 'Logistics & Kho'),
        finance: dashboardText('widgetGroupFinance', 'Tài chính / Kế toán'),
    };
    const widgetTypeLabels: Record<DashboardWidgetType, string> = {
        metric: dashboardText('widgetTypeMetric', 'KPI'),
        insight: dashboardText('widgetTypeInsight', 'Insight'),
        worklist: dashboardText('widgetTypeWorklist', 'Worklist'),
    };
    const widgetSizeLabels: Record<DashboardWidgetSize, string> = {
        small: dashboardText('widgetSizeSmall', 'Nhỏ'),
        medium: dashboardText('widgetSizeMedium', 'Vừa'),
    };
    const rolePresetLabels: Record<DashboardRolePresetKey, string> = {
        director: dashboardText('presetDirector', 'Giám đốc / Admin'),
        sales: dashboardText('presetSales', 'Sales Export'),
        logistics: dashboardText('presetLogistics', 'Logistics / Kho'),
        finance: dashboardText('presetFinance', 'Kế toán / Tài chính'),
    };
    const widgetCatalogGroups = WIDGET_GROUP_ORDER.map((group) => ({
        group,
        label: widgetGroupLabels[group],
        widgets: widgetOrder
            .map((widgetId) => widgetById.get(widgetId))
            .filter((widget): widget is DashboardWidgetDefinition => Boolean(widget))
            .filter((widget) => widget.group === group),
    })).filter((section) => section.widgets.length > 0);

    const getWidgetSpan = useCallback((widget: DashboardWidgetDefinition): DashboardWidgetSpan => (
        widgetSpanOverrides[widget._id] || widget.span
    ), [widgetSpanOverrides]);

    const getWidgetGridSpan = useCallback((widget: DashboardWidgetDefinition): DashboardWidgetGridSpan => {
        const span = getWidgetSpan(widget);
        return normalizeDashboardWidgetGridSpan(span.xl ?? span.lg ?? span.md);
    }, [getWidgetSpan]);

    const toggleWidgetVisibility = (widgetId: DashboardWidgetId, visible: boolean) => {
        setWidgetVisibility((current) => ({ ...current, [widgetId]: visible }));
    };

    const applyRolePreset = (presetKey: DashboardRolePresetKey) => {
        const presetOrder = DASHBOARD_ROLE_PRESET_ORDER[presetKey];
        setWidgetVisibility(DASHBOARD_ROLE_PRESET_VISIBILITY[presetKey]);
        setWidgetOrder([
            ...presetOrder,
            ...DASHBOARD_WIDGET_ORDER.filter((widgetId) => !presetOrder.includes(widgetId)),
        ]);
        setWidgetSpanOverrides({});
    };

    const moveWidgetBefore = (sourceWidgetId: DashboardWidgetId, targetWidgetId: DashboardWidgetId) => {
        setWidgetOrder((current) => {
            const next = current.filter((widgetId) => widgetId !== sourceWidgetId);
            const targetIndex = next.indexOf(targetWidgetId);
            next.splice(targetIndex < 0 ? next.length : targetIndex, 0, sourceWidgetId);
            return next;
        });
    };

    const startWidgetDrag = (event: DragEvent<HTMLElement>, widgetId: DashboardWidgetId) => {
        if (!isEditing) return;
        const target = event.target;
        if (target instanceof HTMLElement && target.closest('.dashboard-widget-resize-control')) {
            event.preventDefault();
            return;
        }

        clearLongPressTimer();
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', widgetId);
        setDraggedWidgetId(widgetId);
    };

    const dropWidgetBefore = (event: DragEvent<HTMLElement>, targetWidgetId: DashboardWidgetId) => {
        if (!isEditing || !draggedWidgetId || draggedWidgetId === targetWidgetId) return;

        event.preventDefault();
        moveWidgetBefore(draggedWidgetId, targetWidgetId);
        setDraggedWidgetId(null);
    };

    const moveWidgetByOffset = (widgetId: DashboardWidgetId, offset: number) => {
        setWidgetOrder((current) => {
            const currentIndex = current.indexOf(widgetId);
            const targetIndex = currentIndex + offset;
            if (currentIndex < 0 || targetIndex < 0 || targetIndex >= current.length) return current;

            const next = [...current];
            const [removed] = next.splice(currentIndex, 1);
            next.splice(targetIndex, 0, removed);
            return next;
        });
    };

    const clearLongPressTimer = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        setLongPressWidgetId(null);
    }, []);

    const startWidgetResize = useCallback((event: ReactPointerEvent<HTMLElement>, widget: DashboardWidgetDefinition) => {
        if (!isEditing) return;

        event.preventDefault();
        event.stopPropagation();
        clearLongPressTimer();
        setDraggedWidgetId(null);
        setResizingWidgetId(widget._id);
        const resizeTarget = event.currentTarget;
        const resizeSession: DashboardWidgetResizeSession = {
            widgetId: widget._id,
            startX: event.clientX,
            startSpan: getWidgetGridSpan(widget),
        };
        resizeSessionRef.current = resizeSession;
        resizeTarget.setPointerCapture?.(event.pointerId);
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';

        const applyResize = (clientX: number) => {
            const startIndex = DASHBOARD_WIDGET_SPAN_STEPS.indexOf(resizeSession.startSpan);
            const deltaSteps = Math.round((clientX - resizeSession.startX) / 72);
            const nextIndex = Math.max(0, Math.min(DASHBOARD_WIDGET_SPAN_STEPS.length - 1, startIndex + deltaSteps));
            const nextSpan = DASHBOARD_WIDGET_SPAN_STEPS[nextIndex];

            setWidgetSpanOverrides((current) => ({
                ...current,
                [resizeSession.widgetId]: makeDashboardWidgetSpan(nextSpan),
            }));
        };

        const handlePointerMove = (pointerEvent: globalThis.PointerEvent) => {
            pointerEvent.preventDefault();
            applyResize(pointerEvent.clientX);
        };

        const stopResize = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', stopResize);
            window.removeEventListener('pointercancel', stopResize);
            resizeTarget.releasePointerCapture?.(event.pointerId);
            resizeSessionRef.current = null;
            setResizingWidgetId(null);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stopResize);
        window.addEventListener('pointercancel', stopResize);
    }, [clearLongPressTimer, getWidgetGridSpan, isEditing]);

    const startWidgetLongPress = useCallback((event: ReactPointerEvent<HTMLElement>, widgetId: DashboardWidgetId) => {
        if (isEditing) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        clearLongPressTimer();
        setLongPressWidgetId(widgetId);
        longPressTimerRef.current = setTimeout(() => {
            suppressNextWidgetClickRef.current = true;
            setIsEditing(true);
            setCustomizeOpen(false);
            setLongPressWidgetId(null);
            longPressTimerRef.current = null;
        }, 520);
    }, [clearLongPressTimer, isEditing]);

    const handleWidgetCardClick = useCallback((widgetId: DashboardWidgetId) => {
        if (suppressNextWidgetClickRef.current) {
            suppressNextWidgetClickRef.current = false;
            return;
        }

        setActiveWidgetId(widgetId);
    }, []);

    const resetDashboardLayout = () => {
        setWidgetVisibility(DEFAULT_WIDGET_VISIBILITY);
        setWidgetOrder(DASHBOARD_WIDGET_ORDER);
        setWidgetSpanOverrides({});
    };

    const enterEditMode = () => {
        clearLongPressTimer();
        setIsEditing(true);
        setCustomizeOpen(true);
    };

    const exitEditMode = () => {
        clearLongPressTimer();
        setIsEditing(false);
        setCustomizeOpen(false);
        setDraggedWidgetId(null);
        setResizingWidgetId(null);
        resizeSessionRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };

    useEffect(() => clearLongPressTimer, [clearLongPressTimer]);


    return (
        <div style={{ 
            backgroundColor: 'transparent',
            transition: 'all 0.3s ease'
        }}>
            {/* --- GLASSMORPHISM HEADER --- */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: 32,
                padding: '20px 24px',
                background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'blur(12px)',
                borderRadius: 24,
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                border: isDark ? '1px solid #334155' : '1px solid rgba(255, 255, 255, 0.3)',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: isDark ? '#f8fafc' : token.colorText, letterSpacing: 0 }}>{t('title')}</h1>
                    <Space size={8}>
                        <Text style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#cbd5e1' : '#64748b' }}>{t('subtitle')} - {t('realtimeMonitoring')}</Text>
                        {data?.lastUpdated && (
                            <Tag style={{ fontSize: 11, borderRadius: 6, background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 700 }}>
                                {t('lastSync')}: {dayjs(data.lastUpdated).format('HH:mm:ss')}
                            </Tag>
                        )}
                        {isEditing ? (
                            <Tag style={{ fontSize: 11, borderRadius: 6, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', fontWeight: 800 }}>
                                {dashboardText('editModeActive', 'Edit mode')}
                            </Tag>
                        ) : null}
                    </Space>
                </div>
                <Space size="large">
                    <RangePicker 
                        value={dateRange}
                        onChange={(dates) => {
                            if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
                        }}
                        style={{ 
                            borderRadius: 14, 
                            height: 42, 
                            border: 'none', 
                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            background: isDark ? '#1e293b' : '#fff'
                        }} 
                    />
                    {isEditing ? (
                        <Button icon={<PlusOutlined />} size="large" onClick={() => setCustomizeOpen(true)} style={{ borderRadius: 14, fontWeight: 600, height: 42 }}>
                            {dashboardText('widgetPicker', 'Thư viện widget')}
                        </Button>
                    ) : null}
                    <Button
                        icon={isEditing ? <CheckCircleOutlined /> : <MoreOutlined />}
                        type={isEditing ? 'primary' : 'default'}
                        size="large"
                        onClick={isEditing ? exitEditMode : enterEditMode}
                        style={{ borderRadius: 14, fontWeight: 600, height: 42 }}
                    >
                        {isEditing ? dashboardText('doneEditing', 'Xong') : dashboardText('customizeDashboard', 'Tùy chỉnh bảng điều khiển')}
                    </Button>
                    <Button icon={<DownloadOutlined />} size="large" style={{ borderRadius: 14, fontWeight: 600, height: 42 }}>{t('exportReport')}</Button>
                </Space>
            </div>

            <Card
                variant="borderless"
                style={{ ...dashboardCardStyle(isDark, 20), marginBottom: 20 }}
                styles={{ body: { padding: '10px 18px 0' } }}
            >
                <Tabs
                    activeKey={activeDashboardTab}
                    onChange={(key) => setActiveDashboardTab(key as DashboardTabKey)}
                    items={dashboardTabs.map((tab) => ({ key: tab.key, label: tab.label }))}
                />
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ order: 2 }}>
            <DashboardSectionHeader
                title={dashboardText('sectionPrimary', 'Chỉ số chính')}
                description={dashboardText('sectionPrimaryDesc', 'Các KPI ưu tiên của tab hiện tại, bấm vào từng thẻ để xem chi tiết.')}
                isDark={isDark}
            />
            <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
                {dashboardWidgetsToRender.length > 0 ? (
                    dashboardWidgetsToRender.map((widget) => {
                        const isWidgetVisible = widgetVisibility[widget._id];
                        const widgetSpan = getWidgetSpan(widget);
                        const widgetGridSpan = getWidgetGridSpan(widget);

                        return (
                        <Col key={widget._id} xs={widgetSpan.xs} md={widgetSpan.md} lg={widgetSpan.lg} xl={widgetSpan.xl}>
                            <div
                                onDragOver={(event) => {
                                    if (isEditing && draggedWidgetId && draggedWidgetId !== widget._id) {
                                        event.preventDefault();
                                    }
                                }}
                                onDrop={(event) => dropWidgetBefore(event, widget._id)}
                                style={{
                                    height: '100%',
                                    opacity: draggedWidgetId === widget._id ? 0.55 : isEditing && !isWidgetVisible ? 0.45 : 1,
                                    filter: isEditing && !isWidgetVisible ? 'grayscale(0.45)' : undefined,
                                    transition: 'opacity 0.2s ease, filter 0.2s ease, transform 0.2s ease',
                                }}
                            >
                                <DashboardMetricCard
                                    _id={widget._id}
                                    label={widget.title}
                                    value={widget.value}
                                    caption={widget.caption}
                                    icon={widget.icon}
                                    color={widget.color}
                                    valueColor={widget.valueColor}
                                    loading={loading}
                                    isDark={isDark}
                                    action={widget.action}
                                    trend={widget.trend}
                                    isEditing={isEditing}
                                    isDragging={draggedWidgetId === widget._id}
                                    isPressing={longPressWidgetId === widget._id || resizingWidgetId === widget._id}
                                    draggable={isEditing && resizingWidgetId !== widget._id}
                                    onDragStart={(event) => startWidgetDrag(event, widget._id)}
                                    onDragEnd={() => setDraggedWidgetId(null)}
                                    onPointerDown={!isEditing ? (event) => startWidgetLongPress(event, widget._id) : undefined}
                                    onPointerUp={clearLongPressTimer}
                                    onPointerLeave={clearLongPressTimer}
                                    onPointerCancel={clearLongPressTimer}
                                    onClick={!isEditing && isWidgetVisible ? () => handleWidgetCardClick(widget._id) : undefined}
                                    dragHandle={
                                        <Button
                                            size="small"
                                            type="text"
                                            draggable={isEditing}
                                            icon={<HolderOutlined />}
                                            title={dashboardText('dragToArrange', 'Drag to arrange')}
                                            onDragStart={(event) => startWidgetDrag(event, widget._id)}
                                            onDragEnd={() => setDraggedWidgetId(null)}
                                            style={{ cursor: 'grab' }}
                                        />
                                    }
                                    editAction={
                                        <Button
                                            size="small"
                                            type="text"
                                            danger={isWidgetVisible}
                                            icon={isWidgetVisible ? <CloseOutlined /> : <PlusOutlined />}
                                            title={
                                                isWidgetVisible
                                                    ? dashboardText('hideWidget', 'Hide widget')
                                                    : dashboardText('showWidget', 'Show widget')
                                            }
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                toggleWidgetVisibility(widget._id, !isWidgetVisible);
                                            }}
                                        />
                                    }
                                    resizeHandle={
                                        <span
                                            className="dashboard-widget-resize-grip"
                                            draggable={false}
                                            title={`${dashboardText('resizeWidget', 'Resize widget')} (${widgetGridSpan}/24)`}
                                            onPointerDown={(event) => startWidgetResize(event, widget)}
                                            onDragStart={(event) => event.preventDefault()}
                                        />
                                    }
                                />
                            </div>
                        </Col>
                        );
                    })
                ) : (
                    <Col xs={24}>
                        <Card variant="borderless" style={dashboardCardStyle(isDark, 20)}>
                            <Empty description={dashboardText('emptyVisibleWidgets', 'Không có widget nào trong tab này')}>
                                {isEditing ? (
                                    <Button icon={<PlusOutlined />} onClick={() => setCustomizeOpen(true)}>
                                        {dashboardText('widgetPicker', 'Widget picker')}
                                    </Button>
                                ) : null}
                            </Empty>
                        </Card>
                    </Col>
                )}
            </Row>

            </div>

            <div style={{ order: 3 }}>
            {(isSalesTab || isFinanceTab || isLogisticsTab) && (
            <>
            <DashboardSectionHeader
                title={dashboardText('sectionFocus', 'Phân tích trọng tâm')}
                description={dashboardText('sectionFocusDesc', 'Mỗi tab chỉ hiển thị các khối phân tích đúng nghiệp vụ để tránh loãng dữ liệu.')}
                isDark={isDark}
            />
            <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
                {isSalesTab && (
                <Col xs={24}>
                    <Card
                        title={<Title level={5} style={{ margin: 0, fontWeight: 800 }}>{t('grossMarginDrilldown')}</Title>}
                        extra={
                            <Tabs
                                activeKey={activeMarginTab}
                                onChange={(key) => setActiveMarginTab(key as 'market' | 'product')}
                                size="small"
                                items={[
                                    { key: 'market', label: t('market') },
                                    { key: 'product', label: t('product') },
                                ]}
                            />
                        }
                        variant="borderless"
                        style={dashboardCardStyle(isDark, 24)}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
                            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                                {marginRows.slice(0, 5).map((row) => (
                                    <div key={row.key}>
                                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                            <Text strong ellipsis style={{ maxWidth: 180 }}>{row.label}</Text>
                                            <Text style={{ color: '#3b82f6', fontWeight: 800 }}>{formatVND(row.revenueVnd)}</Text>
                                        </Space>
                                        {canViewCost ? (
                                            <Progress
                                                percent={Math.max(Math.min(row.grossProfitMarginPercent || 0, 100), 0)}
                                                size="small"
                                                strokeColor={(row.grossProfitMarginPercent || 0) >= 20 ? '#10b981' : '#f59e0b'}
                                                format={() => compactPercent(row.grossProfitMarginPercent)}
                                            />
                                        ) : (
                                            <Text type="secondary" style={{ fontSize: 12 }}>{t('hiddenByPermission')}</Text>
                                        )}
                                    </div>
                                ))}
                                {marginRows.length === 0 && (
                                    <EmptyInsight
                                        icon={<DollarOutlined />}
                                        title={t('emptyMarginTitle')}
                                        description={t('emptyMarginDesc')}
                                        color="#3b82f6"
                                        isDark={isDark}
                                    />
                                )}
                            </Space>
                        </Skeleton>
                    </Card>
                </Col>
                )}

                {isFinanceTab && (
                <Col xs={24}>
                    <Card
                        title={<Title level={5} style={{ margin: 0, fontWeight: 800 }}>{t('dsoOverdueAr')}</Title>}
                        variant="borderless"
                        style={dashboardCardStyle(isDark, 24)}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
                            <Row gutter={12} style={{ marginBottom: 12 }}>
                                <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 800 }}>DSO</Text>
                                    <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b' }}>{drilldown?.dso?.dsoDays || 0} {t('days')}</div>
                                </Col>
                                <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 800 }}>{t('overdue')}</Text>
                                    <div style={{ fontSize: 24, fontWeight: 900, color: '#ef4444' }}>{drilldown?.dso?.overdueInvoiceCount || 0}</div>
                                </Col>
                            </Row>
                            <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                                {(drilldown?.dso?.topOverdueInvoices || []).slice(0, 4).map((invoice) => (
                                    <div key={invoice._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                        <div>
                                            <Text strong>{invoice.invoiceNumber}</Text>
                                            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{invoice.buyerName || t('unknownBuyer')} · {invoice.overdueDays} {t('days')}</Text>
                                        </div>
                                        <Text style={{ color: '#ef4444', fontWeight: 800 }}>{formatVND(invoice.openAmountVnd)}</Text>
                                    </div>
                                ))}
                                {(drilldown?.dso?.topOverdueInvoices || []).length === 0 && (
                                    <EmptyInsight
                                        icon={<ClockCircleOutlined />}
                                        title={t('emptyDsoTitle')}
                                        description={t('emptyDsoDesc')}
                                        color="#f59e0b"
                                        isDark={isDark}
                                    />
                                )}
                            </Space>
                        </Skeleton>
                    </Card>
                </Col>
                )}

                {isLogisticsTab && (
                <Col xs={24}>
                    <Card
                        title={<Title level={5} style={{ margin: 0, fontWeight: 800 }}>{t('inventoryTurnover')}</Title>}
                        variant="borderless"
                        style={dashboardCardStyle(isDark, 24)}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
                            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                                {topInventoryTurnover.map((item) => (
                                    <div key={item._id}>
                                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                            <div>
                                                <Text strong ellipsis style={{ maxWidth: 180 }}>{item.productName}</Text>
                                                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{item.sku} · {t('sold')} {item.quantitySold}</Text>
                                            </div>
                                            <Text style={{ fontWeight: 900, color: '#10b981' }}>{canViewCost ? `${item.turnover || 0}x` : t('hiddenByPermission')}</Text>
                                        </Space>
                                    </div>
                                ))}
                                {topInventoryTurnover.length === 0 && (
                                    <EmptyInsight
                                        icon={<ShoppingCartOutlined />}
                                        title={t('emptyInventoryTitle')}
                                        description={t('emptyInventoryDesc')}
                                        color="#10b981"
                                        isDark={isDark}
                                    />
                                )}
                            </Space>
                        </Skeleton>
                    </Card>
                </Col>
                )}

                {isLogisticsTab && (
                <Col xs={24}>
                    <Card
                        title={<Title level={5} style={{ margin: 0, fontWeight: 800 }}>{t('logisticsRevenueDrilldown')}</Title>}
                        variant="borderless"
                        style={dashboardCardStyle(isDark, 24)}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 4 }}>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} md={8}>
                                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 800 }}>{t('periodRatio')}</Text>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: '#3b82f6' }}>
                                        {canViewCost ? compactPercent(drilldown?.logisticsRevenue?.logisticsCostRatioPercent) : t('hiddenByPermission')}
                                    </div>
                                    <Text type="secondary">{formatVND(drilldown?.logisticsRevenue?.revenueVnd || 0)} {t('revenueShort')}</Text>
                                </Col>
                                <Col xs={24} md={16}>
                                    <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                                        {logisticsShipments.map((shipment) => (
                                            <div key={shipment._id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 90px', gap: 12, alignItems: 'center' }}>
                                                <div>
                                                    <Text strong>{shipment.shipmentNumber}</Text>
                                                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{shipment.buyerName || t('unknownBuyer')} · {shipment.status}</Text>
                                                </div>
                                                <Text style={{ textAlign: 'right' }}>{formatVND(shipment.revenueVnd)}</Text>
                                                <Text style={{ textAlign: 'right', color: '#3b82f6', fontWeight: 800 }}>
                                                    {canViewCost ? compactPercent(shipment.logisticsCostRatioPercent) : t('hiddenByPermission')}
                                                </Text>
                                            </div>
                                        ))}
                                        {logisticsShipments.length === 0 && (
                                            <EmptyInsight
                                                icon={<TruckOutlined />}
                                                title={t('emptyLogisticsTitle')}
                                                description={t('emptyLogisticsDesc')}
                                                color="#3b82f6"
                                                isDark={isDark}
                                            />
                                        )}
                                    </Space>
                                </Col>
                            </Row>
                        </Skeleton>
                    </Card>
                </Col>
                )}
            </Row>
            </>
            )}
            </div>

            <div style={{ order: 1 }}>
            {/* --- CHARTS --- */}
            {(showRevenueChart || showShipmentStatus) && (
            <>
            <DashboardSectionHeader
                title={dashboardText('sectionCharts', 'Diễn biến & trạng thái')}
                description={dashboardText('sectionChartsDesc', 'Biểu đồ lớn dùng để đọc xu hướng, các panel cạnh phải dùng để điều hướng nhanh theo trạng thái.')}
                isDark={isDark}
            />
            <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
                {showRevenueChart && (
                <Col xs={24} lg={showShipmentStatus ? 16 : 24}>
                    <Card 
                        title={<Title level={5} style={{ margin: 0, fontWeight: 800, color: isDark ? '#f8fafc' : undefined }}>{t('charts.revenueTitle')}</Title>}
                        variant="borderless"
                        style={{ 
                            borderRadius: 28, height: '100%', 
                            boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)' : '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                            background: isDark ? '#1e293b' : '#fff',
                            border: isDark ? '1px solid #334155' : '1px solid #f0f0f0'
                        }}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 10 }}>
                            <SafeResponsiveContainer height={380} style={{ marginTop: 10 }}>
                                    <ComposedChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} dy={10} />
                                        <YAxis 
                                            yAxisId="left" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} 
                                            tickFormatter={(value) => formatCompact(value)} 
                                        />
                                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#f59e0b', fontSize: 11, fontWeight: 600}} />
                                        <RechartsTooltip 
                                            contentStyle={{ 
                                                borderRadius: 16, border: 'none', 
                                                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                                                background: isDark ? '#1e293b' : '#fff'
                                            }}
                                            itemStyle={{ fontWeight: 700 }}
                                            formatter={(value: unknown, name: unknown) => {
                                                const metricName: ChartTooltipName = typeof name === 'string' || typeof name === 'number' ? name : '';
                                                const metricValue = typeof value === 'string' || typeof value === 'number' ? value : 0;
                                                return [
                                                    metricName === t('orders') ? metricValue : `${formatCompact(metricValue)} ${t('million')}`,
                                                    metricName,
                                                ] as [string | number, ChartTooltipName];
                                            }}
                                        />
                                        <Legend verticalAlign="top" align="right" iconType="circle" height={36} />
                                        <Bar yAxisId="right" name={t('orders')} dataKey="orders" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={30} opacity={0.8} />
                                        <Area yAxisId="left" type="monotone" name={t('charts.revenue')} dataKey="revenue" stroke="#3b82f6" strokeWidth={4} fill="url(#colorRev)" />
                                    </ComposedChart>
                            </SafeResponsiveContainer>
                        </Skeleton>
                    </Card>
                </Col>
                )}
                {showShipmentStatus && (
                <Col xs={24} lg={showRevenueChart ? 8 : 24}>
                    <Card 
                        title={<Title level={5} style={{ margin: 0, fontWeight: 800, color: isDark ? '#f8fafc' : undefined }}>{t('shipmentStatus')} ({t('live')})</Title>}
                        variant="borderless"
                        style={{ 
                            borderRadius: 28, height: '100%', 
                            boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)' : '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                            background: isDark ? '#1e293b' : '#fff',
                            border: isDark ? '1px solid #334155' : '1px solid #f0f0f0'
                        }}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 10 }}>
                            <div style={{ height: 380, minWidth: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                <SafeResponsiveContainer height={260}>
                                    <PieChart>
                                        <Pie 
                                            data={shipmentStats} 
                                            innerRadius={70} 
                                            outerRadius={100} 
                                            paddingAngle={8} 
                                            dataKey="value"
                                            cornerRadius={12}
                                            stroke="none"
                                        >
                                            {shipmentStats.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip />
                                    </PieChart>
                                </SafeResponsiveContainer>
                                <div style={{ position: 'absolute', top: '35%', textAlign: 'center' }}>
                                    <div style={{ fontSize: 42, fontWeight: 900, color: isDark ? '#f8fafc' : token.colorText, lineHeight: 1 }}>{kpis.activeShipments}</div>
                                    <Text style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0, color: isDark ? '#cbd5e1' : '#64748b' }}>{t('shipments')}</Text>
                                </div>
                                <div style={{ width: '100%', marginTop: 20, padding: '0 20px' }}>
                                    <Row gutter={[8, 8]}>
                                        {shipmentStats.map((s, i) => (
                                            <Col span={12} key={i}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, background: isDark ? '#1e293b' : '#f8fafc' }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i] }} />
                                                    <Text style={{ fontSize: 11, fontWeight: 600 }}>{s.name}: {s.value}</Text>
                                                </div>
                                            </Col>
                                        ))}
                                    </Row>
                                </div>
                            </div>
                        </Skeleton>
                    </Card>
                </Col>
                )}
            </Row>
            </>
            )}
            </div>

            <div style={{ order: 4 }}>
            {/* --- ACTIONABLE INTELLIGENCE --- */}
            {(showLowStockPanel || showPartnerPanel || showUpcomingShipmentPanel) && (
            <>
            <DashboardSectionHeader
                title={dashboardText('sectionActionable', 'Việc cần chú ý')}
                description={dashboardText('sectionActionableDesc', 'Các cảnh báo và danh sách có thể hành động ngay theo từng vai trò vận hành.')}
                isDark={isDark}
            />
            <Row gutter={[20, 20]}>
                {/* Low Stock Alerts */}
                {showLowStockPanel && (
                <Col xs={24} lg={showPartnerPanel || showUpcomingShipmentPanel ? 8 : 24}>
                    <Card
                        title={<Space><ClockCircleOutlined style={{ color: '#ef4444' }} /><Title level={5} style={{ margin: 0, fontWeight: 800, color: isDark ? '#f8fafc' : undefined }}>{t('lowStock')}</Title></Space>}
                        extra={
                            <Space>
                                <Button type="link" size="small" style={{ fontSize: 12 }}>{t('viewAll')}</Button>
                                <Dropdown menu={{ items: [{ key: '1', label: t('refresh') }, { key: '2', label: t('settings') }] }} trigger={['click']}>
                                    <Button type="text" icon={<MoreOutlined />} size="small" />
                                </Dropdown>
                            </Space>
                        }
                        variant="borderless"
                        style={{ 
                            borderRadius: 28, height: '100%',
                            boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)' : '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                            background: isDark ? '#1e293b' : '#fff',
                            border: isDark ? '1px solid #334155' : '1px solid #f0f0f0'
                        }}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                                {lowStockProducts.length > 0 ? (
                                    lowStockProducts.map((p: DashboardLowStockProduct, i: number) => (
                                        <motion.div 
                                            initial={{ x: -20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: i * 0.1 }}
                                            key={p._id}
                                            style={{ 
                                                padding: '16px', 
                                                background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#fff', 
                                                borderRadius: 20,
                                                border: isDark ? '1px solid #334155' : '1px solid #f1f5f9',
                                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                                                <Space>
                                                    <Avatar shape="square" src={p.imageUrl} icon={<ShoppingCartOutlined />} style={{ background: '#ef444415', color: '#ef4444' }} />
                                                    <div>
                                                        <Text strong style={{ display: 'block', color: isDark ? '#f8fafc' : undefined }}>{p.name}</Text>
                                                        <Text type="secondary" style={{ fontSize: 11 }}>SKU: {p.sku}</Text>
                                                    </div>
                                                </Space>
                                                <Button type="primary" size="small" danger ghost style={{ borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{t('reorder')}</Button>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ flex: 1, height: 6, background: isDark ? '#334155' : '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                                                    <motion.div 
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${Math.min((p.currentStock / 100) * 100, 100)}%` }}
                                                        style={{ height: '100%', background: '#ef4444', borderRadius: 3 }} 
                                                    />
                                                </div>
                                                <Text strong style={{ fontSize: 12, color: '#ef4444' }}>{p.currentStock} {t('units')}</Text>
                                            </div>
                                        </motion.div>
                                    ))
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#10b98110', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                            <CheckCircleOutlined style={{ fontSize: 40, color: '#10b981' }} />
                                        </div>
                                        <Text strong style={{ display: 'block', fontSize: 16 }}>{t('stockSafe')}</Text>
                                        <Text type="secondary">{t('stockOptimized')}</Text>
                                    </div>
                                )}
                            </div>
                        </Skeleton>
                    </Card>
                </Col>
                )}

                {/* Top Strategic Partners */}
                {showPartnerPanel && (
                <Col xs={24} lg={showLowStockPanel || showUpcomingShipmentPanel ? 8 : 24}>
                    <Card
                        title={
                            <Tabs 
                                activeKey={activePartnerTab}
                                onChange={(key) => setActivePartnerTab(key as '1' | '2')}
                                size="small"
                                tabBarExtraContent={
                                    <Button type="link" size="small" style={{ fontSize: 12 }}>{t('analytics')}</Button>
                                }
                                items={[
                                    { key: '1', label: t('buyer'), icon: <GlobalOutlined /> },
                                    { key: '2', label: t('supplier'), icon: <TeamOutlined /> },
                                ]}
                            />
                        }
                        variant="borderless"
                        style={{ 
                            borderRadius: 28, height: '100%',
                            boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)' : '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                            background: isDark ? '#1e293b' : '#fff',
                            border: isDark ? '1px solid #334155' : '1px solid #f0f0f0'
                        }}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                                {partnerRows.map((p: DashboardPartnerLine, i: number) => (
                                    <motion.div 
                                        whileHover={{ x: 5 }}
                                        key={p._id}
                                        style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center', 
                                            padding: '16px', 
                                            background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc', 
                                            borderRadius: 20,
                                            cursor: 'pointer',
                                            border: '1px solid transparent'
                                        }}
                                        onClick={() => window.location.href = activePartnerTab === '1' ? `/admin/partners/${p._id}` : `/admin/suppliers/${p._id}`}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <Avatar size={40} style={{ background: `linear-gradient(135deg, ${COLORS[i % COLORS.length]} 0%, ${COLORS[i % COLORS.length]}88 100%)`, fontWeight: 700 }}>
                                                {p.name.charAt(0)}
                                            </Avatar>
                                            <div>
                                                <Text strong style={{ display: 'block', color: isDark ? '#f8fafc' : undefined }}>{p.name}</Text>
                                                <Tag color={activePartnerTab === '1' ? "success" : "processing"} style={{ fontSize: 10, borderRadius: 6, border: 'none' }}>
                                                    {activePartnerTab === '1' ? t('vipBuyer') : t('keySupplier')}
                                                </Tag>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                        <Text strong style={{ display: 'block', color: '#3b82f6' }}>{formatVND(p.total)}</Text>
                                            <Text type="secondary" style={{ fontSize: 11 }}>{activePartnerTab === '1' ? t('purchaseTotal') : t('supplyTotal')}</Text>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </Skeleton>
                    </Card>
                </Col>
                )}

                {/* Upcoming Shipments */}
                {showUpcomingShipmentPanel && (
                <Col xs={24} lg={showLowStockPanel || showPartnerPanel ? 8 : 24}>
                    <Card
                        title={<Space><TruckOutlined style={{ color: '#10b981' }} /><Title level={5} style={{ margin: 0, fontWeight: 800, color: isDark ? '#f8fafc' : undefined }}>{t('upcomingShipments7D')}</Title></Space>}
                        extra={<Button type="text" icon={<PlusOutlined />} size="small" />}
                        variant="borderless"
                        style={{ 
                            borderRadius: 28, height: '100%',
                            boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)' : '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                            background: isDark ? '#1e293b' : '#fff',
                            border: isDark ? '1px solid #334155' : '1px solid #f0f0f0'
                        }}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
                            <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                            {upcomingShipments.length > 0 ? (
                                <Timeline
                                    style={{ marginTop: 10 }}
                                    items={upcomingShipments.map((s: DashboardUpcomingShipment) => ({
                                        key: s._id || s.number,
                                        color: '#10b981',
                                        content: (
                                            <motion.div whileHover={{ x: 5 }} style={{ marginBottom: 12, padding: '12px', background: isDark ? 'rgba(16, 185, 129, 0.05)' : '#10b98105', borderRadius: 12 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <Text strong style={{ color: isDark ? '#f8fafc' : undefined }}>{s.number}</Text>
                                                    <Tag color={SHIP_STATUS_COLOR[s.status] || 'processing'} style={{ borderRadius: 6, fontSize: 10 }}>
                                                        {t(s.status.toLowerCase())}
                                                    </Tag>
                                                </div>
                                                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                                                    <GlobalOutlined style={{ marginRight: 4 }} /> {s.customer}
                                                </Text>
                                                <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                                                    <ClockCircleOutlined style={{ marginRight: 4 }} /> ETD: {dayjs(s.etd).format('DD MMM, YYYY')}
                                                </Text>
                                            </motion.div>
                                        )
                                    }))}
                                />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: isDark ? '#334155' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                        <TruckOutlined style={{ fontSize: 40, color: isDark ? '#64748b' : '#cbd5e1' }} />
                                    </div>
                                    <Text type="secondary" style={{ display: 'block' }}>{t('noShipments')}</Text>
                                    <Button type="link" style={{ marginTop: 8 }}>{t('createNewShipment')}</Button>
                                </div>
                            )}
                            </div>
                        </Skeleton>
                    </Card>
                </Col>
                )}
            </Row>
            </>
            )}
            </div>
            </div>

            <Drawer
                title={selectedWidget?.title || dashboardText('widgetDetails', 'Chi tiết KPI')}
                open={Boolean(selectedWidget)}
                onClose={() => setActiveWidgetId(null)}
                size="large"
            >
                {selectedWidget ? (
                    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                        <DashboardMetricCard
                            _id={selectedWidget._id}
                            label={selectedWidget.title}
                            value={selectedWidget.value}
                            caption={selectedWidget.caption}
                            icon={selectedWidget.icon}
                            color={selectedWidget.color}
                            valueColor={selectedWidget.valueColor}
                            loading={loading}
                            isDark={isDark}
                            trend={selectedWidget.trend}
                        />
                        <Card variant="borderless" style={dashboardCardStyle(isDark, 16)}>
                            {selectedWidget.detail}
                        </Card>
                    </Space>
                ) : null}
            </Drawer>

            <Drawer
                title={dashboardText('widgetPicker', 'Thư viện widget')}
                open={customizeOpen}
                onClose={() => setCustomizeOpen(false)}
                size="default"
                extra={
                    <Space>
                        <Button onClick={() => applyRolePreset(rolePresetKey)}>
                            {dashboardText('restoreRolePreset', 'Theo vai trò')}
                        </Button>
                        <Button onClick={resetDashboardLayout}>{dashboardText('resetLayout', 'Khôi phục mặc định')}</Button>
                        <Button type="primary" onClick={exitEditMode}>{dashboardText('doneEditing', 'Xong')}</Button>
                    </Space>
                }
            >
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                    <Card size="small" variant="borderless" style={{ background: isDark ? '#0f172a' : '#f8fafc', borderRadius: 12 }}>
                        <Space wrap size={[8, 8]}>
                            <Text strong>{dashboardText('rolePreset', 'Preset')}:</Text>
                            <Tag color="blue">{rolePresetLabels[rolePresetKey]}</Tag>
                            <Tag>{dashboardText('visibleWidgets', 'Widget đang bật')}: {visibleWidgetCount}/{DASHBOARD_WIDGET_ORDER.length}</Tag>
                            <Tag>{dashboardText('currentTabWidgets', 'Trong tab này')}: {visibleDashboardWidgets.length}</Tag>
                        </Space>
                    </Card>
                    <Text style={{ color: isDark ? '#cbd5e1' : '#64748b' }}>
                        {dashboardText('widgetPickerDesc', 'Bật/tắt widget bằng checkbox. Kéo icon tay nắm để đổi thứ tự ưu tiên; view mode sẽ khóa layout để thao tác an toàn.')}
                    </Text>
                    {widgetCatalogGroups.map((section) => (
                        <div key={section.group}>
                            <Text strong style={{ display: 'block', marginBottom: 8, color: isDark ? '#f8fafc' : '#0f172a' }}>
                                {section.label}
                            </Text>
                            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                                {section.widgets.map((widget) => {
                                    const index = widgetOrder.indexOf(widget._id);
                                    const isActiveInCurrentTab = widget.tabs.includes(activeDashboardTab);

                                    return (
                                        <div
                                            key={widget._id}
                                            onDragOver={(event) => {
                                                if (draggedWidgetId && draggedWidgetId !== widget._id) {
                                                    event.preventDefault();
                                                }
                                            }}
                                            onDrop={(event) => dropWidgetBefore(event, widget._id)}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: 12,
                                                padding: '12px 14px',
                                                borderRadius: 12,
                                                border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
                                                background: draggedWidgetId === widget._id ? (isDark ? '#334155' : '#eff6ff') : (isDark ? '#0f172a' : '#fff'),
                                            }}
                                        >
                                            <Space size={10} align="start">
                                                <Button
                                                    size="small"
                                                    type="text"
                                                    draggable
                                                    icon={<HolderOutlined />}
                                                    title={dashboardText('dragToArrange', 'Kéo để sắp xếp')}
                                                    onDragStart={(event) => startWidgetDrag(event, widget._id)}
                                                    onDragEnd={() => setDraggedWidgetId(null)}
                                                    style={{ cursor: 'grab', marginTop: 2 }}
                                                />
                                                <Checkbox
                                                    checked={widgetVisibility[widget._id]}
                                                    onChange={(event) => toggleWidgetVisibility(widget._id, event.target.checked)}
                                                >
                                                    <Space orientation="vertical" size={4}>
                                                        <Text strong>{widget.title}</Text>
                                                        <Space wrap size={[4, 4]}>
                                                            <Tag color={widget.type === 'metric' ? 'blue' : widget.type === 'insight' ? 'purple' : 'orange'}>
                                                                {widgetTypeLabels[widget.type]}
                                                            </Tag>
                                                            <Tag>{widgetSizeLabels[widget.size]}</Tag>
                                                            {isActiveInCurrentTab ? <Tag color="green">{dashboardText('activeInCurrentTab', 'Đang thuộc tab này')}</Tag> : null}
                                                        </Space>
                                                    </Space>
                                                </Checkbox>
                                            </Space>
                                            <Space size={4}>
                                                <Button size="small" disabled={index === 0} onClick={() => moveWidgetByOffset(widget._id, -1)}>{dashboardText('moveUp', 'Lên')}</Button>
                                                <Button size="small" disabled={index === widgetOrder.length - 1} onClick={() => moveWidgetByOffset(widget._id, 1)}>{dashboardText('moveDown', 'Xuống')}</Button>
                                            </Space>
                                        </div>
                                    );
                                })}
                            </Space>
                        </div>
                    ))}
                </Space>
            </Drawer>
        </div>
    );
};

export default AdminDashboard;
