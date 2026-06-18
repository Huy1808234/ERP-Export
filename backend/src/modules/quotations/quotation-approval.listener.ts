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
import { Quotation, QuotationStatus } from './entities/quotation.entity';

@Injectable()
export class QuotationApprovalListener {
  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
  ) {}

  @OnEvent(APPROVAL_WORKFLOW_APPROVED_EVENT)
  async handleApproved(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType !== ApprovalDocumentType.QUOTATION) return;

    const quotation = await this.quotationRepository.findOne({
      where: { _id: payload.documentId },
    });
    if (!quotation || quotation.status !== QuotationStatus.PENDING_APPROVAL)
      return;

    quotation.status = QuotationStatus.SENT;
    quotation.approvedByUsername = payload.actorUsername;
    quotation.approvedAt = new Date();
    quotation.rejectedByUsername = null;
    quotation.rejectedAt = null;
    quotation.rejectionReason = null;
    await this.quotationRepository.save(quotation);
  }

  @OnEvent(APPROVAL_WORKFLOW_REJECTED_EVENT)
  async handleRejected(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType !== ApprovalDocumentType.QUOTATION) return;

    const quotation = await this.quotationRepository.findOne({
      where: { _id: payload.documentId },
    });
    if (!quotation || quotation.status !== QuotationStatus.PENDING_APPROVAL)
      return;

    quotation.status = QuotationStatus.REJECTED;
    quotation.rejectedByUsername = payload.actorUsername;
    quotation.rejectedAt = new Date();
    quotation.rejectionReason =
      payload.reason || 'Rejected by approval workflow';
    await this.quotationRepository.save(quotation);
  }
}
