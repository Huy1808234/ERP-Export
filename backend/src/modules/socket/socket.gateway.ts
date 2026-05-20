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
  id: string;
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
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('SocketGateway');

  afterInit(server: Server) {
    this.logger.log('🚀 WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`⚡ Client connected: ${client.id}`);
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
    this.logger.log(`📢 Internal event received: notification.new_inquiry`);
    this.logger.log(`📦 Payload: ${JSON.stringify(payload)}`);
    
    if (this.server) {
      this.server.emit('new_inquiry', {
        ...payload,
        timestamp: new Date(),
      });
      this.logger.log('🚀 Successfully broadcasted "new_inquiry" to all connected clients');
    } else {
      this.logger.error('❌ WebSocket Server instance is not available!');
    }
  }

  /**
   * Broadcast updated unread count to all admin clients
   * Triggered when an admin reads or clears notifications
   */
  @OnEvent('notification.unread_count')
  handleUnreadCountUpdate(payload: { count: number }) {
    this.logger.log(`📢 Unread count updated: ${payload.count}`);
    if (this.server) {
      this.server.emit('unread_count', payload);
    }
  }

  @OnEvent('notification.trade_finance_deadline')
  handleTradeFinanceDeadlineEvent(payload: Record<string, unknown>) {
    this.logger.log('Trade Finance deadline notification received');
    if (this.server) {
      this.server.emit('trade_finance_deadline', {
        ...payload,
        timestamp: new Date(),
      });
    }
  }

  @OnEvent('approval.workflow.requested')
  handleApprovalWorkflowRequested(payload: ApprovalWorkflowRequestedEvent) {
    this.logger.log(`Approval workflow requested: ${payload.requestId}`);
    if (this.server) {
      this.server.emit('approval_required', {
        ...payload,
        timestamp: new Date(),
      });
    }
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket, data: unknown) {
    return { event: 'pong', data: 'Server is alive' };
  }
}
