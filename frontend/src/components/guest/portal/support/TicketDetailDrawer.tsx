import React from 'react';
import { Drawer, Space, Typography, Tag, Timeline, Input, Button, Form, FormInstance } from 'antd';
import { CheckCircleOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { SupportTicket } from '@/types/support.type';

const { Title, Text } = Typography;

interface TicketDetailDrawerProps {
  activeTicket: SupportTicket | null;
  onClose: () => void;
  onCloseTicket: () => void;
  replyForm: FormInstance<{ message: string }>;
  onSendReply: (values: { message: string }) => void;
  loading: boolean;
}

export default function TicketDetailDrawer({
  activeTicket,
  onClose,
  onCloseTicket,
  replyForm,
  onSendReply,
  loading,
}: TicketDetailDrawerProps) {
  return (
    <Drawer
      title={activeTicket ? `${activeTicket.ticketNumber} - ${activeTicket.subject}` : 'Ticket'}
      open={Boolean(activeTicket)}
      onClose={onClose}
      size={720}
      extra={activeTicket && activeTicket.status !== 'CLOSED' ? (
        <Button icon={<CheckCircleOutlined />} onClick={onCloseTicket}>Close ticket</Button>
      ) : null}
    >
      {activeTicket ? (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
            <Space size="large" wrap>
              <div><Text type="secondary">Status: </Text><Tag>{activeTicket.status}</Tag></div>
              <div><Text type="secondary">Priority: </Text><Text strong>{activeTicket.priority}</Text></div>
              <div><Text type="secondary">Category: </Text><Text>{activeTicket.category}</Text></div>
              <div><Text type="secondary">Created: </Text><Text>{dayjs(activeTicket.createdAt).format('DD/MM/YYYY HH:mm')}</Text></div>
            </Space>
          </div>

          <Title level={5}>Messages</Title>
          {activeTicket.messages && activeTicket.messages.length > 0 ? (
            <Timeline
              items={activeTicket.messages.map((m) => ({
                color: m.authorType === 'BUYER' ? 'blue' : 'green',
                children: (
                  <div>
                    <div style={{ marginBottom: 4 }}>
                      <Text strong>{m.authorType === 'BUYER' ? 'You' : 'Support Team'} </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>({m.authorUsername}) - {dayjs(m.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
                    </div>
                    <div style={{
                      background: m.authorType === 'BUYER' ? '#eff6ff' : '#f0fdf4',
                      padding: '8px 12px',
                      borderRadius: 6,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {m.message}
                    </div>
                  </div>
                ),
              }))}
            />
          ) : (
            <Text type="secondary">No messages yet.</Text>
          )}

          {activeTicket.status !== 'CLOSED' && (
            <Form form={replyForm} onFinish={onSendReply} layout="vertical" style={{ marginTop: 24 }}>
              <Form.Item name="message" rules={[{ required: true, message: 'Please enter a message' }]}>
                <Input.TextArea rows={4} placeholder="Type your reply here..." />
              </Form.Item>
              <div style={{ textAlign: 'right' }}>
                <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={loading}>
                  Send reply
                </Button>
              </div>
            </Form>
          )}
        </Space>
      ) : null}
    </Drawer>
  );
}
