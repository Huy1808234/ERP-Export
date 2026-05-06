import { Controller, Get, Query } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { ResponseMessage } from '@/decorator/customize';

@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('journal')
  @ResponseMessage('Fetch all journal entries')
  findAllJournal(@Query() query: any) {
    return this.accountingService.findAllJournal(query);
  }

  @Get('balance')
  @ResponseMessage('Get account balance')
  getAccountBalance(@Query('accountCode') accountCode: string) {
    return this.accountingService.getAccountBalance(accountCode);
  }

  @Get('report/summary')
  @ResponseMessage('Get accounting summary report')
  getSummaryReport(@Query() query: any) {
    return this.accountingService.getSummaryReport(query);
  }

  @Get('debug-ledger')
  @ResponseMessage('Debug ledger')
  async debugLedger() {
    const mgr = this.accountingService['dataSource'].manager;
    const ledgers = await mgr.query(`SELECT * FROM ledger_entries`);
    const pis = await mgr.query(`SELECT id, "piNumber", status, "totalAmountVnd", "customerId" FROM proforma_invoices`);
    return { ledgers, pis };
  }

  @Get('report/aging')
  @ResponseMessage('Get overdue aging report')
  getOverdueAging() {
    return this.accountingService.getOverdueAging();
  }

  @Get('report/balance-sheet')
  @ResponseMessage('Get balance sheet report')
  getBalanceSheet(@Query() query: any) {
    return this.accountingService.getBalanceSheet(query);
  }
}
