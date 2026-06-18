import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountPayable } from '@/modules/account-payables/entities/account-payable.entity';
import { GoodsReceipt } from '@/modules/goods-receipts/entities/goods-receipt.entity';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/entities/purchase-order.entity';
import { QualityCheck } from '@/modules/quality-control/entities/quality-check.entity';
import { VendorEvaluation } from './entities/vendor-evaluation.entity';
import { VendorEvaluationsController } from './vendor-evaluations.controller';
import { VendorEvaluationsService } from './vendor-evaluations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VendorEvaluation,
      Partner,
      AccountPayable,
      PurchaseOrder,
      GoodsReceipt,
      QualityCheck,
    ]),
  ],
  controllers: [VendorEvaluationsController],
  providers: [VendorEvaluationsService],
  exports: [VendorEvaluationsService],
})
export class VendorEvaluationsModule {}
