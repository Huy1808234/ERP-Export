import { Incoterm } from '@/modules/quotations/entities/quotation.entity';

export enum IncotermCategory {
  SELLER_PAYS_FREIGHT = 'SELLER_PAYS_FREIGHT',
  BUYER_PAYS_FREIGHT = 'BUYER_PAYS_FREIGHT',
}

export const INCOTERM_CONFIG: Record<
  Incoterm,
  { category: IncotermCategory; description: string }
> = {
  [Incoterm.EXW]: {
    category: IncotermCategory.BUYER_PAYS_FREIGHT,
    description: 'Ex Works - Người mua chịu toàn bộ chi phí từ kho người bán.',
  },
  [Incoterm.FOB]: {
    category: IncotermCategory.BUYER_PAYS_FREIGHT,
    description: 'Free On Board - Người bán chịu phí đến khi hàng lên tàu.',
  },
  [Incoterm.CIF]: {
    category: IncotermCategory.SELLER_PAYS_FREIGHT,
    description:
      'Cost, Insurance and Freight - Người bán chịu phí vận chuyển và bảo hiểm đến cảng đích.',
  },
  [Incoterm.CFR]: {
    category: IncotermCategory.SELLER_PAYS_FREIGHT,
    description:
      'Cost and Freight - Người bán chịu phí vận chuyển đến cảng đích.',
  },
  [Incoterm.DDP]: {
    category: IncotermCategory.SELLER_PAYS_FREIGHT,
    description:
      'Delivered Duty Paid - Người bán chịu mọi chi phí đến kho người mua (bao gồm thuế nhập khẩu).',
  },
  [Incoterm.DAP]: {
    category: IncotermCategory.SELLER_PAYS_FREIGHT,
    description:
      'Delivered At Place - Người bán chịu phí đến điểm giao hàng (chưa bao gồm thuế nhập khẩu).',
  },
};

export function validateIncotermLogisticsFee(
  incoterm: Incoterm,
  fees: {
    logisticsFee?: number;
    seaFreight?: number;
    insuranceCost?: number;
    domesticTransportCost?: number;
    portCharges?: number;
  },
): { isValid: boolean; message?: string } {
  const config = INCOTERM_CONFIG[incoterm];
  if (!config) return { isValid: true };

  const feeValues = [
    fees.logisticsFee,
    fees.seaFreight,
    fees.insuranceCost,
    fees.domesticTransportCost,
    fees.portCharges,
  ].map((fee) => Number(fee || 0));

  if (feeValues.some((fee) => fee < 0)) {
    return {
      isValid: false,
      message: 'Chi phí logistics không được âm.',
    };
  }

  const totalLogistics = feeValues.reduce((sum, fee) => sum + fee, 0);

  if (
    config.category === IncotermCategory.SELLER_PAYS_FREIGHT &&
    totalLogistics <= 0
  ) {
    return {
      isValid: true,
      message: `Với điều kiện ${incoterm}, phí vận chuyển có thể đã nằm trong đơn giá theo chính sách giá. Nếu tách phí riêng, hãy nhập ở phần Logistics.`,
    };
  }

  // SENIOR LOGIC: Warning for Buyer-led terms with unexpected Seller-paid fees
  if (config.category === IncotermCategory.BUYER_PAYS_FREIGHT) {
    const sea = Number(fees.seaFreight || 0);
    const insurance = Number(fees.insuranceCost || 0);

    if (sea > 0 || insurance > 0) {
      return {
        isValid: true, // Vẫn cho phép nhưng có thể log hoặc hiện cảnh báo ở UI
        message: `Lưu ý: Với điều kiện ${incoterm}, người mua thường tự trả cước biển và bảo hiểm. Hãy kiểm tra lại nếu bạn đang thu hộ các phí này.`,
      };
    }
  }

  return { isValid: true };
}
