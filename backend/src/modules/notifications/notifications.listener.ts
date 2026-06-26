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

type GoodsReceiptCreatedPayload = {
  grn?: {
    grNumber: string;
    receivedByUsername?: string | null;
    purchaseOrder?: {
      poNumber: string;
      createdByUsername?: string | null;
    } | null;
  } | null;
};

type ShipmentOnBoardPayload = {
  shipment?: {
    shipmentNumber: string;
    salesContract?: {
      contractNumber: string;
      createdByUsername?: string | null;
    } | null;
  } | null;
};

type TradeFinanceDeadlinePayload = {
  lcNumber?: string | null;
  title?: string;
  body?: string;
};

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
        let foundCount = 0;
        results.forEach((user) => {
          if (!user.roleName) {
            // Log warning but don't crash - user may be missing role data
            this.logger.warn(
              `User ${user.username} found but has no role assigned - skipping from approval notification`,
            );
            return;
          }
          if (event.approverRoleNames.includes(user.roleName)) {
            targetUsernames.add(user.username);
            foundCount++;
          }
        });
        this.logger.debug(
          `Found ${foundCount} users with matching roles for approval notification`,
        );
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
            username: user.username,
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
          username: user.username,
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
          username: user.username,
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
  async handleGoodsReceiptCreated(payload: GoodsReceiptCreatedPayload) {
    const { grn } = payload;
    if (!grn?.purchaseOrder) return;

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
          username: user.username,
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
  async handleShipmentOnBoard(payload: ShipmentOnBoardPayload) {
    const { shipment } = payload;
    if (!shipment?.salesContract) return;

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
          username: user.username,
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
  async handleTradeFinanceDeadline(payload: TradeFinanceDeadlinePayload) {
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
          username: user.username,
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

  @OnEvent('notification.new_inquiry')
  async handleNewInquiryNotification(payload: any) {
    const { customerName, customerEmail, message } = payload;
    
    this.logger.log(`Received new inquiry notification: ${message}`);

    try {
      // Find all staff users (not customer accounts)
      const { results } = await this.usersService.findAll(
        { isActive: true },
        1,
        100,
      );
      
      // Send to users with relevant roles (Sales, Admin)
      const targetRoles = ['ADMIN', 'SUPER ADMIN', 'SALES', 'SALE'];
      const targetUsers = results.filter(
        (user) => user.roleName && targetRoles.some(role => 
          user.roleName?.toUpperCase().includes(role)
        ),
      );

      // If no specific roles found, send to all active staff
      const recipients = targetUsers.length > 0 ? targetUsers : results;

      for (const user of recipients) {
        await this.notificationsService.create({
          userId: user._id,
          username: user.username,
          type: SystemNotificationType.APPROVAL,
          title: 'Yêu cầu báo giá mới',
          content: `${message}${customerEmail ? ` (${customerEmail})` : ''}`,
          targetUrl: '/dashboard/inquiry',
        });
      }
      
      this.logger.log(`New inquiry notification sent to ${recipients.length} staff users`);
    } catch (err) {
      this.logger.error('Failed to send new inquiry notification to staff', err);
    }
  }

  @OnEvent('quotation.accepted_by_buyer')
  async handleQuotationAcceptedByBuyer(payload: any) {
    const { quotationNumber, createdByUsername, username } = payload;
    if (!createdByUsername) return;

    this.logger.log(`Received quotation accepted event for ${quotationNumber}, notifying creator: ${createdByUsername}`);

    try {
      const user = await this.usersService.findByUsername(createdByUsername);
      if (user) {
        await this.notificationsService.create({
          userId: user._id,
          username: user.username,
          type: SystemNotificationType.SUCCESS,
          title: `Khách hàng đã CHẤP NHẬN Báo giá`,
          content: `Khách hàng (Tài khoản: ${username}) đã chấp nhận báo giá ${quotationNumber}.`,
          targetUrl: '/dashboard/quotation',
        });
      }
    } catch (err) {
      this.logger.error(`Failed to send quotation accepted notification to ${createdByUsername}`, err);
    }
  }

  @OnEvent('quotation.rejected_by_buyer')
  async handleQuotationRejectedByBuyer(payload: any) {
    const { quotationNumber, createdByUsername, username, reason } = payload;
    if (!createdByUsername) return;

    this.logger.log(`Received quotation rejected event for ${quotationNumber}, notifying creator: ${createdByUsername}`);

    try {
      const user = await this.usersService.findByUsername(createdByUsername);
      if (user) {
        await this.notificationsService.create({
          userId: user._id,
          username: user.username,
          type: SystemNotificationType.ERROR,
          title: `Khách hàng đã TỪ CHỐI Báo giá`,
          content: `Khách hàng (Tài khoản: ${username}) đã từ chối báo giá ${quotationNumber}. Lý do: ${reason}`,
          targetUrl: '/dashboard/quotation',
        });
      }
    } catch (err) {
      this.logger.error(`Failed to send quotation rejected notification to ${createdByUsername}`, err);
    }
  }

  // ==================== Payment Receipt Events ====================

  @OnEvent('payment-receipt.created')
  async handlePaymentReceiptCreated(payload: any) {
    const { receipt, buyer } = payload;
    this.logger.log(`Payment receipt ${receipt.receiptNumber} created, notifying accountants`);

    try {
      // Find all accountant users
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
        'ACCOUNTING',
      ];
      const targetUsers = results.filter(
        (user) => user.roleName && targetRoles.includes(user.roleName),
      );

      for (const user of targetUsers) {
        await this.notificationsService.create({
          userId: user._id,
          username: user.username,
          type: SystemNotificationType.APPROVAL,
          title: `Chứng từ thanh toán mới: ${receipt.receiptNumber}`,
          content: `Khách hàng ${buyer?.name || 'N/A'} vừa upload chứng từ thanh toán ${receipt.receiptNumber} trị giá ${receipt.currency} ${receipt.amountPaidForeign}. Vui lòng kiểm tra và duyệt.`,
          targetUrl: '/dashboard/payments',
        });
      }
    } catch (err) {
      this.logger.error('Failed to send payment receipt notification to accountants', err);
    }
  }

  @OnEvent('payment-receipt.approved')
  async handlePaymentReceiptApproved(payload: any) {
    const { receipt } = payload;
    this.logger.log(`Payment receipt ${receipt.receiptNumber} approved`);

    // Notify the customer who submitted the receipt
    // In a B2B system, we might notify the salesperson or account manager
    // For now, we'll log it - customer notification would typically be done via email
    this.logger.log(`Payment receipt ${receipt.receiptNumber} approved for buyer ${receipt.buyerId}`);
  }

  @OnEvent('payment-receipt.rejected')
  async handlePaymentReceiptRejected(payload: any) {
    const { receipt } = payload;
    this.logger.log(`Payment receipt ${receipt.receiptNumber} rejected: ${receipt.rejectionReason}`);

    // In a real system, you might notify the customer about rejection
    // via email or push notification
    this.logger.log(`Payment receipt ${receipt.receiptNumber} rejected - customer should be notified`);
  }
}
