import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { Product } from './entities/product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsListener } from './products.listener';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Partner]),
    InventoryModule
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsListener],
  exports: [ProductsService],
})
export class ProductsModule {}
