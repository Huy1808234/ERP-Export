import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionOrder, ProductionOutput } from './entities/production-order.entity';
import { ProductionService } from './production.service';
import { ProductionController } from './production.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { LotsModule } from '../lots/lots.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductionOrder, ProductionOutput]),
    InventoryModule,
    LotsModule,
  ],
  controllers: [ProductionController],
  providers: [ProductionService],
  exports: [ProductionService],
})
export class ProductionModule {}
