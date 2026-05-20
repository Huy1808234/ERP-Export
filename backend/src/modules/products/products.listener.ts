import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  APPROVAL_WORKFLOW_APPROVED_EVENT,
  APPROVAL_WORKFLOW_REJECTED_EVENT,
} from '@/modules/approval-matrix/approval-workflow.events';
import type { ApprovalWorkflowDecisionEvent } from '@/modules/approval-matrix/approval-workflow.events';
import { ApprovalDocumentType } from '@/modules/approval-matrix/entities/approval-rule.entity';
import { ProductsService } from './products.service';

@Injectable()
export class ProductsListener {
  constructor(private readonly productsService: ProductsService) {}

  @OnEvent('shipment.on_board')
  async handleShipmentOnBoard(payload: any) {
    const { shipment } = payload;

    if (shipment.proformaInvoice && shipment.proformaInvoice.items) {
      for (const item of shipment.proformaInvoice.items) {
        // Deduct stock when shipment is ON_BOARD
        await this.productsService.deductStock(item.productId, item.quantity);
        console.log(
          `Deducted ${item.quantity} units for product ${item.productId} due to shipment ${shipment.shipmentNumber}`,
        );
      }
    }
  }

  @OnEvent(APPROVAL_WORKFLOW_APPROVED_EVENT)
  async handleProductChangeApproved(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType !== ApprovalDocumentType.PRODUCT_CHANGE_REQUEST)
      return;

    await this.productsService.completeChangeRequestFromApprovalWorkflow(
      payload.documentId,
      payload.requestId,
      payload.actorUsername,
      payload.reason,
    );
  }

  @OnEvent(APPROVAL_WORKFLOW_REJECTED_EVENT)
  async handleProductChangeRejected(payload: ApprovalWorkflowDecisionEvent) {
    if (payload.documentType !== ApprovalDocumentType.PRODUCT_CHANGE_REQUEST)
      return;

    await this.productsService.rejectChangeRequestFromApprovalWorkflow(
      payload.documentId,
      payload.requestId,
      payload.actorUsername,
      payload.reason,
    );
  }
}
