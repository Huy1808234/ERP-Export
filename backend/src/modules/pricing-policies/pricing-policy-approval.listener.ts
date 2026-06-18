import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  APPROVAL_WORKFLOW_APPROVED_EVENT,
  APPROVAL_WORKFLOW_REJECTED_EVENT,
} from '@/modules/approval-matrix/approval-workflow.events';
import type { ApprovalWorkflowDecisionEvent } from '@/modules/approval-matrix/approval-workflow.events';
import { ApprovalDocumentType } from '@/modules/approval-matrix/entities/approval-rule.entity';
import { PricingPoliciesService } from './pricing-policies.service';

@Injectable()
export class PricingPolicyApprovalListener {
  private readonly logger = new Logger(PricingPolicyApprovalListener.name);

  constructor(
    private readonly pricingPoliciesService: PricingPoliciesService,
  ) {}

  @OnEvent(APPROVAL_WORKFLOW_APPROVED_EVENT)
  async handlePricingPolicyApproved(event: ApprovalWorkflowDecisionEvent) {
    if (event.documentType !== ApprovalDocumentType.PRICING_POLICY) {
      return;
    }

    try {
      await this.pricingPoliciesService.approve(
        event.documentId,
        { username: event.actorUsername },
        event.reason || undefined,
      );
      this.logger.log(
        `Pricing policy ${event.documentId} approved via workflow`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to approve pricing policy ${event.documentId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  @OnEvent(APPROVAL_WORKFLOW_REJECTED_EVENT)
  async handlePricingPolicyRejected(event: ApprovalWorkflowDecisionEvent) {
    if (event.documentType !== ApprovalDocumentType.PRICING_POLICY) {
      return;
    }

    try {
      await this.pricingPoliciesService.reject(
        event.documentId,
        event.reason || 'Rejected by workflow',
        { username: event.actorUsername },
      );
      this.logger.log(
        `Pricing policy ${event.documentId} rejected via workflow`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to reject pricing policy ${event.documentId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
