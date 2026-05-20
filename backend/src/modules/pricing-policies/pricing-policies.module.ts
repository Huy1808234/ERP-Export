import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '@/modules/products/entities/product.entity';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { PricingPoliciesController } from './pricing-policies.controller';
import { PricingPoliciesService } from './pricing-policies.service';
import { PricingPolicy } from './entities/pricing-policy.entity';
import { SalesPriceHistory } from './entities/sales-price-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PricingPolicy,
      SalesPriceHistory,
      Product,
      Partner,
    ]),
  ],
  controllers: [PricingPoliciesController],
  providers: [PricingPoliciesService],
  exports: [PricingPoliciesService],
})
export class PricingPoliciesModule {}
