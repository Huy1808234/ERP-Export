import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotationsService } from './quotations.service';
import { QuotationsController } from './quotations.controller';
import { Quotation } from './entities/quotation.entity';
import { QuotationItem } from './entities/quotation-item.entity';
import { CurrenciesModule } from '../currencies/currencies.module';
import { PricingPoliciesModule } from '../pricing-policies/pricing-policies.module';
import { ApprovalMatrixModule } from '../approval-matrix/approval-matrix.module';
import { QuotationApprovalListener } from './quotation-approval.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quotation, QuotationItem]),
    CurrenciesModule,
    PricingPoliciesModule,
    ApprovalMatrixModule,
  ],
  controllers: [QuotationsController],
  providers: [QuotationsService, QuotationApprovalListener],
  exports: [QuotationsService],
})
export class QuotationsModule {}
