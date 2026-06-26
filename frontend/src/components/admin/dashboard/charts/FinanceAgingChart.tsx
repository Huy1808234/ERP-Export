import { BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { useTranslations } from 'next-intl';
import { useCurrency } from '@/hooks/useCurrency';
import { EmptyState } from '../components/EmptyState';
import { getTooltipStyle } from '../styles';
import { DashboardChartPoint } from '../types';
import { useTheme } from '@/context/theme.context';

interface FinanceAgingChartProps {
    data: DashboardChartPoint[];
}

export const FinanceAgingChart = ({ data }: FinanceAgingChartProps) => {
    const t = useTranslations('Dashboard');
    const { isDark } = useTheme();
    const { formatCompact, formatVND } = useCurrency();

    const dashboardText = (key: string, fallback: string) => {
        try {
            return t.has(key) ? t(key) : fallback;
        } catch {
            return fallback;
        }
    };

    const hasData = data.some((bucket) => bucket.value > 0);

    if (!hasData) {
        return <EmptyState title={dashboardText('noData', 'Chưa có dữ liệu')} description={dashboardText('noFinanceDataDesc', 'Chưa có dữ liệu AR Aging trong khoảng thời gian đã chọn.')} isDark={isDark} variant="chart" />;
    }

    const arAgingColors = ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'];
    const tooltipStyle = getTooltipStyle(isDark);

    return (
        <SafeResponsiveContainer height={360}>
            <BarChart data={data} layout="vertical" margin={{ top: 18, right: 18, left: 24, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={isDark ? 'rgba(148, 163, 184, 0.12)' : '#e5e7eb'} />
                <XAxis type="number" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} tickFormatter={(value) => `${formatCompact(Number(value || 0))}`} />
                <YAxis type="category" dataKey="label" tick={{ fill: isDark ? '#f8fafc' : '#1e293b', fontSize: 12, fontWeight: 500 }} width={80} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} contentStyle={{ ...tooltipStyle, borderRadius: 12 }} formatter={(value) => [formatVND(Number(value || 0)), dashboardText('arExposure', 'Giá trị AR')]} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                    {data.map((entry, index) => <Cell key={entry.label} fill={arAgingColors[index % arAgingColors.length]} />)}
                </Bar>
            </BarChart>
        </SafeResponsiveContainer>
    );
};
