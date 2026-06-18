import type { JsonRecord } from '@/common/types/authenticated-user.type';
import { ApprovalDocumentType } from './entities/approval-rule.entity';
import { ApprovalRequestStatus } from './entities/approval-workflow.entity';

export const APPROVAL_WORKFLOW_APPROVED_EVENT = 'approval.workflow.approved';
export const APPROVAL_WORKFLOW_REJECTED_EVENT = 'approval.workflow.rejected';
export const APPROVAL_WORKFLOW_REQUESTED_EVENT = 'approval.workflow.requested';

export type ApprovalWorkflowDecisionEvent = {
  requestId: string;
  documentType: ApprovalDocumentType;
  documentId: string;
  documentNumber: string | null;
  status: ApprovalRequestStatus.APPROVED | ApprovalRequestStatus.REJECTED;
  actorUsername: string;
  reason?: string | null;
  metadata?: JsonRecord;
  requesterUsername: string;
};

export type ApprovalWorkflowRequestedEvent = {
  requestId: string;
  documentType: ApprovalDocumentType;
  documentId: string;
  documentNumber: string | null;
  title: string;
  requesterUsername: string;
  currentStepOrder: number;
  approverRoleNames: string[];
  approverUsernames: string[];
  metadata?: JsonRecord;
};
