import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountReceivable } from '@/modules/account-receivables/entities/account-receivable.entity';
import { PaymentAllocation } from '@/modules/account-receivables/entities/payment-allocation.entity';
import { FilesModule } from '@/modules/files/files.module';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';
import { TradeFinanceModule } from '@/modules/trade-finance/trade-finance.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { PortalNotification } from './entities/portal-notification.entity';
import { PortalPaymentReceipt } from './entities/portal-payment-receipt.entity';
import { PortalSupportMessage } from './entities/portal-support-message.entity';
import { PortalSupportTicket } from './entities/portal-support-ticket.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountReceivable,
      PaymentAllocation,
      SalesContract,
      Shipment,
      PortalNotification,
      PortalPaymentReceipt,
      PortalSupportMessage,
      PortalSupportTicket,
    ]),
    FilesModule,
    TradeFinanceModule,
  ],
  controllers: [PortalController],
  providers: [PortalService],
  exports: [PortalService],
})
export class PortalModule {}
