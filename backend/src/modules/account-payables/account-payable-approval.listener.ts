import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  APPROVAL_WORKFLOW_APPROVED_EVENT,
  APPROVAL_WORKFLOW_REJECTED_EVENT,
} from '@/modules/approval-matrix/approval-workflow.events';
import type { ApprovalWorkflowDecisionEvent } from '@/modules/approval-matrix/approval-workflow.events';
import { ApprovalDocumentType } from '@/modules/approval-matrix/entities/approval-rule.entity';
import { AccountPayablesService } from './account-payables.service';

@Injectable()
export class AccountPayableApprovalListener {
  constructor(private readonly accountPayablesService: AccountPayablesService) {}

  @OnEvent(APPROVAL_WORKFLOW_APPROVED_EVENT)
  async handleApproved(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType === ApprovalDocumentType.AP_PAYMENT_BATCH) {
      await this.accountPayablesService.completePaymentBatchWorkflowApproval(
        payload.documentId,
        payload.actorUsername,
        payload.reason,
      );
      return;
    }

    if (payload.documentType === ApprovalDocumentType.AP_PAYMENT_REVERSAL) {
      await this.accountPayablesService.completeSettlementReversalWorkflow(
        payload.documentId,
        payload.requestId,
        payload.actorUsername,
        payload.metadata,
      );
    }
  }

  @OnEvent(APPROVAL_WORKFLOW_REJECTED_EVENT)
  async handleRejected(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType === ApprovalDocumentType.AP_PAYMENT_BATCH) {
      await this.accountPayablesService.rejectPaymentBatchWorkflow(
        payload.documentId,
        payload.actorUsername,
        payload.reason,
      );
      return;
    }

    if (payload.documentType === ApprovalDocumentType.AP_PAYMENT_REVERSAL) {
      await this.accountPayablesService.rejectSettlementReversalWorkflow(
        payload.documentId,
        payload.requestId,
      );
    }
  }
}
