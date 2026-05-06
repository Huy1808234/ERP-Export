import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment, ShipmentStatus } from '../shipments/entities/shipment.entity';
import { Partner } from '../partners/entities/partner.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { PurchaseOrder, PurchaseOrderStatus } from '../purchase-orders/entities/purchase-order.entity';
import { ProformaInvoice, PIStatus } from '../proforma-invoices/entities/proforma-invoice.entity';
import { SalesContract, SalesContractStatus } from '../sales-contracts/entities/sales-contract.entity';

@Injectable()
export class LandingService {
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
}
