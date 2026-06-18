import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '@/modules/products/entities/product.entity';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { PortsModule } from '@/modules/ports/ports.module';
import { PricingPoliciesController } from './pricing-policies.controller';
import { PricingPoliciesService } from './pricing-policies.service';
import { PricingPolicy } from './entities/pricing-policy.entity';
import { SalesPriceHistory } from './entities/sales-price-history.entity';
import { CurrenciesModule } from '../currencies/currencies.module';
import { ApprovalMatrixModule } from '../approval-matrix/approval-matrix.module';

import { PricingPolicyApprovalListener } from './pricing-policy-approval.listener';

@Module({
  imports: [
    CurrenciesModule,
    PortsModule,
    ApprovalMatrixModule,
    TypeOrmModule.forFeature([
      PricingPolicy,
      SalesPriceHistory,
      Product,
      Partner,
    ]),
  ],
  controllers: [PricingPoliciesController],
  providers: [PricingPoliciesService, PricingPolicyApprovalListener],
  exports: [PricingPoliciesService],
})
export class PricingPoliciesModule {}
