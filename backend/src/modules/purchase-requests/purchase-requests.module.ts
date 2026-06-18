import { Module } from '@nestjs/common';
import { PurchaseRequestsService } from './purchase-requests.service';
import { PurchaseRequestsController } from './purchase-requests.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseRequest } from './entities/purchase-request.entity';
import { PurchaseRequestItem } from './entities/purchase-request-item.entity';
import { ApprovalMatrixModule } from '../approval-matrix/approval-matrix.module';
import { PurchaseRequestApprovalListener } from './purchase-request-approval.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseRequest, PurchaseRequestItem]),
    ApprovalMatrixModule,
  ],
  controllers: [PurchaseRequestsController],
  providers: [PurchaseRequestsService, PurchaseRequestApprovalListener],
  exports: [PurchaseRequestsService],
})
export class PurchaseRequestsModule {}
