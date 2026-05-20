import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  APPROVAL_WORKFLOW_APPROVED_EVENT,
  APPROVAL_WORKFLOW_REJECTED_EVENT,
} from '../approval-matrix/approval-workflow.events';
import type { ApprovalWorkflowDecisionEvent } from '../approval-matrix/approval-workflow.events';
import { ApprovalDocumentType } from '../approval-matrix/entities/approval-rule.entity';
import { InventoryService } from './inventory.service';

@Injectable()
export class InventoryAdjustmentApprovalListener {
  constructor(private readonly inventoryService: InventoryService) {}

  @OnEvent(APPROVAL_WORKFLOW_APPROVED_EVENT)
  async handleApproved(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType !== ApprovalDocumentType.INVENTORY_ADJUSTMENT)
      return;

    await this.inventoryService.approveInventoryAdjustmentFromWorkflow(
      payload.documentId,
      payload.actorUsername,
    );
  }

  @OnEvent(APPROVAL_WORKFLOW_REJECTED_EVENT)
  async handleRejected(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType !== ApprovalDocumentType.INVENTORY_ADJUSTMENT)
      return;

    await this.inventoryService.rejectInventoryAdjustmentFromWorkflow(
      payload.documentId,
      payload.actorUsername,
      payload.reason,
    );
  }
}
