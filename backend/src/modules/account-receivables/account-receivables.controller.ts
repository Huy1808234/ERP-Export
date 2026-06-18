import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles, User } from '@/decorator/customize';
import { AccountReceivablesService } from './account-receivables.service';
import { CreateAccountReceivableDto } from './dto/create-account-receivable.dto';
import { UpdateAccountReceivableDto } from './dto/update-account-receivable.dto';
import { AllocatePaymentDto } from './dto/allocate-payment.dto';

@Controller('account-receivables')
export class AccountReceivablesController {
  constructor(
    private readonly accountReceivablesService: AccountReceivablesService,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALES')
  create(@Body() dto: CreateAccountReceivableDto, @User() user: any) {
    return this.accountReceivablesService.create(dto, user);
  }

  @Post('sync-shipped')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  syncShipped(@User() user: any) {
    return this.accountReceivablesService.syncShippedContracts(user);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALES')
  findAll(@Query() query: any) {
    return this.accountReceivablesService.findAll(query);
  }

  @Get('aging')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALES')
  getAging() {
    return this.accountReceivablesService.getAging();
  }

  @Get('dso')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALES')
  getDso(@Query('days') days?: string) {
    return this.accountReceivablesService.getDso(Number(days || 90));
  }

  @Get(':_id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALES')
  findOne(@Param('_id') recordId: string) {
    return this.accountReceivablesService.findOne(recordId);
  }

  @Patch(':_id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  update(
    @Param('_id') recordId: string,
    @Body() dto: UpdateAccountReceivableDto,
  ) {
    return this.accountReceivablesService.update(recordId, dto);
  }

  @Patch(':_id/allocate-payment')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  allocatePayment(
    @Param('_id') recordId: string,
    @Body() dto: AllocatePaymentDto,
    @User() user: any,
  ) {
    return this.accountReceivablesService.allocatePayment(recordId, dto, user);
  }
}
