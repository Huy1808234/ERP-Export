export interface DashboardTrendPoint {
    label: string;
    revenueMillion: number;
    orders: number;
    gpm?: number;
}

export interface DashboardChartPoint {
    label: string;
    value: number;
    secondary?: number;
    statusKey?: string;
}
