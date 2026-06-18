import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Shipment } from './entities/shipment.entity';
import { ShipmentCostAllocation } from './entities/shipment-cost-allocation.entity';
import Decimal from 'decimal.js';

export enum AllocationMethod {
  BY_CBM = 'CBM',
  BY_WEIGHT = 'WEIGHT',
  BY_QUANTITY = 'QUANTITY',
  BY_VALUE = 'VALUE',
}

export interface AllocationResult {
  productId: string;
  allocatedFreightCost: number;
  allocatedLocalCharge: number;
  totalAllocatedCost: number;
}

@Injectable()
export class LogisticsAllocationService {
  constructor(private dataSource: DataSource) {}

  /**
   * Thuật toán Phân bổ chi phí Logistics (Cost Allocation Algorithm)
   * Sử dụng Decimal.js và phương pháp "Largest Remainder" để triệt tiêu sai số làm tròn.
   */
  async allocateCosts(
    shipmentId: string,
    method: AllocationMethod = AllocationMethod.BY_CBM,
  ): Promise<ShipmentCostAllocation[]> {
    const manager = this.dataSource.manager;

    const shipment = await manager.findOne(Shipment, {
      where: { _id: shipmentId },
      relations: [
        'salesContract',
        'salesContract.items',
        'salesContract.items.product',
      ],
    });

    if (!shipment) throw new BadRequestException('Shipment not found');
    if (!shipment.salesContract?.items?.length) {
      throw new BadRequestException(
        'Shipment does not have any items to allocate',
      );
    }

    const exRate = new Decimal(shipment.salesContract.exchangeRate || 1);

    // Tách biệt chi phí quốc tế (Freight/Insurance) và nội địa (Local/Trucking/Customs)
    const freightInsuranceVnd = new Decimal(shipment.freightCost || 0)
      .plus(shipment.insuranceCost || 0)
      .times(exRate);
    const localChargesVnd = new Decimal(shipment.localChargesVnd || 0)
      .plus(shipment.truckingCostVnd || 0)
      .plus(shipment.customsFeeVnd || 0);

    const totalLogisticsVnd = freightInsuranceVnd.plus(localChargesVnd);
    if (totalLogisticsVnd.isZero()) return [];

    // 1. Tính toán Basis cho từng item
    const items = shipment.salesContract.items;
    let totalBasis = new Decimal(0);

    const itemsBasis = items.map((item) => {
      let basisValue = new Decimal(0);
      const qty = new Decimal(item.quantity || 0);
      const product = item.product;

      switch (method) {
        case AllocationMethod.BY_CBM:
          const cbm = new Decimal(product?.cbmPerCarton || 0);
          const pcsPerCarton = new Decimal(product?.piecesPerCarton || 1);
          basisValue = qty.div(pcsPerCarton).mul(cbm);
          break;
        case AllocationMethod.BY_WEIGHT:
          const gw = new Decimal(
            product?.grossWeightPerCarton || product?.netWeightPerCarton || 0,
          );
          const pcs = new Decimal(product?.piecesPerCarton || 1);
          basisValue = qty.div(pcs).mul(gw);
          break;
        case AllocationMethod.BY_VALUE:
          basisValue = new Decimal(
            item.totalPrice || qty.mul(item.unitPrice || 0),
          );
          break;
        default: // BY_QUANTITY
          basisValue = qty;
      }

      // Fallback nếu thiếu data CBM/Weight
      if (basisValue.isZero() && method !== AllocationMethod.BY_QUANTITY)
        basisValue = qty;

      totalBasis = totalBasis.plus(basisValue);
      return { productId: item.productId, basisValue };
    });

    if (totalBasis.isZero())
      throw new BadRequestException('Total Basis is 0, cannot allocate.');

    // 2. Phân bổ sử dụng Largest Remainder Method (Làm tròn số nguyên VND)
    const allocatePart = (totalAmount: Decimal) => {
      let sumAllocated = new Decimal(0);
      const parts = itemsBasis.map((ib) => {
        const exact = totalAmount.mul(ib.basisValue).div(totalBasis);
        const floor = exact.floor();
        sumAllocated = sumAllocated.plus(floor);
        return {
          productId: ib.productId,
          allocated: floor,
          remainder: exact.minus(floor),
        };
      });

      let diff = totalAmount.minus(sumAllocated).toNumber();
      parts.sort((a, b) => b.remainder.minus(a.remainder).toNumber());
      for (let i = 0; i < diff; i++) {
        parts[i % parts.length].allocated =
          parts[i % parts.length].allocated.plus(1);
      }
      return parts;
    };

    const freightParts = allocatePart(freightInsuranceVnd);
    const localParts = allocatePart(localChargesVnd);

    // 3. Lưu kết quả
    const allocations = itemsBasis.map((ib) => {
      const f = freightParts.find((p) => p.productId === ib.productId);
      const l = localParts.find((p) => p.productId === ib.productId);

      if (!f || !l) {
        throw new BadRequestException(
          `Allocation parts not found for product ${ib.productId}`,
        );
      }

      return manager.create(ShipmentCostAllocation, {
        shipmentId,
        productId: ib.productId,
        allocatedFreightCost: f.allocated.toNumber(),
        allocatedLocalCharge: l.allocated.toNumber(),
        totalAllocatedCost: f.allocated.plus(l.allocated).toNumber(),
        allocationMethod: method,
      });
    });

    // Xóa kết quả cũ nếu có và lưu mới
    await manager.delete(ShipmentCostAllocation, { shipmentId });
    return manager.save(allocations);
  }
}
