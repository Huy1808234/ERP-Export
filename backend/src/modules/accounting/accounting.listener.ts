import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AccountingService } from './accounting.service';
import { CurrenciesService } from '../currencies/currencies.service';

@Injectable()
export class AccountingListener {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly currenciesService: CurrenciesService,
  ) {}

  @OnEvent('shipment.on_board')
  async handleShipmentOnBoard(payload: any) {
    const { shipment } = payload;
    const pi = shipment.proformaInvoice;
    
    if (pi) {
      const amountVnd = await this.currenciesService.convertToBase(pi.totalAmount, pi.currency || 'USD');
      
      await this.accountingService.createJournalEntry({
        description: `Doanh thu xuất khẩu ${shipment.shipmentNumber} - PI: ${pi.piNumber}`,
        referenceType: 'SHIPMENT',
        referenceId: shipment.id,
        items: [
          { accountCode: '131', debit: amountVnd, credit: 0, partnerId: pi.customerId },
          { accountCode: '511', debit: 0, credit: amountVnd }
        ]
      });
    }
  }

}
