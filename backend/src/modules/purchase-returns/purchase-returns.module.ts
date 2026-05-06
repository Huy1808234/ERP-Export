import { Module } from '@nestjs/common';
import { PurchaseReturnsService } from './purchase-returns.service';
import { PurchaseReturnsController } from './purchase-returns.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseReturn, PurchaseReturnItem } from './entities/purchase-return.entity';
import { Product } from '../products/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PurchaseReturn, PurchaseReturnItem, Product])],
  controllers: [PurchaseReturnsController],
  providers: [PurchaseReturnsService],
})
export class PurchaseReturnsModule {}
