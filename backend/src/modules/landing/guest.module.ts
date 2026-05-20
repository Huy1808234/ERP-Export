import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestService } from './guest.service';
import { GuestController } from './guest.controller';
import { Shipment } from '../shipments/entities/shipment.entity';
import { Partner } from '../partners/entities/partner.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { ProformaInvoice } from '../proforma-invoices/entities/proforma-invoice.entity';
import { SalesContract } from '../sales-contracts/entities/sales-contract.entity';
import { Product } from '../products/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shipment,
      Partner,
      Quotation,
      PurchaseOrder,
      ProformaInvoice,
      SalesContract,
      Product
    ]),
  ],
  controllers: [GuestController],
  providers: [GuestService],
  exports: [GuestService],
})
export class GuestModule {}
