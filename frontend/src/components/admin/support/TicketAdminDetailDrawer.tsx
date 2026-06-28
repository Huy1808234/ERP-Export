import React from 'react';
import { Drawer, Space, Typography, Tag, Timeline, Input, Button, Form, FormInstance, Card, Avatar } from 'antd';
import { CustomerServiceOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { SupportTicket, TicketStatus } from '@/types/support.type';

const { Text } = Typography;

const statusColor: Record<string, string> = {
  OPEN: 'error',
  IN_PROGRESS: 'processing',
  WAITING_BUYER: 'warning',
  RESOLVED: 'success',
  CLOSED: 'default',
};

interface TicketAdminDetailDrawerProps {
  activeTicket: SupportTicket | null;
  onClose: () => void;
  onUpdateStatus: (status: TicketStatus) => void;
  replyForm: FormInstance<{ message: string }>;
  onSendReply: (values: { message: string }) => void;
}

export default function TicketAdminDetailDrawer({
  activeTicket,
  onClose,
  onUpdateStatus,
  replyForm,
  onSendReply,
}: TicketAdminDetailDrawerProps) {
  return (
    <Drawer
      title={activeTicket ? `${activeTicket.ticketNumber} - ${activeTicket.subject}` : 'Ticket'}
      open={Boolean(activeTicket)}
      onClose={onClose}
      size={720}
      extra={activeTicket && (
        <Space>
          {activeTicket.status !== 'RESOLVED' && activeTicket.status !== 'CLOSED' && (
            <Button type="primary" onClick={() => onUpdateStatus('RESOLVED')}>Mark Resolved</Button>
          )}
          {activeTicket.status !== 'CLOSED' && (
            <Button danger onClick={() => onUpdateStatus('CLOSED')}>Close Ticket</Button>
          )}
        </Space>
      )}
    >
      {activeTicket ? (
        <Space orientation="vertical" size={24} style={{ width: '100%' }}>
          <Space>
            <Tag color={statusColor[activeTicket.status]}>{activeTicket.status}</Tag>
            <Tag>{activeTicket.category}</Tag>
            <Tag>{activeTicket.priority}</Tag>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Text type="secondary">Buyer: {(activeTicket as any).buyer?.name || '-'}</Text>
          </Space>
          
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
            <Timeline
              mode="left"
              items={(activeTicket.messages || []).map((item) => ({
                color: item.authorType === 'STAFF' ? 'green' : 'blue',
                dot: item.authorType === 'STAFF' ? <CustomerServiceOutlined style={{ fontSize: '16px' }} /> : <Avatar size="small">{item.authorUsername.charAt(0).toUpperCase()}</Avatar>,
                children: (
                  <div style={{ paddingBottom: 16 }}>
                    <Text strong>{item.authorUsername}</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>{dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
                    <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', background: item.authorType === 'STAFF' ? '#dcfce3' : '#fff', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      {item.message}
                    </div>
                  </div>
                ),
              }))}
            />
          </div>

          {activeTicket.status !== 'CLOSED' && activeTicket.status !== 'RESOLVED' ? (
            <Card size="small" title="Reply to Customer">
              <Form form={replyForm} layout="vertical" onFinish={onSendReply}>
                <Form.Item name="message" rules={[{ required: true, message: 'Please enter a reply message' }]}>
                  <Input.TextArea rows={4} placeholder="Type your reply to the buyer here..." />
                </Form.Item>
                <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
                  Send Reply
                </Button>
              </Form>
            </Card>
          ) : (
            <Card size="small" style={{ textAlign: 'center', background: '#f1f5f9' }}>
              <Text type="secondary">This ticket is {activeTicket.status.toLowerCase()}. You cannot add new messages.</Text>
              {activeTicket.status === 'RESOLVED' && (
                 <div style={{ marginTop: 12 }}>
                   <Button onClick={() => onUpdateStatus('OPEN')}>Reopen Ticket</Button>
                 </div>
              )}
            </Card>
          )}
        </Space>
      ) : null}
    </Drawer>
  );
}
