import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AccountingService } from './accounting.service';
import { CurrenciesService } from '../currencies/currencies.service';
import {
  APPROVAL_WORKFLOW_APPROVED_EVENT,
  APPROVAL_WORKFLOW_REJECTED_EVENT,
} from '../approval-matrix/approval-workflow.events';
import type { ApprovalWorkflowDecisionEvent } from '../approval-matrix/approval-workflow.events';
import { ApprovalDocumentType } from '../approval-matrix/entities/approval-rule.entity';

type ShipmentOnBoardPayload = {
  shipment?: {
    _id: string;
    shipmentNumber: string;
    proformaInvoice?: {
      piNumber: string;
      totalAmount: number;
      currency?: string | null;
      customerId?: string | null;
    } | null;
  };
};

@Injectable()
export class AccountingListener {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly currenciesService: CurrenciesService,
  ) {}

  @OnEvent('shipment.on_board')
  async handleShipmentOnBoard(payload: ShipmentOnBoardPayload) {
    const { shipment } = payload;
    const pi = shipment?.proformaInvoice;
    
    if (pi) {
      const amountVnd = await this.currenciesService.convertToBase(pi.totalAmount, pi.currency || 'USD');
      
      await this.accountingService.createJournalEntry({
        description: `Doanh thu xuất khẩu ${shipment.shipmentNumber} - PI: ${pi.piNumber}`,
        referenceType: 'SHIPMENT',
            referenceId: shipment._id,
            items: [
          { accountCode: '131', debit: amountVnd, credit: 0, partnerId: pi.customerId || undefined },
          { accountCode: '511', debit: 0, credit: amountVnd }
        ]
      });
    }
  }

  @OnEvent(APPROVAL_WORKFLOW_APPROVED_EVENT)
  async handleApprovalWorkflowApproved(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType === ApprovalDocumentType.ACCOUNTING_PERIOD_REOPEN) {
      await this.accountingService.completePeriodReopenWorkflowApproval(
        payload.documentId,
        payload.requestId,
        payload.actorUsername,
        this.resolveWorkflowReason(payload),
      );
      return;
    }

    if (payload.documentType === ApprovalDocumentType.ACCOUNTING_PERIOD_LOCK) {
      await this.accountingService.completePeriodLockWorkflowApproval(
        payload.documentId,
        payload.requestId,
        payload.actorUsername,
        this.resolveWorkflowReason(payload),
      );
      return;
    }

    if (payload.documentType !== ApprovalDocumentType.VAT_REFUND) return;

    await this.accountingService.completeVatRefundWorkflowApproval(
      payload.documentId,
      payload.requestId,
      payload.actorUsername,
      payload.reason,
    );
  }

  @OnEvent(APPROVAL_WORKFLOW_REJECTED_EVENT)
  async handleApprovalWorkflowRejected(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType === ApprovalDocumentType.ACCOUNTING_PERIOD_REOPEN) {
      await this.accountingService.rejectPeriodReopenWorkflow(
        payload.documentId,
        payload.requestId,
        payload.actorUsername,
        this.resolveWorkflowReason(payload),
      );
      return;
    }

    if (payload.documentType === ApprovalDocumentType.ACCOUNTING_PERIOD_LOCK) {
      await this.accountingService.rejectPeriodLockWorkflow(
        payload.documentId,
        payload.requestId,
        payload.actorUsername,
        this.resolveWorkflowReason(payload),
      );
      return;
    }

    if (payload.documentType !== ApprovalDocumentType.VAT_REFUND) return;

    await this.accountingService.rejectVatRefundWorkflow(
      payload.documentId,
      payload.requestId,
      payload.actorUsername,
      payload.reason,
    );
  }

  private resolveWorkflowReason(payload: ApprovalWorkflowDecisionEvent) {
    const metadataReason = payload.metadata?.reason;
    return typeof metadataReason === 'string' && metadataReason.trim()
      ? metadataReason
      : payload.reason;
  }
}
