import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ResponseMessage, Roles, User } from '@/decorator/customize';
import { JwtAuthGuard } from '@/auth/passport/jwt-auth.guard';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import type { AuthenticatedUser, QueryParams } from '@/common/types/authenticated-user.type';
import { ExportDocumentsService } from './export-documents.service';
import { DocumentType } from './entities/export-document.entity';
import { UpsertExportDocumentDto } from './dto/upsert-export-document.dto';
import { ReviewExportDocumentDto } from './dto/review-export-document.dto';

@Controller('export-documents')
@UseGuards(JwtAuthGuard)
@Roles('ADMIN', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT', 'ACCOUNTANT')
export class ExportDocumentsController {
  constructor(private readonly exportDocumentsService: ExportDocumentsService) {}

  @Get()
  @ResponseMessage('Fetch export documents')
  findAll(@Query() query: QueryParams) {
    return this.exportDocumentsService.findAll(query);
  }

  @Get('shipment/:_id')
  @ResponseMessage('Fetch export document center by shipment')
  findByShipment(@Param('_id') recordId: string) {
    return this.exportDocumentsService.findByShipment(recordId);
  }

  @Post()
  @ResponseMessage('Register export document version')
  upsertDocument(@Body() dto: UpsertExportDocumentDto, @User() user: UserEntity) {
    return this.exportDocumentsService.upsertDocument(dto, user);
  }

  @Get(':_id/audit')
  @ResponseMessage('Fetch export document audit trail')
  getDocumentAudit(@Param('_id') recordId: string) {
    return this.exportDocumentsService.getDocumentAudit(recordId);
  }

  @Post('shipment/:_id/generate/:type')
  @ResponseMessage('Generate export document snapshot')
  generateSnapshot(@Param('_id') recordId: string, @Param('type') type: DocumentType) {
    return this.exportDocumentsService.generateSnapshotDocument(recordId, type);
  }

  @Patch(':_id/review')
  @ResponseMessage('Review export document')
  reviewDocument(
    @Param('_id') recordId: string,
    @Body() dto: ReviewExportDocumentDto,
    @User() user: UserEntity,
  ) {
    return this.exportDocumentsService.reviewDocument(recordId, dto, user);
  }

  @Patch(':_id/share')
  @ResponseMessage('Share export document with buyer portal')
  shareDocument(@Param('_id') recordId: string, @User() user: UserEntity) {
    return this.exportDocumentsService.setBuyerSharing(recordId, true, user);
  }

  @Patch(':_id/unshare')
  @ResponseMessage('Unshare export document from buyer portal')
  unshareDocument(@Param('_id') recordId: string, @User() user: UserEntity) {
    return this.exportDocumentsService.setBuyerSharing(recordId, false, user);
  }

  @Get('download/:_id/:type')
  async downloadPdf(
    @Param('_id') recordId: string,
    @Param('type') type: 'CI' | 'PL',
    @Res() res: Response,
  ) {
    const buffer = await this.exportDocumentsService.generateDocumentPdf(recordId, type);
    const filename = `${type}_${recordId}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}

@Controller('export-documents/portal')
@UseGuards(JwtAuthGuard)
export class PortalExportDocumentsController {
  constructor(private readonly exportDocumentsService: ExportDocumentsService) {}

  @Get()
  @ResponseMessage('Fetch buyer portal export documents')
  findSharedDocuments(@User() user: AuthenticatedUser) {
    return this.exportDocumentsService.findSharedPortalDocuments(user);
  }

  @Get(':_id/download')
  async downloadSharedDocument(
    @Param('_id') recordId: string,
    @User() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const file = await this.exportDocumentsService.downloadSharedPortalDocument(recordId, user);

    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.fileName)}"`,
      'Content-Length': file.buffer.length,
    });

    res.end(file.buffer);
  }
}
