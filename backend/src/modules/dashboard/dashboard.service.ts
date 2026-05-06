import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ProformaInvoice, PIStatus } from '../proforma-invoices/entities/proforma-invoice.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { Partner, PartnerType } from '../partners/entities/partner.entity';
import { Product } from '../products/entities/product.entity';
import { Shipment, ShipmentStatus } from '../shipments/entities/shipment.entity';
import { Decimal } from 'decimal.js';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(ProformaInvoice)
    private piRepository: Repository<ProformaInvoice>,
    @InjectRepository(PurchaseOrder)
    private poRepository: Repository<PurchaseOrder>,
    @InjectRepository(Partner)
    private partnerRepository: Repository<Partner>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Shipment)
    private shipmentRepository: Repository<Shipment>,
  ) {}

  async getStats() {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 1. Tổng PI (Doanh thu dự kiến/thực tế)
    const [piList, piCount] = await this.piRepository.findAndCount({
      where: { createdAt: Between(firstDayOfMonth, lastDayOfMonth) }
    });

    let totalRevenueVnd = new Decimal(0);
    for (const pi of piList) {
        if (pi.status !== PIStatus.CANCELLED) {
            // Sử dụng exchangeRate đã chốt (Snapshot) để tính doanh thu VND
            const amountVnd = new Decimal(pi.totalAmount).times(new Decimal(pi.exchangeRate || 1));
            totalRevenueVnd = totalRevenueVnd.plus(amountVnd);
        }
    }

    // 2. Tổng PO (Chi phí thu mua)
    const poCount = await this.poRepository.count({
      where: { createdAt: Between(firstDayOfMonth, lastDayOfMonth) }
    });

    // 3. Đối tác chiến lược
    const customerCount = await this.partnerRepository.count({ where: { partnerType: PartnerType.CUSTOMER } });
    const supplierCount = await this.partnerRepository.count({ where: { partnerType: PartnerType.SUPPLIER } });

    // 4. Trạng thái vận đơn (Live)
    const shipments = await this.shipmentRepository.find();
    const shipmentStats = {
      booking: shipments.filter(s => s.status === ShipmentStatus.BOOKED).length,
      loading: shipments.filter(s => s.status === ShipmentStatus.LOADING).length,
      at_port: shipments.filter(s => s.status === ShipmentStatus.ARRIVED).length,
      on_board: shipments.filter(s => s.status === ShipmentStatus.ON_BOARD).length,
    };

    // 5. Biến động doanh thu 6 tháng gần nhất (Mock data logic for chart)
    const chartData = await this.getMonthlyRevenue();

    return {
      kpis: {
        totalPi: piCount,
        totalPo: poCount,
        activeShipments: shipments.filter(s => s.status !== ShipmentStatus.CLOSED).length,
        totalPartners: customerCount + supplierCount,
        revenueVnd: totalRevenueVnd.toNumber(),
      },
      shipmentStats,
      chartData,
    };
  }

  private async getMonthlyRevenue() {
    // Logic thực tế sẽ Group By Month, ở đây tôi demo cấu trúc cho Chart
    return [
      { month: 'Tháng 1', revenue: 4000, orders: 24 },
      { month: 'Tháng 2', revenue: 3000, orders: 18 },
      { month: 'Tháng 3', revenue: 5000, orders: 35 },
      { month: 'Tháng 4', revenue: 2780, orders: 22 },
      { month: 'Tháng 5', revenue: 1890, orders: 15 },
      { month: 'Tháng 6', revenue: 2390, orders: 20 },
    ];
  }
}
