import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  APPROVAL_WORKFLOW_APPROVED_EVENT,
  APPROVAL_WORKFLOW_REJECTED_EVENT,
} from '@/modules/approval-matrix/approval-workflow.events';
import type { ApprovalWorkflowDecisionEvent } from '@/modules/approval-matrix/approval-workflow.events';
import { ApprovalDocumentType } from '@/modules/approval-matrix/entities/approval-rule.entity';
import { SalesContractsService } from './sales-contracts.service';

@Injectable()
export class SalesContractApprovalListener {
  constructor(private readonly salesContractsService: SalesContractsService) {}

  @OnEvent(APPROVAL_WORKFLOW_APPROVED_EVENT)
  async handleApproved(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType === ApprovalDocumentType.SALES_CONTRACT) {
      await this.salesContractsService.completeApprovalWorkflow(
        payload.documentId,
        payload.requestId,
        payload.actorUsername,
      );
      return;
    }

    if (payload.documentType === ApprovalDocumentType.SALES_CONTRACT_CANCEL) {
      await this.salesContractsService.completeCancelWorkflow(
        payload.documentId,
        payload.requestId,
        payload.actorUsername,
        payload.metadata,
      );
    }
  }

  @OnEvent(APPROVAL_WORKFLOW_REJECTED_EVENT)
  async handleRejected(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType === ApprovalDocumentType.SALES_CONTRACT) {
      await this.salesContractsService.rejectApprovalWorkflow(
        payload.documentId,
        payload.requestId,
        payload.actorUsername,
        payload.reason,
      );
      return;
    }

    if (payload.documentType === ApprovalDocumentType.SALES_CONTRACT_CANCEL) {
      await this.salesContractsService.rejectCancelWorkflow(
        payload.documentId,
        payload.requestId,
        payload.actorUsername,
        payload.reason,
        payload.metadata,
      );
    }
  }
}
