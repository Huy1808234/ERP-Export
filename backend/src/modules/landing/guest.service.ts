import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment, ShipmentStatus } from '../shipments/entities/shipment.entity';
import { Partner } from '../partners/entities/partner.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { PurchaseOrder, PurchaseOrderStatus } from '../purchase-orders/entities/purchase-order.entity';
import { ProformaInvoice, PIStatus } from '../proforma-invoices/entities/proforma-invoice.entity';
import { SalesContract, SalesContractStatus } from '../sales-contracts/entities/sales-contract.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class GuestService {
  constructor(
    @InjectRepository(Shipment)
    private shipmentRepo: Repository<Shipment>,
    @InjectRepository(Partner)
    private partnerRepo: Repository<Partner>,
    @InjectRepository(Quotation)
    private quotationRepo: Repository<Quotation>,
    @InjectRepository(PurchaseOrder)
    private poRepo: Repository<PurchaseOrder>,
    @InjectRepository(ProformaInvoice)
    private piRepo: Repository<ProformaInvoice>,
    @InjectRepository(SalesContract)
    private scRepo: Repository<SalesContract>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
  ) {}

  async getSummary() {
    const [shipmentCount, inProgressShipments, completedShipments] = await Promise.all([
      this.shipmentRepo.count(),
      this.shipmentRepo.count({
        where: [
          { status: ShipmentStatus.BOOKED },
          { status: ShipmentStatus.LOADING },
          { status: ShipmentStatus.CUSTOMS_CLEARED },
          { status: ShipmentStatus.ON_BOARD },
        ],
      }),
      this.shipmentRepo.count({
        where: [
          { status: ShipmentStatus.ARRIVED },
          { status: ShipmentStatus.CLOSED },
        ],
      }),
    ]);

    const [partnerTotal, partnerActive] = await Promise.all([
      this.partnerRepo.count(),
      this.partnerRepo.count({ where: { isActive: true } }),
    ]);

    const quotationTotal = await this.quotationRepo.count();

    const [poTotal, poDraft] = await Promise.all([
      this.poRepo.count(),
      this.poRepo.count({ where: { status: PurchaseOrderStatus.DRAFT } }),
    ]);

    const [piTotal, scConfirmed] = await Promise.all([
      this.piRepo.count(),
      this.scRepo.count({ where: { status: SalesContractStatus.CONFIRMED } }), 
    ]);

    return {
      shipments: {
        total: shipmentCount,
        inProgress: inProgressShipments,
        completed: completedShipments,
        completionRate: shipmentCount > 0 ? Math.round((completedShipments / shipmentCount) * 100) : 0,
      },
      partners: {
        total: partnerTotal,
        active: partnerActive,
      },
      quotations: {
        total: quotationTotal,
      },
      purchaseOrders: {
        total: poTotal,
        draft: poDraft,
      },
      proformaInvoices: {
        total: piTotal,
        confirmed: scConfirmed,
        completionRate: piTotal > 0 ? Math.round((scConfirmed / piTotal) * 100) : 0,
      },
    };
  }

  async trackShipment(number: string) {
    const shipment = await this.shipmentRepo.findOne({
      where: { shipmentNumber: number },
      relations: ['salesContract', 'logisticsPartner', 'containers'],
    });

    if (!shipment) {
      return null;
    }

    // Only return safe public data
    return {
      shipmentNumber: shipment.shipmentNumber,
      status: shipment.status,
      pol: shipment.pol,
      pod: shipment.pod,
      etd: shipment.etd,
      eta: shipment.eta,
      vesselName: shipment.vesselName,
      voyageNumber: shipment.voyageNumber,
      bookingNumber: shipment.bookingNumber,
      logisticsPartner: shipment.logisticsPartner?.name,
      containers: shipment.containers?.map(c => ({
        containerNumber: c.containerNumber,
        sealNumber: c.sealNumber,
        type: c.type,
      })),
      updatedAt: shipment.updatedAt,
    };
  }

  async getFeaturedProducts() {
    try {
      const products = await this.productRepo.find({
        take: 6,
        order: { createdAt: 'DESC' },
      });

      if (products && products.length > 0) return products;
    } catch (error) {
      console.error("[GuestService] Error fetching products from DB:", error);
    }

    // Fallback mock data if DB is empty or error occurs
    return [
      {
        id: 'mock-1',
        vietnameseName: 'Gạo ST25 (Top 1 Thế giới)',
        englishName: 'ST25 Fragrant Rice',
        category: 'Nông sản',
        hsCode: '1006.30',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=800'
      },
      {
        id: 'mock-2',
        vietnameseName: 'Cà phê Robusta Đắk Lắk',
        englishName: 'Robusta Coffee Beans',
        category: 'Nông sản',
        hsCode: '0901.11',
        imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=800'
      },
      {
        id: 'mock-3',
        vietnameseName: 'Hạt Điều Bình Phước (Loại A)',
        englishName: 'Cashew Nuts Grade A',
        category: 'Nông sản',
        hsCode: '0801.32',
        imageUrl: 'https://images.unsplash.com/photo-1509911595703-f44a30e9d60d?auto=format&fit=crop&q=80&w=800'
      }
    ];
  }
}
