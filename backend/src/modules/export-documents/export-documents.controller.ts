import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ExportDocumentsService } from './export-documents.service';
import { JwtAuthGuard } from '@/auth/passport/jwt-auth.guard';

@Controller('api/v1/export-documents')
export class ExportDocumentsController {
  constructor(private readonly exportDocumentsService: ExportDocumentsService) {}

  @Get('download/:shipmentId/:type')
  @UseGuards(JwtAuthGuard)
  async downloadPdf(
    @Param('shipmentId') shipmentId: string,
    @Param('type') type: 'CI' | 'PL',
    @Res() res: Response,
  ) {
    const buffer = await this.exportDocumentsService.generateDocumentPdf(shipmentId, type);
    
    const filename = `${type}_${shipmentId}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
