import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortalModule } from '@/modules/portal/portal.module';
import { PortalPaymentReceipt } from '@/modules/portal/entities/portal-payment-receipt.entity';
import { SepayTransaction } from './entities/sepay-transaction.entity';
import { SepayController } from './sepay.controller';
import { SepayService } from './sepay.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SepayTransaction, PortalPaymentReceipt]),
    PortalModule,
  ],
  controllers: [SepayController],
  providers: [SepayService],
  exports: [SepayService],
})
export class SepayModule {}
