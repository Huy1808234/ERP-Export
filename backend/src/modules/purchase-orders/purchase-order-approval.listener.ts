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
  PurchaseOrder,
  PurchaseOrderStatus,
} from './entities/purchase-order.entity';

@Injectable()
export class PurchaseOrderApprovalListener {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepository: Repository<PurchaseOrder>,
  ) {}

  @OnEvent(APPROVAL_WORKFLOW_APPROVED_EVENT)
  async handleApproved(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType !== ApprovalDocumentType.PURCHASE_ORDER) return;

    const po = await this.poRepository.findOne({
      where: { _id: payload.documentId },
    });
    if (!po || po.status !== PurchaseOrderStatus.PENDING_APPROVAL) return;

    po.status = PurchaseOrderStatus.APPROVED;
    po.approvedByUsername = payload.actorUsername;
    po.approvedAt = new Date();
    po.rejectionReason = null;
    await this.poRepository.save(po);
  }

  @OnEvent(APPROVAL_WORKFLOW_REJECTED_EVENT)
  async handleRejected(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType !== ApprovalDocumentType.PURCHASE_ORDER) return;

    const po = await this.poRepository.findOne({
      where: { _id: payload.documentId },
    });
    if (!po || po.status !== PurchaseOrderStatus.PENDING_APPROVAL) return;

    po.status = PurchaseOrderStatus.REJECTED;
    po.approvedByUsername = payload.actorUsername;
    po.approvedAt = new Date();
    po.rejectionReason = payload.reason || 'Rejected by approval workflow';
    await this.poRepository.save(po);
  }
}
