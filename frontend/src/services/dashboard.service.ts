import { sendRequest } from '@/lib/api-client';
import { BaseApiService, IBackendRes } from './base.service';

export interface DashboardHistoryPoint {
  month: string;
  revenue: number;
  orders: number;
  profit?: number;
}

export interface DashboardPartnerLine {
  _id: string;
  name: string;
  total: number;
}

export interface DashboardCashflowItem {
  _id: string;
  invoiceNumber: string;
  partnerName?: string | null;
  dueDate?: string | Date | null;
  amountVnd: number;
}

export interface DashboardCashflowForecast {
  horizonDays: number;
  inflowVnd: number;
  outflowVnd: number;
  netVnd: number;
  receivables: DashboardCashflowItem[];
  payables: DashboardCashflowItem[];
}

export interface DashboardArAging {
  current: number;
  days_30: number;
  days_60: number;
  days_90: number;
  over_90: number;
}

export interface DashboardDirector {
  revenueVnd: number;
  revenueGrowth: number;
  grossProfitMargin?: number;
  arAging?: DashboardArAging;
  inventoryValue?: number;
  topBuyers: DashboardPartnerLine[];
  topSuppliers: DashboardPartnerLine[];
  totalCustomers: number;
  exchangeRate: number;
  dso: number;
  onTimeRate: number;
  inventoryTurnover?: number;
  logisticsCostRatio?: number;
  cashflowForecast?: DashboardCashflowForecast;
  history: DashboardHistoryPoint[];
}

export interface DashboardSales {
  totalPIs: number;
  confirmedContracts: number;
  shippedPIs: number;
  pendingShipments: number;
  conversionRate: number;
  pendingInquiries?: number;
  submittedInquiries?: number;
  quotedInquiries?: number;
  recentInquiries?: Array<{
    _id: string;
    inquiryNumber?: string | null;
    customerName: string;
    customerEmail: string;
    status: string;
    lineCount: number;
    incoterm?: string | null;
    destinationPort?: string | null;
    createdAt?: string | Date | null;
  }>;
  activeShipments: number;
  poGrowth: number;
}

export interface DashboardUpcomingShipment {
  _id: string;
  number: string;
  customer?: string | null;
  etd?: string | Date | null;
  status: string;
}

export interface DashboardLogistics {
  statusBreakdown: Record<string, number>;
  upcomingShipments: DashboardUpcomingShipment[];
  expiringLCs: Array<Record<string, unknown>>;
  shipmentGrowth: number;
}

export interface DashboardLowStockProduct {
  _id: string;
  name: string;
  sku: string;
  currentStock: number;
  minimumStock?: number;
  safetyStock?: number;
  imageUrl?: string | null;
}

export interface DashboardExecutiveData {
  director: DashboardDirector;
  sales: DashboardSales;
  logistics: DashboardLogistics;
  lowStockProducts: DashboardLowStockProduct[];
  lastUpdated: string;
}

export interface MarginDrilldownLine {
  key: string;
  label: string;
  revenueVnd: number;
  cogsVnd?: number;
  grossProfitVnd?: number;
  grossProfitMarginPercent?: number;
  quantity?: number;
  contractCount?: number;
}

export interface InventoryTurnoverLine {
  _id: string;
  sku: string;
  productName: string;
  category: string | null;
  quantitySold: number;
  cogsVnd?: number;
  inventoryValueVnd?: number;
  turnover?: number;
}

export interface DsoOverdueInvoice {
  _id: string;
  invoiceNumber: string;
  buyerName: string | null;
  dueDate: string | Date | null;
  overdueDays: number;
  openAmountVnd: number;
  status: string;
}

export interface DsoDrilldown {
  days: number;
  revenueVnd: number;
  openReceivableVnd: number;
  dsoDays: number;
  overdueInvoiceCount: number;
  overdueAmountVnd: number;
  topOverdueInvoices: DsoOverdueInvoice[];
}

export interface LogisticsRevenueLine {
  _id: string;
  shipmentNumber: string;
  buyerName: string | null;
  status: string;
  etd: string | Date | null;
  revenueVnd: number;
  logisticsCostVnd?: number;
  logisticsCostRatioPercent?: number;
}

export interface DashboardKpiDrilldown {
  range: {
    startDate: string;
    endDate: string;
    days: number;
  };
  grossMarginByMarket: MarginDrilldownLine[];
  grossMarginByProduct: MarginDrilldownLine[];
  dso: DsoDrilldown;
  inventoryTurnoverByProduct: InventoryTurnoverLine[];
  logisticsRevenue: {
    revenueVnd: number;
    logisticsCostVnd?: number;
    logisticsCostRatioPercent?: number;
    costBreakdown?: Array<{ name: string; value: number }>;
    shipments: LogisticsRevenueLine[];
  };
}

class DashboardService extends BaseApiService {
  constructor() {
    super('dashboards');
  }

  async getExecutiveData(startDate?: string, endDate?: string): Promise<IBackendRes<DashboardExecutiveData>> {
    return this.getExecutive(startDate, endDate);
  }

  async getExecutive(startDate?: string, endDate?: string): Promise<IBackendRes<DashboardExecutiveData>> {
    return this.getAuthenticatedDashboard<DashboardExecutiveData>('executive', startDate, endDate);
  }

  async getKpiDrilldown(startDate?: string, endDate?: string): Promise<IBackendRes<DashboardKpiDrilldown>> {
    return this.getAuthenticatedDashboard<DashboardKpiDrilldown>('kpi-drilldown', startDate, endDate);
  }

  private async getAuthenticatedDashboard<T>(
    path: 'executive' | 'kpi-drilldown',
    startDate?: string,
    endDate?: string,
  ): Promise<IBackendRes<T>> {
    const queryParams: Record<string, string> = {};
    if (startDate) queryParams.startDate = startDate;
    if (endDate) queryParams.endDate = endDate;

    return sendRequest<IBackendRes<T>>({
      url: `${this.baseUrl}/${path}`,
      method: 'GET',
      queryParams,
    });
  }
}

export const dashboardService = new DashboardService();
