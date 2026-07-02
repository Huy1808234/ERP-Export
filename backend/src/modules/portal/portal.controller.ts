import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Roles, User } from '@/decorator/customize';
import type {
  AuthenticatedUser,
  QueryParams,
} from '@/common/types/authenticated-user.type';
import { PortalService } from './portal.service';
import { CreatePortalPaymentReceiptDto } from './dto/create-portal-payment-receipt.dto';
import { CreatePortalInquiryDto } from './dto/create-portal-inquiry.dto';
import { ReviewPortalPaymentReceiptDto } from './dto/review-portal-payment-receipt.dto';
import { CreatePortalSupportTicketDto } from './dto/create-portal-support-ticket.dto';
import { CreatePortalSupportMessageDto } from './dto/create-portal-support-message.dto';
import { UpdatePortalSupportTicketStatusDto } from './dto/update-portal-support-ticket-status.dto';
import { QueryPortalSupportTicketDto } from './dto/query-portal-support-ticket.dto';
import { AssignPortalSupportTicketDto } from './dto/assign-portal-support-ticket.dto';

@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('profile')
  getProfile(@User() user?: AuthenticatedUser) {
    return this.portalService.getProfile(user);
  }

  @Get('orders')
  findOrders(@User() user?: AuthenticatedUser) {
    return this.portalService.findOrders(user);
  }

  @Get('shipments')
  findShipments(@Query() query: QueryParams, @User() user?: AuthenticatedUser) {
    return this.portalService.findShipments(user, query);
  }

  @Get('pricing')
  findPricing(@Query() query: QueryParams, @User() user?: AuthenticatedUser) {
    return this.portalService.findPricing(user, query);
  }

  @Get('products')
  findProducts(@Query() query: QueryParams, @User() user?: AuthenticatedUser) {
    return this.portalService.findProducts(user, query);
  }

  @Get('inquiries')
  findInquiries(@User() user?: AuthenticatedUser) {
    return this.portalService.findInquiries(user);
  }

  @Post('inquiries')
  createInquiry(
    @Body() dto: CreatePortalInquiryDto,
    @User() user?: AuthenticatedUser,
    @Req() request?: Request,
  ) {
    return this.portalService.createInquiry(dto, user, {
      username: user?.username || 'unknown',
      ipAddress: request?.ip || request?.socket.remoteAddress || null,
    });
  }

  @Get('finance/statement')
  getStatement(@User() user?: AuthenticatedUser) {
    return this.portalService.getStatement(user);
  }

  @Get('finance/statement/download')
  async downloadStatement(
    @User() user: AuthenticatedUser | undefined,
    @Res() res: Response,
  ) {
    const file = await this.portalService.exportStatementCsv(user);
    const filename = `statement_of_account_${new Date().toISOString().slice(0, 10)}.csv`;
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': file.length,
    });
    res.end(file);
  }

  @Get('finance/tt-receipts')
  findPaymentReceipts(@User() user?: AuthenticatedUser) {
    return this.portalService.findPaymentReceipts(user);
  }

  @Get('finance/tt-receipts/:_id')
  findPaymentReceipt(
    @Param('_id') recordId: string,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.findPaymentReceiptById(recordId, user);
  }

  @Post('finance/tt-receipts')
  createPaymentReceipt(
    @Body() dto: CreatePortalPaymentReceiptDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.createPaymentReceipt(dto, user);
  }

  @Patch('finance/tt-receipts/:_id/review')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  reviewPaymentReceipt(
    @Param('_id') recordId: string,
    @Body() dto: ReviewPortalPaymentReceiptDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.reviewPaymentReceipt(recordId, dto, user);
  }

  @Get('support/tickets')
  findSupportTickets(
    @Query() query: QueryParams,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.findSupportTickets(user, query);
  }

  @Post('support/tickets')
  createSupportTicket(
    @Body() dto: CreatePortalSupportTicketDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.createSupportTicket(dto, user);
  }

  @Get('support/tickets/:_id')
  findSupportTicket(
    @Param('_id') _id: string,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.findSupportTicket(_id, user);
  }

  @Post('support/tickets/:_id/messages')
  addSupportMessage(
    @Param('_id') _id: string,
    @Body() dto: CreatePortalSupportMessageDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.addSupportMessage(_id, dto, user);
  }

  @Patch('support/tickets/:_id/status')
  updateSupportTicketStatus(
    @Param('_id') _id: string,
    @Body() dto: UpdatePortalSupportTicketStatusDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.updateSupportTicketStatus(_id, dto, user);
  }

  // --- ADMIN SUPPORT TICKETS API ---

  @Get('admin/support/tickets')
  @Roles(
    'ADMIN',
    'MANAGER',
    'SALES_EXPORT',
    'SALES',
    'LOGISTICS',
    'ACCOUNTANT',
    'CHIEF_ACCOUNTANT',
  )
  adminFindSupportTickets(
    @Query() query: QueryPortalSupportTicketDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.adminFindSupportTickets(query, user);
  }

  @Get('admin/support/tickets/:_id')
  @Roles(
    'ADMIN',
    'MANAGER',
    'SALES_EXPORT',
    'SALES',
    'LOGISTICS',
    'ACCOUNTANT',
    'CHIEF_ACCOUNTANT',
  )
  adminFindSupportTicket(
    @Param('_id') _id: string,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.adminFindSupportTicket(_id, user);
  }

  @Post('admin/support/tickets/:_id/messages')
  @Roles(
    'ADMIN',
    'MANAGER',
    'SALES_EXPORT',
    'SALES',
    'LOGISTICS',
    'ACCOUNTANT',
    'CHIEF_ACCOUNTANT',
  )
  adminAddSupportMessage(
    @Param('_id') _id: string,
    @Body() dto: CreatePortalSupportMessageDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.adminAddSupportMessage(_id, dto, user);
  }

  @Patch('admin/support/tickets/:_id/status')
  @Roles(
    'ADMIN',
    'MANAGER',
    'SALES_EXPORT',
    'SALES',
    'LOGISTICS',
    'ACCOUNTANT',
    'CHIEF_ACCOUNTANT',
  )
  adminUpdateSupportTicketStatus(
    @Param('_id') _id: string,
    @Body() dto: UpdatePortalSupportTicketStatusDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.adminUpdateSupportTicketStatus(_id, dto, user);
  }

  @Patch('admin/support/tickets/:_id/assignee')
  @Roles(
    'ADMIN',
    'MANAGER',
    'SALES_EXPORT',
    'SALES',
    'LOGISTICS',
    'ACCOUNTANT',
    'CHIEF_ACCOUNTANT',
  )
  adminAssignSupportTicket(
    @Param('_id') _id: string,
    @Body() dto: AssignPortalSupportTicketDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.adminAssignSupportTicket(_id, dto, user);
  }

  @Get('notifications')
  findNotifications(
    @Query() query: QueryParams,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.findNotifications(user, query);
  }

  @Patch('notifications/read-all')
  markAllNotificationsRead(@User() user?: AuthenticatedUser) {
    return this.portalService.markAllNotificationsRead(user);
  }

  @Patch('notifications/:_id/read')
  markNotificationRead(
    @Param('_id') recordId: string,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.markNotificationRead(recordId, user);
  }

  // Forced trigger for NestJS watcher
  @Get('quotations/:_id')
  findQuotation(@Param('_id') recordId: string, @User() user?: AuthenticatedUser) {
    return this.portalService.findQuotation(recordId, user);
  }

  @Patch('quotations/:_id/accept')
  acceptQuotation(@Param('_id') recordId: string, @User() user?: AuthenticatedUser) {
    return this.portalService.acceptQuotation(recordId, user);
  }

  @Patch('quotations/:_id/reject')
  rejectQuotation(
    @Param('_id') recordId: string,
    @Body('reason') reason: string,
    @User() user?: AuthenticatedUser
  ) {
    return this.portalService.rejectQuotation(recordId, reason, user);
  }

  @Patch('proforma-invoices/:_id/accept')
  acceptProformaInvoice(@Param('_id') recordId: string, @User() user?: AuthenticatedUser) {
    return this.portalService.acceptProformaInvoice(recordId, user);
  }

  @Patch('proforma-invoices/:_id/reject')
  rejectProformaInvoice(
    @Param('_id') recordId: string,
    @Body('reason') reason: string,
    @User() user?: AuthenticatedUser
  ) {
    return this.portalService.rejectProformaInvoice(recordId, reason, user);
  }

  @Get('quotations/:_id/pdf')
  async downloadQuotationPdf(
    @Param('_id') recordId: string,
    @User() user: AuthenticatedUser | undefined,
    @Res() res: Response
  ) {
    const file = await this.portalService.exportQuotationPdf(recordId, user);
    const quotation = await this.portalService.findQuotation(recordId, user);
    const filename = `Quotation_${quotation.quotationNumber || recordId}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': file.length,
    });
    res.end(file);
  }
}
