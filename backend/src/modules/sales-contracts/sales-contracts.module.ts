import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesContractsService } from './sales-contracts.service';
import { IncotermsService } from './incoterms.service';
import { SalesContractsController } from './sales-contracts.controller';
import { SalesContract } from './entities/sales-contract.entity';
import { SalesContractItem } from './entities/sales-contract-item.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalesContract, SalesContractItem]),
    InventoryModule,
    AccountingModule
  ],
  controllers: [SalesContractsController],
  providers: [SalesContractsService, IncotermsService],
  exports: [SalesContractsService, IncotermsService],
})
export class SalesContractsModule {}
