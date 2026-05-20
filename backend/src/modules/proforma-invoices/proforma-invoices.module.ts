import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProformaInvoicesService } from './proforma-invoices.service';
import { ProformaInvoicesController } from './proforma-invoices.controller';
import { ProformaInvoice } from './entities/proforma-invoice.entity';
import { ProformaInvoiceItem } from './entities/proforma-invoice-item.entity';
import { QuotationsModule } from '../quotations/quotations.module';
import { ProductsModule } from '../products/products.module';
import { CurrenciesModule } from '../currencies/currencies.module';
import { AccountingModule } from '../accounting/accounting.module';
import { ApprovalMatrixModule } from '../approval-matrix/approval-matrix.module';
import { ProformaInvoiceApprovalListener } from './proforma-invoice-approval.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProformaInvoice, ProformaInvoiceItem]),
    QuotationsModule,
    ProductsModule,
    CurrenciesModule,
    AccountingModule,
    ApprovalMatrixModule,
  ],
  controllers: [ProformaInvoicesController],
  providers: [ProformaInvoicesService, ProformaInvoiceApprovalListener],
  exports: [ProformaInvoicesService],
})
export class ProformaInvoicesModule {}
