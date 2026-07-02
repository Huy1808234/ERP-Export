import { ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Bar, Line } from 'recharts';
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { useTranslations, useLocale } from 'next-intl';
import { useCurrency } from '@/hooks/useCurrency';
import { EmptyState } from '../components/EmptyState';
import { getTooltipStyle } from '../styles';
import { DashboardTrendPoint } from '../types';
import { useTheme } from '@/context/theme.context';

interface TrendChartProps {
    data: DashboardTrendPoint[];
    canViewCost: boolean;
}

export const TrendChart = ({ data, canViewCost }: TrendChartProps) => {
    const t = useTranslations('Dashboard');
    const locale = useLocale();
    const { isDark } = useTheme();
    const numberLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
    const { formatCompact } = useCurrency();

    const hasTrendData = data.some((point) => point.revenueMillion > 0 || point.orders > 0);

    if (!hasTrendData) {
        return <EmptyState title={t('noData')} description={t('noChartDataDesc')} isDark={isDark} variant="chart" />;
    }

    const tooltipStyle = getTooltipStyle(isDark);

    return (
        <SafeResponsiveContainer height={360}>
            <ComposedChart data={data} margin={{ top: 18, right: 18, left: 4, bottom: 8 }}>
                <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.9} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.2} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(148, 163, 184, 0.12)' : '#e5e7eb'} />
                <XAxis dataKey="label" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} axisLine={{ stroke: isDark ? 'rgba(148, 163, 184, 0.18)' : '#e2e8f0' }} tickLine={false} dy={8} />
                <YAxis yAxisId="revenue" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${formatCompact(Number(value || 0))} ${t('million')}`} width={82} />
                <YAxis yAxisId="orders" orientation="right" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} width={46} />
                <RechartsTooltip
                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ ...tooltipStyle, borderRadius: 12, padding: '12px 16px', border: isDark ? '1px solid rgba(148, 163, 184, 0.18)' : '1px solid #e2e8f0', background: isDark ? '#0f172a' : '#ffffff' }}
                    itemStyle={{ fontSize: 14, fontWeight: 500 }}
                    labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', marginBottom: 8, fontSize: 13 }}
                    formatter={(value, name) => {
                        if (name === 'orders') return [Number(value || 0).toLocaleString(numberLocale), t('orders')];
                        if (name === 'gpm') return [`${Number(value || 0).toFixed(1)}%`, 'GPM'];
                        return [`${formatCompact(Number(value || 0))} ${t('million')}`, t('revenue')];
                    }}
                />
                <Bar yAxisId="revenue" dataKey="revenueMillion" name="revenue" fill="url(#colorRevenue)" radius={[8, 8, 0, 0]} barSize={32} />
                {canViewCost ? <Line yAxisId="orders" type="monotone" dataKey="gpm" name="gpm" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 0 }} activeDot={{ r: 4, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }} /> : null}
                <Line yAxisId="orders" type="monotone" dataKey="orders" name="orders" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#10b981', stroke: isDark ? '#0f172a' : '#fff', strokeWidth: 2 }} />
            </ComposedChart>
        </SafeResponsiveContainer>
    );
};
