import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryLedger } from './entities/inventory-ledger.entity';
import { Product } from '../products/entities/product.entity';
import { AccountingModule } from '../accounting/accounting.module';
import { LotsModule } from '../lots/lots.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryLedger, Product]),
    AccountingModule,
    LotsModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
