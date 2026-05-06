import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipmentsService } from './shipments.service';
import { LogisticsAllocationService } from './logistics-allocation.service';
import { ShipmentsController } from './shipments.controller';
import { Shipment } from './entities/shipment.entity';
import { Container } from './entities/container.entity';
import { ShipmentDocument } from './entities/shipment-document.entity';
import { ShipmentCostAllocation } from './entities/shipment-cost-allocation.entity';
import { ProformaInvoice } from '../proforma-invoices/entities/proforma-invoice.entity';
import { SalesContractsModule } from '../sales-contracts/sales-contracts.module';
import { AccountingModule } from '../accounting/accounting.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shipment, Container, ShipmentDocument, ShipmentCostAllocation, ProformaInvoice]),
    SalesContractsModule,
    AccountingModule,
    InventoryModule,
  ],
  controllers: [ShipmentsController],
  providers: [ShipmentsService, LogisticsAllocationService],
  exports: [ShipmentsService, LogisticsAllocationService],
})
export class ShipmentsModule {}
