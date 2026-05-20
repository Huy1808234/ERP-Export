import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  APPROVAL_WORKFLOW_APPROVED_EVENT,
  APPROVAL_WORKFLOW_REJECTED_EVENT,
} from '@/modules/approval-matrix/approval-workflow.events';
import type { ApprovalWorkflowDecisionEvent } from '@/modules/approval-matrix/approval-workflow.events';
import { ApprovalDocumentType } from '@/modules/approval-matrix/entities/approval-rule.entity';
import { ExportDocumentsService } from './export-documents.service';

@Injectable()
export class ExportDocumentApprovalListener {
  constructor(private readonly exportDocumentsService: ExportDocumentsService) {}

  @OnEvent(APPROVAL_WORKFLOW_APPROVED_EVENT)
  async handleApproved(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType !== ApprovalDocumentType.EXPORT_DOCUMENT_REVIEW) return;

    await this.exportDocumentsService.completeDocumentReviewWorkflow(
      payload.documentId,
      payload.requestId,
      payload.actorUsername,
      payload.metadata,
    );
  }

  @OnEvent(APPROVAL_WORKFLOW_REJECTED_EVENT)
  async handleRejected(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType !== ApprovalDocumentType.EXPORT_DOCUMENT_REVIEW) return;

    await this.exportDocumentsService.rejectDocumentReviewWorkflow(
      payload.documentId,
      payload.requestId,
      payload.actorUsername,
      payload.reason,
    );
  }
}
