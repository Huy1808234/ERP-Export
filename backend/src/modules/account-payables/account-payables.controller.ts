import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles, User } from '@/decorator/customize';
import { AccountPayablesService } from './account-payables.service';
import { CreateAccountPayableDto } from './dto/create-account-payable.dto';
import { UpdateAccountPayableDto } from './dto/update-account-payable.dto';
import { APStatus } from './entities/account-payable.entity';
import {
  CreatePaymentBatchDto,
  MarkPaymentBatchPaidDto,
  ReverseSettlementAuditDto,
  ReviewPaymentBatchDto,
  UpdatePaymentBatchDto,
} from './dto/create-payment-batch.dto';

@Controller('account-payables')
export class AccountPayablesController {
  constructor(private readonly accountPayablesService: AccountPayablesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASING')
  create(@Body() dto: CreateAccountPayableDto) {
    return this.accountPayablesService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASING')
  findAll(
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: APStatus,
  ) {
    return this.accountPayablesService.findAll(vendorId, status);
  }

  @Get('alerts/due-soon')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASING')
  getDueSoon(@Query('days') days?: string) {
    return this.accountPayablesService.getDueSoon(days ? Number(days) : 7);
  }

  @Get('payment-batches')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASING')
  findPaymentBatches(@Query() query: any) {
    return this.accountPayablesService.findAllPaymentBatches(query);
  }

  @Get('settlement-audits')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASING')
  findSettlementAudits(@Query() query: any) {
    return this.accountPayablesService.findSettlementAudits(query);
  }

  @Patch('settlement-audits/:_id/reverse')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  reverseSettlementAudit(
    @Param('_id') recordId: string,
    @User() user: any,
    @Body() dto: ReverseSettlementAuditDto,
  ) {
    return this.accountPayablesService.reverseSettlementAudit(recordId, dto, user);
  }

  @Post('payment-batches')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  createPaymentBatch(@Body() dto: CreatePaymentBatchDto, @User() user: any) {
    return this.accountPayablesService.createPaymentBatch(dto, user);
  }

  @Get('payment-batches/:_id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASING')
  findPaymentBatch(@Param('_id') recordId: string) {
    return this.accountPayablesService.findPaymentBatch(recordId);
  }

  @Patch('payment-batches/:_id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  updatePaymentBatch(@Param('_id') recordId: string, @Body() dto: UpdatePaymentBatchDto) {
    return this.accountPayablesService.updatePaymentBatch(recordId, dto);
  }

  @Patch('payment-batches/:_id/submit')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  submitPaymentBatch(@Param('_id') recordId: string, @User() user: any) {
    return this.accountPayablesService.submitPaymentBatch(recordId, user);
  }

  @Patch('payment-batches/:_id/approve')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  approvePaymentBatch(
    @Param('_id') recordId: string,
    @User() user: any,
    @Body() dto: ReviewPaymentBatchDto,
  ) {
    return this.accountPayablesService.approvePaymentBatch(recordId, user, dto);
  }

  @Patch('payment-batches/:_id/reject')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  rejectPaymentBatch(
    @Param('_id') recordId: string,
    @User() user: any,
    @Body() dto: ReviewPaymentBatchDto,
  ) {
    return this.accountPayablesService.rejectPaymentBatch(recordId, user, dto);
  }

  @Patch('payment-batches/:_id/mark-paid')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  markPaymentBatchPaid(
    @Param('_id') recordId: string,
    @User() user: any,
    @Body() dto: MarkPaymentBatchPaidDto,
  ) {
    return this.accountPayablesService.markPaymentBatchPaid(recordId, dto, user);
  }

  @Get(':_id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASING')
  findOne(@Param('_id') recordId: string) {
    return this.accountPayablesService.findOne(recordId);
  }

  @Patch(':_id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASING')
  update(@Param('_id') recordId: string, @Body() dto: UpdateAccountPayableDto) {
    return this.accountPayablesService.update(recordId, dto);
  }

  @Patch(':_id/approve-payment')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  approveForPayment(
    @Param('_id') recordId: string,
    @User() user: any,
    @Body('note') note?: string,
  ) {
    return this.accountPayablesService.approveForPayment(recordId, user, note);
  }

  @Patch(':_id/record-payment')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  recordPayment(
    @Param('_id') recordId: string,
    @User() user: any,
    @Body('amount') amount: number,
    @Body('note') note?: string,
  ) {
    return this.accountPayablesService.recordPayment(recordId, amount, user, note);
  }

  @Delete(':_id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  remove(@Param('_id') recordId: string) {
    return this.accountPayablesService.remove(recordId);
  }
}
