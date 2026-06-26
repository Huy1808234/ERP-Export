import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { User } from '@/decorator/customize';
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type';
import { PortalService } from './portal.service';
import { QueryCommercialDocumentDto } from './dto/query-commercial-document.dto';
import { RejectCustomerQuotationDto } from './dto/reject-customer-quotation.dto';
import { RequestQuotationRevisionDto } from './dto/request-quotation-revision.dto';
import { RequestSignatureInvitationDto } from '@/modules/sales-contracts/dto/request-signature-invitation.dto';

@Controller('customer')
export class CustomerController {
  constructor(private readonly portalService: PortalService) {}

  @Get('orders/summary')
  getOrdersSummary(@User() user?: AuthenticatedUser) {
    return this.portalService.getCustomerOrdersSummary(user);
  }

  @Get('commercial-documents')
  findCommercialDocuments(
    @Query() query: QueryCommercialDocumentDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.findCommercialDocuments(user, query);
  }

  @Get('commercial-documents/:_id')
  findCommercialDocument(
    @Param('_id') recordId: string,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.findCustomerCommercialDocument(recordId, user);
  }

  @Get('quotations/:_id')
  findQuotation(
    @Param('_id') recordId: string,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.findCustomerQuotation(recordId, user);
  }

  @Post('quotations/:_id/accept')
  acceptQuotation(
    @Param('_id') recordId: string,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.acceptQuotation(recordId, user);
  }

  @Post('quotations/:_id/reject')
  rejectQuotation(
    @Param('_id') recordId: string,
    @Body() dto: RejectCustomerQuotationDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.rejectQuotation(recordId, dto.reason, user);
  }

  @Post('proforma-invoices/:_id/accept')
  acceptProformaInvoice(
    @Param('_id') recordId: string,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.acceptProformaInvoice(recordId, user);
  }

  @Post('proforma-invoices/:_id/reject')
  rejectProformaInvoice(
    @Param('_id') recordId: string,
    @Body() dto: RejectCustomerQuotationDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.rejectProformaInvoice(recordId, dto.reason, user);
  }

  @Post('quotations/:_id/request-revision')
  requestQuotationRevision(
    @Param('_id') recordId: string,
    @Body() dto: RequestQuotationRevisionDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.requestQuotationRevision(
      recordId,
      dto.reason,
      user,
    );
  }

  @Get('quotations/:_id/pdf')
  async downloadQuotationPdf(
    @Param('_id') recordId: string,
    @User() user: AuthenticatedUser | undefined,
    @Res() res: Response,
  ) {
    const quotation = await this.portalService.findCustomerQuotation(
      recordId,
      user,
    );
    const file = await this.portalService.exportQuotationPdf(recordId, user);
    const filename = `Quotation_${quotation.documentNumber || recordId}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': file.length,
    });
    res.end(file);
  }

  @Get('orders/:_id/timeline')
  findOrderTimeline(
    @Param('_id') recordId: string,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.findCustomerOrderTimeline(recordId, user);
  }

  @Post('contracts/:_id/signing-invitation')
  requestContractSigning(
    @Param('_id') recordId: string,
    @Body() dto: RequestSignatureInvitationDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.requestContractSigning(recordId, dto, user);
  }
}
