import type { CSSProperties } from 'react';

export const dashboardSurfaceStyle = (isDark: boolean): CSSProperties => ({
    minHeight: '100%',
    padding: 24,
    background: isDark ? '#020617' : '#f8fafc',
});

export const chartCardStyle = (isDark: boolean, radius = 16): CSSProperties => ({
    borderRadius: radius,
    background: isDark ? '#0f172a' : '#ffffff',
    border: isDark ? '1px solid rgba(148, 163, 184, 0.18)' : '1px solid #e2e8f0',
    boxShadow: isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
});

export const metricCardStyle = (isDark: boolean): CSSProperties => ({
    borderRadius: 16,
    background: isDark ? '#111c2e' : '#ffffff',
    border: isDark ? '1px solid rgba(148, 163, 184, 0.18)' : '1px solid #e2e8f0',
    boxShadow: isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
});

export const makeSoftPanelStyle = (isDark: boolean): CSSProperties => ({
    borderRadius: 12,
    background: isDark ? '#111c2e' : '#f8fafc',
    border: isDark ? '1px solid rgba(148, 163, 184, 0.18)' : '1px solid #e2e8f0',
});

export const getTooltipStyle = (isDark: boolean): CSSProperties => ({
    background: isDark ? '#0f172a' : '#ffffff',
    border: isDark ? '1px solid rgba(148, 163, 184, 0.18)' : '1px solid #e2e8f0',
    borderRadius: 12,
    color: isDark ? '#f8fafc' : '#0f172a',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
});
