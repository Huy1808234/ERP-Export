import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { IQuotation, IQuotationLine } from '@/types/o2c';

/**
 * Senior Excel Service for ERP
 * Handles professional data exporting with proper formatting and mapping
 * Verification: IQuotation.createdBy is defined in types/o2c.ts
 */

export const ExcelService = {
  /**
   * Export a list of quotations to Excel
   */
  exportQuotationTable: (data: IQuotation[], fileName: string = 'Danh_sach_bao_gia') => {
    const wsData = data.map((item, index) => ({
      'STT': index + 1,
      'Số Báo Giá': item.quotationNumber,
      'Khách Hàng': item.customer?.name || 'N/A',
      'Incoterm': item.incoterm || 'N/A',
      'Tiền Tệ': item.currency,
      'Tổng Giá Trị': item.totalAmount,
      'Trạng Thái': item.status,
      'Ngày Phát Hành': item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '-',
      'Ngày Hết Hạn': item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('vi-VN') : '-',
      'Người Tạo': item.createdBy ? `${item.createdBy.fullName || item.createdBy.name}${item.createdBy.role?.name ? ` (${item.createdBy.role.name})` : ''}` : 'N/A',
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    
    // Set column widths for better readability
    const wscols = [
      { wch: 5 },  // STT
      { wch: 18 }, // Số Báo Giá
      { wch: 30 }, // Khách Hàng
      { wch: 10 }, // Incoterm
      { wch: 10 }, // Tiền Tệ
      { wch: 15 }, // Tổng Giá Trị
      { wch: 12 }, // Trạng Thái
      { wch: 15 }, // Ngày Phát Hành
      { wch: 15 }, // Ngày Hết Hạn
      { wch: 15 }, // Người Tạo
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Quotations');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `${fileName}_${new Date().getTime()}.xlsx`);
  },

  /**
   * Export a single detailed Quotation (Formal Production Template)
   */
  exportSingleQuotation: (item: IQuotation, companySettings?: any[]) => {
    const fileName = `Quotation_${item.quotationNumber}`;
    
    // Find settings in the array if provided
    const getSetting = (key: string, defaultValue: string) => {
      const s = companySettings?.find(x => x.key === key);
      return s?.value || defaultValue;
    };

    const companyName = getSetting('COMPANY_NAME', 'ANTIGRAVITY EXPORT CO., LTD');
    const companyAddress = getSetting('COMPANY_ADDRESS', '123 Le Loi St, Dist 1, HCMC, Vietnam');
    const bankInfoRaw = getSetting('COMPANY_BANK_INFO', 'Bank Name: VIETCOMBANK\nBeneficiary: ANTIGRAVITY EXPORT CO., LTD\nAccount No: 123-456-789-000 (USD)\nSwift Code: VCBKVNVX');
    const bankLines = bankInfoRaw.split('\n');

    // Precise calculation of subtotal from lines
    const lineItemsSubtotal = (item.items || []).reduce((acc: number, line: IQuotationLine) => {
      return acc + (line.quantity * line.unitPrice);
    }, 0);

    const otherFee = Number(item.otherFee) || 0;

    // Header Section - Enterprise Identity (Separated columns for clarity)
    const header = [
      ['PROFORMA INVOICE / QUOTATION'],
      [''],
      ['SHIPPER / EXPORTER:', '', '', '', '', 'BUYER / IMPORTER:'],
      [companyName, '', '', '', '', item.customer?.name],
      [companyAddress, '', '', '', '', item.customer?.address || '-'],
      [`Tel: +84 28 3822 0000`, '', '', '', '', `Contact: ${item.customer?.contactPerson || 'N/A'}`],
      ['Email: sales@antigravity.com', '', '', '', '', `Tax ID: ${item.customer?.taxId || '-'}`],
      [''],
      [`PI/Quotation No: ${item.quotationNumber}`, '', '', '', '', `Date: ${item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '-'}`],
      [`Incoterm: ${item.incoterm || '-'}`, '', '', '', '', `Currency: ${item.currency}`],
      [`Port of Loading: ${item.portOfLoading || '-'}`, '', '', '', '', `Port of Discharge: ${item.portOfDischarge || '-'}`],
      [''],
      ['STT', 'Mô tả sản phẩm / Description', 'HS Code', 'Q\'ty', 'Unit', 'Price', 'Total Amount', 'CBM', 'G.W (Kgs)'],
    ];

    // Calculate Logistics Totals for Summary
    let totalCBM = 0;
    let totalGW = 0;

    // Items Section
    const items = (item.items || []).map((line: IQuotationLine, idx: number) => {
      const p = line.product || {};
      const pcsPerCtn = p.piecesPerCarton || 1;
      const cbm = (p.cbmPerCarton || 0) * (line.quantity / pcsPerCtn);
      const gw = (p.grossWeightPerCarton || 0) * (line.quantity / pcsPerCtn);
      
      totalCBM += cbm;
      totalGW += gw;

      return [
        idx + 1,
        p.vietnameseName || line.productDescription || 'N/A',
        p.hsCode || '-',
        line.quantity,
        line.unit,
        line.unitPrice,
        line.quantity * line.unitPrice,
        cbm.toFixed(3),
        gw.toFixed(2)
      ];
    });

    // Financial & Logistics Footer (Complete Fee Breakdown)
    const footer = [
      [''],
      ['', '', '', '', '', 'SUBTOTAL:', lineItemsSubtotal],
      ['', '', '', '', '', 'SEA FREIGHT:', item.seaFreight || 0],
      ['', '', '', '', '', 'INSURANCE:', item.insuranceCost || 0],
      ['', '', '', '', '', 'TRUCKING / DOMESTIC:', item.domesticTransportCost || 0],
      ['', '', '', '', '', 'LOCAL CHARGES (POL/POD):', item.portCharges || 0],
      ['', '', '', '', '', 'LOGISTICS SERVICES:', item.logisticsFee || 0],
      ['', '', '', '', '', 'OTHER FEE:', otherFee],
      ['', '', '', '', '', 'GRAND TOTAL:', item.totalAmount, item.currency],
      [''],
      ['LOGISTICS SUMMARY:'],
      ['Total Volume:', `${totalCBM.toFixed(3)} CBM`],
      ['Total Gross Weight:', `${totalGW.toFixed(2)} Kgs`],
      [''],
      ['PAYMENT TERMS:'],
      [item.paymentTerms || 'T/T 100%'],
      [''],
      ['BANKING INFORMATION:'],
      ...bankLines.map((line: string) => [line]),
      [''],
      [''],
      ['VALIDITY:', `This quotation is valid until ${item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('vi-VN') : '30 days from issue date'}`],
      [''],
      ['AUTHORIZED SIGNATURE:', '', '', '', 'BUYER CONFIRMATION:'],
      ['(Signed & Stamped)', '', '', '', '(Signed & Stamped)'],
    ];

    const wsData = [...header, ...items, ...footer];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Precise Column Widths for Formal Doc
    ws['!cols'] = [
      { wch: 5 },   // STT
      { wch: 35 },  // Description
      { wch: 12 },  // HS Code
      { wch: 10 },  // Qty
      { wch: 8 },   // Unit
      { wch: 12 },  // Price
      { wch: 15 },  // Total
      { wch: 10 },  // CBM
      { wch: 12 },  // GW
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Commercial Quotation');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `${fileName}.xlsx`);
  }
};
