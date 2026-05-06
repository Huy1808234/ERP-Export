import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TradeFinanceService } from './trade-finance.service';
import { CreateLCDto } from './dto/create-lc.dto';
import { UpdateLCDto } from './dto/update-lc.dto';
import { ResponseMessage, User } from '@/decorator/customize';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import { LCStatus } from './entities/letter-of-credit.entity';
import { TradeFinanceStatus } from './entities/trade-finance-transaction.entity';

@Controller('trade-finance')
export class TradeFinanceController {
  constructor(private readonly tradeFinanceService: TradeFinanceService) {}

  @Post('lc')
  @ResponseMessage('Create L/C successfully')
  createLC(@Body() createLCDto: CreateLCDto, @User() user: UserEntity) {
    return this.tradeFinanceService.createLC(createLCDto, user);
  }

  @Get('lc')
  @ResponseMessage('Fetch all L/Cs with pagination')
  findAllLC(@Query() query: string) {
    return this.tradeFinanceService.findAllLC(query);
  }

  @Get('lc/:id')
  @ResponseMessage('Fetch L/C by id')
  findOneLC(@Param('id') id: string) {
    return this.tradeFinanceService.findOneLC(id);
  }

  @Patch('lc/:id')
  @ResponseMessage('Update L/C successfully')
  updateLC(@Param('id') id: string, @Body() updateLCDto: UpdateLCDto) {
    return this.tradeFinanceService.updateLC(id, updateLCDto);
  }

  @Patch('lc/:id/status')
  @ResponseMessage('Update L/C status')
  updateLCStatus(@Param('id') id: string, @Body('status') status: LCStatus) {
    return this.tradeFinanceService.updateLCStatus(id, status);
  }

  // --- T/T & D/P & D/A Endpoints ---

  @Post('transactions')
  @ResponseMessage('Create trade finance transaction successfully')
  createTransaction(@Body() data: any, @User() user: UserEntity) {
    return this.tradeFinanceService.createTransaction(data, user);
  }

  @Get('transactions')
  @ResponseMessage('Fetch all trade finance transactions')
  findAllTransactions(@Query() query: any) {
    return this.tradeFinanceService.findAllTransactions(query);
  }

  @Patch('transactions/:id/status')
  @ResponseMessage('Update transaction status and post accounting')
  updateTransactionStatus(
    @Param('id') id: string, 
    @Body('status') status: TradeFinanceStatus, 
    @User() user: UserEntity
  ) {
    return this.tradeFinanceService.updateTransactionStatus(id, status, user);
  }
}
