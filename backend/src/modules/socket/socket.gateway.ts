import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { ApprovalWorkflowRequestedEvent } from '@/modules/approval-matrix/approval-workflow.events';

type NewInquiryNotificationEvent = {
  _id: string;
  customerName: string;
  customerEmail?: string | null;
  quantity?: number | string | null;
  message?: string;
};

@Injectable()
@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private logger: Logger = new Logger('SocketGateway');

  afterInit() {
    this.logger.log(' WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(` Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Listen to internal system events and push to connected clients
   * This keeps the services decoupled from the gateway
   */
  @OnEvent('notification.new_inquiry')
  handleNewInquiryEvent(payload: NewInquiryNotificationEvent) {
    this.logger.log(` Internal event received: notification.new_inquiry`);
    this.logger.log(` Payload: ${JSON.stringify(payload)}`);

    if (this.server) {
      void this.server.emit('new_inquiry', {
        ...payload,
        timestamp: new Date(),
      });
      this.logger.log(
        ' Successfully broadcasted "new_inquiry" to all connected clients',
      );
    } else {
      this.logger.error(' WebSocket Server instance is not available!');
    }
  }

  @OnEvent('notification.new_system')
  handleNewSystemNotification(payload: {
    userId?: string | null;
    [key: string]: unknown;
  }) {
    this.logger.log(` Internal event received: notification.new_system`);
    if (this.server) {
      if (payload.userId) {
        void this.server.to(payload.userId).emit('new_system_notification', {
          ...payload,
          timestamp: new Date(),
        });
        this.logger.log(` Sent system notification to room: ${payload.userId}`);
      } else {
        void this.server.emit('new_system_notification', {
          ...payload,
          timestamp: new Date(),
        });
        this.logger.log('Broadcasted system notification to all clients');
      }
    }
  }

  /**
   * Send updated unread count to specific user room
   */
  @OnEvent('notification.unread_count')
  handleUnreadCountUpdate(payload: { userId?: string; count: number }) {
    this.logger.log(
      ` Unread count updated for user ${payload.userId || 'all'}: ${payload.count}`,
    );
    if (this.server) {
      if (payload.userId) {
        void this.server.to(payload.userId).emit('unread_count', payload);
      } else {
        void this.server.emit('unread_count', payload);
      }
    }
  }

  @OnEvent('notification.trade_finance_deadline')
  handleTradeFinanceDeadlineEvent(payload: Record<string, unknown>) {
    this.logger.log('Trade Finance deadline notification received');
    if (this.server) {
      void this.server.emit('trade_finance_deadline', {
        ...payload,
        timestamp: new Date(),
      });
    }
  }

  @OnEvent('approval.workflow.requested')
  handleApprovalWorkflowRequested(payload: ApprovalWorkflowRequestedEvent) {
    this.logger.log(`Approval workflow requested: ${payload.requestId}`);
    // Note: We keep this legacy broadcast event for backward compatibility,
    // but the actual system notification is pushed to specific approver rooms via 'notification.new_system'.
    if (this.server) {
      void this.server.emit('approval_required', {
        ...payload,
        timestamp: new Date(),
      });
    }
  }

  @SubscribeMessage('join')
  async handleJoin(client: Socket, payload: { userId: string }) {
    if (payload && payload.userId) {
      await client.join(payload.userId);
      this.logger.log(` Client ${client.id} joined room: ${payload.userId}`);
      return { status: 'joined', room: payload.userId };
    }
    return { status: 'error', message: 'userId is required' };
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { event: 'pong', data: 'Server is alive' };
  }
}
