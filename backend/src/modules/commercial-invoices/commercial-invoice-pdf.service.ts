import { renderPdfBuffer, PdfMakeDocDefinition } from '@/common/pdfmake-server.util';
import { CommercialInvoice } from './entities/commercial-invoice.entity';
import { CommercialInvoiceItem } from './entities/commercial-invoice-item.entity';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';

export interface CompanyInfo {
  name: string;
  address: string;
  bankInfo: string;
  phone?: string;
  email?: string;
}

export interface CommercialInvoicePdfData {
  invoice: {
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string | null;
    currency: string;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    totalAmountVnd: number;
    incoterm: string | null;
    paymentTerms: string | null;
    note: string | null;
  };
  seller: CompanyInfo;
  buyer: {
    name: string;
    address: string;
    country: string;
    phone?: string;
    email?: string;
  };
  shipment: {
    vesselName: string | null;
    voyageNumber: string | null;
    loadingPort: string | null;
    dischargePort: string | null;
    blNumber: string | null;
    etd: string | null;
    eta: string | null;
  };
  items: Array<{
    sku: string | null;
    productName: string;
    hsCode: string | null;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    netWeight: number | null;
    grossWeight: number | null;
    cbm: number | null;
  }>;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatWeight(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return `${formatCurrency(value, 'kg')} kg`;
}

function formatCbm(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return `${formatCurrency(value, 'm3')} m³`;
}

export async function generateCommercialInvoicePdf(
  data: CommercialInvoicePdfData,
): Promise<Buffer> {
  const { invoice, seller, buyer, shipment, items } = data;

  const docDefinition: PdfMakeDocDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [40, 60, 40, 60],
    content: [
      // Header: Seller Info
      {
        columns: [
          {
            width: '60%',
            stack: [
              { text: seller.name, style: 'companyName' },
              { text: seller.address, style: 'companyDetail' },
              ...(seller.phone ? [{ text: `Tel: ${seller.phone}`, style: 'companyDetail' }] : []),
              ...(seller.email ? [{ text: `Email: ${seller.email}`, style: 'companyDetail' }] : []),
            ],
          },
          {
            width: '40%',
            stack: [
              { text: 'COMMERCIAL INVOICE', style: 'invoiceTitle' },
              { text: `No: ${invoice.invoiceNumber}`, style: 'invoiceNumber' },
              { text: `Date: ${invoice.invoiceDate}`, style: 'invoiceDate' },
              ...(invoice.dueDate
                ? [{ text: `Due Date: ${invoice.dueDate}`, style: 'invoiceDate' }]
                : []),
            ],
          },
        ],
      },
      { text: '', margin: [0, 10] },

      // Buyer Info
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'BUYER / CONSIGNEE:', style: 'sectionLabel' },
              { text: buyer.name, style: 'partyName' },
              { text: buyer.address, style: 'partyDetail' },
              { text: buyer.country, style: 'partyDetail' },
              ...(buyer.phone ? [{ text: `Tel: ${buyer.phone}`, style: 'partyDetail' }] : []),
              ...(buyer.email ? [{ text: `Email: ${buyer.email}`, style: 'partyDetail' }] : []),
            ],
          },
          {
            width: '50%',
            stack: [
              { text: 'SHIPMENT DETAILS:', style: 'sectionLabel' },
              ...(shipment.vesselName
                ? [{ text: `Vessel: ${shipment.vesselName}`, style: 'shipmentDetail' }]
                : []),
              ...(shipment.voyageNumber
                ? [{ text: `Voyage No: ${shipment.voyageNumber}`, style: 'shipmentDetail' }]
                : []),
              ...(shipment.loadingPort
                ? [{ text: `Loading Port: ${shipment.loadingPort}`, style: 'shipmentDetail' }]
                : []),
              ...(shipment.dischargePort
                ? [{ text: `Discharge Port: ${shipment.dischargePort}`, style: 'shipmentDetail' }]
                : []),
              ...(shipment.blNumber
                ? [{ text: `B/L No: ${shipment.blNumber}`, style: 'shipmentDetail' }]
                : []),
              ...(shipment.etd ? [{ text: `ETD: ${shipment.etd}`, style: 'shipmentDetail' }] : []),
              ...(shipment.eta ? [{ text: `ETA: ${shipment.eta}`, style: 'shipmentDetail' }] : []),
            ],
          },
        ],
      },
      { text: '', margin: [0, 10] },

      // Incoterm & Payment Terms
      {
        columns: [
          {
            width: '50%',
            stack: [
              ...(invoice.incoterm
                ? [{ text: `Incoterms: ${invoice.incoterm}`, style: 'termsDetail' }]
                : []),
              ...(invoice.paymentTerms
                ? [{ text: `Payment Terms: ${invoice.paymentTerms}`, style: 'termsDetail' }]
                : []),
            ],
          },
        ],
      },
      { text: '', margin: [0, 5] },

      // Items Table Header
      {
        table: {
          headerRows: 1,
          widths: [25, '*', 50, 35, 35, 45, 45, 50, 50],
          body: [
            [
              { text: 'No.', style: 'tableHeader' },
              { text: 'Description of Goods', style: 'tableHeader' },
              { text: 'HS Code', style: 'tableHeader' },
              { text: 'Quantity', style: 'tableHeader' },
              { text: 'Unit', style: 'tableHeader' },
              { text: 'Unit Price', style: 'tableHeader' },
              { text: 'Total Price', style: 'tableHeader' },
              { text: 'N.W.', style: 'tableHeader' },
              { text: 'G.W.', style: 'tableHeader' },
            ],
            ...items.map((item, index) => [
              { text: String(index + 1), style: 'tableCell', alignment: 'center' },
              { text: item.productName, style: 'tableCell' },
              { text: item.hsCode || '-', style: 'tableCell', alignment: 'center' },
              { text: formatCurrency(item.quantity, invoice.currency), style: 'tableCell', alignment: 'right' },
              { text: item.unit, style: 'tableCell', alignment: 'center' },
              { text: `${invoice.currency} ${formatCurrency(item.unitPrice, invoice.currency)}`, style: 'tableCell', alignment: 'right' },
              { text: `${invoice.currency} ${formatCurrency(item.totalPrice, invoice.currency)}`, style: 'tableCell', alignment: 'right' },
              { text: formatWeight(item.netWeight), style: 'tableCell', alignment: 'right' },
              { text: formatWeight(item.grossWeight), style: 'tableCell', alignment: 'right' },
            ]),
          ],
        },
        layout: {
          hLineWidth: (i: number, node: { table: { widths: number[], body: any[] } }) =>
            i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.1,
          vLineWidth: () => 0.1,
          hLineColor: () => '#cccccc',
          vLineColor: () => '#cccccc',
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      },
      { text: '', margin: [0, 10] },

      // Totals Section
      {
        columns: [
          {
            width: '60%',
            stack: [
              ...(invoice.note
                ? [
                    { text: 'REMARKS:', style: 'sectionLabel' },
                    { text: invoice.note, style: 'noteText' },
                  ]
                : []),
              { text: '', margin: [0, 15] },
              { text: 'BANK INFORMATION:', style: 'sectionLabel' },
              { text: seller.bankInfo, style: 'bankInfo' },
            ],
          },
          {
            width: '40%',
            stack: [
              {
                columns: [
                  { text: 'Subtotal:', style: 'totalLabel' },
                  {
                    text: `${invoice.currency} ${formatCurrency(invoice.subtotal, invoice.currency)}`,
                    style: 'totalValue',
                    alignment: 'right',
                  },
                ],
              },
              ...(invoice.taxRate > 0
                ? [
                    {
                      columns: [
                        { text: `Tax (${invoice.taxRate}%):`, style: 'totalLabel' },
                        {
                          text: `${invoice.currency} ${formatCurrency(invoice.taxAmount, invoice.currency)}`,
                          style: 'totalValue',
                          alignment: 'right',
                        },
                      ],
                    },
                  ]
                : []),
              {
                canvas: [
                  {
                    type: 'line',
                    x1: 0,
                    y1: 0,
                    x2: 200,
                    y2: 0,
                    lineWidth: 1,
                  },
                ],
                margin: [0, 5],
              },
              {
                columns: [
                  { text: 'TOTAL:', style: 'grandTotalLabel' },
                  {
                    text: `${invoice.currency} ${formatCurrency(invoice.totalAmount, invoice.currency)}`,
                    style: 'grandTotalValue',
                    alignment: 'right',
                  },
                ],
              },
              ...(invoice.totalAmountVnd > 0 && invoice.currency !== 'VND'
                ? [
                    {
                      columns: [
                        { text: '(VND)', style: 'vndLabel', fontSize: 9 },
                        {
                          text: `(${new Intl.NumberFormat('vi-VN').format(invoice.totalAmountVnd)} VND)`,
                          style: 'vndValue',
                          alignment: 'right',
                          fontSize: 9,
                        },
                      ],
                    },
                  ]
                : []),
            ],
          },
        ],
      },
      { text: '', margin: [0, 30] },

      // Signature Block
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 180,
            stack: [
              { text: 'Authorized Signature', style: 'signatureLabel', alignment: 'center' },
              { text: '', margin: [0, 40] },
              { text: '_________________________', style: 'signatureLine', alignment: 'center' },
              { text: seller.name, style: 'signatureCompany', alignment: 'center' },
            ],
          },
          { width: '*', text: '' },
        ],
      },
    ],
    styles: {
      companyName: {
        fontSize: 14,
        bold: true,
        color: '#1a1a1a',
      },
      companyDetail: {
        fontSize: 9,
        color: '#555555',
        margin: [0, 2],
      },
      invoiceTitle: {
        fontSize: 18,
        bold: true,
        color: '#1a1a1a',
        alignment: 'right',
      },
      invoiceNumber: {
        fontSize: 11,
        bold: true,
        alignment: 'right',
        margin: [0, 5, 0, 0],
      },
      invoiceDate: {
        fontSize: 10,
        alignment: 'right',
        margin: [0, 2, 0, 0],
      },
      sectionLabel: {
        fontSize: 9,
        bold: true,
        color: '#666666',
        margin: [0, 0, 0, 3],
      },
      partyName: {
        fontSize: 11,
        bold: true,
        margin: [0, 0, 0, 2],
      },
      partyDetail: {
        fontSize: 9,
        color: '#444444',
        margin: [0, 1],
      },
      shipmentDetail: {
        fontSize: 9,
        color: '#444444',
        margin: [0, 1],
      },
      termsDetail: {
        fontSize: 10,
        color: '#333333',
        margin: [0, 2],
      },
      tableHeader: {
        fontSize: 9,
        bold: true,
        color: '#ffffff',
        fillColor: '#2c3e50',
        alignment: 'center',
      },
      tableCell: {
        fontSize: 8,
        color: '#333333',
      },
      sectionLabel2: {
        fontSize: 9,
        bold: true,
        color: '#666666',
        margin: [0, 0, 0, 3],
      },
      noteText: {
        fontSize: 9,
        color: '#444444',
        italics: true,
      },
      bankInfo: {
        fontSize: 9,
        color: '#333333',
        margin: [0, 2],
      },
      totalLabel: {
        fontSize: 10,
        margin: [0, 3],
      },
      totalValue: {
        fontSize: 10,
        margin: [0, 3],
      },
      grandTotalLabel: {
        fontSize: 12,
        bold: true,
        margin: [0, 5],
      },
      grandTotalValue: {
        fontSize: 12,
        bold: true,
        color: '#c0392b',
        margin: [0, 5],
      },
      vndLabel: {
        margin: [0, 2, 0, 0],
      },
      vndValue: {
        margin: [0, 2, 0, 0],
      },
      signatureLabel: {
        fontSize: 10,
        margin: [0, 0, 0, 5],
      },
      signatureLine: {
        fontSize: 10,
      },
      signatureCompany: {
        fontSize: 9,
        margin: [0, 3, 0, 0],
      },
    },
    defaultStyle: {
      font: 'Helvetica',
    },
  };

  return renderPdfBuffer(docDefinition);
}

export function buildInvoicePdfData(
  ci: CommercialInvoice,
  contract: SalesContract,
  shipment: Shipment,
  seller: CompanyInfo,
): CommercialInvoicePdfData {
  const items: CommercialInvoicePdfData['items'] = (ci.items || []).map(
    (item: CommercialInvoiceItem) => ({
      sku: item.sku || null,
      productName: item.description || item.product?.englishName || item.product?.vietnameseName || 'N/A',
      hsCode: item.hsCode || item.product?.hsCode || null,
      quantity: Number(item.quantity || 0),
      unit: item.unit || 'PCS',
      unitPrice: Number(item.unitPriceForeign || 0),
      totalPrice: Number(item.lineAmountForeign || 0),
      netWeight: item.netWeight || null,
      grossWeight: item.grossWeight || null,
      cbm: item.cbm || null,
    }),
  );

  return {
    invoice: {
      invoiceNumber: ci.invoiceNumber,
      invoiceDate: formatDateForPdf(ci.invoiceDate),
      dueDate: ci.dueDate ? formatDateForPdf(ci.dueDate) : null,
      currency: ci.currency,
      subtotal: Number(ci.subtotalForeign || 0),
      taxRate: Number(ci.taxRatePercent || 0),
      taxAmount: Number(ci.taxAmountForeign || 0),
      totalAmount: Number(ci.totalAmountForeign || 0),
      totalAmountVnd: Number(ci.totalAmountVnd || 0),
      incoterm: ci.incoterm,
      paymentTerms: ci.paymentTerms,
      note: ci.note,
    },
    seller,
    buyer: {
      name: ci.buyer?.name || contract.buyer?.name || 'N/A',
      address: ci.buyer?.address || contract.buyer?.address || '',
      country: ci.buyer?.country || contract.buyer?.country || '',
      phone: ci.buyer?.phone || contract.buyer?.phone || undefined,
      email: ci.buyer?.email || contract.buyer?.email || undefined,
    },
    shipment: {
      vesselName: shipment?.vesselName || null,
      voyageNumber: shipment?.voyageNumber || null,
      loadingPort: shipment?.polPort?.name || shipment?.pol || null,
      dischargePort: shipment?.podPort?.name || shipment?.pod || null,
      blNumber: shipment?.blNumber || null,
      etd: shipment?.etd ? formatDateForPdf(shipment.etd) : null,
      eta: shipment?.eta ? formatDateForPdf(shipment.eta) : null,
    },
    items,
  };
}

function formatDateForPdf(date: Date | string): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
