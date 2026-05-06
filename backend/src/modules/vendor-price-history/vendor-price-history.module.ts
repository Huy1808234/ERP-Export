import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { VendorPriceHistory } from './entities/vendor-price-history.entity';
import { VendorPriceHistoryController } from './vendor-price-history.controller';
import { VendorPriceHistoryService } from './vendor-price-history.service';

@Module({
  imports: [TypeOrmModule.forFeature([VendorPriceHistory, Partner, Product])],
  controllers: [VendorPriceHistoryController],
  providers: [VendorPriceHistoryService],
  exports: [VendorPriceHistoryService],
})
export class VendorPriceHistoryModule {}
