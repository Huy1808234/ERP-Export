import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommercialInvoicesController } from './commercial-invoices.controller';
import { CommercialInvoicesService } from './commercial-invoices.service';
import { CommercialInvoice } from './entities/commercial-invoice.entity';
import { CommercialInvoiceItem } from './entities/commercial-invoice-item.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';
import { ExportDocument } from '@/modules/export-documents/entities/export-document.entity';
import { AccountingModule } from '@/modules/accounting/accounting.module';
import { AccountReceivablesModule } from '@/modules/account-receivables/account-receivables.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommercialInvoice,
      CommercialInvoiceItem,
      Shipment,
      ExportDocument,
    ]),
    AccountingModule,
    AccountReceivablesModule,
  ],
  controllers: [CommercialInvoicesController],
  providers: [CommercialInvoicesService],
  exports: [CommercialInvoicesService],
})
export class CommercialInvoicesModule {}
