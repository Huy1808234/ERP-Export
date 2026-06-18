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
import { AccountingService } from './accounting.service';
import {
  RequirePermissions,
  ResponseMessage,
  User,
} from '@/decorator/customize';
import type {
  AuthenticatedUser,
  QueryParams,
} from '@/common/types/authenticated-user.type';
import { RunFxRevaluationDto } from './dto/run-fx-revaluation.dto';
import { CreateVatRefundDossierDto } from './dto/create-vat-refund-dossier.dto';
import {
  AccountingNoteDto,
  CloseAccountingPeriodDto,
  LockAccountingPeriodDto,
  OpenAccountingPeriodDto,
  ReopenAccountingPeriodDto,
  VatRefundApprovalDto,
  VatRefundPaymentDto,
  VatRefundRejectionDto,
} from './dto/accounting-actions.dto';

@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('journal')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Fetch all journal entries')
  findAllJournal(@Query() query: QueryParams) {
    return this.accountingService.findAllJournal(query);
  }

  @Get('balance')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Get account balance')
  getAccountBalance(@Query('accountCode') accountCode: string) {
    return this.accountingService.getAccountBalance(accountCode);
  }

  @Get('report/summary')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Get accounting summary report')
  getSummaryReport(@Query() query: QueryParams) {
    return this.accountingService.getSummaryReport(query);
  }

  @Get('report/aging')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Get overdue aging report')
  getOverdueAging() {
    return this.accountingService.getOverdueAging();
  }

  @Get('report/balance-sheet')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Get balance sheet report')
  getBalanceSheet(@Query() query: QueryParams) {
    return this.accountingService.getBalanceSheet(query);
  }

  @Get('report/trend')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Get accounting trend report')
  getTrendReport(@Query() query: QueryParams) {
    return this.accountingService.getTrendReport(query);
  }

  @Get('report/shipment/:shipmentId/profitability')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Get shipment profitability report')
  getShipmentProfitability(@Param('shipmentId') shipmentId: string) {
    return this.accountingService.getShipmentProfitability(shipmentId);
  }

  @Get('report/pl-drilldown')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Get P&L drill down details')
  getPLDrilldown(@Query() query: QueryParams) {
    return this.accountingService.getPLDrilldown(query);
  }

  @Post('close-period')
  @RequirePermissions('write:accounting')
  @ResponseMessage('Close accounting period')
  closePeriod(
    @Body() body: CloseAccountingPeriodDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.accountingService.closePeriod(body, user);
  }

  @Get('periods')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Fetch accounting periods')
  findPeriods(@Query() query: QueryParams) {
    return this.accountingService.findPeriods(query);
  }

  @Get('periods/:_id/close-policy')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Preview accounting period close policy')
  getPeriodClosePolicy(@Param('_id') recordId: string) {
    return this.accountingService.getPeriodClosePolicy(recordId);
  }

  @Get('periods/:_id/close-packets')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Fetch close packets for accounting period')
  findPeriodClosePackets(
    @Param('_id') recordId: string,
    @Query() query: QueryParams,
  ) {
    return this.accountingService.findPeriodClosePackets(recordId, query);
  }

  @Get('tax-report-runs')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Fetch frozen tax report runs')
  findTaxReportRuns(@Query() query: QueryParams) {
    return this.accountingService.findTaxReportRuns(query);
  }

  @Get('close-packets')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Fetch accounting period close packets')
  findClosePackets(@Query() query: QueryParams) {
    return this.accountingService.findClosePackets(query);
  }

  @Post('periods/open')
  @RequirePermissions('write:accounting')
  @ResponseMessage('Open accounting period')
  openPeriod(
    @Body() body: OpenAccountingPeriodDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.accountingService.openPeriod(body, user);
  }

  @Post('periods/:_id/close')
  @RequirePermissions('write:accounting')
  @ResponseMessage('Close accounting period by _id')
  closePeriodById(
    @Param('_id') recordId: string,
    @Body() body: AccountingNoteDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.accountingService.closePeriodById(recordId, body, user);
  }

  @Patch('periods/:_id/reopen')
  @RequirePermissions('write:accounting')
  @ResponseMessage('Reopen accounting period')
  reopenPeriod(
    @Param('_id') recordId: string,
    @Body() body: ReopenAccountingPeriodDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.accountingService.reopenPeriod(recordId, body, user);
  }

  @Patch('periods/:_id/lock')
  @RequirePermissions('write:accounting')
  @ResponseMessage('Lock accounting period permanently')
  lockPeriod(
    @Param('_id') recordId: string,
    @Body() body: LockAccountingPeriodDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.accountingService.lockPeriod(recordId, body, user);
  }

  @Get('report/ar-aging')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Get AR aging report')
  getARAging() {
    return this.accountingService.getARAging();
  }

  @Get('report/ar-aging-details')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Get AR aging detail report by customer')
  getARAgingDetails(@Query() query: QueryParams) {
    return this.accountingService.getARAgingDetails(query);
  }

  @Get('report/ap-aging-details')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Get AP aging detail report by vendor')
  getAPAgingDetails(@Query() query: QueryParams) {
    return this.accountingService.getAPAgingDetails(query);
  }

  @Get('report/cash-flow')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Get cash flow report')
  getCashFlow(@Query() query: QueryParams) {
    return this.accountingService.getCashFlowReport(query);
  }

  @Get('report/vat')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Get VAT report')
  getVatReport(@Query() query: QueryParams) {
    return this.accountingService.getVatReport(query);
  }

  @Get('report/tax/export')
  @RequirePermissions('read:accounting')
  async exportTaxReport(
    @Query() query: { startDate?: string; endDate?: string },
    @Res() res: Response,
  ) {
    const file = await this.accountingService.exportTaxReportCsv(query);
    const suffix =
      `${query.startDate || 'start'}_${query.endDate || 'end'}`.replace(
        /[^a-zA-Z0-9_.-]/g,
        '_',
      );
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tax_report_${suffix}.csv"`,
      'Content-Length': file.length,
    });
    res.end(file);
  }

  @Get('report/tax')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Get production tax report')
  getTaxReport(@Query() query: QueryParams) {
    return this.accountingService.getVatReport(query);
  }

  @Get('report/ratios')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Get financial ratios')
  getRatios(@Query() query: QueryParams) {
    return this.accountingService.getFinancialRatios(query);
  }

  @Get('fx-revaluations')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Fetch unrealized FX revaluations')
  findFxRevaluations(@Query() query: QueryParams) {
    return this.accountingService.findFxRevaluations(query);
  }

  @Post('fx-revaluations/run')
  @RequirePermissions('write:accounting')
  @ResponseMessage('Run unrealized FX revaluation')
  runFxRevaluation(
    @Body() body: RunFxRevaluationDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.accountingService.runUnrealizedFxRevaluation(body, user);
  }

  @Get('vat-refunds')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Fetch VAT refund dossiers')
  findVatRefunds(@Query() query: QueryParams) {
    return this.accountingService.findVatRefundDossiers(query);
  }

  @Post('vat-refunds')
  @RequirePermissions('write:accounting')
  @ResponseMessage('Create VAT refund dossier')
  createVatRefund(
    @Body() body: CreateVatRefundDossierDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.accountingService.createVatRefundDossier(body, user);
  }

  @Patch('vat-refunds/:_id/submit')
  @RequirePermissions('write:accounting')
  @ResponseMessage('Submit VAT refund dossier')
  submitVatRefund(
    @Param('_id') recordId: string,
    @User() user?: AuthenticatedUser,
  ) {
    return this.accountingService.submitVatRefund(recordId, user);
  }

  @Patch('vat-refunds/:_id/approve')
  @RequirePermissions('write:accounting')
  @ResponseMessage('Approve VAT refund dossier')
  approveVatRefund(
    @Param('_id') recordId: string,
    @Body() body: VatRefundApprovalDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.accountingService.approveVatRefund(recordId, body, user);
  }

  @Patch('vat-refunds/:_id/pay')
  @RequirePermissions('write:accounting')
  @ResponseMessage('Pay VAT refund dossier')
  payVatRefund(
    @Param('_id') recordId: string,
    @Body() body: VatRefundPaymentDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.accountingService.payVatRefund(recordId, body, user);
  }

  @Patch('vat-refunds/:_id/reject')
  @RequirePermissions('write:accounting')
  @ResponseMessage('Reject VAT refund dossier')
  rejectVatRefund(
    @Param('_id') recordId: string,
    @Body() body: VatRefundRejectionDto,
    @User() user?: AuthenticatedUser,
  ) {
    return this.accountingService.rejectVatRefund(recordId, body, user);
  }

  @Get('audit-events')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Fetch immutable accounting audit events')
  findAuditEvents(@Query() query: QueryParams) {
    return this.accountingService.findAuditEvents(query);
  }

  @Get('audit-events/verify')
  @RequirePermissions('read:accounting')
  @ResponseMessage('Verify accounting audit hash chain')
  verifyAuditChain() {
    return this.accountingService.verifyAuditChain();
  }
}
