import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles, User } from '@/decorator/customize';
import type {
  AuthenticatedUser,
  QueryParams,
} from '@/common/types/authenticated-user.type';
import { PortalService } from './portal.service';
import { CreatePortalPaymentReceiptDto } from './dto/create-portal-payment-receipt.dto';
import { ReviewPortalPaymentReceiptDto } from './dto/review-portal-payment-receipt.dto';
import { CreatePortalSupportTicketDto } from './dto/create-portal-support-ticket.dto';
import { CreatePortalSupportMessageDto } from './dto/create-portal-support-message.dto';
import { UpdatePortalSupportTicketStatusDto } from './dto/update-portal-support-ticket-status.dto';

type CreatePortalInquiryBody = {
  product_id: string;
  quantity: number;
  note?: string | null;
  customerPhone?: string | null;
};

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
  findShipments(@User() user?: AuthenticatedUser) {
    return this.portalService.findShipments(user);
  }

  @Get('pricing')
  findPricing(@Query() query: QueryParams, @User() user?: AuthenticatedUser) {
    return this.portalService.findPricing(user, query);
  }

  @Get('inquiries')
  findInquiries(@User() user?: AuthenticatedUser) {
    return this.portalService.findInquiries(user);
  }

  @Post('inquiries')
  createInquiry(
    @Body() dto: CreatePortalInquiryBody,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.createInquiry(dto, user);
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
    @Param('_id') recordId: string,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.findSupportTicket(recordId, user);
  }

  @Post('support/tickets/:_id/messages')
  addSupportMessage(
    @Param('_id') recordId: string,
    @Body() dto: CreatePortalSupportMessageDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.addSupportMessage(recordId, dto, user);
  }

  @Patch('support/tickets/:_id/status')
  updateSupportTicketStatus(
    @Param('_id') recordId: string,
    @Body() dto: UpdatePortalSupportTicketStatusDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.portalService.updateSupportTicketStatus(recordId, dto, user);
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
}
