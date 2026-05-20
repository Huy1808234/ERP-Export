import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { Product } from './entities/product.entity';
import { ProductChangeRequest } from './entities/product-change-request.entity';
import { ProductVersion } from './entities/product-version.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsListener } from './products.listener';
import { InventoryModule } from '../inventory/inventory.module';
import { ApprovalMatrixModule } from '@/modules/approval-matrix/approval-matrix.module';
import { CurrenciesModule } from '@/modules/currencies/currencies.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Partner,
      ProductChangeRequest,
      ProductVersion,
    ]),
    InventoryModule,
    ApprovalMatrixModule,
    CurrenciesModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsListener],
  exports: [ProductsService],
})
export class ProductsModule {}
