import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountReceivable } from '@/modules/account-receivables/entities/account-receivable.entity';
import { PaymentAllocation } from '@/modules/account-receivables/entities/payment-allocation.entity';
import { FilesModule } from '@/modules/files/files.module';
import { Inquiry } from '@/modules/inquiries/entities/inquiry.entity';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { PricingPoliciesModule } from '@/modules/pricing-policies/pricing-policies.module';
import { Product } from '@/modules/products/entities/product.entity';
import { ProformaInvoice } from '@/modules/proforma-invoices/entities/proforma-invoice.entity';
import { Quotation } from '@/modules/quotations/entities/quotation.entity';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import { TradeFinanceModule } from '@/modules/trade-finance/trade-finance.module';
import { AuditLog } from '@/modules/audit-logs/entities/audit-log.entity';
import { CommercialInvoice } from '@/modules/commercial-invoices/entities/commercial-invoice.entity';
import { SalesContractsModule } from '@/modules/sales-contracts/sales-contracts.module';
import { CustomerController } from './customer.controller';
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
      Inquiry,
      Partner,
      Product,
      Quotation,
      UserEntity,
      ProformaInvoice,
      SalesContract,
      Shipment,
      AuditLog,
      CommercialInvoice,
      PortalNotification,
      PortalPaymentReceipt,
      PortalSupportMessage,
      PortalSupportTicket,
    ]),
    FilesModule,
    PricingPoliciesModule,
    TradeFinanceModule,
    SalesContractsModule,
  ],
  controllers: [PortalController, CustomerController],
  providers: [PortalService],
  exports: [PortalService],
})
export class PortalModule {}
