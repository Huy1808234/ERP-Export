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
import { PIStatus, ProformaInvoice } from './entities/proforma-invoice.entity';

@Injectable()
export class ProformaInvoiceApprovalListener {
  constructor(
    @InjectRepository(ProformaInvoice)
    private readonly piRepository: Repository<ProformaInvoice>,
  ) {}

  @OnEvent(APPROVAL_WORKFLOW_APPROVED_EVENT)
  async handleApproved(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType !== ApprovalDocumentType.PROFORMA_INVOICE) return;

    const pi = await this.piRepository.findOne({
      where: { _id: payload.documentId },
    });
    if (!pi || pi.status !== PIStatus.PENDING_APPROVAL) return;

    pi.status = PIStatus.SENT;
    pi.approvedByUsername = payload.actorUsername;
    pi.approvedAt = new Date();
    pi.rejectedByUsername = null;
    pi.rejectedAt = null;
    pi.rejectionReason = null;
    await this.piRepository.save(pi);
  }

  @OnEvent(APPROVAL_WORKFLOW_REJECTED_EVENT)
  async handleRejected(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType !== ApprovalDocumentType.PROFORMA_INVOICE) return;

    const pi = await this.piRepository.findOne({
      where: { _id: payload.documentId },
    });
    if (!pi || pi.status !== PIStatus.PENDING_APPROVAL) return;

    pi.status = PIStatus.REJECTED;
    pi.rejectedByUsername = payload.actorUsername;
    pi.rejectedAt = new Date();
    pi.rejectionReason = payload.reason || 'Rejected by approval workflow';
    await this.piRepository.save(pi);
  }
}
