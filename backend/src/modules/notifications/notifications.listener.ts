import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { UsersService } from '../users/users.service';
import { SystemNotificationType } from './entities/system-notification.entity';
import {
  APPROVAL_WORKFLOW_REQUESTED_EVENT,
  APPROVAL_WORKFLOW_APPROVED_EVENT,
  APPROVAL_WORKFLOW_REJECTED_EVENT,
} from '../approval-matrix/approval-workflow.events';
import type {
  ApprovalWorkflowRequestedEvent,
  ApprovalWorkflowDecisionEvent,
} from '../approval-matrix/approval-workflow.events';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  @OnEvent(APPROVAL_WORKFLOW_REQUESTED_EVENT)
  async handleApprovalRequested(event: ApprovalWorkflowRequestedEvent) {
    this.logger.log(
      `Received approval request event for ${event.documentType} - ${event.documentId}`,
    );

    const targetUsernames = new Set<string>();

    if (event.approverUsernames?.length) {
      event.approverUsernames.forEach((username) =>
        targetUsernames.add(username),
      );
    }

    if (event.approverRoleNames?.length) {
      try {
        const { results } = await this.usersService.findAll(
          { isActive: true },
          1,
          100,
        );
        results.forEach((user) => {
          if (
            user.roleName &&
            event.approverRoleNames.includes(user.roleName)
          ) {
            targetUsernames.add(user.username);
          }
        });
      } catch (err) {
        this.logger.error(
          'Failed to fetch users by roles for notifications',
          err,
        );
      }
    }

    if (targetUsernames.size === 0) {
      this.logger.warn(
        `No target users found for approval request ${event.requestId}`,
      );
      return;
    }

    const title = `Yêu cầu duyệt: ${event.title}`;
    const content = `${event.requesterUsername} đã gửi yêu cầu duyệt ${event.documentType} - ${event.documentNumber || event.documentId}`;

    for (const username of targetUsernames) {
      try {
        const user = await this.usersService.findByUsername(username);
        if (user) {
          await this.notificationsService.create({
            userId: user._id,
            type: SystemNotificationType.APPROVAL,
            title,
            content,
            targetUrl: `/dashboard/approvals`,
          });
        }
      } catch (err) {
        this.logger.error(
          `Failed to send notification to user ${username}`,
          err,
        );
      }
    }
  }

  private getTargetUrl(documentType: string): string {
    switch (documentType) {
      case 'PURCHASE_REQUEST':
        return '/dashboard/purchase-request';
      case 'PURCHASE_ORDER':
        return '/dashboard/purchase-orders';
      case 'QUOTATION':
        return '/dashboard/quotation';
      case 'PROFORMA_INVOICE':
        return '/dashboard/proforma-invoice';
      case 'SALES_CONTRACT':
      case 'SALES_CONTRACT_CANCEL':
        return '/dashboard/sales-contract';
      case 'AP_PAYMENT_BATCH':
      case 'AP_PAYMENT_REVERSAL':
        return '/dashboard/account-payables';
      case 'INVENTORY_COUNT':
      case 'INVENTORY_ADJUSTMENT':
        return '/dashboard/inventory/counts';
      case 'PRODUCT_CHANGE_REQUEST':
        return '/dashboard/product';
      case 'VAT_REFUND':
      case 'ACCOUNTING_PERIOD_REOPEN':
      case 'ACCOUNTING_PERIOD_LOCK':
        return '/dashboard/accounting';
      case 'EXPORT_DOCUMENT_REVIEW':
        return '/dashboard/commercial-invoices';
      case 'TRADE_FINANCE':
        return '/dashboard/finance/lc';
      case 'PRICING_POLICY':
        return '/dashboard/pricing-policies';
      default:
        return '/dashboard';
    }
  }

  @OnEvent(APPROVAL_WORKFLOW_APPROVED_EVENT)
  async handleApprovalApproved(event: ApprovalWorkflowDecisionEvent) {
    this.logger.log(
      `Approval approved for ${event.documentId} by ${event.actorUsername}`,
    );

    if (!event.requesterUsername) return;

    try {
      const user = await this.usersService.findByUsername(
        event.requesterUsername,
      );
      if (user) {
        const title = `Yêu cầu đã được duyệt: ${event.documentType}`;
        const content = `Yêu cầu phê duyệt cho ${event.documentType} - ${event.documentNumber || event.documentId} đã được PHÊ DUYỆT bởi ${event.actorUsername}.`;

        await this.notificationsService.create({
          userId: user._id,
          type: SystemNotificationType.SUCCESS,
          title,
          content,
          targetUrl: this.getTargetUrl(event.documentType),
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to send approval approval notification to user ${event.requesterUsername}`,
        err,
      );
    }
  }

  @OnEvent(APPROVAL_WORKFLOW_REJECTED_EVENT)
  async handleApprovalRejected(event: ApprovalWorkflowDecisionEvent) {
    this.logger.log(
      `Approval rejected for ${event.documentId} by ${event.actorUsername}`,
    );

    if (!event.requesterUsername) return;

    try {
      const user = await this.usersService.findByUsername(
        event.requesterUsername,
      );
      if (user) {
        const title = `Yêu cầu đã bị từ chối: ${event.documentType}`;
        const reasonStr = event.reason ? `. Lý do: ${event.reason}` : '';
        const content = `Yêu cầu phê duyệt cho ${event.documentType} - ${event.documentNumber || event.documentId} đã bị TỪ CHỐI bởi ${event.actorUsername}${reasonStr}.`;

        await this.notificationsService.create({
          userId: user._id,
          type: SystemNotificationType.ERROR,
          title,
          content,
          targetUrl: this.getTargetUrl(event.documentType),
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to send approval rejection notification to user ${event.requesterUsername}`,
        err,
      );
    }
  }

  @OnEvent('goods-receipt.created')
  async handleGoodsReceiptCreated(payload: { grn: any }) {
    const { grn } = payload;
    if (!grn || !grn.purchaseOrder) return;

    const buyerUsername = grn.purchaseOrder.createdByUsername;
    if (!buyerUsername) return;

    this.logger.log(
      `Received goods receipt event for GRN ${grn.grNumber}, notifying PO creator: ${buyerUsername}`,
    );

    try {
      const user = await this.usersService.findByUsername(buyerUsername);
      if (user) {
        await this.notificationsService.create({
          userId: user._id,
          type: SystemNotificationType.SUCCESS,
          title: `Đơn hàng đã nhập kho: ${grn.purchaseOrder.poNumber}`,
          content: `Phiếu nhập kho ${grn.grNumber} đã được tạo bởi ${grn.receivedByUsername} cho đơn hàng ${grn.purchaseOrder.poNumber}.`,
          targetUrl: '/dashboard/purchase-orders',
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to send goods receipt notification to buyer ${buyerUsername}`,
        err,
      );
    }
  }

  @OnEvent('shipment.on_board')
  async handleShipmentOnBoard(payload: { shipment: any }) {
    const { shipment } = payload;
    if (!shipment || !shipment.salesContract) return;

    const salespersonUsername = shipment.salesContract.createdByUsername;
    if (!salespersonUsername) return;

    this.logger.log(
      `Received shipment on board event for ${shipment.shipmentNumber}, notifying contract owner: ${salespersonUsername}`,
    );

    try {
      const user = await this.usersService.findByUsername(salespersonUsername);
      if (user) {
        await this.notificationsService.create({
          userId: user._id,
          type: SystemNotificationType.SUCCESS,
          title: `Lô hàng đã lên tàu: ${shipment.shipmentNumber}`,
          content: `Lô hàng ${shipment.shipmentNumber} thuộc hợp đồng ${shipment.salesContract.contractNumber} đã cập nhật trạng thái Lên tàu (ON BOARD).`,
          targetUrl: '/dashboard/shipment',
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to send shipment notification to salesperson ${salespersonUsername}`,
        err,
      );
    }
  }

  @OnEvent('notification.trade_finance_deadline')
  async handleTradeFinanceDeadline(payload: any) {
    this.logger.log(
      `Received trade finance deadline notification for LC ${payload.lcNumber || 'unknown'}`,
    );

    try {
      const { results } = await this.usersService.findAll(
        { isActive: true },
        1,
        100,
      );
      const targetRoles = [
        'ADMIN',
        'SUPER ADMIN',
        'CHIEF_ACCOUNTANT',
        'ACCOUNTANT',
      ];
      const targetUsers = results.filter(
        (user) => user.roleName && targetRoles.includes(user.roleName),
      );

      for (const user of targetUsers) {
        await this.notificationsService.create({
          userId: user._id,
          type: SystemNotificationType.WARNING,
          title: payload.title || 'Hạn chót Trade Finance',
          content:
            payload.body || `L/C ${payload.lcNumber} có thời hạn cần xử lý.`,
          targetUrl: '/dashboard/finance/lc',
        });
      }
    } catch (err) {
      this.logger.error(
        'Failed to send trade finance deadline notification',
        err,
      );
    }
  }
}
