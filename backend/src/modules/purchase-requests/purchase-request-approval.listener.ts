import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  APPROVAL_WORKFLOW_APPROVED_EVENT,
  APPROVAL_WORKFLOW_REJECTED_EVENT,
} from '../approval-matrix/approval-workflow.events';
import type { ApprovalWorkflowDecisionEvent } from '../approval-matrix/approval-workflow.events';
import { ApprovalDocumentType } from '../approval-matrix/entities/approval-rule.entity';
import {
  PurchaseRequest,
  PurchaseRequestStatus,
} from './entities/purchase-request.entity';

@Injectable()
export class PurchaseRequestApprovalListener {
  constructor(
    @InjectRepository(PurchaseRequest)
    private readonly prRepository: Repository<PurchaseRequest>,
  ) {}

  @OnEvent(APPROVAL_WORKFLOW_APPROVED_EVENT)
  async handleApproved(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType !== ApprovalDocumentType.PURCHASE_REQUEST) return;

    const pr = await this.prRepository.findOne({
      where: { _id: payload.documentId },
    });
    if (!pr || pr.status !== PurchaseRequestStatus.PENDING) return;

    pr.status = PurchaseRequestStatus.APPROVED;
    pr.approvedByUsername = payload.actorUsername;
    pr.approvedAt = new Date();
    pr.rejectionReason = null;
    await this.prRepository.save(pr);
  }

  @OnEvent(APPROVAL_WORKFLOW_REJECTED_EVENT)
  async handleRejected(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType !== ApprovalDocumentType.PURCHASE_REQUEST) return;

    const pr = await this.prRepository.findOne({
      where: { _id: payload.documentId },
    });
    if (!pr || pr.status !== PurchaseRequestStatus.PENDING) return;

    pr.status = PurchaseRequestStatus.REJECTED;
    pr.approvedByUsername = payload.actorUsername;
    pr.approvedAt = new Date();
    pr.rejectionReason = payload.reason || 'Rejected by approval workflow';
    await this.prRepository.save(pr);
  }
}
