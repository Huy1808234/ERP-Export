import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { Space, Typography, Button } from 'antd';
import { useTranslations, useLocale } from 'next-intl';
import { EmptyState } from '../components/EmptyState';
import { getTooltipStyle } from '../styles';
import { DashboardChartPoint } from '../types';
import { useTheme } from '@/context/theme.context';

const { Text } = Typography;

interface ShipmentDonutChartProps {
    data: DashboardChartPoint[];
    activeStatus: string | null;
    onStatusChange: (status: string | null) => void;
}

export const ShipmentDonutChart = ({ data, activeStatus, onStatusChange }: ShipmentDonutChartProps) => {
    const t = useTranslations('Dashboard');
    const locale = useLocale();
    const { isDark } = useTheme();
    const numberLocale = locale === 'vi' ? 'vi-VN' : 'en-US';

    const dashboardText = (key: string, fallback: string) => {
        try {
            return t.has(key) ? t(key) : fallback;
        } catch {
            return fallback;
        }
    };

    if (!data.length) {
        return <EmptyState title={dashboardText('noData', 'Chưa có dữ liệu')} description={dashboardText('noLogisticsDataDesc', 'Chưa có dữ liệu trạng thái lô hàng trong khoảng thời gian đã chọn.')} isDark={isDark} variant="chart" />;
    }

    const total = data.reduce((sum, item) => sum + (item.secondary || 0), 0);
    const donutColors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];
    const tooltipStyle = getTooltipStyle(isDark);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(230px, 1fr)', gap: 24, alignItems: 'center', minHeight: 320 }} className="dashboard-hero-split">
            <div style={{ position: 'relative', minHeight: 280, display: 'flex', justifyContent: 'center' }}>
                <SafeResponsiveContainer height={280}>
                    <PieChart>
                        <Pie data={data} dataKey="value" nameKey="label" innerRadius={85} outerRadius={115} paddingAngle={4} stroke="none">
                            {data.map((entry, index) => {
                                const color = donutColors[index % donutColors.length];
                                const isActive = activeStatus === entry.statusKey;
                                return (
                                    <Cell
                                        key={`${entry.statusKey || entry.label}`}
                                        fill={color}
                                        opacity={activeStatus && !isActive ? 0.2 : 1}
                                        stroke={isActive ? (isDark ? '#f8fafc' : '#0f172a') : 'none'}
                                        strokeWidth={isActive ? 2 : 0}
                                        cursor="pointer"
                                        onClick={() => onStatusChange(activeStatus === entry.statusKey ? null : entry.statusKey || null)}
                                    />
                                );
                            })}
                        </Pie>
                        <RechartsTooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value || 0).toFixed(1)}%`, dashboardText('share', 'Tỷ trọng')]} />
                    </PieChart>
                </SafeResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <Text strong style={{ fontSize: 36, fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a' }}>{total.toLocaleString(numberLocale)}</Text>
                    <Text style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: isDark ? '#94a3b8' : '#64748b' }}>{dashboardText('shipments', 'Lô hàng')}</Text>
                </div>
            </div>
            <Space orientation="vertical" size={12} style={{ width: '100%', paddingRight: 16 }}>
                {data.map((point, index) => {
                    const color = donutColors[index % donutColors.length];
                    const active = activeStatus === point.statusKey;
                    return (
                        <button
                            key={`${point.statusKey || point.label}-legend`}
                            type="button"
                            onClick={() => onStatusChange(activeStatus === point.statusKey ? null : point.statusKey || null)}
                            style={{
                                width: '100%',
                                display: 'grid',
                                gridTemplateColumns: '12px minmax(0, 1fr) auto auto',
                                gap: 12,
                                alignItems: 'center',
                                borderRadius: 12,
                                padding: '10px 14px',
                                border: active ? `1px solid ${color}` : (isDark ? '1px solid rgba(148, 163, 184, 0.12)' : '1px solid #e2e8f0'),
                                background: active ? `${color}1c` : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                font: 'inherit',
                                transition: 'all 0.2s',
                            }}
                        >
                            <span style={{ width: 12, height: 12, borderRadius: 4, background: color }} />
                            <Text strong ellipsis style={{ color: isDark ? '#e2e8f0' : '#0f172a', fontSize: 14 }}>{point.label}</Text>
                            <Text style={{ color, fontWeight: 800, fontSize: 14 }}>{point.value.toFixed(1)}%</Text>
                            <Text type="secondary" style={{ fontSize: 14, minWidth: 32, textAlign: 'right' }}>{(point.secondary || 0).toLocaleString(numberLocale)}</Text>
                        </button>
                    );
                })}
                {activeStatus ? <Button type="text" size="small" onClick={() => onStatusChange(null)} style={{ marginTop: 8 }}>{dashboardText('clearFilter', 'Bỏ lọc')}</Button> : null}
            </Space>
        </div>
    );
};
