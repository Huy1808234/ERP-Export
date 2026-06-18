type PdfMakeFontDescriptor = {
  normal: string;
  bold?: string;
  italics?: string;
  bolditalics?: string;
};

export type PdfMakeDocDefinition = {
  content: unknown[];
  pageSize?: string;
  pageOrientation?: string;
  pageMargins?: number | [number, number, number, number];
  styles?: Record<string, unknown>;
  defaultStyle?: Record<string, unknown>;
  [key: string]: unknown;
};

type PdfMakeOutputDocument = {
  getBuffer(): Promise<Buffer>;
  write(filename: string): Promise<void>;
};

type PdfMakeServer = {
  setFonts(fonts: Record<string, PdfMakeFontDescriptor>): void;
  setUrlAccessPolicy(callback: (url: string) => boolean): void;
  createPdf(docDefinition: PdfMakeDocDefinition): PdfMakeOutputDocument;
};

const pdfMake = require('pdfmake') as PdfMakeServer;

pdfMake.setFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
  Courier: {
    normal: 'Courier',
    bold: 'Courier-Bold',
    italics: 'Courier-Oblique',
    bolditalics: 'Courier-BoldOblique',
  },
});
pdfMake.setUrlAccessPolicy(() => false);

export function renderPdfBuffer(
  docDefinition: PdfMakeDocDefinition,
): Promise<Buffer> {
  return pdfMake.createPdf(docDefinition).getBuffer();
}

export function writePdfFile(
  docDefinition: PdfMakeDocDefinition,
  filePath: string,
): Promise<void> {
  return pdfMake.createPdf(docDefinition).write(filePath);
}
