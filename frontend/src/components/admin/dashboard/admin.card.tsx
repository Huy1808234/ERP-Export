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
    FilterOutlined,
    GlobalOutlined,
    HolderOutlined,
    ReloadOutlined,
    ShoppingCartOutlined,
    TruckOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import { Alert, Card, Col, Row, Tag, Timeline, Typography, Avatar, Space, Button, DatePicker, Skeleton, theme, Progress, Drawer, Checkbox, Empty, Tooltip } from 'antd';
import { type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/context/theme.context';
import {
    Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, Tooltip as RechartsTooltip,
    XAxis, YAxis,
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

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
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
const DASHBOARD_FRONTEND_CACHE_TTL_MS = 60_000;
const DASHBOARD_MANUAL_REFRESH_COOLDOWN_MS = 30_000;
const DASHBOARD_POLLING_INTERVAL_MS = 60_000;
const DASHBOARD_SAMPLE_DATA_ENABLED = process.env.NEXT_PUBLIC_DASHBOARD_SAMPLE_DATA === 'true';
const DSO_TARGET_DAYS = 60;

type ChartTooltipName = string | number;

interface RevenueChartPoint {
    month: string;
    revenue: number;
    orders: number;
}

interface ShipmentStat {
    statusKey: string;
    name: string;
    value: number;
}

type DashboardTabChartMode = 'line' | 'bar' | 'donut';

interface DashboardTabChartPoint {
    label: string;
    primary: number;
    secondary?: number;
    statusKey?: string;
}

interface DashboardTabChartConfig {
    _id: DashboardTabKey;
    mode: DashboardTabChartMode;
    title: string;
    description: string;
    data: DashboardTabChartPoint[];
    primaryLabel: string;
    secondaryLabel?: string;
    primaryColor: string;
    secondaryColor?: string;
    barColors?: string[];
    yAxisDomain?: [number, number];
    isSampleData?: boolean;
    isTrailingPeriodPartial?: boolean;
    note?: string;
    activeKey?: string | null;
    onPointClick?: (point: DashboardTabChartPoint) => void;
    onClearSelection?: () => void;
    valueFormatter: (value: number) => string;
    axisFormatter?: (value: number) => string;
    secondaryFormatter?: (value: number) => string;
}

interface DashboardDataCacheEntry {
    executive: DashboardExecutiveData | null;
    drilldown: DashboardKpiDrilldown | null;
    fetchedAt: number;
}

interface BusinessAnalysisPoint {
    label: string;
    value: number;
    secondary?: number;
}

interface CostDistributionPoint {
    name: string;
    value: number;
}

interface FinanceAgingFocusBucket {
    _id: string;
    label: string;
    valueVnd: number;
    color: string;
    isOverdue: boolean;
}

type DashboardBusinessAlertTone = 'danger' | 'warning' | 'info';

interface DashboardBusinessAlert {
    _id: string;
    tone: DashboardBusinessAlertTone;
    title: string;
    description: string;
}

const FALLBACK_REVENUE_TREND_DATA: DashboardTabChartPoint[] = [
    { label: 'M-5', primary: 18, secondary: 4 },
    { label: 'M-4', primary: 24, secondary: 5 },
    { label: 'M-3', primary: 21, secondary: 6 },
    { label: 'M-2', primary: 32, secondary: 7 },
    { label: 'M-1', primary: 29, secondary: 8 },
    { label: 'Now', primary: 38, secondary: 10 },
];

const FALLBACK_SALES_TREND_DATA: DashboardTabChartPoint[] = [
    { label: 'W1', primary: 6, secondary: 12 },
    { label: 'W2', primary: 8, secondary: 18 },
    { label: 'W3', primary: 7, secondary: 16 },
    { label: 'W4', primary: 11, secondary: 24 },
];

const FALLBACK_LOGISTICS_SHARE_DATA: DashboardTabChartPoint[] = [
    { label: 'Booked', primary: 28, secondary: 28, statusKey: 'BOOKED' },
    { label: 'Loading', primary: 24, secondary: 24, statusKey: 'LOADING' },
    { label: 'On Board', primary: 31, secondary: 31, statusKey: 'ON_BOARD' },
    { label: 'Arrived', primary: 17, secondary: 17, statusKey: 'ARRIVED' },
];

const FALLBACK_FINANCE_SHARE_DATA: DashboardTabChartPoint[] = [
    { label: 'Current', primary: 820_000_000 },
    { label: '1-30d', primary: 380_000_000 },
    { label: '31-60d', primary: 270_000_000 },
    { label: '61-90d', primary: 210_000_000 },
    { label: '>90d', primary: 140_000_000 },
];

const FALLBACK_GPM_TREND_DATA: BusinessAnalysisPoint[] = [
    { label: 'Q1', value: 28 },
    { label: 'Q2', value: 35 },
    { label: 'Q3', value: 31 },
    { label: 'Q4', value: 38 },
];

const FALLBACK_GPM_PRODUCT_DATA: BusinessAnalysisPoint[] = [
    { label: 'Gia dụng', value: 63, secondary: 1_200_000_000 },
    { label: 'Điện tử', value: 56, secondary: 900_000_000 },
    { label: 'May mặc', value: 35, secondary: 650_000_000 },
    { label: 'Khác', value: 19, secondary: 420_000_000 },
];

const FALLBACK_GPM_MARKET_DATA: BusinessAnalysisPoint[] = [
    { label: 'Việt Nam', value: 35, secondary: 1_200_000_000 },
    { label: 'Thái Lan', value: 30, secondary: 800_000_000 },
    { label: 'Singapore', value: 25, secondary: 500_000_000 },
];

const FALLBACK_COST_DISTRIBUTION_DATA: CostDistributionPoint[] = [
    { name: 'Giá vốn', value: 65 },
    { name: 'Vận hành', value: 15 },
    { name: 'Marketing', value: 10 },
    { name: 'Lợi nhuận gộp', value: 10 },
];

const makeShareChartData = (
    items: Array<{ label: string; value: number; statusKey?: string }>,
    fallback: DashboardTabChartPoint[],
): DashboardTabChartPoint[] => {
    const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
    if (total <= 0) return fallback;

    return items
        .filter((item) => Number(item.value || 0) > 0)
        .map((item) => ({
            label: item.label,
            primary: Number(((Number(item.value || 0) / total) * 100).toFixed(1)),
            secondary: Number(item.value || 0),
            statusKey: item.statusKey,
        }));
};

const formatChartAxisLabel = (value: unknown): string => {
    const label = String(value ?? '');
    return label.length > 14 ? `${label.slice(0, 13)}...` : label;
};

const getBusinessAlertColor = (tone: DashboardBusinessAlertTone): string => {
    if (tone === 'danger') return '#ef4444';
    if (tone === 'warning') return '#f59e0b';
    return '#3b82f6';
};

const compactPercent = (value?: number) => `${Number(value || 0).toFixed(1)}%`;

const getLowStockThreshold = (product: DashboardLowStockProduct): number => {
    const threshold = Number(product.safetyStock ?? product.minimumStock ?? 100);
    return Math.max(threshold || 100, 1);
};

const getLowStockRatioPercent = (product: DashboardLowStockProduct): number => {
    const threshold = getLowStockThreshold(product);
    return Math.min((Number(product.currentStock || 0) / threshold) * 100, 100);
};

const getLowStockColor = (ratioPercent: number): string => {
    if (ratioPercent <= 35) return '#ef4444';
    if (ratioPercent <= 70) return '#f59e0b';
    return '#10b981';
};

const getLogisticsCostRiskColor = (ratioPercent?: number): string => {
    const ratio = Number(ratioPercent || 0);
    if (ratio >= 15) return '#ef4444';
    if (ratio >= 8) return '#f59e0b';
    return '#10b981';
};

const getDsoRiskColor = (dsoDays?: number): string => {
    const days = Number(dsoDays || 0);
    if (days >= 90) return '#ef4444';
    if (days >= 60) return '#f59e0b';
    return '#10b981';
};

const getOverdueDaysRiskColor = (overdueDays?: number): string => {
    const days = Number(overdueDays || 0);
    if (days >= 90) return '#ef4444';
    if (days >= 30) return '#f59e0b';
    return '#3b82f6';
};

const normalizeStatusKey = (status?: string | null): string => String(status || '').trim().toUpperCase();

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

interface DashboardDonutChartProps {
    _id: DashboardTabKey;
    data: DashboardTabChartPoint[];
    activeKey?: string | null;
    primaryLabel: string;
    secondaryLabel?: string;
    primaryColor: string;
    barColors?: string[];
    valueFormatter: (value: number) => string;
    tooltipStyle: CSSProperties;
    formatTooltipValue: (value: unknown, name: unknown) => [string, ChartTooltipName];
    isDark: boolean;
    locale: string;
    dashboardText: (key: string, fallback: string) => string;
    onPointClick?: (point: DashboardTabChartPoint) => void;
    onClearSelection?: () => void;
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

const getDashboardWidgetStorageKey = (username?: string | null): string => {
    const ownerUsername = username?.trim();
    return ownerUsername ? `${DASHBOARD_WIDGET_STORAGE_KEY}.${ownerUsername}` : `${DASHBOARD_WIDGET_STORAGE_KEY}.anonymous`;
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

const dashboardCardStyle = (isDark: boolean, radius = 12) => ({
    borderRadius: radius,
    background: isDark ? '#1e293b' : '#fff',
    border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
    boxShadow: isDark ? '0 8px 18px -10px rgba(0, 0, 0, 0.6)' : '0 8px 18px -14px rgba(15, 23, 42, 0.25)',
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
        styles={{ body: { padding: 14 } }}
    >
        <Skeleton loading={loading} active paragraph={{ rows: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, minHeight: 66 }}>
                <div style={{ minWidth: 0 }}>
                    <Space size={8} style={{ marginBottom: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: 850, textTransform: 'uppercase', color: isDark ? '#cbd5e1' : '#475569', letterSpacing: 0 }}>
                            {label}
                        </Text>
                        {action}
                    </Space>
                    <div style={{ fontSize: 20, fontWeight: 850, color: valueColor || (isDark ? '#f8fafc' : '#111827'), lineHeight: 1.15, letterSpacing: 0 }}>
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
                                    backgroundColor: trend.value === 0 ? (isDark ? '#334155' : '#f1f5f9') : trend.isUp ? '#dcfce7' : '#fee2e2',
                                    color: trend.value === 0 ? (isDark ? '#cbd5e1' : '#64748b') : trend.isUp ? '#047857' : '#b91c1c',
                                    fontSize: 12,
                                    fontWeight: 800,
                                }}
                            >
                                {trend.value === 0 ? null : trend.isUp ? <ArrowUpOutlined style={{ marginRight: 4 }} /> : <ArrowDownOutlined style={{ marginRight: 4 }} />}
                                {Math.abs(trend.value).toFixed(1)}%
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
                            width: 36,
                            height: 36,
                            flex: '0 0 36px',
                            borderRadius: 10,
                            background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 17,
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
            minHeight: 108,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 8,
            padding: '14px 12px',
            borderRadius: 12,
            background: isDark ? 'rgba(15, 23, 42, 0.35)' : '#f8fafc',
            border: isDark ? '1px dashed #334155' : '1px dashed #dbe3ef',
        }}
    >
        <div
            style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `${color}18`,
                color,
                fontSize: 19,
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
            alignItems: 'center',
            gap: 16,
            margin: '18px 0 10px',
        }}
    >
        <div style={{ minWidth: 0 }}>
            <Title level={5} style={{ margin: 0, fontWeight: 850, color: isDark ? '#f8fafc' : '#0f172a' }}>
                {title}
            </Title>
            {description ? (
                <Text style={{ display: 'block', marginTop: 3, color: isDark ? '#cbd5e1' : '#64748b', fontSize: 12 }}>
                    {description}
                </Text>
            ) : null}
        </div>
        {action}
    </div>
);

const DashboardDonutChart = ({
    _id,
    data,
    activeKey,
    primaryLabel,
    secondaryLabel,
    primaryColor,
    barColors,
    valueFormatter,
    tooltipStyle,
    formatTooltipValue,
    isDark,
    locale,
    dashboardText,
    onPointClick,
    onClearSelection,
}: DashboardDonutChartProps) => {
    const numberLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
    const palette = barColors || COLORS;
    const total = data.reduce((sum, point) => sum + Number(point.secondary || 0), 0);
    const getColor = (index: number): string => palette[index % palette.length] || primaryColor;

    return (
        <div
            style={{
                minHeight: 250,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
                alignItems: 'center',
            }}
        >
            <div style={{ position: 'relative', minHeight: 250 }}>
                <SafeResponsiveContainer height={250}>
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="primary"
                            nameKey="label"
                            innerRadius={64}
                            outerRadius={94}
                            paddingAngle={4}
                            stroke="none"
                            isAnimationActive
                        >
                            {data.map((entry, index) => {
                                const color = getColor(index);
                                const isActiveSlice = Boolean(activeKey && entry.statusKey === activeKey);

                                return (
                                    <Cell
                                        key={`${_id}-${entry.label}`}
                                        fill={color}
                                        opacity={activeKey && !isActiveSlice ? 0.38 : 1}
                                        cursor={entry.statusKey ? 'pointer' : 'default'}
                                        stroke={isActiveSlice ? (isDark ? '#f8fafc' : '#0f172a') : 'none'}
                                        strokeWidth={isActiveSlice ? 2 : 0}
                                        onClick={() => onPointClick?.(entry)}
                                    />
                                );
                            })}
                        </Pie>
                        <RechartsTooltip contentStyle={tooltipStyle} formatter={formatTooltipValue} />
                    </PieChart>
                </SafeResponsiveContainer>
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                    }}
                >
                    <Text strong style={{ fontSize: 24, color: isDark ? '#f8fafc' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        {total.toLocaleString(numberLocale)}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {secondaryLabel || primaryLabel}
                    </Text>
                </div>
            </div>
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {data.map((point, index) => {
                    const color = getColor(index);
                    const isActivePoint = Boolean(activeKey && point.statusKey === activeKey);

                    return (
                        <button
                            key={`${_id}-legend-${point.label}`}
                            type="button"
                            aria-pressed={isActivePoint}
                            aria-label={`${dashboardText('filterByStatus', 'Lọc theo trạng thái')} ${point.label}`}
                            onClick={() => onPointClick?.(point)}
                            style={{
                                width: '100%',
                                appearance: 'none',
                                display: 'grid',
                                gridTemplateColumns: '12px minmax(0, 1fr) minmax(58px, auto) minmax(52px, auto)',
                                gap: 10,
                                alignItems: 'center',
                                padding: '9px 10px',
                                borderRadius: 10,
                                border: isActivePoint ? `1px solid ${color}` : (isDark ? '1px solid #334155' : '1px solid #e5e7eb'),
                                background: isActivePoint ? `${color}14` : (isDark ? 'rgba(15, 23, 42, 0.24)' : '#f8fafc'),
                                cursor: point.statusKey ? 'pointer' : 'default',
                                textAlign: 'left',
                                font: 'inherit',
                            }}
                        >
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                            <Text strong ellipsis style={{ minWidth: 0, color: isDark ? '#f8fafc' : '#0f172a' }}>
                                {point.label}
                            </Text>
                            <Text style={{ textAlign: 'right', color, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>
                                {valueFormatter(point.primary)}
                            </Text>
                            <Text type="secondary" style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                                {typeof point.secondary === 'number' ? point.secondary.toLocaleString(numberLocale) : ''}
                            </Text>
                        </button>
                    );
                })}
                {activeKey ? (
                    <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClearSelection} style={{ alignSelf: 'flex-start', fontWeight: 700 }}>
                        {dashboardText('clearFilter', 'Bỏ lọc')}
                    </Button>
                ) : null}
            </Space>
        </div>
    );
};

const AdminDashboard = () => {
    const t = useTranslations('Dashboard');
    const locale = useLocale();
    const router = useRouter();
    const numberLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
    const dashboardText = useCallback((key: string, fallback: string) => {
        return t.has(key) ? t(key) : fallback;
    }, [t]);
    const { data: session } = useSession();
    const canViewCost = canReadCostFields(session?.user);
    const [loading, setLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState<string | null>(null);
    const [data, setData] = useState<DashboardExecutiveData | null>(null);
    const [drilldown, setDrilldown] = useState<DashboardKpiDrilldown | null>(null);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);
    const [currency, setCurrency] = useState<'VND' | 'USD'>('VND');
    const [activePartnerTab, setActivePartnerTab] = useState<'1' | '2'>('1');
    const [activeMarginTab, setActiveMarginTab] = useState<'market' | 'product'>('market');
    const [activeDashboardTab, setActiveDashboardTab] = useState<DashboardTabKey>('overview');
    const [activeLogisticsStatus, setActiveLogisticsStatus] = useState<string | null>(null);
    const [customizeOpen, setCustomizeOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [activeWidgetId, setActiveWidgetId] = useState<DashboardWidgetId | null>(null);
    const [draggedWidgetId, setDraggedWidgetId] = useState<DashboardWidgetId | null>(null);
    const [longPressWidgetId, setLongPressWidgetId] = useState<DashboardWidgetId | null>(null);
    const [resizingWidgetId, setResizingWidgetId] = useState<DashboardWidgetId | null>(null);
    const [preferencesHydrated, setPreferencesHydrated] = useState(false);
    const [hydratedPreferenceKey, setHydratedPreferenceKey] = useState<string | null>(null);

    const openPartnerModule = useCallback((partnerRef: string) => {
        const params = new URLSearchParams({
            partner_ref: partnerRef,
            partner_type: activePartnerTab === '1' ? 'CUSTOMER' : 'SUPPLIER',
        });

        router.push(`/${locale}/dashboard/partners?${params.toString()}`);
    }, [activePartnerTab, locale, router]);
    const [widgetVisibility, setWidgetVisibility] = useState<Record<DashboardWidgetId, boolean>>(DEFAULT_WIDGET_VISIBILITY);
    const [widgetOrder, setWidgetOrder] = useState<DashboardWidgetId[]>(DASHBOARD_WIDGET_ORDER);
    const [widgetSpanOverrides, setWidgetSpanOverrides] = useState<Partial<Record<DashboardWidgetId, DashboardWidgetSpan>>>({});
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suppressNextWidgetClickRef = useRef(false);
    const resizeSessionRef = useRef<DashboardWidgetResizeSession | null>(null);
    const dashboardDataCacheRef = useRef<Record<string, DashboardDataCacheEntry>>({});
    const backgroundRefreshInFlightRef = useRef(false);
    const [manualRefreshLockedUntil, setManualRefreshLockedUntil] = useState(0);
    const [refreshClock, setRefreshClock] = useState(0);
    const [chartRefreshing, setChartRefreshing] = useState(false);

    const { token } = theme.useToken();
    const { isDark } = useTheme();
    const { formatVND, formatMoney, formatCompact } = useCurrency();
    const dashboardWidgetStorageKey = useMemo(
        () => getDashboardWidgetStorageKey(session?.user?.username),
        [session?.user?.username],
    );
    const getDashboardDataCacheKey = useCallback((start?: string, end?: string) => (
        `${session?.user?.username || 'anonymous'}:${start || 'default'}:${end || 'default'}`
    ), [session?.user?.username]);

    const dateRangePresets = useMemo(() => {
        const now = dayjs();
        const quarterStartMonth = Math.floor(now.month() / 3) * 3;
        const quarterStart = now.month(quarterStartMonth).startOf('month');

        return [
            {
                label: dashboardText('presetToday', 'Hôm nay'),
                value: [now.startOf('day'), now.endOf('day')] as [dayjs.Dayjs, dayjs.Dayjs],
            },
            {
                label: dashboardText('presetThisMonth', 'Tháng này'),
                value: [now.startOf('month'), now.endOf('day')] as [dayjs.Dayjs, dayjs.Dayjs],
            },
            {
                label: dashboardText('presetThisQuarter', 'Quý này'),
                value: [quarterStart, now.endOf('day')] as [dayjs.Dayjs, dayjs.Dayjs],
            },
            {
                label: dashboardText('presetThisYear', 'Năm nay'),
                value: [now.startOf('year'), now.endOf('day')] as [dayjs.Dayjs, dayjs.Dayjs],
            },
        ];
    }, [dashboardText]);

    const fetchDashboardData = useCallback(async (start?: string, end?: string, options?: { force?: boolean; showGlobalLoading?: boolean }) => {
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
            console.error("Lỗi tải dữ liệu Dashboard:", error);
            setDashboardError(dashboardText('loadError', 'Không tải được dữ liệu dashboard. Vui lòng thử lại.'));
        } finally {
            if (shouldShowGlobalLoading) setLoading(false);
        }
    }, [dashboardText, getDashboardDataCacheKey]);

    const refreshDashboardData = useCallback(() => {
        const now = Date.now();
        if (now < manualRefreshLockedUntil || loading || chartRefreshing || backgroundRefreshInFlightRef.current) return;

        setManualRefreshLockedUntil(now + DASHBOARD_MANUAL_REFRESH_COOLDOWN_MS);
        setRefreshClock(now);
        setChartRefreshing(true);
        fetchDashboardData(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'), { force: true, showGlobalLoading: false })
            .finally(() => setChartRefreshing(false));
    }, [chartRefreshing, dateRange, fetchDashboardData, loading, manualRefreshLockedUntil]);

    useEffect(() => {
        fetchDashboardData(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'));
    }, [dateRange, fetchDashboardData]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            if (document.visibilityState !== 'visible' || loading || chartRefreshing || backgroundRefreshInFlightRef.current) return;

            backgroundRefreshInFlightRef.current = true;
            fetchDashboardData(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'), {
                force: true,
                showGlobalLoading: false,
            }).finally(() => {
                backgroundRefreshInFlightRef.current = false;
            });
        }, DASHBOARD_POLLING_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [chartRefreshing, dateRange, fetchDashboardData, loading]);

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

    useEffect(() => {
        setPreferencesHydrated(false);
        setHydratedPreferenceKey(null);

        try {
            const rawPreferences = window.localStorage.getItem(dashboardWidgetStorageKey)
                || window.localStorage.getItem(DASHBOARD_WIDGET_STORAGE_KEY);
            if (!rawPreferences) {
                setPreferencesHydrated(true);
                setHydratedPreferenceKey(dashboardWidgetStorageKey);
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
            setHydratedPreferenceKey(dashboardWidgetStorageKey);
        }
    }, [dashboardWidgetStorageKey]);

    useEffect(() => {
        if (!preferencesHydrated || hydratedPreferenceKey !== dashboardWidgetStorageKey) return;

        const preferences: DashboardWidgetPreferences = {
            visible: widgetVisibility,
            order: widgetOrder,
            spans: widgetSpanOverrides,
        };
        window.localStorage.setItem(dashboardWidgetStorageKey, JSON.stringify(preferences));
    }, [dashboardWidgetStorageKey, hydratedPreferenceKey, preferencesHydrated, widgetOrder, widgetSpanOverrides, widgetVisibility]);

    // Mapping dữ liệu từ Backend (director, sales, logistics)
    const kpis = {
        revenueVnd: data?.director?.revenueVnd || 0,
        poCount: data?.sales?.totalPIs || 0,
        activeShipments: data?.sales?.activeShipments || data?.sales?.pendingShipments || 0,
        customerCount: data?.director?.totalCustomers || 0
    };
    
    const chartData: RevenueChartPoint[] = data?.director?.history?.map((item) => ({
        month: dayjs(item.month).format('MMM YYYY'),
        revenue: Math.round(item.revenue / 1000000), 
        orders: item.orders
    })) || [];
    const currentMonthLabel = dayjs().format('MMM YYYY');
    const isCurrentMonthIncomplete = dayjs().date() < dayjs().daysInMonth();
    const hasCurrentMonthTrendPoint = chartData.some((point) => point.month === currentMonthLabel);
    const shouldDashCurrentMonthTrend = hasCurrentMonthTrendPoint && isCurrentMonthIncomplete;

    const shipmentStats = useMemo<ShipmentStat[]>(() => (
        data?.logistics?.statusBreakdown
            ? Object.entries(data.logistics.statusBreakdown).map(([key, value]) => ({
            statusKey: normalizeStatusKey(key),
            name: t(key.toLowerCase()),
                value,
            }))
            : []
    ), [data?.logistics?.statusBreakdown, t]);

    // Logic quy đổi USD tạm tính (Ưu tiên tỷ giá từ Backend, nếu không có dùng hằng số Global)
    const hasRevenueTrendData = chartData.some((point) => point.revenue > 0 || point.orders > 0);
    const revenueTrendChartData: DashboardTabChartPoint[] = hasRevenueTrendData
        ? chartData.map((point) => ({
            label: point.month,
            primary: point.revenue,
            secondary: point.orders,
        }))
        : DASHBOARD_SAMPLE_DATA_ENABLED ? FALLBACK_REVENUE_TREND_DATA : [];

    const hasSalesTrendData = chartData.some((point) => point.revenue > 0 || point.orders > 0);
    const salesTrendChartData: DashboardTabChartPoint[] = hasSalesTrendData
        ? chartData.map((point) => ({
            label: point.month,
            primary: point.orders,
            secondary: point.revenue,
        }))
        : DASHBOARD_SAMPLE_DATA_ENABLED ? FALLBACK_SALES_TREND_DATA : [];

    const hasLogisticsShareData = shipmentStats.some((stat) => Number(stat.value || 0) > 0);
    const logisticsShareChartData = useMemo(() => makeShareChartData(
            shipmentStats.map((stat) => ({ label: stat.name, value: stat.value, statusKey: stat.statusKey })),
            DASHBOARD_SAMPLE_DATA_ENABLED ? FALLBACK_LOGISTICS_SHARE_DATA : [],
        ), [shipmentStats]);
    const activeLogisticsStatusLabel = logisticsShareChartData.find((point) => point.statusKey === activeLogisticsStatus)?.label || null;

    useEffect(() => {
        if (!activeLogisticsStatus || logisticsShareChartData.length === 0) return;

        const statusStillAvailable = logisticsShareChartData.some((point) => point.statusKey === activeLogisticsStatus);
        if (!statusStillAvailable) setActiveLogisticsStatus(null);
    }, [activeLogisticsStatus, logisticsShareChartData]);

    const arAging = data?.director?.arAging;
    const financeAgingBuckets: FinanceAgingFocusBucket[] = arAging ? [
        { _id: 'current', label: dashboardText('agingCurrent', 'Current'), valueVnd: Number(arAging.current || 0), color: '#10b981', isOverdue: false },
        { _id: 'days_30', label: '1-30d', valueVnd: Number(arAging.days_30 || 0), color: '#3b82f6', isOverdue: true },
        { _id: 'days_60', label: '31-60d', valueVnd: Number(arAging.days_60 || 0), color: '#f59e0b', isOverdue: true },
        { _id: 'days_90', label: '61-90d', valueVnd: Number(arAging.days_90 || 0), color: '#f97316', isOverdue: true },
        { _id: 'over_90', label: '>90d', valueVnd: Number(arAging.over_90 || 0), color: '#ef4444', isOverdue: true },
    ] : [];
    const financeAgingChartData: DashboardTabChartPoint[] = financeAgingBuckets.map((bucket) => ({
        label: bucket.label,
        primary: bucket.valueVnd,
    }));
    const totalArAgingVnd = financeAgingBuckets.reduce((sum, bucket) => sum + bucket.valueVnd, 0);
    const overdueArAgingVnd = financeAgingBuckets
        .filter((bucket) => bucket.isOverdue)
        .reduce((sum, bucket) => sum + bucket.valueVnd, 0);
    const overdueExposurePercent = totalArAgingVnd > 0 ? (overdueArAgingVnd / totalArAgingVnd) * 100 : 0;
    const hasFinanceAgingData = financeAgingChartData.some((bucket) => Number(bucket.primary || 0) > 0);
    const financeShareChartData = hasFinanceAgingData
        ? financeAgingChartData
        : DASHBOARD_SAMPLE_DATA_ENABLED ? FALLBACK_FINANCE_SHARE_DATA : [];

    const EXCHANGE_RATE = data?.director?.exchangeRate || GLOBAL_EXCHANGE_RATE;
    const displayRevenue = currency === 'VND'
        ? formatVND(kpis.revenueVnd)
        : formatMoney(kpis.revenueVnd / EXCHANGE_RATE, 'USD');

    const marketMarginRows = drilldown?.grossMarginByMarket || [];
    const productMarginRows = drilldown?.grossMarginByProduct || [];
    const marginRows: MarginDrilldownLine[] = activeMarginTab === 'market'
        ? marketMarginRows
        : productMarginRows;
    const grossMarginTrendRows = (data?.director?.history || [])
        .filter((item) => Number(item.revenue || 0) > 0 && typeof item.profit === 'number')
        .map((item) => ({
            label: dayjs(item.month).format('MMM YYYY'),
            value: Number(((Number(item.profit || 0) / Number(item.revenue || 1)) * 100).toFixed(1)),
        }));
    const hasGrossMarginTrendData = canViewCost && grossMarginTrendRows.length > 0;
    const grossMarginTrendData = hasGrossMarginTrendData ? grossMarginTrendRows : DASHBOARD_SAMPLE_DATA_ENABLED ? FALLBACK_GPM_TREND_DATA : [];
    const productGpmRows = productMarginRows
        .filter((row) => typeof row.grossProfitMarginPercent === 'number')
        .slice(0, 5)
        .map((row) => ({
            label: row.label,
            value: Number(row.grossProfitMarginPercent || 0),
            secondary: row.revenueVnd,
        }));
    const hasProductGpmData = canViewCost && productGpmRows.length > 0;
    const productGpmData = hasProductGpmData ? productGpmRows : DASHBOARD_SAMPLE_DATA_ENABLED ? FALLBACK_GPM_PRODUCT_DATA : [];
    const marketGpmRows = marketMarginRows
        .filter((row) => typeof row.grossProfitMarginPercent === 'number')
        .slice(0, 5)
        .map((row) => ({
            label: row.label,
            value: Number(row.grossProfitMarginPercent || 0),
            secondary: row.revenueVnd,
        }));
    const hasMarketGpmData = canViewCost && marketGpmRows.length > 0;
    const marketGpmData = hasMarketGpmData ? marketGpmRows : DASHBOARD_SAMPLE_DATA_ENABLED ? FALLBACK_GPM_MARKET_DATA : [];
    const topInventoryTurnover = drilldown?.inventoryTurnoverByProduct?.slice(0, 5) || [];
    const logisticsRevenueShipments = drilldown?.logisticsRevenue?.shipments || [];
    const logisticsShipments = logisticsRevenueShipments.slice(0, 5);
    const filteredLogisticsDrilldownShipments = (
        activeLogisticsStatus
            ? logisticsRevenueShipments.filter((shipment) => normalizeStatusKey(shipment.status) === activeLogisticsStatus)
            : logisticsRevenueShipments
    ).slice(0, 5);
    const inventoryTurnoverChartData = topInventoryTurnover.map((item) => ({
        _id: item._id,
        label: item.productName || item.sku,
        shortLabel: item.sku || formatChartAxisLabel(item.productName),
        productName: item.productName,
        sku: item.sku,
        quantitySold: Number(item.quantitySold || 0),
        turnover: Number(item.turnover || 0),
    }));
    const logisticsRevenueChartData = filteredLogisticsDrilldownShipments.map((shipment) => ({
        _id: shipment._id,
        label: shipment.shipmentNumber,
        buyerName: shipment.buyerName || t('unknownBuyer'),
        status: shipment.status,
        revenueVnd: Number(shipment.revenueVnd || 0),
        logisticsCostRatioPercent: Number(shipment.logisticsCostRatioPercent || 0),
    }));
    const totalCogsVnd = productMarginRows.reduce((sum, row) => sum + Number(row.cogsVnd || 0), 0);
    const totalGrossProfitVnd = productMarginRows.reduce((sum, row) => sum + Number(row.grossProfitVnd || 0), 0);
    const totalLogisticsCostVnd = Number(drilldown?.logisticsRevenue?.logisticsCostVnd || 0);
    const costDistributionRows: CostDistributionPoint[] = [
        { name: dashboardText('cogs', 'Giá vốn'), value: totalCogsVnd },
        { name: dashboardText('logisticsCost', 'Chi phí logistics'), value: totalLogisticsCostVnd },
        { name: dashboardText('grossProfit', 'Lợi nhuận gộp'), value: totalGrossProfitVnd },
    ].filter((item) => item.value > 0);
    const hasCostDistributionData = canViewCost && costDistributionRows.length > 0;
    const costDistributionData = hasCostDistributionData ? costDistributionRows : DASHBOARD_SAMPLE_DATA_ENABLED ? FALLBACK_COST_DISTRIBUTION_DATA : [];
    const highestLogisticsCostRatio = logisticsShipments.reduce((maxRatio, shipment) => (
        Math.max(maxRatio, Number(shipment.logisticsCostRatioPercent || 0))
    ), 0);
    const highestLogisticsCostRiskColor = getLogisticsCostRiskColor(highestLogisticsCostRatio);
    const directorLogisticsCostRiskColor = getLogisticsCostRiskColor(data?.director?.logisticsCostRatio);
    const periodLogisticsCostRatio = drilldown?.logisticsRevenue?.logisticsCostRatioPercent;
    const periodLogisticsCostRiskColor = getLogisticsCostRiskColor(periodLogisticsCostRatio);
    const dsoDays = Number(drilldown?.dso?.dsoDays || data?.director?.dso || 0);
    const overdueInvoiceCount = Number(drilldown?.dso?.overdueInvoiceCount || 0);
    const overdueAmountVnd = Number(drilldown?.dso?.overdueAmountVnd || 0);
    const overdueInvoices = drilldown?.dso?.topOverdueInvoices || [];
    const dsoRiskColor = getDsoRiskColor(dsoDays);
    const dsoVarianceDays = dsoDays - DSO_TARGET_DAYS;
    const dsoVarianceColor = dsoVarianceDays > 0 ? dsoRiskColor : '#10b981';
    const overdueRiskColor = overdueInvoiceCount > 0 ? '#ef4444' : '#10b981';
    const lowMarginMarket = canViewCost
        ? [...marketMarginRows]
            .filter((row) => typeof row.grossProfitMarginPercent === 'number')
            .sort((a, b) => Number(a.grossProfitMarginPercent || 0) - Number(b.grossProfitMarginPercent || 0))[0] || null
        : null;
    const lowMarginProduct = canViewCost
        ? [...productMarginRows]
            .filter((row) => typeof row.grossProfitMarginPercent === 'number')
            .sort((a, b) => Number(a.grossProfitMarginPercent || 0) - Number(b.grossProfitMarginPercent || 0))[0] || null
        : null;
    const highestLogisticsShipment = canViewCost
        ? [...logisticsShipments]
            .filter((shipment) => Number(shipment.logisticsCostRatioPercent || 0) > 0)
            .sort((a, b) => Number(b.logisticsCostRatioPercent || 0) - Number(a.logisticsCostRatioPercent || 0))[0] || null
        : null;
    const businessAlerts: DashboardBusinessAlert[] = [
        ...(lowMarginMarket && Number(lowMarginMarket.grossProfitMarginPercent || 0) < 25 ? [{
            _id: `market-${lowMarginMarket.key}`,
            tone: 'warning' as const,
            title: dashboardText('lowMarketGpmAlertTitle', 'Thị trường có GPM thấp'),
            description: `${lowMarginMarket.label}: ${compactPercent(lowMarginMarket.grossProfitMarginPercent)} · ${t('revenue')}: ${formatVND(lowMarginMarket.revenueVnd)}`,
        }] : []),
        ...(lowMarginProduct && Number(lowMarginProduct.grossProfitMarginPercent || 0) < 20 ? [{
            _id: `product-${lowMarginProduct.key}`,
            tone: 'danger' as const,
            title: dashboardText('lowProductGpmAlertTitle', 'Dòng sản phẩm cần rà soát giá vốn'),
            description: `${lowMarginProduct.label}: ${compactPercent(lowMarginProduct.grossProfitMarginPercent)} · ${t('revenue')}: ${formatVND(lowMarginProduct.revenueVnd)}`,
        }] : []),
        ...((drilldown?.dso?.overdueInvoiceCount || 0) > 0 ? [{
            _id: 'overdue-ar',
            tone: 'danger' as const,
            title: dashboardText('overdueArAlertTitle', 'Công nợ phải thu quá hạn'),
            description: `${drilldown?.dso?.overdueInvoiceCount || 0} ${t('overdueAr')} · ${formatVND(drilldown?.dso?.overdueAmountVnd || 0)}`,
        }] : []),
        ...(highestLogisticsShipment && Number(highestLogisticsShipment.logisticsCostRatioPercent || 0) >= 15 ? [{
            _id: `logistics-${highestLogisticsShipment._id}`,
            tone: 'info' as const,
            title: dashboardText('highLogisticsCostAlertTitle', 'Lô hàng có tỷ lệ logistics cao'),
            description: `${highestLogisticsShipment.shipmentNumber}: ${compactPercent(highestLogisticsShipment.logisticsCostRatioPercent)} · ${highestLogisticsShipment.buyerName || t('unknownBuyer')}`,
        }] : []),
    ].slice(0, 4);
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

    const dashboardTabChartConfigs: Record<DashboardTabKey, DashboardTabChartConfig> = {
        overview: {
            _id: 'overview',
            mode: 'line',
            title: dashboardText('overviewTrendChartTitle', 'Xu hướng điều hành'),
            description: dashboardText('overviewTrendChartDesc', 'Xu hướng doanh thu và đơn hàng trong 6 tháng gần nhất; bộ lọc ngày áp dụng cho KPI và drilldown.'),
            data: revenueTrendChartData,
            primaryLabel: t('charts.revenue'),
            secondaryLabel: t('orders'),
            primaryColor: '#3b82f6',
            secondaryColor: '#f59e0b',
            isSampleData: !hasRevenueTrendData && DASHBOARD_SAMPLE_DATA_ENABLED,
            isTrailingPeriodPartial: hasRevenueTrendData && shouldDashCurrentMonthTrend,
            note: hasRevenueTrendData && shouldDashCurrentMonthTrend
                ? dashboardText('partialMonthNote', 'Đoạn nét đứt là tháng hiện tại chưa kết thúc.')
                : undefined,
            valueFormatter: (value) => `${formatCompact(value)} ${t('million')}`,
            secondaryFormatter: (value) => String(Math.round(value)),
        },
        sales: {
            _id: 'sales',
            mode: 'line',
            title: dashboardText('salesTrendChartTitle', 'Xu hướng pipeline Sales'),
            description: dashboardText('salesTrendChartDesc', 'Diễn biến đơn hàng và doanh thu theo lịch sử 6 tháng gần nhất.'),
            data: salesTrendChartData,
            primaryLabel: t('orders'),
            secondaryLabel: t('charts.revenue'),
            primaryColor: '#2563eb',
            secondaryColor: '#10b981',
            isSampleData: !hasSalesTrendData && DASHBOARD_SAMPLE_DATA_ENABLED,
            isTrailingPeriodPartial: hasSalesTrendData && shouldDashCurrentMonthTrend,
            note: hasSalesTrendData && shouldDashCurrentMonthTrend
                ? dashboardText('partialMonthNote', 'Đoạn nét đứt là tháng hiện tại chưa kết thúc.')
                : undefined,
            valueFormatter: (value) => String(Math.round(value)),
            secondaryFormatter: (value) => `${formatCompact(value)} ${t('million')}`,
        },
        logistics: {
            _id: 'logistics',
            mode: 'donut',
            title: dashboardText('logisticsShareChartTitle', 'Tỷ trọng trạng thái lô hàng'),
            description: dashboardText('logisticsShareChartDesc', 'Tải vận hành theo từng trạng thái shipment.'),
            data: logisticsShareChartData,
            primaryLabel: dashboardText('share', 'Tỷ trọng'),
            secondaryLabel: t('shipments'),
            primaryColor: '#10b981',
            barColors: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4'],
            activeKey: activeLogisticsStatus,
            onPointClick: (point) => {
                if (!point.statusKey) return;
                setActiveLogisticsStatus((currentStatus) => currentStatus === point.statusKey ? null : point.statusKey || null);
            },
            onClearSelection: () => setActiveLogisticsStatus(null),
            isSampleData: !hasLogisticsShareData && DASHBOARD_SAMPLE_DATA_ENABLED,
            note: activeLogisticsStatusLabel
                ? `${dashboardText('filteredByStatus', 'Đang lọc trạng thái')}: ${activeLogisticsStatusLabel}`
                : undefined,
            valueFormatter: (value) => `${Number(value || 0).toFixed(1)}%`,
        },
        finance: {
            _id: 'finance',
            mode: 'bar',
            title: dashboardText('financeShareChartTitle', 'AR Aging Exposure'),
            description: dashboardText('financeShareChartDesc', 'Giá trị phải thu còn mở theo nhóm tuổi nợ, gồm cả current và quá hạn.'),
            data: financeShareChartData,
            primaryLabel: dashboardText('arExposure', 'Giá trị AR'),
            primaryColor: '#f59e0b',
            barColors: ['#3b82f6', '#f59e0b', '#fb7185', '#ef4444', '#7f1d1d'],
            isSampleData: !hasFinanceAgingData && DASHBOARD_SAMPLE_DATA_ENABLED,
            note: hasFinanceAgingData
                ? `${dashboardText('totalOpenAr', 'Tổng AR mở')}: ${formatVND(totalArAgingVnd)} · ${dashboardText('overdueAr', 'AR quá hạn')}: ${formatVND(overdueArAgingVnd)}`
                : undefined,
            valueFormatter: (value) => formatVND(value),
            axisFormatter: (value) => `${formatCompact(value)} đ`,
        },
    };

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
            tabs: ['sales'],
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
            tabs: ['logistics'],
            group: 'logistics',
            type: 'insight',
            size: 'medium',
            title: dashboardText('logisticsCostOutliers', 'Lô hàng chi phí cao'),
            value: canViewCost ? compactPercent(highestLogisticsCostRatio) : t('hiddenByPermission'),
            caption: dashboardText('highestShipmentLogisticsRatio', 'Tỷ lệ chi phí cao nhất theo lô hàng'),
            icon: <TruckOutlined />,
            color: highestLogisticsCostRiskColor,
            valueColor: highestLogisticsCostRiskColor,
            span: { xs: 24, md: 12, xl: 8 },
            detail: (
                <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                    {logisticsShipments.map((shipment) => {
                        const shipmentRiskColor = getLogisticsCostRiskColor(shipment.logisticsCostRatioPercent);

                        return (
                            <div
                                key={shipment._id}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 1fr) 88px',
                                    gap: 12,
                                    alignItems: 'center',
                                }}
                            >
                                <Text ellipsis style={{ minWidth: 0 }}>{shipment.shipmentNumber}</Text>
                                <Text
                                    strong
                                    style={{
                                        display: 'block',
                                        textAlign: 'right',
                                        color: canViewCost ? shipmentRiskColor : undefined,
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {canViewCost ? compactPercent(shipment.logisticsCostRatioPercent) : t('hiddenByPermission')}
                                </Text>
                            </div>
                        );
                    })}
                </Space>
            ),
        },
        {
            _id: 'accountingFocus',
            tabs: ['overview', 'finance'],
            group: 'finance',
            type: 'insight',
            size: 'medium',
            title: dashboardText('dso', 'DSO'),
            value: `${dsoDays} ${t('days')}`,
            caption: `${dashboardText('dsoLong', 'Days Sales Outstanding')} / ${overdueInvoiceCount} ${t('overdueAr')}`,
            icon: <ClockCircleOutlined />,
            color: dsoRiskColor,
            valueColor: dsoRiskColor,
            span: { xs: 24, md: 12, xl: 8 },
            detail: (
                <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                    {overdueInvoices.slice(0, 5).map((invoice) => (
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
            tabs: ['sales'],
            group: 'sales',
            type: 'metric',
            size: 'small',
            title: t('orders'),
            value: kpis.poCount,
            icon: <ShoppingCartOutlined />,
            color: '#f59e0b',
            trend: { value: data?.sales?.poGrowth || 0, isUp: (data?.sales?.poGrowth || 0) >= 0, label: t('vsLastMonth') },
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
            tabs: ['sales'],
            group: 'sales',
            type: 'metric',
            size: 'small',
            title: t('customers'),
            value: kpis.customerCount,
            icon: <ApartmentOutlined />,
            color: '#8b5cf6',
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
            tabs: ['logistics'],
            group: 'logistics',
            type: 'metric',
            size: 'small',
            title: t('logisticsRevenue'),
            value: canViewCost ? compactPercent(data?.director?.logisticsCostRatio) : t('hiddenByPermission'),
            caption: t('logisticsCostOverRevenue'),
            icon: <TruckOutlined />,
            color: directorLogisticsCostRiskColor,
            valueColor: directorLogisticsCostRiskColor,
            span: { xs: 24, md: 12, xl: 6 },
            detail: <Text>{t('logisticsRevenueDrilldown')}</Text>,
        },
        {
            _id: 'onTimeShipment',
            tabs: ['logistics'],
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
    const showBusinessAnalysisPanel = isOverviewTab || isSalesTab;
    const hasLogisticsRevenueFocusData = logisticsRevenueShipments.length > 0 || Number(drilldown?.logisticsRevenue?.revenueVnd || 0) > 0;
    const showFinanceFocusCard = isFinanceTab && (
        loading || dsoDays > 0 || overdueInvoiceCount > 0 || overdueAmountVnd > 0 || overdueInvoices.length > 0 || hasFinanceAgingData
    );
    const showInventoryTurnoverFocusCard = isLogisticsTab && (loading || topInventoryTurnover.length > 0);
    const showLogisticsRevenueFocusCard = isLogisticsTab && (loading || hasLogisticsRevenueFocusData);
    const showFocusSection = (
        showBusinessAnalysisPanel
        || showFinanceFocusCard
        || showInventoryTurnoverFocusCard
        || showLogisticsRevenueFocusCard
    );
    const showBusinessAlertPanel = isOverviewTab || isSalesTab || isFinanceTab || isLogisticsTab;
    const showLowStockPanel = isOverviewTab || isLogisticsTab;
    const showPartnerPanel = isOverviewTab || isSalesTab;
    const showUpcomingShipmentPanel = isOverviewTab || isLogisticsTab;
    const actionablePanelCount = [
        showBusinessAlertPanel,
        showLowStockPanel,
        showPartnerPanel,
        showUpcomingShipmentPanel,
    ].filter(Boolean).length;
    const actionablePanelSpan = actionablePanelCount >= 4
        ? { md: 12, lg: 12, xl: 12 }
        : actionablePanelCount === 3
            ? { md: 12, lg: 8, xl: 8 }
            : actionablePanelCount === 2
                ? { md: 12, lg: 12, xl: 12 }
                : { md: 24, lg: 24, xl: 24 };
    const actionableCardStyle = {
        ...dashboardCardStyle(isDark, 12),
        height: '100%',
        minHeight: 288,
    };
    const rolePresetKey = getDashboardRolePreset(session?.user);
    const manualRefreshRemainingSeconds = Math.max(
        0,
        Math.ceil((manualRefreshLockedUntil - refreshClock) / 1000),
    );
    const isManualRefreshDisabled = loading || chartRefreshing || manualRefreshRemainingSeconds > 0;
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

    const renderDashboardTabChart = (config: DashboardTabChartConfig) => {
        const gridStroke = isDark ? '#334155' : '#e2e8f0';
        const axisColor = isDark ? '#cbd5e1' : '#64748b';
        const tooltipStyle = {
            borderRadius: 14,
            border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
            boxShadow: isDark ? '0 18px 40px rgba(0,0,0,0.35)' : '0 18px 40px rgba(15, 23, 42, 0.12)',
            background: isDark ? '#0f172a' : '#fff',
        };
        const formatTooltipValue = (value: unknown, name: unknown): [string, ChartTooltipName] => {
            const numericValue = typeof value === 'number' ? value : Number(value || 0);
            const metricName: ChartTooltipName = typeof name === 'string' || typeof name === 'number' ? name : '';
            const metricLabel = String(metricName);
            const formatter = config.secondaryLabel && metricLabel.startsWith(config.secondaryLabel)
                ? (config.secondaryFormatter || config.valueFormatter)
                : config.valueFormatter;

            return [formatter(numericValue), metricName];
        };
        const lineChartData = config.isTrailingPeriodPartial && config.data.length > 1
            ? config.data.map((point, index, points) => ({
                ...point,
                primaryHistorical: index < points.length - 1 ? point.primary : undefined,
                primaryPartial: index >= points.length - 2 ? point.primary : undefined,
                secondaryHistorical: index < points.length - 1 ? point.secondary : undefined,
                secondaryPartial: index >= points.length - 2 ? point.secondary : undefined,
            }))
            : config.data;
        const partialLabel = dashboardText('partialPeriod', 'chưa chốt');
        const chartModeLabel = config.mode === 'line'
            ? dashboardText('lineChart', 'Biểu đồ đường')
            : config.mode === 'donut'
                ? dashboardText('donutChart', 'Biểu đồ donut')
                : dashboardText('barChart', 'Biểu đồ cột');
        const chartModeColor = config.mode === 'line' ? 'blue' : config.mode === 'donut' ? 'purple' : 'green';

        return (
            <div
                style={{
                    marginTop: 2,
                    padding: '14px clamp(12px, 1.5vw, 18px) 16px',
                    borderRadius: 12,
                    background: isDark
                        ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 59, 0.86) 100%)'
                        : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                    border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 16,
                        flexWrap: 'wrap',
                        marginBottom: 10,
                    }}
                >
                    <div style={{ minWidth: 220, flex: '1 1 320px' }}>
                        <Title level={5} style={{ margin: 0, fontWeight: 850, color: isDark ? '#f8fafc' : '#0f172a' }}>
                            {config.title}
                        </Title>
                        <Text style={{ display: 'block', marginTop: 6, color: isDark ? '#cbd5e1' : '#64748b', fontSize: 13 }}>
                            {config.description}
                        </Text>
                    </div>
                    <Space size={8} wrap>
                        <Tag
                            color={chartModeColor}
                            style={{ borderRadius: 999, padding: '4px 10px', fontWeight: 800, marginInlineEnd: 0 }}
                        >
                            {chartModeLabel}
                        </Tag>
                        <Tag
                            color={config.data.length === 0 ? 'default' : config.isSampleData ? 'orange' : 'cyan'}
                            style={{ borderRadius: 999, padding: '4px 10px', fontWeight: 800, marginInlineEnd: 0 }}
                        >
                            {config.data.length === 0
                                ? dashboardText('noData', 'Chưa có dữ liệu')
                                : config.isSampleData
                                ? dashboardText('sampleData', 'Dữ liệu mẫu')
                                : dashboardText('systemData', 'Dữ liệu hệ thống')}
                        </Tag>
                    </Space>
                </div>

                <Skeleton loading={loading || chartRefreshing} active paragraph={{ rows: 8 }}>
                    {config.data.length === 0 ? (
                        <EmptyInsight
                            icon={<DollarOutlined />}
                            title={dashboardText('emptyChartTitle', 'Chưa có dữ liệu biểu đồ')}
                            description={dashboardText('emptyChartDesc', 'Khoảng thời gian đang chọn chưa có đủ dữ liệu thật cho biểu đồ này.')}
                            color={config.primaryColor}
                            isDark={isDark}
                        />
                    ) : config.mode === 'donut' ? (
                        <DashboardDonutChart
                            _id={config._id}
                            data={config.data}
                            activeKey={config.activeKey}
                            primaryLabel={config.primaryLabel}
                            secondaryLabel={config.secondaryLabel}
                            primaryColor={config.primaryColor}
                            barColors={config.barColors}
                            valueFormatter={config.valueFormatter}
                            tooltipStyle={tooltipStyle}
                            formatTooltipValue={formatTooltipValue}
                            isDark={isDark}
                            locale={locale}
                            dashboardText={dashboardText}
                            onPointClick={config.onPointClick}
                            onClearSelection={config.onClearSelection}
                        />
                    ) : (
                    <SafeResponsiveContainer height={250}>
                        {config.mode === 'line' ? (
                            <LineChart data={lineChartData} margin={{ top: 12, right: 18, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                <XAxis
                                    dataKey="label"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: axisColor, fontSize: 11, fontWeight: 700 }}
                                    tickFormatter={formatChartAxisLabel}
                                    dy={10}
                                />
                                <YAxis
                                    yAxisId="left"
                                    axisLine={false}
                                    tickLine={false}
                                    width={62}
                                    tick={{ fill: axisColor, fontSize: 11, fontWeight: 700 }}
                                    tickFormatter={(value) => (config.axisFormatter || config.valueFormatter)(Number(value))}
                                />
                                {config.secondaryLabel ? (
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        axisLine={false}
                                        tickLine={false}
                                        width={46}
                                        tick={{ fill: config.secondaryColor || axisColor, fontSize: 11, fontWeight: 700 }}
                                        tickFormatter={(value) => (config.secondaryFormatter || config.valueFormatter)(Number(value))}
                                    />
                                ) : null}
                                <RechartsTooltip contentStyle={tooltipStyle} formatter={formatTooltipValue} />
                                <Legend verticalAlign="top" align="right" iconType="circle" height={32} />
                                <Line
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey={config.isTrailingPeriodPartial ? 'primaryHistorical' : 'primary'}
                                    name={config.primaryLabel}
                                    stroke={config.primaryColor}
                                    strokeWidth={3}
                                    dot={{ r: 4, strokeWidth: 2 }}
                                    activeDot={{ r: 6 }}
                                />
                                {config.isTrailingPeriodPartial ? (
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="primaryPartial"
                                        name={`${config.primaryLabel} (${partialLabel})`}
                                        stroke={config.primaryColor}
                                        strokeWidth={3}
                                        strokeDasharray="6 5"
                                        dot={{ r: 4, strokeWidth: 2 }}
                                        activeDot={{ r: 6 }}
                                        legendType="none"
                                    />
                                ) : null}
                                {config.secondaryLabel ? (
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey={config.isTrailingPeriodPartial ? 'secondaryHistorical' : 'secondary'}
                                        name={config.secondaryLabel}
                                        stroke={config.secondaryColor || '#f59e0b'}
                                        strokeWidth={3}
                                        dot={{ r: 4, strokeWidth: 2 }}
                                    />
                                ) : null}
                                {config.secondaryLabel && config.isTrailingPeriodPartial ? (
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="secondaryPartial"
                                        name={`${config.secondaryLabel} (${partialLabel})`}
                                        stroke={config.secondaryColor || '#f59e0b'}
                                        strokeWidth={3}
                                        strokeDasharray="6 5"
                                        dot={{ r: 4, strokeWidth: 2 }}
                                        legendType="none"
                                    />
                                ) : null}
                            </LineChart>
                        ) : (
                            <BarChart data={config.data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                <XAxis
                                    dataKey="label"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: axisColor, fontSize: 11, fontWeight: 700 }}
                                    tickFormatter={formatChartAxisLabel}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    width={54}
                                    domain={config.yAxisDomain}
                                    tick={{ fill: axisColor, fontSize: 11, fontWeight: 700 }}
                                    tickFormatter={(value) => (config.axisFormatter || config.valueFormatter)(Number(value))}
                                />
                                <RechartsTooltip contentStyle={tooltipStyle} formatter={formatTooltipValue} />
                                <Legend verticalAlign="top" align="right" iconType="circle" height={32} />
                                <Bar dataKey="primary" name={config.primaryLabel} radius={[8, 8, 0, 0]} maxBarSize={42}>
                                    {config.data.map((entry, index) => (
                                        <Cell
                                            key={`${config._id}-${entry.label}`}
                                            fill={(config.barColors || COLORS)[index % (config.barColors || COLORS).length] || config.primaryColor}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        )}
                    </SafeResponsiveContainer>
                    )}
                    {(config.isSampleData || config.note) ? (
                        <Text
                            style={{
                                display: 'block',
                                marginTop: 10,
                                fontSize: 12,
                                color: config.isSampleData ? '#d97706' : (isDark ? '#cbd5e1' : '#64748b'),
                            }}
                        >
                            {config.isSampleData
                                ? dashboardText('sampleDataNote', 'Chưa có đủ dữ liệu thật cho khoảng đang chọn, biểu đồ đang dùng dữ liệu mẫu để giữ bố cục.')
                                : config.note}
                        </Text>
                    ) : null}
                </Skeleton>
            </div>
        );
    };

    const renderBusinessAnalysisCard = ({
        title,
        description,
        isSampleData,
        isEmpty,
        children,
    }: {
        title: string;
        description: string;
        isSampleData: boolean;
        isEmpty?: boolean;
        children: ReactNode;
    }) => (
        <Card
            variant="borderless"
            style={{
                ...dashboardCardStyle(isDark, 12),
                height: '100%',
                overflow: 'hidden',
            }}
            styles={{ body: { padding: 16 } }}
        >
            <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
                {canViewCost ? (
                    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 0 }}>
                                <Title level={5} style={{ margin: 0, fontSize: 14, fontWeight: 850, color: isDark ? '#f8fafc' : '#0f172a' }}>
                                    {title}
                                </Title>
                                <Text style={{ display: 'block', marginTop: 4, fontSize: 12, color: isDark ? '#cbd5e1' : '#64748b' }}>
                                    {description}
                                </Text>
                            </div>
                            <Tag
                                color={isEmpty ? 'default' : isSampleData ? 'orange' : 'cyan'}
                                style={{ borderRadius: 999, marginInlineEnd: 0, fontWeight: 800 }}
                            >
                                {isEmpty
                                    ? dashboardText('noData', 'Chưa có dữ liệu')
                                    : isSampleData
                                    ? dashboardText('sampleData', 'Dữ liệu mẫu')
                                    : dashboardText('systemData', 'Dữ liệu hệ thống')}
                            </Tag>
                        </div>
                        {isEmpty ? (
                            <EmptyInsight
                                icon={<DollarOutlined />}
                    <SafeResponsiveContainer height={250}>
                        {config.mode === 'line' ? (
                            <LineChart data={lineChartData} margin={{ top: 12, right: 18, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                <XAxis
                                    dataKey="label"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: axisColor, fontSize: 11, fontWeight: 700 }}
                                    tickFormatter={formatChartAxisLabel}
                                    dy={10}
                                />
                                <YAxis
                                    yAxisId="left"
                                    axisLine={false}
                                    tickLine={false}
                                    width={62}
                                    tick={{ fill: axisColor, fontSize: 11, fontWeight: 700 }}
                                    tickFormatter={(value) => (config.axisFormatter || config.valueFormatter)(Number(value))}
                                />
                                {config.secondaryLabel ? (
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        axisLine={false}
                                        tickLine={false}
                                        width={46}
                                        tick={{ fill: config.secondaryColor || axisColor, fontSize: 11, fontWeight: 700 }}
                                        tickFormatter={(value) => (config.secondaryFormatter || config.valueFormatter)(Number(value))}
                                    />
                                ) : null}
                                <RechartsTooltip contentStyle={tooltipStyle} formatter={formatTooltipValue} />
                                <Legend verticalAlign="top" align="right" iconType="circle" height={32} />
                                <Line
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey={config.isTrailingPeriodPartial ? 'primaryHistorical' : 'primary'}
                                    name={config.primaryLabel}
                                    stroke={config.primaryColor}
                                    strokeWidth={3}
                                    dot={{ r: 4, strokeWidth: 2 }}
                                    activeDot={{ r: 6 }}
                                />
                                {config.isTrailingPeriodPartial ? (
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="primaryPartial"
                                        name={`${config.primaryLabel} (${partialLabel})`}
                                        stroke={config.primaryColor}
                                        strokeWidth={3}
                                        strokeDasharray="6 5"
                                        dot={{ r: 4, strokeWidth: 2 }}
                                        activeDot={{ r: 6 }}
                                        legendType="none"
                                    />
                                ) : null}
                                {config.secondaryLabel ? (
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey={config.isTrailingPeriodPartial ? 'secondaryHistorical' : 'secondary'}
                                        name={config.secondaryLabel}
                                        stroke={config.secondaryColor || '#f59e0b'}
                                        strokeWidth={3}
                                        dot={{ r: 4, strokeWidth: 2 }}
                                    />
                                ) : null}
                                {config.secondaryLabel && config.isTrailingPeriodPartial ? (
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="secondaryPartial"
                                        name={`${config.secondaryLabel} (${partialLabel})`}
                                        stroke={config.secondaryColor || '#f59e0b'}
                                        strokeWidth={3}
                                        strokeDasharray="6 5"
                                        dot={{ r: 4, strokeWidth: 2 }}
                                        legendType="none"
                                    />
                                ) : null}
                            </LineChart>
                        ) : (
                            <BarChart data={config.data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                <XAxis
                                    dataKey="label"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: axisColor, fontSize: 11, fontWeight: 700 }}
                                    tickFormatter={formatChartAxisLabel}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    width={54}
                                    domain={config.yAxisDomain}
                                    tick={{ fill: axisColor, fontSize: 11, fontWeight: 700 }}
                                    tickFormatter={(value) => (config.axisFormatter || config.valueFormatter)(Number(value))}
                                />
                                <RechartsTooltip contentStyle={tooltipStyle} formatter={formatTooltipValue} />
                                <Legend verticalAlign="top" align="right" iconType="circle" height={32} />
                                <Bar dataKey="primary" name={config.primaryLabel} radius={[8, 8, 0, 0]} maxBarSize={42}>
                                    {config.data.map((entry, index) => (
                                        <Cell
                                            key={`${config._id}-${entry.label}`}
                                            fill={(config.barColors || COLORS)[index % (config.barColors || COLORS).length] || config.primaryColor}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        )}
                    </SafeResponsiveContainer>
                    )}
                    {(config.isSampleData || config.note) ? (
                        <Text
                            style={{
                                display: 'block',
                                marginTop: 10,
                                fontSize: 12,
                                color: config.isSampleData ? '#d97706' : (isDark ? '#cbd5e1' : '#64748b'),
                            }}
                        >
                            {config.isSampleData
                                ? dashboardText('sampleDataNote', 'Chưa có đủ dữ liệu thật cho khoảng đang chọn, biểu đồ đang dùng dữ liệu mẫu để giữ bố cục.')
                                : config.note}
                        </Text>
                    ) : null}
                </Skeleton>
            </div>
        );
    };

    const renderBusinessAnalysisCard = ({
        title,
        description,
        isSampleData,
        isEmpty,
        children,
    }: {
        title: string;
        description: string;
        isSampleData: boolean;
        isEmpty?: boolean;
        children: ReactNode;
    }) => (
        <Card
            variant="borderless"
            style={{
                ...dashboardCardStyle(isDark, 12),
                height: '100%',
                overflow: 'hidden',
            }}
            styles={{ body: { padding: 16 } }}
        >
            <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
                {canViewCost ? (
                    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 0 }}>
                                <Title level={5} style={{ margin: 0, fontSize: 14, fontWeight: 850, color: isDark ? '#f8fafc' : '#0f172a' }}>
                                    {title}
                                </Title>
                                <Text style={{ display: 'block', marginTop: 4, fontSize: 12, color: isDark ? '#cbd5e1' : '#64748b' }}>
                                    {description}
                                </Text>
                            </div>
                            <Tag
                                color={isEmpty ? 'default' : isSampleData ? 'orange' : 'cyan'}
                                style={{ borderRadius: 999, marginInlineEnd: 0, fontWeight: 800 }}
                            >
                                {isEmpty
                                    ? dashboardText('noData', 'Chưa có dữ liệu')
                                    : isSampleData
                                    ? dashboardText('sampleData', 'Dữ liệu mẫu')
                                    : dashboardText('systemData', 'Dữ liệu hệ thống')}
                            </Tag>
                        </div>
                        {isEmpty ? (
                            <EmptyInsight
                                icon={<DollarOutlined />}
                                title={dashboardText('emptyAnalysisTitle', 'Chưa có dữ liệu phân tích')}
                                description={dashboardText('emptyAnalysisDesc', 'Khoảng thời gian đang chọn chưa có đủ dữ liệu thật để dựng biểu đồ này.')}
                                color="#3b82f6"
                                isDark={isDark}
                            />
                        ) : children}
    const analysisTooltipStyle = {
        borderRadius: 14,
        border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
        background: isDark ? '#0f172a' : '#fff',
        boxShadow: isDark ? '0 18px 40px rgba(0,0,0,0.35)' : '0 18px 40px rgba(15, 23, 42, 0.12)',
    };

    const renderCostDistributionChart = () => (
        <Card
            variant="borderless"
            style={{
                ...dashboardCardStyle(isDark, 12),
                height: '100%',
                overflow: 'hidden',
            }}
            styles={{ body: { padding: '14px 16px' } }}
        >
            <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                            <Title level={5} style={{ margin: 0, fontSize: 14, fontWeight: 850, color: isDark ? '#f8fafc' : '#0f172a' }}>
                                {dashboardText('costDistributionAnalysisTitle', 'Phân bổ chi phí & lợi nhuận')}
                            </Title>
                            <Text style={{ display: 'block', marginTop: 4, fontSize: 12, color: isDark ? '#cbd5e1' : '#64748b' }}>
                                {dashboardText('costDistributionAnalysisDesc', 'Cơ cấu giá vốn, logistics và lợi nhuận gộp.')}
                            </Text>
                        </div>
                    </div>
                    <SafeResponsiveContainer height={180}>
                        <PieChart>
                            <Pie data={costDistributionData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={4} stroke="none">
                                {costDistributionData.map((point, index) => (
                                    <Cell key={`cost-distribution-${point.name}`} fill={['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'][index % 4]} />
                                ))}
                            </Pie>
                            <RechartsTooltip
                                contentStyle={analysisTooltipStyle}
                                formatter={(value: unknown) => [
                                    hasCostDistributionData ? formatVND(Number(value || 0)) : compactPercent(Number(value || 0)),
                                    dashboardText('value', 'Giá trị'),
                                ]}
                            />
                            <Legend verticalAlign="bottom" iconType="circle" height={28} />
                        </PieChart>
                    </SafeResponsiveContainer>
                </Space>
            </Skeleton>
        </Card>
    );

    const renderGpmTrendChart = () => (
        <Card
            variant="borderless"
            style={{
                ...dashboardCardStyle(isDark, 12),
                height: '100%',
                overflow: 'hidden',
            }}
            styles={{ body: { padding: '14px 16px' } }}
        >
            <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                            <Title level={5} style={{ margin: 0, fontSize: 14, fontWeight: 850, color: isDark ? '#f8fafc' : '#0f172a' }}>
                                {dashboardText('gpmTrendAnalysisTitle', 'Xu hướng GPM')}
                            </Title>
                            <Text style={{ display: 'block', marginTop: 4, fontSize: 12, color: isDark ? '#cbd5e1' : '#64748b' }}>
                                {dashboardText('gpmTrendAnalysisDesc', 'Biên lợi nhuận gộp theo thời gian.')}
                            </Text>
                        </div>
                    </div>
                    <SafeResponsiveContainer height={180}>
                        <LineChart data={grossMarginTrendData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 11, fontWeight: 700 }} tickFormatter={formatChartAxisLabel} />
                            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 11, fontWeight: 700 }} tickFormatter={(value) => `${Number(value)}%`} />
                            <RechartsTooltip contentStyle={analysisTooltipStyle} formatter={(value: unknown) => [compactPercent(Number(value || 0)), 'GPM']} />
                            <Line type="monotone" dataKey="value" name="GPM" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </SafeResponsiveContainer>
                </Space>
            </Skeleton>
        </Card>
    );

    const renderSlotD = () => {
        if (canViewCost) {
            return renderCostDistributionChart();
        } else {
            return (
                <div style={{ height: '100%' }}>
                    {renderDashboardTabChart(dashboardTabChartConfigs.finance)}
                </div>
            );
        }
    };

    const renderSlotE = () => {
        if (canViewCost) {
            return renderGpmTrendChart();
        } else {
            return (
                <div style={{ height: '100%' }}>
                    {renderDashboardTabChart(dashboardTabChartConfigs.sales)}
                </div>
            );
        }
    };

    const renderInteractivePanel = () => {
        return (
            <Card
                variant="borderless"
                style={{
                    ...dashboardCardStyle(isDark, 12),
                    height: '100%',
                    minHeight: 288,
                }}
                styles={{ body: { padding: '12px 14px' } }}
            >
                <Tabs
                    defaultActiveKey="shipments"
                    size="small"
                    items={[
                        {
                            key: 'shipments',
                            label: (
                                <Space size={4}>
                                    <TruckOutlined style={{ color: '#10b981' }} />
                                    <span style={{ fontWeight: 700 }}>{t('upcomingShipments7D')}</span>
                                </Space>
                            ),
                            children: (
                                <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
                                    <div style={{ maxHeight: 220, overflowY: 'auto', paddingRight: 4, marginTop: 6 }}>
                                        {upcomingShipments.length > 0 ? (
                                            <Timeline
                                                style={{ marginTop: 8 }}
                                                items={upcomingShipments.map((s: DashboardUpcomingShipment) => ({
                                                    key: s._id || s.number,
                                                    color: '#10b981',
                                                    content: (
                                                        <motion.div whileHover={{ x: 3 }} style={{ marginBottom: 8, padding: '8px 10px', background: isDark ? 'rgba(16, 185, 129, 0.05)' : '#10b98105', borderRadius: 8 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                                                <Text strong style={{ color: isDark ? '#f8fafc' : undefined, fontSize: 12 }}>{s.number}</Text>
                                                                <Tag color={SHIP_STATUS_COLOR[s.status] || 'processing'} style={{ borderRadius: 4, fontSize: 9, padding: '0 4px', marginInlineEnd: 0 }}>
                                                                    {t(s.status.toLowerCase())}
                                                                </Tag>
                                                            </div>
                                                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                                                                <GlobalOutlined style={{ marginRight: 2, fontSize: 10 }} /> {s.customer}
                                                            </Text>
                                                        </motion.div>
                                                    )
                                                }))}
                                            />
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                                <TruckOutlined style={{ fontSize: 28, color: isDark ? '#64748b' : '#cbd5e1', marginBottom: 8 }} />
                                                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{t('noShipments')}</Text>
                                            </div>
                                        )}
                                    </div>
                                </Skeleton>
                            ),
                        },
                        {
                            key: 'lowStock',
                            label: (
                                <Space size={4}>
                                    <WarningOutlined style={{ color: '#ef4444' }} />
                                    <span style={{ fontWeight: 700 }}>{dashboardText('lowStockAlert', 'Thấp kho')}</span>
                                </Space>
                            ),
                            children: (
                                <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
                                    <div style={{ maxHeight: 220, overflowY: 'auto', paddingRight: 4, marginTop: 6 }}>
                                        {lowStockProducts.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {lowStockProducts.slice(0, 5).map((p) => {
                                                    const ratioPercent = getLowStockRatioPercent(p);
                                                    const safetyStock = getLowStockThreshold(p);
                                                    const stockColor = getLowStockColor(ratioPercent);

                                                    return (
                                                        <motion.div
                                                            whileHover={{ x: 3 }}
                                                            key={p._id}
                                                            style={{
                                                                padding: '8px 10px',
                                                                background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                                borderRadius: 8,
                                                                borderLeft: `3px solid ${stockColor}`,
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                                                <Text strong ellipsis style={{ fontSize: 12, maxWidth: 160, color: isDark ? '#f8fafc' : undefined }}>
                                                                    {p.productName}
                                                                </Text>
                                                                <Text strong style={{ fontSize: 12, color: stockColor }}>
                                                                    {Number(p.currentStock || 0).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} / {safetyStock.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}
                                                                </Text>
                                                            </div>
                                                            <Progress
                                                                percent={ratioPercent}
                                                                size="small"
                                                                showInfo={false}
                                                                strokeColor={stockColor}
                                                                trailColor={isDark ? '#334155' : '#e5e7eb'}
                                                                style={{ margin: '4px 0 0' }}
                                                            />
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                                <CheckCircleOutlined style={{ fontSize: 28, color: '#10b981', marginBottom: 8 }} />
                                                <Text strong style={{ display: 'block', fontSize: 13 }}>{t('stockSafe')}</Text>
                                                <Text type="secondary" style={{ fontSize: 12 }}>{t('stockOptimized')}</Text>
                                            </div>
                                        )}
                                    </div>
                                </Skeleton>
                            ),
                        },
                    ]}
                />
            </Card>
        );
    };

    const dashboardTabNavItems = dashboardTabs.map((tab) => ({
        key: tab.key,
        label: tab.label,
    }));
    const sideChartConfigs = ([
        dashboardTabChartConfigs.logistics,
        dashboardTabChartConfigs.finance,
    ]).filter((config) => config._id !== activeDashboardTab);


    return (
        <div style={{ 
            backgroundColor: 'transparent',
            transition: 'all 0.3s ease',
            width: '100%',
            maxWidth: 1840,
            margin: '0 auto',
        }}>
            {/* --- GLASSMORPHISM HEADER --- */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 12,
                padding: '12px 14px',
                background: isDark ? 'rgba(30, 41, 59, 0.82)' : 'rgba(255, 255, 255, 0.86)',
                backdropFilter: 'blur(10px)',
                borderRadius: 12,
                boxShadow: isDark ? '0 8px 18px -12px rgba(0, 0, 0, 0.7)' : '0 8px 18px -14px rgba(15, 23, 42, 0.25)',
                border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 850, margin: 0, color: isDark ? '#f8fafc' : token.colorText, letterSpacing: 0 }}>{t('title')}</h1>
                    <Space size={[8, 4]} wrap>
                        <Text style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#cbd5e1' : '#64748b' }}>{t('subtitle')} - {t('realtimeMonitoring')}</Text>
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
                <Space size={[8, 8]} wrap>
                    <Button
                        icon={<ReloadOutlined spin={loading} />}
                        onClick={refreshDashboardData}
                        disabled={isManualRefreshDisabled}
                        title={
                            manualRefreshRemainingSeconds > 0
                                ? `${dashboardText('refreshCooldown', 'Có thể làm mới lại sau')} ${manualRefreshRemainingSeconds}s`
                                : dashboardText('refreshDashboard', 'Làm mới dữ liệu dashboard')
                        }
                        style={{ borderRadius: 10, fontWeight: 700, height: 34 }}
                    >
                        {manualRefreshRemainingSeconds > 0 ? `${manualRefreshRemainingSeconds}s` : t('refresh')}
                    </Button>
                    <RangePicker
                        value={dateRange}
                        allowClear={false}
                        presets={dateRangePresets}
                        onChange={(dates) => {
                            if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
                        }}
                        style={{
                            borderRadius: 10,
                            height: 34,
                            border: 'none',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            background: isDark ? '#1e293b' : '#fff'
                        }}
                    />

                    <Button
                        icon={isEditing ? <CheckCircleOutlined /> : <MoreOutlined />}
                        type={isEditing ? 'primary' : 'default'}
                        onClick={isEditing ? exitEditMode : enterEditMode}
                        style={{ borderRadius: 10, fontWeight: 700, height: 34 }}
                    >
                        {isEditing ? dashboardText('doneEditing', 'Xong') : dashboardText('customizeDashboard', 'Tùy chỉnh bảng điều khiển')}
                    </Button>
                    <Button icon={<DownloadOutlined />} style={{ borderRadius: 10, fontWeight: 700, height: 34 }}>{t('exportReport')}</Button>
                </Space>
            </div>

            {dashboardError ? (
                <Alert
                    type="error"
                    showIcon
                    closable
                    title={dashboardError}
                    onClose={() => setDashboardError(null)}
                    style={{ marginBottom: 12, borderRadius: 12 }}
                />
            ) : null}

            <div
                className="dashboard-analytics-shell"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 300px)',
                    gap: 14,
                    alignItems: 'start',
                }}
            >
            <main style={{ minWidth: 0 }}>
                {/* --- Z-PATTERN EXECUTIVE GRID --- */}
                <div
                    className="dashboard-z-grid"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                        gap: 14,
                        marginBottom: 20,
                    }}
                >
                    {/* Slot A: KPI Cards sub-grid (Cols 1-8 / 12) */}
                    <div className="dashboard-z-grid-slot-8" style={{ minWidth: 0 }}>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                                gap: 12,
                            }}
                        >
                            {dashboardWidgetsToRender.length > 0 ? (
                                dashboardWidgetsToRender.map((widget) => {
                                    const isWidgetVisible = widgetVisibility[widget._id];
                                    const widgetGridSpan = getWidgetGridSpan(widget);

                                    return (
                                        <div
                                            key={widget._id}
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
                                    );
                                })
                            ) : (
                                <Card variant="borderless" style={dashboardCardStyle(isDark, 12)}>
                                    <Empty description={dashboardText('emptyVisibleWidgets', 'Không có widget nào trong tab này')}>
                                        {isEditing ? (
                                            <Text type="secondary">{dashboardText('dragFromCatalog', 'Mở thư viện widget bên phải để bật lại widget phù hợp')}</Text>
                                        ) : null}
                                    </Empty>
                                </Card>
                            )}
                        </div>
                    </div>

                    {/* Slot B: Pie Chart 1 (Cols 9-12 / 12) */}
                    <div className="dashboard-z-grid-slot-4" style={{ minWidth: 0 }}>
                        <div style={{ height: '100%' }}>
                            {renderDashboardTabChart(
                                activeDashboardTab === 'logistics'
                                    ? dashboardTabChartConfigs.logistics
                                    : activeDashboardTab === 'finance'
                                        ? { ...dashboardTabChartConfigs.finance, mode: 'donut' as const }
                                        : dashboardTabChartConfigs.logistics
                            )}
                        </div>
                    </div>

                    {/* Slot C: Line Chart 1 (Cols 1-8 / 12) */}
                    <div className="dashboard-z-grid-slot-8" style={{ minWidth: 0 }}>
                        <div style={{ height: '100%' }}>
                            {renderDashboardTabChart(
                                (activeDashboardTab === 'overview' || activeDashboardTab === 'sales')
                                    ? dashboardTabChartConfigs[activeDashboardTab]
                                    : dashboardTabChartConfigs.overview
                            )}
                        </div>
                    </div>

                    {/* Slot D: Pie Chart 2 (Cols 9-12 / 12) */}
                    <div className="dashboard-z-grid-slot-4" style={{ minWidth: 0 }}>
                        {renderSlotD()}
                    </div>

                    {/* Slot E: Line Chart 2 (Cols 1-8 / 12) */}
                    <div className="dashboard-z-grid-slot-8" style={{ minWidth: 0 }}>
                        {renderSlotE()}
                    </div>

                    {/* Slot F: Interactive Panel (Cols 9-12 / 12) */}
                    <div className="dashboard-z-grid-slot-4" style={{ minWidth: 0 }}>
                        {renderInteractivePanel()}
                    </div>
                </div>

                {/* --- SLOT G: DRILLDOWN DETAILS & ACTIONABLE ITEMS --- */}
                {/* Warnings / Actionable Business Alerts */}
                {showBusinessAlertPanel && businessAlerts.length > 0 && (
                    <Card
                        title={<Space><WarningOutlined style={{ color: '#f59e0b' }} /><Title level={5} style={{ margin: 0, fontWeight: 800, color: isDark ? '#f8fafc' : undefined }}>{dashboardText('businessAlerts', 'Cảnh báo phân tích hệ thống')}</Title></Space>}
                        variant="borderless"
                        style={{ ...dashboardCardStyle(isDark, 12), marginBottom: 14 }}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 4 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                                {businessAlerts.map((alert) => {
                                    const alertColor = getBusinessAlertColor(alert.tone);

                                    return (
                                        <div
                                            key={alert._id}
                                            style={{
                                                padding: 14,
                                                borderRadius: 12,
                                                background: isDark ? 'rgba(15, 23, 42, 0.45)' : '#f8fafc',
                                                border: `1px solid ${alertColor}33`,
                                            }}
                                        >
                                            <Space size={10} align="start" style={{ width: '100%' }}>
                                                <span
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        flex: '0 0 8px',
                                                        marginTop: 6,
                                                        background: alertColor,
                                                    }}
                                                />
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <Text strong style={{ display: 'block', color: isDark ? '#f8fafc' : '#0f172a', fontSize: 13, lineHeight: 1.35 }}>
                                                        {alert.title}
                                                    </Text>
                                                    <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.4 }}>
                                                        {alert.description}
                                                    </Text>
                                                </div>
                                            </Space>
                                        </div>
                                    );
                                })}
                            </div>
                        </Skeleton>
                    </Card>
                )}

                {/* Focus Tables & Detailed Drilldowns */}
                {showFocusSection && (
                    <div style={{ marginTop: 14 }}>
                        <DashboardSectionHeader
                            title={dashboardText('sectionFocusDetails', 'Chi tiết phân tích & Drilldown')}
                            description={dashboardText('sectionFocusDetailsDesc', 'Các biểu đồ, bảng số liệu chi tiết và danh mục drilldown theo nghiệp vụ.')}
                            isDark={isDark}
                        />
                        <Row gutter={[12, 12]}>
                            {/* Gross Margin Drilldown */}
                            {showBusinessAnalysisPanel && (
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
                                        style={dashboardCardStyle(isDark, 12)}
                                    >
                                        <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
                                            {marginRows.length > 0 ? (
                                                <Row gutter={[18, 18]} align="middle">
                                                    <Col xs={24} lg={14}>
                                                        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                                                            {marginRows.slice(0, 5).map((row) => (
                                                                <div key={row.key}>
                                                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                                        <Text strong ellipsis style={{ maxWidth: 220 }}>{row.label}</Text>
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
                                                        </Space>
                                                    </Col>
                                                    <Col xs={24} lg={10}>
                                                        {canViewCost ? (
                                                            <SafeResponsiveContainer height={210}>
                                                                <BarChart
                                                                    data={marginRows.slice(0, 5).map((row) => ({
                                                                        label: row.label,
                                                                        value: Number(row.grossProfitMarginPercent || 0),
                                                                    }))}
                                                                    margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
                                                                >
                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                                                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 11, fontWeight: 700 }} tickFormatter={formatChartAxisLabel} />
                                                                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 11, fontWeight: 700 }} tickFormatter={(value) => `${Number(value)}%`} />
                                                                    <RechartsTooltip contentStyle={analysisTooltipStyle} formatter={(value: unknown) => [compactPercent(Number(value || 0)), 'GPM']} />
                                                                    <Bar dataKey="value" name="GPM" radius={[8, 8, 0, 0]} maxBarSize={46}>
                                                                        {marginRows.slice(0, 5).map((row, index) => (
                                                                            <Cell key={`margin-drilldown-${row.key}`} fill={(row.grossProfitMarginPercent || 0) >= 20 ? '#10b981' : COLORS[index % COLORS.length]} />
                                                                        ))}
                                                                    </Bar>
                                                                </BarChart>
                                                            </SafeResponsiveContainer>
                                                        ) : (
                                                            <EmptyInsight
                                                                icon={<DollarOutlined />}
                                                                title={t('hiddenByPermission')}
                                                                description={dashboardText('marginChartHiddenDesc', 'Biểu đồ GPM bị ẩn theo quyền xem giá vốn.')}
                                                                color="#f59e0b"
                                                                isDark={isDark}
                                                            />
                                                        )}
                                                    </Col>
                                                </Row>
                                            ) : (
                                                <EmptyInsight
                                                    icon={<DollarOutlined />}
                                                    title={t('emptyMarginTitle')}
                                                    description={t('emptyMarginDesc')}
                                                    color="#3b82f6"
                                                    isDark={isDark}
                                                />
                                            )}
                                        </Skeleton>
                                    </Card>
                                </Col>
                            )}

                            {/* Finance Focus (DSO & Overdue AR details) */}
                            {showFinanceFocusCard && (
                                <Col xs={24}>
                                    <Card
                                        title={<Title level={5} style={{ margin: 0, fontWeight: 800 }}>{t('dsoOverdueAr')}</Title>}
                                        extra={
                                            <Tag color={dsoDays > DSO_TARGET_DAYS ? 'red' : 'green'} style={{ marginInlineEnd: 0, borderRadius: 999, fontWeight: 800 }}>
                                                Target {'<='} {DSO_TARGET_DAYS} {t('days')}
                                            </Tag>
                                        }
                                        variant="borderless"
                                        style={dashboardCardStyle(isDark, 12)}
                                    >
                                        <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
                                            <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
                                                <Col xs={24} md={8}>
                                                    <div style={{ padding: '12px 14px', borderRadius: 12, background: isDark ? 'rgba(15, 23, 42, 0.38)' : '#f8fafc', border: `1px solid ${dsoRiskColor}30` }}>
                                                        <Text type="secondary" style={{ fontSize: 11, fontWeight: 800 }}>DSO</Text>
                                                        <div style={{ fontSize: 24, fontWeight: 900, color: dsoRiskColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                                                            {dsoDays.toFixed(1)} {t('days')}
                                                        </div>
                                                        <Text style={{ display: 'block', marginTop: 4, fontSize: 12, color: dsoVarianceColor, fontWeight: 700 }}>
                                                            {dsoVarianceDays > 0
                                                                ? `${dashboardText('aboveTarget', 'Vượt mục tiêu')} ${dsoVarianceDays.toFixed(1)} ${t('days')}`
                                                                : dashboardText('withinDsoTarget', 'Trong ngưỡng mục tiêu')}
                                                        </Text>
                                                    </div>
                                                </Col>
                                                <Col xs={24} md={8}>
                                                    <div style={{ padding: '12px 14px', borderRadius: 12, background: isDark ? 'rgba(15, 23, 42, 0.38)' : '#f8fafc', border: `1px solid ${overdueRiskColor}30` }}>
                                                        <Text type="secondary" style={{ fontSize: 11, fontWeight: 800 }}>
                                                            {dashboardText('overdueInvoiceCountLabel', 'Hóa đơn quá hạn')}
                                                        </Text>
                                                        <div style={{ fontSize: 24, fontWeight: 900, color: overdueRiskColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                                                            {overdueInvoiceCount}
                                                        </div>
                                                        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                                                            {overdueInvoiceCount > 0 ? dashboardText('needsCollectionFollowUp', 'Cần theo dõi thu hồi') : dashboardText('noOverdueAr', 'Không có AR quá hạn')}
                                                        </Text>
                                                    </div>
                                                </Col>
                                                <Col xs={24} md={8}>
                                                    <div style={{ padding: '12px 14px', borderRadius: 12, background: isDark ? 'rgba(15, 23, 42, 0.38)' : '#f8fafc', border: `1px solid ${overdueRiskColor}30`, textAlign: 'right' }}>
                                                        <Text type="secondary" style={{ fontSize: 11, fontWeight: 800 }}>
                                                            {dashboardText('overdueAmountLabel', 'Giá trị quá hạn')}
                                                        </Text>
                                                        <div style={{ fontSize: 22, fontWeight: 900, color: overdueRiskColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>
                                                            {formatVND(overdueAmountVnd)}
                                                        </div>
                                                        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                                                            {dashboardText('overdueExposure', 'Tỷ trọng quá hạn')}: {compactPercent(overdueExposurePercent)}
                                                        </Text>
                                                    </div>
                                                </Col>
                                            </Row>
                                            <div
                                                style={{
                                                    marginBottom: 14,
                                                    padding: '12px 14px',
                                                    borderRadius: 12,
                                                    background: isDark ? 'rgba(15, 23, 42, 0.28)' : '#f8fafc',
                                                    border: isDark ? '1px solid rgba(51, 65, 85, 0.72)' : '1px solid #e5e7eb',
                                                }}
                                            >
                                                <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 10 }}>
                                                    <div>
                                                        <Text strong style={{ display: 'block', color: isDark ? '#e2e8f0' : '#0f172a' }}>
                                                            {dashboardText('arAgingExposureTitle', 'AR Aging Exposure')}
                                                        </Text>
                                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                                            {dashboardText('totalOpenAr', 'Tổng AR mở')}: {formatVND(totalArAgingVnd)}
                                                        </Text>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <Text type="secondary" style={{ display: 'block', fontSize: 11, fontWeight: 800 }}>
                                                            {dashboardText('overdueAr', 'AR quá hạn')}
                                                        </Text>
                                                        <Text style={{ display: 'block', color: overdueRiskColor, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                                                            {formatVND(overdueArAgingVnd)} · {compactPercent(overdueExposurePercent)}
                                                        </Text>
                                                    </div>
                                                </Space>
                                                {hasFinanceAgingData ? (
                                                    <SafeResponsiveContainer height={240}>
                                                        <BarChart data={financeAgingBuckets} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                                                            <XAxis
                                                                dataKey="label"
                                                                axisLine={false}
                                                                tickLine={false}
                                                                tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 11, fontWeight: 700 }}
                                                            />
                                                            <YAxis
                                                                axisLine={false}
                                                                tickLine={false}
                                                                width={64}
                                                                tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 11, fontWeight: 700 }}
                                                                tickFormatter={(value) => formatCompact(Number(value || 0))}
                                                            />
                                                            <RechartsTooltip
                                                                contentStyle={analysisTooltipStyle}
                                                                formatter={(value: unknown) => [formatVND(Number(value || 0)), dashboardText('openReceivable', 'Công nợ mở')]}
                                                            />
                                                            <Bar dataKey="valueVnd" name={dashboardText('openReceivable', 'Công nợ mở')} radius={[8, 8, 0, 0]} maxBarSize={44}>
                                                                {financeAgingBuckets.map((bucket) => (
                                                                    <Cell key={`finance-aging-${bucket._id}`} fill={bucket.color} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    </SafeResponsiveContainer>
                                                ) : (
                                                    <EmptyInsight
                                                        icon={<ClockCircleOutlined />}
                                                        title={dashboardText('emptyArAgingTitle', 'Chưa có dữ liệu AR Aging')}
                                                        description={dashboardText('emptyArAgingDesc', 'Khoảng ngày hiện tại chưa có công nợ mở đủ để phân tích aging.')}
                                                        color="#3b82f6"
                                                        isDark={isDark}
                                                    />
                                                )}
                                            </div>
                                            <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                                                <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                                                    <Text strong style={{ color: isDark ? '#e2e8f0' : '#0f172a' }}>
                                                        {dashboardText('topOverdueInvoices', 'Top hóa đơn quá hạn')}
                                                    </Text>
                                                    <Tag color={overdueInvoiceCount > 0 ? 'red' : 'green'} style={{ marginInlineEnd: 0, borderRadius: 999, fontWeight: 800 }}>
                                                        {overdueInvoiceCount.toLocaleString(numberLocale)}
                                                    </Tag>
                                                </Space>
                                                {overdueInvoices.slice(0, 4).map((invoice) => {
                                                    const invoiceRiskColor = getOverdueDaysRiskColor(invoice.overdueDays);

                                                    return (
                                                        <div
                                                            key={invoice._id}
                                                            style={{
                                                                display: 'grid',
                                                                gridTemplateColumns: 'minmax(0, 1fr) minmax(116px, auto)',
                                                                gap: 12,
                                                                alignItems: 'center',
                                                                padding: '10px 12px',
                                                                borderRadius: 10,
                                                                background: isDark ? 'rgba(15, 23, 42, 0.28)' : '#f8fafc',
                                                                border: `1px solid ${invoiceRiskColor}24`,
                                                            }}
                                                        >
                                                            <div style={{ minWidth: 0 }}>
                                                                <Text strong ellipsis style={{ display: 'block', minWidth: 0 }}>{invoice.invoiceNumber}</Text>
                                                                <Text type="secondary" style={{ display: 'block', fontSize: 12, lineHeight: 1.4 }}>
                                                                    {invoice.buyerName || t('unknownBuyer')} · {dashboardText('overdueByDays', 'quá hạn')} {invoice.overdueDays} {t('days')}
                                                                </Text>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <Text style={{ display: 'block', color: invoiceRiskColor, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                                                    {formatVND(invoice.openAmountVnd)}
                                                                </Text>
                                                                <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
                                                                    {dashboardText('overdueAmountLabel', 'Giá trị quá hạn')}
                                                                </Text>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {overdueInvoices.length === 0 && (
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

                            {/* Inventory Turnover */}
                            {showInventoryTurnoverFocusCard && (
                                <Col xs={24}>
                                    <Card
                                        title={<Title level={5} style={{ margin: 0, fontWeight: 800 }}>{t('inventoryTurnover')}</Title>}
                                        variant="borderless"
                                        style={dashboardCardStyle(isDark, 12)}
                                    >
                                        <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
                                            {canViewCost ? (
                                                inventoryTurnoverChartData.length > 0 ? (
                                                    <Row gutter={[16, 16]} align="middle">
                                                        <Col xs={24} lg={17}>
                                                            <SafeResponsiveContainer height={Math.max(220, inventoryTurnoverChartData.length * 46)}>
                                                                <BarChart
                                                                    data={inventoryTurnoverChartData}
                                                                    layout="vertical"
                                                                    margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                                                                >
                                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                                                                    <XAxis
                                                                        type="number"
                                                                        axisLine={false}
                                                                        tickLine={false}
                                                                        tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 11, fontWeight: 700 }}
                                                                        tickFormatter={(value) => `${Number(value || 0).toFixed(1)}x`}
                                                                    />
                                                                    <YAxis
                                                                        dataKey="shortLabel"
                                                                        type="category"
                                                                        axisLine={false}
                                                                        tickLine={false}
                                                                        width={116}
                                                                        tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 11, fontWeight: 700 }}
                                                                        tickFormatter={formatChartAxisLabel}
                                                                    />
                                                                    <RechartsTooltip
                                                                        contentStyle={analysisTooltipStyle}
                                                                        formatter={(value: unknown) => [`${Number(value || 0).toFixed(2)}x`, t('inventoryTurnover')]}
                                                                        labelFormatter={(label: unknown) => String(label || '')}
                                                                    />
                                                                    <Bar dataKey="turnover" name={t('inventoryTurnover')} radius={[0, 8, 8, 0]} maxBarSize={26}>
                                                                        {inventoryTurnoverChartData.map((item, index) => (
                                                                            <Cell key={`inventory-turnover-${item._id}`} fill={['#10b981', '#3b82f6', '#14b8a6', '#f59e0b'][index % 4]} />
                                                                        ))}
                                                                    </Bar>
                                                                </BarChart>
                                                            </SafeResponsiveContainer>
                                                        </Col>
                                                        <Col xs={24} lg={7}>
                                                            <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                                                                {inventoryTurnoverChartData.slice(0, 3).map((item) => (
                                                                    <div
                                                                        key={`inventory-turnover-summary-${item._id}`}
                                                                        style={{
                                                                            display: 'grid',
                                                                            gridTemplateColumns: 'minmax(0, 1fr) minmax(72px, auto)',
                                                                            gap: 10,
                                                                            alignItems: 'center',
                                                                            padding: '10px 12px',
                                                                            borderRadius: 10,
                                                                            background: isDark ? 'rgba(15, 23, 42, 0.32)' : '#f8fafc',
                                                                        }}
                                                                    >
                                                                        <div style={{ minWidth: 0 }}>
                                                                            <Text strong ellipsis style={{ display: 'block', minWidth: 0 }}>{item.productName}</Text>
                                                                            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                                                                                {item.sku} · {t('sold')} {item.quantitySold.toLocaleString(numberLocale)}
                                                                            </Text>
                                                                        </div>
                                                                        <Text style={{ textAlign: 'right', fontWeight: 900, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                                                                            {item.turnover.toFixed(2)}x
                                                                        </Text>
                                                                    </div>
                                                                ))}
                                                            </Space>
                                                        </Col>
                                                    </Row>
                                                ) : (
                                                    <EmptyInsight
                                                        icon={<ShoppingCartOutlined />}
                                                        title={t('emptyInventoryTitle')}
                                                        description={t('emptyInventoryDesc')}
                                                        color="#10b981"
                                                        isDark={isDark}
                                                    />
                                                )
                                            ) : (
                                                <EmptyInsight
                                                    icon={<DollarOutlined />}
                                                    title={t('hiddenByPermission')}
                                                    description={dashboardText('inventoryTurnoverHiddenDesc', 'Inventory turnover uses cost and inventory value data, so this chart is hidden by permission.')}
                                                    color="#f59e0b"
                                                    isDark={isDark}
                                                />
                                            )}
                                        </Skeleton>
                                    </Card>
                                </Col>
                            )}

                            {/* Logistics Revenue Drilldown */}
                            {showLogisticsRevenueFocusCard && (
                                <Col xs={24}>
                                    <Card
                                        title={<Title level={5} style={{ margin: 0, fontWeight: 800 }}>{t('logisticsRevenueDrilldown')}</Title>}
                                        extra={activeLogisticsStatusLabel ? (
                                            <Space size={8}>
                                                <Tag color="blue" style={{ marginInlineEnd: 0, borderRadius: 999, fontWeight: 700 }}>
                                                    {activeLogisticsStatusLabel}
                                                </Tag>
                                                <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => setActiveLogisticsStatus(null)}>
                                                    {dashboardText('clearFilter', 'Bỏ lọc')}
                                                </Button>
                                            </Space>
                                        ) : null}
                                        variant="borderless"
                                        style={dashboardCardStyle(isDark, 12)}
                                    >
                                        <Skeleton loading={loading} active paragraph={{ rows: 4 }}>
                                            <Row gutter={[16, 16]} align="middle">
                                                <Col xs={24} lg={6}>
                                                    <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                                                        <div>
                                                            <Text type="secondary" style={{ fontSize: 11, fontWeight: 800 }}>{t('periodRatio')}</Text>
                                                            <div style={{ fontSize: 28, fontWeight: 900, color: canViewCost ? periodLogisticsCostRiskColor : (isDark ? '#cbd5e1' : '#64748b'), fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
                                                                {canViewCost ? compactPercent(periodLogisticsCostRatio) : t('hiddenByPermission')}
                                                            </div>
                                                            <Text type="secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatVND(drilldown?.logisticsRevenue?.revenueVnd || 0)} {t('revenueShort')}</Text>
                                                        </div>
                                                        <div
                                                            style={{
                                                                padding: '10px 12px',
                                                                borderRadius: 10,
                                                                background: isDark ? 'rgba(15, 23, 42, 0.32)' : '#f8fafc',
                                                            }}
                                                        >
                                                            <Text type="secondary" style={{ display: 'block', fontSize: 11, fontWeight: 800 }}>
                                                                {dashboardText('shipmentCount', 'Shipments')}
                                                            </Text>
                                                            <Text style={{ display: 'block', fontSize: 20, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                                                                {logisticsRevenueChartData.length.toLocaleString(numberLocale)}
                                                            </Text>
                                                        </div>
                                                    </Space>
                                                </Col>
                                                <Col xs={24} lg={18}>
                                                    {logisticsRevenueChartData.length > 0 ? (
                                                        <SafeResponsiveContainer height={Math.max(230, logisticsRevenueChartData.length * 44)}>
                                                            <BarChart
                                                                data={logisticsRevenueChartData}
                                                                layout="vertical"
                                                                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                                                            >
                                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                                                                <XAxis
                                                                    type="number"
                                                                    axisLine={false}
                                                                    tickLine={false}
                                                                    tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 11, fontWeight: 700 }}
                                                                    tickFormatter={(value) => (
                                                                        canViewCost ? compactPercent(Number(value || 0)) : formatCompact(Number(value || 0))
                                                                    )}
                                                                />
                                                                <YAxis
                                                                    dataKey="label"
                                                                    type="category"
                                                                    axisLine={false}
                                                                    tickLine={false}
                                                                    width={132}
                                                                    tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 11, fontWeight: 700 }}
                                                                    tickFormatter={formatChartAxisLabel}
                                                                />
                                                                <RechartsTooltip
                                                                    contentStyle={analysisTooltipStyle}
                                                                    formatter={(value: unknown) => [
                                                                        canViewCost ? compactPercent(Number(value || 0)) : formatVND(Number(value || 0)),
                                                                        canViewCost ? t('periodRatio') : t('revenue'),
                                                                    ]}
                                                                    labelFormatter={(label: unknown) => String(label || '')}
                                                                />
                                                                <Bar
                                                                    dataKey={canViewCost ? 'logisticsCostRatioPercent' : 'revenueVnd'}
                                                                    name={canViewCost ? t('periodRatio') : t('revenue')}
                                                                    radius={[0, 8, 8, 0]}
                                                                    maxBarSize={26}
                                                                >
                                                                    {logisticsRevenueChartData.map((shipment) => (
                                                                        <Cell
                                                                            key={`logistics-revenue-${shipment._id}`}
                                                                            fill={canViewCost ? getLogisticsCostRiskColor(shipment.logisticsCostRatioPercent) : '#3b82f6'}
                                                                        />
                                                                    ))}
                                                                </Bar>
                                                            </BarChart>
                                                        </SafeResponsiveContainer>
                                                    ) : (
                                                        <EmptyInsight
                                                            icon={<TruckOutlined />}
                                                            title={t('emptyLogisticsTitle')}
                                                            description={t('emptyLogisticsDesc')}
                                                            color="#3b82f6"
                                                            isDark={isDark}
                                                        />
                                                    )}
                                                </Col>
                                            </Row>
                                        </Skeleton>
                                    </Card>
                                </Col>
                            )}

                            {/* Strategic Partners List */}
                            {showPartnerPanel && (
                                <Col xs={24}>
                                    <Card
                                        title={
                                            <Tabs 
                                                activeKey={activePartnerTab}
                                                onChange={(key) => setActivePartnerTab(key as '1' | '2')}
                                                size="small"
                                                tabBarExtraContent={
                                                    <Button type="link" size="small" onClick={() => router.push(`/${locale}/dashboard/partners`)} style={{ fontSize: 12 }}>{t('analytics')}</Button>
                                                }
                                                items={[
                                                    { key: '1', label: t('buyer'), icon: <GlobalOutlined /> },
                                                    { key: '2', label: t('supplier'), icon: <TeamOutlined /> },
                                                ]}
                                            />
                                        }
                                        variant="borderless"
                                        style={dashboardCardStyle(isDark, 12)}
                                    >
                                        <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                                                {partnerRows.length > 0 ? partnerRows.slice(0, 4).map((p: DashboardPartnerLine, i: number) => (
                                                    <motion.div 
                                                        whileHover={{ x: 3 }}
                                                        key={p._id}
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            padding: '12px',
                                                            background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                            borderRadius: 12,
                                                            cursor: 'pointer',
                                                            border: isDark ? '1px solid #334155' : '1px solid #f1f5f9'
                                                        }}
                                                        onClick={() => openPartnerModule(p._id)}
                                                    >
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
            </section>
            </main>
            <aside
                className="dashboard-filter-rail"
                style={{
                    position: 'sticky',
                    top: 76,
                    alignSelf: 'start',
                    zIndex: 20,
                }}
            >
                <Card
                    variant="borderless"
                    style={{
                        ...dashboardCardStyle(isDark, 12),
                        borderColor: isDark ? '#475569' : '#dbeafe',
                    }}
                    styles={{ body: { padding: 14 } }}
                >
                    <Space orientation="vertical" size={14} style={{ width: '100%' }}>
                        <div>
                            <Space size={8} style={{ marginBottom: 6 }}>
                                <FilterOutlined style={{ color: '#2563eb' }} />
                                <Text strong style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                                    {dashboardText('globalFilters', 'Global filters')}
                                </Text>
                            </Space>
                            <Text style={{ display: 'block', fontSize: 12, color: isDark ? '#cbd5e1' : '#64748b', lineHeight: 1.45 }}>
                                {dashboardText('globalFiltersDesc', 'Các slicer này cập nhật toàn bộ KPI và biểu đồ bên trái.')}
                            </Text>
                        </div>

                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 12, color: isDark ? '#e2e8f0' : '#334155' }}>
                                {dashboardText('filterDateRange', 'Date range')}
                            </Text>
                            <RangePicker
                                value={dateRange}
                                allowClear={false}
                                presets={dateRangePresets}
                                onChange={(dates) => {
                                    if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
                                }}
                                style={{
                                    width: '100%',
                                    borderRadius: 10,
                                    minHeight: 36,
                                    background: isDark ? '#1e293b' : '#fff',
                                }}
                            />
                        </div>

                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 12, color: isDark ? '#e2e8f0' : '#334155' }}>
                                {dashboardText('filterDashboardScope', 'Dashboard scope')}
                            </Text>
                            <Tabs
                                activeKey={activeDashboardTab}
                                onChange={(key) => setActiveDashboardTab(key as DashboardTabKey)}
                                items={dashboardTabNavItems}
                                size="small"
                                tabPosition="left"
                            />
                        </div>

                        <div
                            style={{
                                padding: 12,
                                borderRadius: 10,
                                background: isDark ? 'rgba(15, 23, 42, 0.36)' : '#f8fafc',
                                border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
                            }}
                        >
                            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                                {dashboardText('activeSlicers', 'Active slicers')}
                            </Text>
                            <Space wrap size={[6, 6]}>
                                <Tag color="blue" style={{ marginInlineEnd: 0 }}>{rolePresetLabels[rolePresetKey]}</Tag>
                                <Tag color="cyan" style={{ marginInlineEnd: 0 }}>{currency}</Tag>
                                {activeLogisticsStatusLabel ? (
                                    <Tag color="green" closable onClose={() => setActiveLogisticsStatus(null)} style={{ marginInlineEnd: 0 }}>
                                        {activeLogisticsStatusLabel}
                                    </Tag>
                                ) : null}
                                <Tag style={{ marginInlineEnd: 0 }}>
                                    {dateRange[0].format('DD/MM')} - {dateRange[1].format('DD/MM')}
                                </Tag>
                            </Space>
                        </div>

                        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                            <Button
                                block
                                icon={<ReloadOutlined spin={loading || chartRefreshing} />}
                                onClick={refreshDashboardData}
                                disabled={isManualRefreshDisabled}
                                title={
                                    manualRefreshRemainingSeconds > 0
                                        ? `${dashboardText('refreshCooldown', 'Có thể làm mới lại sau')} ${manualRefreshRemainingSeconds}s`
                                        : dashboardText('refreshDashboard', 'Làm mới dữ liệu dashboard')
                                }
                                style={{ borderRadius: 10, fontWeight: 800, height: 36 }}
                            >
                                {manualRefreshRemainingSeconds > 0 ? `${manualRefreshRemainingSeconds}s` : t('refresh')}
                            </Button>
                            <Button
                                block
                                icon={isEditing ? <CheckCircleOutlined /> : <MoreOutlined />}
                                type={isEditing ? 'primary' : 'default'}
                                onClick={isEditing ? exitEditMode : enterEditMode}
                                style={{ borderRadius: 10, fontWeight: 800, height: 36 }}
                            >
                                {isEditing ? dashboardText('doneEditing', 'Xong') : dashboardText('customizeDashboard', 'Tùy chỉnh bảng điều khiển')}
                            </Button>
                            <Button block icon={<DownloadOutlined />} style={{ borderRadius: 10, fontWeight: 800, height: 36 }}>
                                {t('exportReport')}
                            </Button>
                        </Space>
                    </Space>
                </Card>
            </aside>
            </div>

            <Drawer
                title={dashboardText('widgetPicker', 'Thư viện widget')}
                open={customizeOpen}
                onClose={exitEditMode}
                size={440}
                mask={false}
                extra={
                    <Space>
                        <Button onClick={() => applyRolePreset(rolePresetKey)}>
                            {dashboardText('restoreRolePreset', 'Theo vai trò')}
                        </Button>
                        <Button onClick={resetDashboardLayout}>
                            {dashboardText('resetLayout', 'Khôi phục mặc định')}
                        </Button>
                        <Button type="primary" onClick={exitEditMode}>
                            {dashboardText('doneEditing', 'Xong')}
                        </Button>
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
                        {dashboardText('customizeDashboardDesc', 'Tick để ẩn/hiện widget, kéo thả hoặc dùng nút lên/xuống để sắp xếp thứ tự ưu tiên.')}
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
                                                background: draggedWidgetId === widget._id
                                                    ? (isDark ? '#334155' : '#eff6ff')
                                                    : (isDark ? '#0f172a' : '#fff'),
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
                                                            {isActiveInCurrentTab ? (
                                                                <Tag color="green">{dashboardText('activeInCurrentTab', 'Đang thuộc tab này')}</Tag>
                                                            ) : null}
                                                        </Space>
                                                    </Space>
                                                </Checkbox>
                                            </Space>
                                            <Space size={4}>
                                                <Button size="small" disabled={index === 0} onClick={() => moveWidgetByOffset(widget._id, -1)}>
                                                    {dashboardText('moveUp', 'Lên')}
                                                </Button>
                                                <Button size="small" disabled={index === widgetOrder.length - 1} onClick={() => moveWidgetByOffset(widget._id, 1)}>
                                                    {dashboardText('moveDown', 'Xuống')}
                                                </Button>
                                            </Space>
                                        </div>
                                    );
                                })}
                            </Space>
                        </div>
                    ))}
                </Space>
            </Drawer>

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
                        <Card variant="borderless" style={dashboardCardStyle(isDark, 12)}>
                            {selectedWidget.detail}
                        </Card>
                    </Space>
                ) : null}
            </Drawer>

            <style jsx global>{`
                .dashboard-analytics-shell {
                    grid-template-columns: minmax(0, 1fr) minmax(260px, 300px);
                }

                .dashboard-z-grid {
                    display: grid;
                    grid-template-columns: repeat(12, minmax(0, 1fr));
                    gap: 16px;
                }

                .dashboard-z-grid-slot-8 {
                    grid-column: span 8 / span 8;
                }

                .dashboard-z-grid-slot-4 {
                    grid-column: span 4 / span 4;
                }

                @media (max-width: 1280px) {
                    .dashboard-analytics-shell {
                        grid-template-columns: minmax(0, 1fr) 280px;
                    }

                    .dashboard-z-grid-slot-8,
                    .dashboard-z-grid-slot-4 {
                        grid-column: span 12 / span 12;
                    }
                }

                @media (max-width: 992px) {
                    .dashboard-analytics-shell {
                        grid-template-columns: minmax(0, 1fr);
                    }

                    .dashboard-filter-rail {
                        position: static !important;
                        order: -1;
                    }
                }

                @media (max-width: 640px) {
                    .dashboard-analytics-shell,
                    .dashboard-z-grid {
                        gap: 10px !important;
                    }
                }
            `}</style>

        </div>
    );
};

export default AdminDashboard;
