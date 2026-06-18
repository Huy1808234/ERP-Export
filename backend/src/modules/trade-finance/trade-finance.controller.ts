import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { TradeFinanceService } from './trade-finance.service';
import { CreateLCDto } from './dto/create-lc.dto';
import { UpdateLCDto } from './dto/update-lc.dto';
import { ResponseMessage, Roles, User } from '@/decorator/customize';
import type { QueryParams } from '@/common/types/authenticated-user.type';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import { LCStatus } from './entities/letter-of-credit.entity';
import { TradeFinanceStatus } from './entities/trade-finance-transaction.entity';
import type { TradeFinanceTransaction } from './entities/trade-finance-transaction.entity';
import { CollectionOrderStatus } from './entities/collection-order.entity';
import type { CollectionOrder } from './entities/collection-order.entity';
import { CreateLCDiscrepancyDto } from './dto/create-lc-discrepancy.dto';
import { ResolveLCDiscrepancyDto } from './dto/resolve-lc-discrepancy.dto';

type CreateCollectionPayload = Partial<CollectionOrder>;
type CreateTradeFinanceTransactionPayload = Partial<TradeFinanceTransaction> & {
  vendorInvoiceIds?: string[];
};

const TRADE_FINANCE_READ_ROLES = [
  'ADMIN',
  'DIRECTOR',
  'MANAGER',
  'FINANCE',
  'ACCOUNTANT',
  'ACCOUNTING',
  'CHIEF_ACCOUNTANT',
  'TREASURY',
  'SALES_EXPORT',
];

const TRADE_FINANCE_WRITE_ROLES = [
  'ADMIN',
  'DIRECTOR',
  'MANAGER',
  'FINANCE',
  'ACCOUNTANT',
  'ACCOUNTING',
  'CHIEF_ACCOUNTANT',
  'TREASURY',
];

@Controller('trade-finance')
@Roles(...TRADE_FINANCE_READ_ROLES)
export class TradeFinanceController {
  constructor(private readonly tradeFinanceService: TradeFinanceService) {}

  @Post('lc')
  @Roles(...TRADE_FINANCE_WRITE_ROLES)
  @ResponseMessage('Create L/C successfully')
  createLC(@Body() createLCDto: CreateLCDto, @User() user: UserEntity) {
    return this.tradeFinanceService.createLC(createLCDto, user);
  }

  @Get('lc')
  @ResponseMessage('Fetch all L/Cs with pagination')
  findAllLC(@Query() query: QueryParams) {
    return this.tradeFinanceService.findAllLC(query);
  }

  @Get('lc/alerts')
  @ResponseMessage('Fetch L/C deadline and discrepancy alerts')
  getLCAlerts(@Query('days') days?: string): Promise<Record<string, unknown>> {
    return this.tradeFinanceService.getLCAlerts(days ? Number(days) : 14);
  }

  @Get('lc/deadline-dashboard')
  @ResponseMessage('Fetch detailed L/C deadline dashboard')
  getLCDeadlineDashboard(
    @Query('days') days?: string,
  ): Promise<Record<string, unknown>> {
    return this.tradeFinanceService.getLCAlerts(days ? Number(days) : 14);
  }

  @Post('lc/deadline-dashboard/notify')
  @Roles(...TRADE_FINANCE_WRITE_ROLES)
  @ResponseMessage('Publish L/C deadline notifications')
  publishLCDeadlineNotifications(
    @Query('days') days?: string,
    @User() user?: UserEntity,
  ): Promise<Record<string, unknown>> {
    return this.tradeFinanceService.publishDeadlineNotifications(
      days ? Number(days) : 14,
      user?.username || 'system',
    );
  }

  @Get('lc/:_id')
  @ResponseMessage('Fetch L/C by recordId')
  findOneLC(@Param('_id') recordId: string) {
    return this.tradeFinanceService.findOneLC(recordId);
  }

  // --- COLLECTION ORDERS (D/P, D/A) ---

  @Get('collections')
  findAllCollections(@Query() query: QueryParams) {
    return this.tradeFinanceService.findAllCollections(query);
  }

  @Post('collections')
  @Roles(...TRADE_FINANCE_WRITE_ROLES)
  createCollection(
    @Body() data: CreateCollectionPayload,
    @User() user: UserEntity,
  ) {
    return this.tradeFinanceService.createCollection(data, user);
  }

  @Patch('collections/:_id/status')
  @Roles(...TRADE_FINANCE_WRITE_ROLES)
  updateCollectionStatus(
    @Param('_id') recordId: string,
    @Body('status') status: CollectionOrderStatus,
  ) {
    return this.tradeFinanceService.updateCollectionStatus(recordId, status);
  }

  // --- TRANSACTIONS ---

  @Patch('lc/:_id')
  @Roles(...TRADE_FINANCE_WRITE_ROLES)
  @ResponseMessage('Update L/C successfully')
  updateLC(@Param('_id') recordId: string, @Body() updateLCDto: UpdateLCDto) {
    return this.tradeFinanceService.updateLC(recordId, updateLCDto);
  }

  @Patch('lc/:_id/status')
  @Roles(...TRADE_FINANCE_WRITE_ROLES)
  @ResponseMessage('Update L/C status')
  updateLCStatus(
    @Param('_id') recordId: string,
    @Body('status') status: LCStatus,
  ) {
    return this.tradeFinanceService.updateLCStatus(recordId, status);
  }

  @Get('lc/:_id/discrepancies')
  @ResponseMessage('Fetch L/C discrepancies')
  findLCDiscrepancies(@Param('_id') recordId: string) {
    return this.tradeFinanceService.findLCDiscrepancies(recordId);
  }

  @Post('lc/:_id/discrepancies')
  @Roles(...TRADE_FINANCE_WRITE_ROLES)
  @ResponseMessage('Create L/C discrepancy')
  createLCDiscrepancy(
    @Param('_id') recordId: string,
    @Body() dto: CreateLCDiscrepancyDto,
    @User() user: UserEntity,
  ) {
    return this.tradeFinanceService.createLCDiscrepancy(recordId, dto, user);
  }

  @Patch('lc/:_id/discrepancies/:discrepancy_id/resolve')
  @Roles(...TRADE_FINANCE_WRITE_ROLES)
  @ResponseMessage('Resolve L/C discrepancy')
  resolveLCDiscrepancy(
    @Param('_id') recordId: string,
    @Param('discrepancy_id') discrepancy_id: string,
    @Body() dto: ResolveLCDiscrepancyDto,
    @User() user: UserEntity,
  ) {
    return this.tradeFinanceService.resolveLCDiscrepancy(
      recordId,
      discrepancy_id,
      dto,
      user,
    );
  }

  // --- T/T & D/P & D/A Endpoints ---

  @Post('transactions')
  @Roles(...TRADE_FINANCE_WRITE_ROLES)
  @ResponseMessage('Create trade finance transaction successfully')
  createTransaction(
    @Body() data: CreateTradeFinanceTransactionPayload,
    @User() user: UserEntity,
  ) {
    return this.tradeFinanceService.createTransaction(data, user);
  }

  @Get('transactions')
  @ResponseMessage('Fetch all trade finance transactions')
  findAllTransactions(@Query() query: QueryParams) {
    return this.tradeFinanceService.findAllTransactions(query);
  }

  @Get('transactions/reconciliation/sales-contract/:_id')
  @ResponseMessage('Fetch T/T reconciliation summary')
  getReconciliationSummary(@Param('_id') recordId: string) {
    return this.tradeFinanceService.getReconciliationSummary(recordId);
  }

  @Patch('transactions/:_id/status')
  @Roles(...TRADE_FINANCE_WRITE_ROLES)
  @ResponseMessage('Update transaction status and post accounting')
  updateTransactionStatus(
    @Param('_id') recordId: string,
    @Body('status') status: TradeFinanceStatus,
    @User() user: UserEntity,
  ) {
    return this.tradeFinanceService.updateTransactionStatus(
      recordId,
      status,
      user,
    );
  }
}
