import { Injectable } from '@nestjs/common';
import { Incoterms, SalesContract } from './entities/sales-contract.entity';

@Injectable()
export class IncotermsService {
  /**
   * Thuật toán tự động tính toán giá trị hợp đồng dựa trên Incoterm
   * Lõi: Tự động cộng dồn các loại chi phí Logistics vào giá bán
   */
  calculateTotal(contract: Partial<SalesContract>): { totalAmount: number; totalAmountVnd: number } {
    const baseValue = contract.items?.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0) || 0;
    
    let totalAmount = baseValue;

    // Logic cộng dồn chi phí Logistics dựa trên Incoterm
    switch (contract.incoterm) {
      case Incoterms.EXW:
        // Giá tại xưởng: Không cộng gì thêm
        break;
      
      case Incoterms.FOB:
        // FOB = EXW + Vận chuyển nội địa + Phí cảng
        totalAmount += (Number(contract.domesticTransportCost) || 0);
        totalAmount += (Number(contract.portCharges) || 0);
        break;

      case Incoterms.CFR:
        // CFR = FOB + Cước tàu
        totalAmount += (Number(contract.domesticTransportCost) || 0);
        totalAmount += (Number(contract.portCharges) || 0);
        totalAmount += (Number(contract.seaFreight) || 0);
        break;
      
      case Incoterms.CIF:
        // CIF = FOB + Cước tàu + Bảo hiểm
        totalAmount += (Number(contract.domesticTransportCost) || 0);
        totalAmount += (Number(contract.portCharges) || 0);
        totalAmount += (Number(contract.seaFreight) || 0);
        totalAmount += (Number(contract.insuranceCost) || 0);
        break;

      case Incoterms.DAP:
      case Incoterms.DDP:
        // DAP/DDP = CIF + Phí nội địa tại đích (nếu có, hiện tại cộng dồn các field đã nhập)
        totalAmount += (Number(contract.domesticTransportCost) || 0);
        totalAmount += (Number(contract.portCharges) || 0);
        totalAmount += (Number(contract.seaFreight) || 0);
        totalAmount += (Number(contract.insuranceCost) || 0);
        break;
    }

    const exchangeRate = Number(contract.exchangeRate) || 1;
    
    return {
      totalAmount,
      totalAmountVnd: totalAmount * exchangeRate
    };
  }
}
