import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalMatrixController } from './approval-matrix.controller';
import { ApprovalMatrixService } from './approval-matrix.service';
import { ApprovalPolicyService } from './approval-policy.service';
import {
  ApprovalRule,
  ApprovalRuleStep,
} from './entities/approval-rule.entity';
import {
  ApprovalWorkflowRequest,
  ApprovalWorkflowStep,
} from './entities/approval-workflow.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApprovalRule,
      ApprovalRuleStep,
      ApprovalWorkflowRequest,
      ApprovalWorkflowStep,
    ]),
  ],
  controllers: [ApprovalMatrixController],
  providers: [ApprovalMatrixService, ApprovalPolicyService],
  exports: [ApprovalMatrixService, ApprovalPolicyService],
})
export class ApprovalMatrixModule {}
