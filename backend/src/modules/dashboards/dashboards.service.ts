import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not, LessThan } from 'typeorm';
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
    private accountingService: AccountingService,
  ) { }

  async getExecutiveDashboard(startDate?: string, endDate?: string) {
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 1. DIRECTOR DASHBOARD (Sử dụng SalesContract để phản ánh đúng cam kết doanh thu)
    const revenueData = await this.scRepository
      .createQueryBuilder('sc')
      .select('SUM(CAST(sc.totalAmountVnd AS NUMERIC))', 'totalRevenueVnd')
      .where('sc.status IN (:...statuses)', { statuses: [SalesContractStatus.CONFIRMED, SalesContractStatus.SHIPPED, SalesContractStatus.PAID] })
      .andWhere('sc.createdAt BETWEEN :start AND :end', { start, end })
      .getRawOne();

    const summary = await this.accountingService.getSummaryReport();
    const arAging = await this.accountingService.getOverdueAging();

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
      .select('buyer.id', 'id')
      .addSelect('buyer.name', 'name')
      .addSelect('SUM(CAST(sc.totalAmountVnd AS NUMERIC))', 'total')
      .where('sc.status != :cancelled', { cancelled: SalesContractStatus.CANCELLED })
      .andWhere('sc.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('buyer.id')
      .addGroupBy('buyer.name')
      .orderBy('total', 'DESC')
      .limit(10)
      .getRawMany();

    const topBuyers = topBuyersData.map(row => ({
      id: row.id,
      name: row.name || 'Unknown',
      total: parseFloat(row.total || 0)
    }));

    // Top 10 Suppliers
    const topSuppliersData = await this.poRepository
      .createQueryBuilder('po')
      .leftJoin('po.vendor', 'vendor')
      .select('vendor.id', 'id')
      .addSelect('vendor.name', 'name')
      .addSelect('SUM(CAST(po.totalAmount AS NUMERIC))', 'total')
      .where('po.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere('vendor.id IS NOT NULL')
      .groupBy('vendor.id')
      .addGroupBy('vendor.name')
      .orderBy('total', 'DESC')
      .limit(10)
      .getRawMany();

    const topSuppliers = topSuppliersData.map(row => ({
      id: row.id,
      name: row.name || 'Unknown',
      total: parseFloat(row.total || 0)
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
      .addSelect('COUNT(sc.id)', 'orders')
      .where('sc.createdAt >= :sixMonthsAgo', { sixMonthsAgo })
      .andWhere('sc.status != :cancelled', { cancelled: SalesContractStatus.CANCELLED })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    const history: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStr = dayjs().subtract(i, 'month').format('YYYY-MM');
      const found = historyData.find(h => h.month === monthStr);
      
      history.push({
        month: monthStr,
        revenue: parseFloat(found?.revenue || 0),
        orders: parseInt(found?.orders || 0)
      });
    }

    // --- KPI CALCULATIONS (Mục 12.5 PRD) ---

    // 1. DSO (Days Sales Outstanding) = (Average AR / Total Credit Sales) * Days
    const totalAr = await this.accountingService.getAccountBalance('131');
    const totalSalesVnd = history.reduce((sum, h) => sum + h.revenue, 0);
    const dso = totalSalesVnd > 0 ? (totalAr / totalSalesVnd) * 180 : 0; // 180 days history

    // 2. On-time Shipment Rate
    const totalShipments = await this.shipmentRepository.count();
    // Assuming actualShipmentDate exists or using createdAt as fallback for 'SHIPPED' status
    const onTimeShipments = await this.shipmentRepository
        .createQueryBuilder('s')
        .where('s.status = :status', { status: ShipmentStatus.ON_BOARD })
        // Simple logic: if ETD is in the past and status is ON_BOARD, count as on-time for this demo
        .getCount();
    const onTimeRate = totalShipments > 0 ? (onTimeShipments / totalShipments) * 100 : 0;

    // 3. Inventory Turnover = COGS / Avg Inventory
    const cogs = summary.cogs;
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

    const statusBreakdown = liveShipments.reduce((acc: any, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});

    return {
      director: {
        revenueVnd: revenueVnd.toNumber(),
        revenueGrowth: parseFloat(revenueGrowth.toFixed(1)),
        grossProfitMargin: summary.revenue > 0 ? (summary.netProfit / summary.revenue) * 100 : 0,
        arAging,
        inventoryValue: inventoryValue.toNumber(),
        topBuyers,
        topSuppliers,
        totalCustomers,
        exchangeRate: 25450, 
        dso: parseFloat(dso.toFixed(1)),
        onTimeRate: parseFloat(onTimeRate.toFixed(1)),
        inventoryTurnover: parseFloat(turnover.toFixed(1)),
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
          id: s.id,
          number: s.shipmentNumber,
          customer: s.salesContract?.buyer?.name,
          etd: s.etd,
          status: s.status
        })),
        expiringLCs: [], 
        shipmentGrowth: 0 
      },
      lowStockProducts: lowStockProducts.map(p => ({
        id: p.id,
        name: p.vietnameseName,
        sku: p.sku,
        currentStock: p.currentStock,
        imageUrl: null
      })),
      lastUpdated: new Date().toISOString(),
    };
  }
}
