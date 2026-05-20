import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Not, LessThan } from 'typeorm';
import dayjs from 'dayjs';
import { ProformaInvoice, PIStatus } from '../proforma-invoices/entities/proforma-invoice.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { Partner, PartnerType } from '../partners/entities/partner.entity';
import { Product } from '../products/entities/product.entity';
import { Shipment, ShipmentStatus } from '../shipments/entities/shipment.entity';
import { LetterOfCredit, LCStatus } from '../trade-finance/entities/letter-of-credit.entity';
import { AccountingService } from '../accounting/accounting.service';
import { SalesContract, SalesContractStatus } from '../sales-contracts/entities/sales-contract.entity';
import { Decimal } from 'decimal.js';
import { AccountReceivable, ARStatus } from '../account-receivables/entities/account-receivable.entity';
import { AccountPayable, APStatus } from '../account-payables/entities/account-payable.entity';
import { maskCostFields } from '@/common/field-access.util';
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type';

type DashboardUser = AuthenticatedUser | undefined;
type PortalDashboardUser = (AuthenticatedUser & { membershipLevel?: string }) | undefined;

interface DashboardDateRange {
  start: Date;
  end: Date;
  days: number;
}

interface RawProductMarginRow {
  _id: string | null;
  sku: string | null;
  productName: string | null;
  category: string | null;
  quantity: string | number | null;
  revenueVnd: string | number | null;
  cogsVnd: string | number | null;
  currentStock: string | number | null;
  purchasePriceVnd: string | number | null;
}

interface RawMarketMarginRow {
  market: string | null;
  revenueVnd: string | number | null;
  cogsVnd: string | number | null;
  contractCount: string | number | null;
}

interface RawPartnerTotalRow {
  _id: string | null;
  name: string | null;
  total: string | number | null;
}

interface RawHistoryRow {
  month: string;
  revenue: string | number | null;
  orders: string | number | null;
}

interface DashboardHistoryLine {
  month: string;
  revenue: number;
  orders: number;
  profit?: number;
}

interface AccountingTrendLine {
  month: string;
  netProfit?: number;
}

interface MarginDrilldownLine {
  key: string;
  label: string;
  revenueVnd: number;
  cogsVnd?: number;
  grossProfitVnd?: number;
  grossProfitMarginPercent?: number;
  quantity?: number;
  contractCount?: number;
}

interface InventoryTurnoverLine {
  _id: string;
  sku: string;
  productName: string;
  category: string | null;
  quantitySold: number;
  cogsVnd?: number;
  inventoryValueVnd?: number;
  turnover?: number;
}

interface DsoOverdueInvoice {
  _id: string;
  invoiceNumber: string;
  buyerName: string | null;
  dueDate: Date | null;
  overdueDays: number;
  openAmountVnd: number;
  status: ARStatus;
}

interface DsoDrilldown {
  days: number;
  revenueVnd: number;
  openReceivableVnd: number;
  dsoDays: number;
  overdueInvoiceCount: number;
  overdueAmountVnd: number;
  topOverdueInvoices: DsoOverdueInvoice[];
}

interface LogisticsRevenueLine {
  _id: string;
  shipmentNumber: string;
  buyerName: string | null;
  status: ShipmentStatus;
  etd: Date | null;
  revenueVnd: number;
  logisticsCostVnd?: number;
  logisticsCostRatioPercent?: number;
}

interface DashboardKpiDrilldown {
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

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(ProformaInvoice)
    private piRepository: Repository<ProformaInvoice>,
    @InjectRepository(SalesContract)
    private scRepository: Repository<SalesContract>,
    @InjectRepository(PurchaseOrder)
    private poRepository: Repository<PurchaseOrder>,
    @InjectRepository(Partner)
    private partnerRepository: Repository<Partner>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Shipment)
    private shipmentRepository: Repository<Shipment>,
    @InjectRepository(LetterOfCredit)
    private lcRepository: Repository<LetterOfCredit>,
    @InjectRepository(AccountReceivable)
    private arRepository: Repository<AccountReceivable>,
    @InjectRepository(AccountPayable)
    private apRepository: Repository<AccountPayable>,
    private accountingService: AccountingService,
  ) { }

  async getAdminDashboard(startDate?: string, endDate?: string, user?: DashboardUser) {
    const executive = await this.getExecutiveDashboard(startDate, endDate, user);
    const exchangeRate = executive.director.exchangeRate || 25450;
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const summary = await this.accountingService.getSummaryReport({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
    const trend = await this.accountingService.getTrendReport({
      startDate: dayjs().subtract(5, 'month').startOf('month').toISOString(),
      endDate: new Date().toISOString(),
    }) as AccountingTrendLine[];
    const trendByMonth = new Map(trend.map((item) => [item.month, item]));

    const history = executive.director.history.map((item) => {
      const accountingMonth = trendByMonth.get(item.month);
      return {
        ...item,
        profit: accountingMonth?.netProfit ?? 0,
      };
    });

    return maskCostFields({
      ...executive,
      finance: {
        totalRevenueVnd: executive.director.revenueVnd,
        grossProfitVnd: summary.current.netProfit,
        totalArVnd: await this.accountingService.getAccountBalance('131'),
        dso: executive.director.dso,
        onTimeRate: executive.director.onTimeRate,
        inventoryTurnover: executive.director.inventoryTurnover,
        exchangeRate,
        history,
        logisticsCostBreakdown: await this.getLogisticsCostBreakdown(start, end, exchangeRate),
      },
    }, user);
  }

  private resolveDateRange(startDate?: string, endDate?: string): DashboardDateRange {
    const now = new Date();
    const start = startDate ? dayjs(startDate).startOf('day').toDate() : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? dayjs(endDate).endOf('day').toDate() : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const days = Math.max(dayjs(end).diff(dayjs(start), 'day') + 1, 1);

    return { start, end, days };
  }

  private toVnd(amount: number | null | undefined, currency: string | null | undefined, exchangeRate: number): number {
    const value = Number(amount || 0);
    return (currency || 'VND').toUpperCase() === 'VND' ? value : value * exchangeRate;
  }

  private parseNumber(value: string | number | null | undefined): number {
    return Number(value || 0);
  }

  private buildMarginLine(key: string, label: string, revenueVnd: number, cogsVnd: number): MarginDrilldownLine {
    const grossProfitVnd = revenueVnd - cogsVnd;
    const grossProfitMarginPercent = revenueVnd > 0 ? (grossProfitVnd / revenueVnd) * 100 : 0;

    return {
      key,
      label,
      revenueVnd,
      cogsVnd,
      grossProfitVnd,
      grossProfitMarginPercent: Number(grossProfitMarginPercent.toFixed(2)),
    };
  }

  private async getLogisticsCostBreakdown(start: Date, end: Date, exchangeRate: number) {
    const shipments = await this.shipmentRepository.find({
      where: { createdAt: Between(start, end) },
      select: {
        _id: true,
        freightCost: true,
        freightCurrency: true,
        insuranceCost: true,
        insuranceCurrency: true,
        truckingCostVnd: true,
        localChargesVnd: true,
        customsFeeVnd: true,
      },
    });

    const totals = shipments.reduce(
      (acc, shipment) => {
        acc.seaFreight += this.toVnd(shipment.freightCost, shipment.freightCurrency, exchangeRate);
        acc.insurance += this.toVnd(shipment.insuranceCost, shipment.insuranceCurrency, exchangeRate);
        acc.trucking += Number(shipment.truckingCostVnd || 0);
        acc.localCharges += Number(shipment.localChargesVnd || 0);
        acc.customs += Number(shipment.customsFeeVnd || 0);
        return acc;
      },
      { seaFreight: 0, trucking: 0, localCharges: 0, insurance: 0, customs: 0 },
    );

    return [
      { name: 'Sea Freight', value: totals.seaFreight },
      { name: 'Domestic Trucking', value: totals.trucking },
      { name: 'Local Charges', value: totals.localCharges },
      { name: 'Insurance', value: totals.insurance },
      { name: 'Customs Fee', value: totals.customs },
    ].filter((item) => item.value > 0);
  }

  async getKpiDrilldown(startDate?: string, endDate?: string, user?: DashboardUser): Promise<DashboardKpiDrilldown> {
    const { start, end, days } = this.resolveDateRange(startDate, endDate);
    const exchangeRate = 25450;

    const productRows = await this.scRepository
      .createQueryBuilder('sc')
      .innerJoin('sc.items', 'item')
      .innerJoin('item.product', 'product')
      .select('product._id', '_id')
      .addSelect('product.sku', 'sku')
      .addSelect('COALESCE(product.vietnameseName, product.englishName, product.sku)', 'productName')
      .addSelect('COALESCE(product.category, :uncategorized)', 'category')
      .addSelect('SUM(CAST(item.quantity AS NUMERIC))', 'quantity')
      .addSelect('SUM(CAST(item.totalPrice AS NUMERIC) * CAST(COALESCE(sc.exchangeRate, 1) AS NUMERIC))', 'revenueVnd')
      .addSelect('SUM(CAST(item.quantity AS NUMERIC) * CAST(COALESCE(product.purchasePriceVnd, 0) AS NUMERIC))', 'cogsVnd')
      .addSelect('MAX(CAST(COALESCE(product.currentStock, 0) AS NUMERIC))', 'currentStock')
      .addSelect('MAX(CAST(COALESCE(product.purchasePriceVnd, 0) AS NUMERIC))', 'purchasePriceVnd')
      .where('sc.status != :cancelled', { cancelled: SalesContractStatus.CANCELLED })
      .andWhere('sc.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('product._id')
      .addGroupBy('product.sku')
      .addGroupBy('product.vietnameseName')
      .addGroupBy('product.englishName')
      .addGroupBy('product.category')
      .setParameter('uncategorized', 'Uncategorized')
      .orderBy('"revenueVnd"', 'DESC')
      .limit(20)
      .getRawMany<RawProductMarginRow>();

    const marketRows = await this.scRepository
      .createQueryBuilder('sc')
      .innerJoin('sc.items', 'item')
      .innerJoin('item.product', 'product')
      .leftJoin('sc.buyer', 'buyer')
      .select("COALESCE(NULLIF(buyer.region::text, ''), NULLIF(buyer.country, ''), :unknownMarket)", 'market')
      .addSelect('SUM(CAST(item.totalPrice AS NUMERIC) * CAST(COALESCE(sc.exchangeRate, 1) AS NUMERIC))', 'revenueVnd')
      .addSelect('SUM(CAST(item.quantity AS NUMERIC) * CAST(COALESCE(product.purchasePriceVnd, 0) AS NUMERIC))', 'cogsVnd')
      .addSelect('COUNT(DISTINCT sc._id)', 'contractCount')
      .where('sc.status != :cancelled', { cancelled: SalesContractStatus.CANCELLED })
      .andWhere('sc.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('market')
      .setParameter('unknownMarket', 'Unknown market')
      .orderBy('"revenueVnd"', 'DESC')
      .getRawMany<RawMarketMarginRow>();

    const revenueData = await this.scRepository
      .createQueryBuilder('sc')
      .select('SUM(CAST(sc.totalAmountVnd AS NUMERIC))', 'totalRevenueVnd')
      .where('sc.status != :cancelled', { cancelled: SalesContractStatus.CANCELLED })
      .andWhere('sc.createdAt BETWEEN :start AND :end', { start, end })
      .getRawOne<{ totalRevenueVnd: string | number | null }>();

    const totalRevenueVnd = this.parseNumber(revenueData?.totalRevenueVnd);
    const openReceivableVnd = await this.accountingService.getAccountBalance('131');
    const today = dayjs().startOf('day').toDate();
    const arOpenStatuses = [ARStatus.UNPAID, ARStatus.PARTIAL, ARStatus.OVERDUE];

    const overdueSummary = await this.arRepository
      .createQueryBuilder('ar')
      .select('COUNT(ar._id)', 'invoiceCount')
      .addSelect('SUM(GREATEST(CAST(ar.amountVnd AS NUMERIC) - CAST(ar.paidAmountVnd AS NUMERIC), 0))', 'amountVnd')
      .where('ar.status IN (:...statuses)', { statuses: arOpenStatuses })
      .andWhere('ar.dueDate < :today', { today })
      .getRawOne<{ invoiceCount: string | number | null; amountVnd: string | number | null }>();

    const overdueInvoices = await this.arRepository.find({
      where: {
        dueDate: LessThan(today),
        status: In(arOpenStatuses),
      },
      relations: ['buyer'],
      order: { dueDate: 'ASC' },
      take: 8,
    });

    const grossMarginByProduct = productRows.map((row) => {
      const line = this.buildMarginLine(
        row._id || row.sku || 'unknown-product',
        row.productName || row.sku || 'Unknown product',
        this.parseNumber(row.revenueVnd),
        this.parseNumber(row.cogsVnd),
      );

      return {
        ...line,
        quantity: this.parseNumber(row.quantity),
      };
    });

    const grossMarginByMarket = marketRows.map((row) => ({
      ...this.buildMarginLine(
        row.market || 'Unknown market',
        row.market || 'Unknown market',
        this.parseNumber(row.revenueVnd),
        this.parseNumber(row.cogsVnd),
      ),
      contractCount: this.parseNumber(row.contractCount),
    }));

    const inventoryTurnoverByProduct = productRows
      .map<InventoryTurnoverLine>((row) => {
        const cogsVnd = this.parseNumber(row.cogsVnd);
        const inventoryValueVnd = this.parseNumber(row.currentStock) * this.parseNumber(row.purchasePriceVnd);
        const turnover = inventoryValueVnd > 0 ? cogsVnd / inventoryValueVnd : 0;

        return {
          _id: row._id || row.sku || 'unknown-product',
          sku: row.sku || '',
          productName: row.productName || row.sku || 'Unknown product',
          category: row.category,
          quantitySold: this.parseNumber(row.quantity),
          cogsVnd,
          inventoryValueVnd,
          turnover: Number(turnover.toFixed(2)),
        };
      })
      .sort((left, right) => (right.turnover || 0) - (left.turnover || 0))
      .slice(0, 10);

    const costBreakdown = await this.getLogisticsCostBreakdown(start, end, exchangeRate);
    const logisticsCostVnd = costBreakdown.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const logisticsCostRatioPercent = totalRevenueVnd > 0 ? (logisticsCostVnd / totalRevenueVnd) * 100 : 0;
    const shipments = await this.shipmentRepository.find({
      where: { createdAt: Between(start, end) },
      relations: ['salesContract', 'salesContract.buyer'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const dashboard: DashboardKpiDrilldown = {
      range: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        days,
      },
      grossMarginByMarket,
      grossMarginByProduct,
      dso: {
        days,
        revenueVnd: totalRevenueVnd,
        openReceivableVnd,
        dsoDays: totalRevenueVnd > 0 ? Number(((openReceivableVnd / totalRevenueVnd) * days).toFixed(1)) : 0,
        overdueInvoiceCount: this.parseNumber(overdueSummary?.invoiceCount),
        overdueAmountVnd: this.parseNumber(overdueSummary?.amountVnd),
        topOverdueInvoices: overdueInvoices.map((item) => ({
          _id: item._id,
          invoiceNumber: item.invoiceNumber,
          buyerName: item.buyer?.name || null,
          dueDate: item.dueDate,
          overdueDays: item.dueDate ? Math.max(dayjs(today).diff(dayjs(item.dueDate), 'day'), 0) : 0,
          openAmountVnd: Math.max(Number(item.amountVnd || 0) - Number(item.paidAmountVnd || 0), 0),
          status: item.status,
        })),
      },
      inventoryTurnoverByProduct,
      logisticsRevenue: {
        revenueVnd: totalRevenueVnd,
        logisticsCostVnd,
        logisticsCostRatioPercent: Number(logisticsCostRatioPercent.toFixed(2)),
        costBreakdown,
        shipments: shipments.map((shipment) => {
          const shipmentCostVnd =
            this.toVnd(shipment.freightCost, shipment.freightCurrency, exchangeRate) +
            this.toVnd(shipment.insuranceCost, shipment.insuranceCurrency, exchangeRate) +
            Number(shipment.truckingCostVnd || 0) +
            Number(shipment.localChargesVnd || 0) +
            Number(shipment.customsFeeVnd || 0);
          const shipmentRevenueVnd = Number(shipment.salesContract?.totalAmountVnd || 0);

          return {
            _id: shipment._id,
            shipmentNumber: shipment.shipmentNumber,
            buyerName: shipment.salesContract?.buyer?.name || null,
            status: shipment.status,
            etd: shipment.etd || null,
            revenueVnd: shipmentRevenueVnd,
            logisticsCostVnd: shipmentCostVnd,
            logisticsCostRatioPercent: shipmentRevenueVnd > 0
              ? Number(((shipmentCostVnd / shipmentRevenueVnd) * 100).toFixed(2))
              : 0,
          };
        }),
      },
    };

    return maskCostFields(dashboard, user, [
      'cogsVnd',
      'grossProfitVnd',
      'grossProfitMarginPercent',
      'inventoryValueVnd',
      'turnover',
      'logisticsCostVnd',
      'logisticsCostRatioPercent',
      'costBreakdown',
    ]);
  }

  async getExecutiveDashboard(startDate?: string, endDate?: string, user?: DashboardUser) {
    const { start, end } = this.resolveDateRange(startDate, endDate);

    // 1. DIRECTOR DASHBOARD (Sử dụng SalesContract để phản ánh đúng cam kết doanh thu)
    const revenueData = await this.scRepository
      .createQueryBuilder('sc')
      .select('SUM(CAST(sc.totalAmountVnd AS NUMERIC))', 'totalRevenueVnd')
      .where('sc.status IN (:...statuses)', { statuses: [SalesContractStatus.CONFIRMED, SalesContractStatus.SHIPPED, SalesContractStatus.PAID] })
      .andWhere('sc.createdAt BETWEEN :start AND :end', { start, end })
      .getRawOne();

    const summary = await this.accountingService.getSummaryReport();
    const arAging = await this.accountingService.getARAging();

    const inventoryData = await this.productRepository
      .createQueryBuilder('product')
      .select('SUM(CAST(product.currentStock AS NUMERIC) * CAST(COALESCE(product.purchasePriceVnd, 0) AS NUMERIC))', 'totalValue')
      .getRawOne();

    const revenueVnd = new Decimal(revenueData?.totalRevenueVnd || 0);
    const inventoryValue = new Decimal(inventoryData?.totalValue || 0);

    // 2. SALES EXPORT DASHBOARD (Mục 12.2 PRD)
    const salesStats = {
      totalPIs: await this.piRepository.count(),
      confirmedContracts: await this.scRepository.count({ where: { status: SalesContractStatus.CONFIRMED } }),
      shippedPIs: await this.scRepository.count({ where: { status: SalesContractStatus.SHIPPED } }),
      pendingShipments: await this.scRepository.count({ where: { status: SalesContractStatus.CONFIRMED } }), // Đã chốt nhưng chưa ship
      conversionRate: 0 
    };
    if (salesStats.totalPIs > 0) salesStats.conversionRate = (salesStats.confirmedContracts / salesStats.totalPIs) * 100;

    // 3. LOGISTICS DASHBOARD
    const next14Days = new Date();
    next14Days.setDate(next14Days.getDate() + 14);
    const upcomingShipments = await this.shipmentRepository.find({
      where: [
        { etd: Between(new Date(), next14Days), status: Not(ShipmentStatus.CLOSED) },
        { eta: Between(new Date(), next14Days), status: Not(ShipmentStatus.CLOSED) },
        { status: ShipmentStatus.ON_BOARD } 
      ],
      relations: ['salesContract', 'salesContract.buyer'],
      order: { etd: 'ASC', eta: 'ASC' },
      take: 10
    });

    // Top 10 Buyers (Dựa trên Hợp đồng thực tế)
    const topBuyersData = await this.scRepository
      .createQueryBuilder('sc')
      .leftJoin('sc.buyer', 'buyer')
      .select('buyer._id', '_id')
      .addSelect('buyer.name', 'name')
      .addSelect('SUM(CAST(sc.totalAmountVnd AS NUMERIC))', 'total')
      .where('sc.status != :cancelled', { cancelled: SalesContractStatus.CANCELLED })
      .andWhere('sc.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('buyer._id')
      .addGroupBy('buyer.name')
      .orderBy('total', 'DESC')
      .limit(10)
      .getRawMany<RawPartnerTotalRow>();

    const topBuyers = topBuyersData.map(row => ({
      _id: row._id,
      name: row.name || 'Unknown',
      total: this.parseNumber(row.total)
    }));

    // Top 10 Suppliers
    const topSuppliersData = await this.poRepository
      .createQueryBuilder('po')
      .leftJoin('po.vendor', 'vendor')
      .select('vendor._id', '_id')
      .addSelect('vendor.name', 'name')
      .addSelect('SUM(CAST(po.totalAmount AS NUMERIC))', 'total')
      .where('po.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere('vendor._id IS NOT NULL')
      .groupBy('vendor._id')
      .addGroupBy('vendor.name')
      .orderBy('total', 'DESC')
      .limit(10)
      .getRawMany<RawPartnerTotalRow>();

    const topSuppliers = topSuppliersData.map(row => ({
      _id: row._id,
      name: row.name || 'Unknown',
      total: this.parseNumber(row.total)
    }));

    const lowStockProducts = await this.productRepository.find({
      where: { currentStock: LessThan(100), isActive: true },
      order: { currentStock: 'ASC' },
      take: 5
    });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const historyData = await this.scRepository
      .createQueryBuilder('sc')
      .select("TO_CHAR(sc.createdAt, 'YYYY-MM')", 'month')
      .addSelect('SUM(CAST(sc.totalAmountVnd AS NUMERIC))', 'revenue')
      .addSelect('COUNT(sc._id)', 'orders')
      .where('sc.createdAt >= :sixMonthsAgo', { sixMonthsAgo })
      .andWhere('sc.status != :cancelled', { cancelled: SalesContractStatus.CANCELLED })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany<RawHistoryRow>();

    const history: DashboardHistoryLine[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStr = dayjs().subtract(i, 'month').format('YYYY-MM');
      const found = historyData.find(h => h.month === monthStr);
      
      history.push({
        month: monthStr,
        revenue: this.parseNumber(found?.revenue),
        orders: this.parseNumber(found?.orders)
      });
    }

    // --- KPI CALCULATIONS (Mục 12.5 PRD) ---

    // 1. DSO (Days Sales Outstanding) = (Average AR / Total Credit Sales) * Days
    const totalAr = await this.accountingService.getAccountBalance('131');
    const totalSalesVnd = history.reduce((sum, h) => sum + h.revenue, 0);
    const dso = totalSalesVnd > 0 ? (totalAr / totalSalesVnd) * 180 : 0; // 180 days history

    // 2. On-time Shipment Rate
    const completedShipmentRows = await this.shipmentRepository.find({
      where: {
        status: In([ShipmentStatus.ON_BOARD, ShipmentStatus.ARRIVED, ShipmentStatus.CLOSED]),
      },
      select: {
        _id: true,
        etd: true,
        stockIssuedAt: true,
        updatedAt: true,
      },
    });
    const shipmentRowsWithEtd = completedShipmentRows.filter((shipment) => shipment.etd);
    const onTimeShipments = shipmentRowsWithEtd.filter((shipment) => {
      const actualMilestone = shipment.stockIssuedAt || shipment.updatedAt;
      return actualMilestone && shipment.etd && new Date(actualMilestone) <= new Date(shipment.etd);
    }).length;
    const onTimeRate = shipmentRowsWithEtd.length > 0 ? (onTimeShipments / shipmentRowsWithEtd.length) * 100 : 0;

    // 3. Inventory Turnover = COGS / Avg Inventory
    const cogs = summary.current.cogs;
    const invValue = inventoryValue.toNumber();
    const turnover = invValue > 0 ? cogs / invValue : 0;

    const prevStart = new Date(start);
    prevStart.setMonth(prevStart.getMonth() - 1);
    const prevEnd = new Date(end);
    prevEnd.setMonth(prevEnd.getMonth() - 1);

    const prevRevenueData = await this.scRepository
      .createQueryBuilder('sc')
      .select('SUM(CAST(sc.totalAmountVnd AS NUMERIC))', 'totalRevenueVnd')
      .where('sc.status != :cancelled', { cancelled: SalesContractStatus.CANCELLED })
      .andWhere('sc.createdAt BETWEEN :start AND :end', { start: prevStart, end: prevEnd })
      .getRawOne();
    
    const prevRevenue = new Decimal(prevRevenueData?.totalRevenueVnd || 0);
    const revenueGrowth = prevRevenue.gt(0) 
      ? revenueVnd.minus(prevRevenue).div(prevRevenue).mul(100).toNumber()
      : 0;

    const totalCustomers = await this.partnerRepository.count({ where: { partnerType: PartnerType.CUSTOMER } });

    // KPI Vận đơn thực tế (Mục 12.5 PRD)
    const activeShipmentsCount = await this.shipmentRepository.count({
      where: { status: Not(ShipmentStatus.CLOSED) }
    });

    const liveShipments = await this.shipmentRepository.find({
      where: { status: Not(ShipmentStatus.CLOSED) }
    });

    const statusBreakdown = liveShipments.reduce<Partial<Record<ShipmentStatus, number>>>((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});

    const exchangeRate = 25450;
    const logisticsCostVnd = await this.getLogisticsCostTotal(start, end, exchangeRate);
    const logisticsCostRatio = revenueVnd.gt(0)
      ? new Decimal(logisticsCostVnd).div(revenueVnd).mul(100).toNumber()
      : 0;
    const cashflowForecast = await this.getCashflowForecast(exchangeRate);
    const expiringLCs = await this.getExpiringLCs();

    const dashboard = {
      director: {
        revenueVnd: revenueVnd.toNumber(),
        revenueGrowth: parseFloat(revenueGrowth.toFixed(1)),
        grossProfitMargin: summary.current.revenue > 0 ? (summary.current.netProfit / summary.current.revenue) * 100 : 0,
        arAging,
        inventoryValue: inventoryValue.toNumber(),
        topBuyers,
        topSuppliers,
        totalCustomers,
        exchangeRate,
        dso: parseFloat(dso.toFixed(1)),
        onTimeRate: parseFloat(onTimeRate.toFixed(1)),
        inventoryTurnover: parseFloat(turnover.toFixed(1)),
        logisticsCostRatio: parseFloat(logisticsCostRatio.toFixed(2)),
        cashflowForecast,
        history
      },
      sales: {
        ...salesStats,
        activeShipments: activeShipmentsCount,
        poGrowth: 0 
      },
      logistics: {
        statusBreakdown,
        upcomingShipments: upcomingShipments.map(s => ({
          _id: s._id,
          number: s.shipmentNumber,
          customer: s.salesContract?.buyer?.name,
          etd: s.etd,
          status: s.status
        })),
        expiringLCs, 
        shipmentGrowth: 0 
      },
      lowStockProducts: lowStockProducts.map(p => ({
        _id: p._id,
        name: p.vietnameseName,
        sku: p.sku,
        currentStock: p.currentStock,
        imageUrl: null
      })),
      lastUpdated: new Date().toISOString(),
    };

    return maskCostFields(dashboard, user);
  }

  private async getLogisticsCostTotal(start: Date, end: Date, exchangeRate: number) {
    const breakdown = await this.getLogisticsCostBreakdown(start, end, exchangeRate);
    return breakdown.reduce((sum, item) => sum + Number(item.value || 0), 0);
  }

  private async getCashflowForecast(exchangeRate: number) {
    const today = dayjs().startOf('day').toDate();
    const in30Days = dayjs().add(30, 'day').endOf('day').toDate();

    const [receivables, payables] = await Promise.all([
      this.arRepository.find({
        where: {
          dueDate: Between(today, in30Days),
          status: In([ARStatus.UNPAID, ARStatus.PARTIAL, ARStatus.OVERDUE]),
        },
        relations: ['buyer'],
        take: 8,
        order: { dueDate: 'ASC' },
      }),
      this.apRepository.find({
        where: {
          dueDate: Between(today, in30Days),
          status: In([APStatus.UNPAID, APStatus.PARTIAL]),
        },
        relations: ['vendor'],
        take: 8,
        order: { dueDate: 'ASC' },
      }),
    ]);

    const inflowVnd = receivables.reduce((sum, item) => (
      sum + Math.max(Number(item.amountVnd || 0) - Number(item.paidAmountVnd || 0), 0)
    ), 0);
    const outflowVnd = payables.reduce((sum, item) => {
      const remaining = Math.max(Number(item.amount || 0) - Number(item.paidAmount || 0), 0);
      return sum + ((item.currency || 'VND').toUpperCase() === 'VND' ? remaining : remaining * exchangeRate);
    }, 0);

    return {
      horizonDays: 30,
      inflowVnd,
      outflowVnd,
      netVnd: inflowVnd - outflowVnd,
      receivables: receivables.map((item) => ({
        _id: item._id,
        invoiceNumber: item.invoiceNumber,
        partnerName: item.buyer?.name,
        dueDate: item.dueDate,
        amountVnd: Math.max(Number(item.amountVnd || 0) - Number(item.paidAmountVnd || 0), 0),
      })),
      payables: payables.map((item) => ({
        _id: item._id,
        invoiceNumber: item.invoiceNumber,
        partnerName: item.vendor?.name,
        dueDate: item.dueDate,
        amountVnd: (item.currency || 'VND').toUpperCase() === 'VND'
          ? Math.max(Number(item.amount || 0) - Number(item.paidAmount || 0), 0)
          : Math.max(Number(item.amount || 0) - Number(item.paidAmount || 0), 0) * exchangeRate,
      })),
    };
  }

  private async getExpiringLCs() {
    const today = dayjs().startOf('day').toDate();
    const next14Days = dayjs().add(14, 'day').endOf('day').toDate();

    const lcs = await this.lcRepository.find({
      where: [
        { status: In([LCStatus.RECEIVED, LCStatus.DOCUMENTS_PRESENTED, LCStatus.ACCEPTED]), expiryDate: Between(today, next14Days) },
        { status: In([LCStatus.RECEIVED, LCStatus.DOCUMENTS_PRESENTED, LCStatus.ACCEPTED]), latestShipmentDate: Between(today, next14Days) },
        { status: In([LCStatus.RECEIVED, LCStatus.DOCUMENTS_PRESENTED, LCStatus.ACCEPTED]), presentationDeadline: Between(today, next14Days) },
      ],
      relations: ['salesContract', 'salesContract.buyer'],
      order: { expiryDate: 'ASC' },
      take: 8,
    });

    return lcs.map((lc) => ({
      _id: lc._id,
      lcNumber: lc.lcNumber,
      buyerName: lc.salesContract?.buyer?.name,
      expiryDate: lc.expiryDate,
      latestShipmentDate: lc.latestShipmentDate,
      presentationDeadline: lc.presentationDeadline,
      amount: lc.amount,
      currency: lc.currency,
      status: lc.status,
    }));
  }
  async getPortalSummary(user: PortalDashboardUser) {
    if (!user || !user.partnerId) {
      return {
        pendingOrders: 0,
        shippedOrders: 0,
        totalDebt: 0,
        recentOrders: [],
        membershipLevel: user?.membershipLevel || 'BRONZE'
      };
    }

    const partnerId = user.partnerId;

    // 1. Count Orders
    const pendingOrders = await this.scRepository.count({
      where: { buyerId: partnerId, status: SalesContractStatus.CONFIRMED }
    });

    const shippedOrders = await this.scRepository.count({
      where: { buyerId: partnerId, status: SalesContractStatus.SHIPPED }
    });

    // 2. Calculate Total Debt (Account balance for this partner)
    const totalDebt = await this.accountingService.getAccountBalanceForPartner('131', partnerId);

    // 3. Recent Orders
    const recentOrders = await this.scRepository.find({
      where: { buyerId: partnerId },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
      take: 5
    });

    return {
      pendingOrders,
      shippedOrders,
      totalDebt,
      recentOrders,
      membershipLevel: user.membershipLevel || 'BRONZE'
    };
  }
}
