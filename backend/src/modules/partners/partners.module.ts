import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from './entities/partner.entity';
import { Quotation } from '@/modules/quotations/entities/quotation.entity';
import { ProformaInvoice } from '@/modules/proforma-invoices/entities/proforma-invoice.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/entities/purchase-order.entity';
import { VendorInvoice } from '@/modules/vendor-invoices/entities/vendor-invoice.entity';
import { AccountPayable } from '@/modules/account-payables/entities/account-payable.entity';
import { QualityCheck } from '@/modules/quality-control/entities/quality-check.entity';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';
import { CurrenciesModule } from '../currencies/currencies.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Partner, Quotation, ProformaInvoice, Shipment, PurchaseOrder, VendorInvoice, AccountPayable, QualityCheck]),
    CurrenciesModule,
  ],
  controllers: [PartnersController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
