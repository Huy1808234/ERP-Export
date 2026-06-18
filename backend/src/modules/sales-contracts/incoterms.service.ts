import { Injectable } from '@nestjs/common';
import { Incoterm } from '../quotations/entities/quotation.entity';
import { SalesContract } from './entities/sales-contract.entity';

type IncotermCalculationInput = Pick<
  Partial<SalesContract>,
  | 'domesticTransportCost'
  | 'portCharges'
  | 'seaFreight'
  | 'insuranceCost'
  | 'otherFee'
  | 'logisticsFee'
  | 'exchangeRate'
  | 'incoterm'
> & {
  items?: Array<{
    quantity: number;
    unitPrice: number;
  }>;
};

@Injectable()
export class IncotermsService {
  /**
   * Thuật toán tự động tính toán giá trị hợp đồng dựa trên Incoterm
   * Lõi: Tự động cộng dồn các loại chi phí Logistics vào giá bán
   */
  calculateTotal(contract: IncotermCalculationInput): {
    totalAmount: number;
    totalAmountVnd: number;
  } {
    const items = contract.items || [];
    const itemsSum = items.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0,
    );

    let totalAmount = itemsSum;

    // SENIOR LOGIC: Accurate Total accumulation based on Incoterm obligations
    const domestic = Number(contract.domesticTransportCost) || 0;
    const port = Number(contract.portCharges) || 0;
    const sea = Number(contract.seaFreight) || 0;
    const insurance = Number(contract.insuranceCost) || 0;

    const otherFee = Number(contract.otherFee) || 0;
    const logisticsFee = Number(contract.logisticsFee) || 0;

    switch (contract.incoterm) {
      case Incoterm.EXW:
        totalAmount = itemsSum;
        break;
      case Incoterm.FOB:
        totalAmount = itemsSum + domestic + port;
        break;
      case Incoterm.CFR:
        totalAmount = itemsSum + domestic + port + sea;
        break;
      case Incoterm.CIF:
      case Incoterm.DAP:
      case Incoterm.DDP:
        totalAmount = itemsSum + domestic + port + sea + insurance;
        break;
      default:
        totalAmount = itemsSum + domestic + port + sea + insurance; // Fallback
        break;
    }

    totalAmount += logisticsFee + otherFee;

    const exchangeRate = Number(contract.exchangeRate) || 1;

    return {
      totalAmount,
      totalAmountVnd: totalAmount * exchangeRate,
    };
  }
}
