import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesContractsService } from './sales-contracts.service';
import { IncotermsService } from './incoterms.service';
import { SalesContractsController } from './sales-contracts.controller';
import { SalesContract } from './entities/sales-contract.entity';
import { SalesContractItem } from './entities/sales-contract-item.entity';
import { ContractSignature } from './entities/contract-signature.entity';
import { ContractSignatureInvitation } from './entities/contract-signature-invitation.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingPoliciesModule } from '../pricing-policies/pricing-policies.module';
import { ApprovalMatrixModule } from '../approval-matrix/approval-matrix.module';
import { SalesContractApprovalListener } from './sales-contract-approval.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalesContract, SalesContractItem, ContractSignature, ContractSignatureInvitation]),
    InventoryModule,
    PricingPoliciesModule,
    ApprovalMatrixModule,
  ],
  controllers: [SalesContractsController],
  providers: [SalesContractsService, IncotermsService, SalesContractApprovalListener],
  exports: [SalesContractsService, IncotermsService],
})
export class SalesContractsModule {}
