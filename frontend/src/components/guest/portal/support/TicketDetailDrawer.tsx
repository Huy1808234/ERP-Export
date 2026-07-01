import React from 'react';
import { Button, Drawer, Form, FormInstance, Input, Space, Tag, Timeline, Typography, theme } from 'antd';
import { CheckCircleOutlined, FileTextOutlined, SendOutlined, TruckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLocale } from 'next-intl';
import { SupportTicket } from '@/types/support.type';

const { Title, Text } = Typography;

const statusColor: Record<string, string> = {
  OPEN: 'blue',
  IN_PROGRESS: 'processing',
  WAITING_BUYER: 'warning',
  RESOLVED: 'green',
  CLOSED: 'default',
};

const getStatusLabel = (status: string, isVi: boolean): string => {
  if (!isVi) return status.replace(/_/g, ' ');
  const labels: Record<string, string> = {
    OPEN: 'Đang mở',
    IN_PROGRESS: 'Đang xử lý',
    WAITING_BUYER: 'Chờ phản hồi',
    RESOLVED: 'Đã xử lý',
    CLOSED: 'Đã đóng',
  };
  return labels[status] || status;
};

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
  const locale = useLocale();
  const isVi = locale === 'vi';
  const { token } = theme.useToken();
  const canReply = Boolean(activeTicket && !['RESOLVED', 'CLOSED'].includes(activeTicket.status));
  const canClose = Boolean(activeTicket && activeTicket.status !== 'CLOSED');

  return (
    <Drawer
      title={activeTicket ? `${activeTicket.ticketNumber} - ${activeTicket.subject}` : 'Ticket'}
      open={Boolean(activeTicket)}
      onClose={onClose}
      size={720}
      extra={canClose ? (
        <Button icon={<CheckCircleOutlined />} onClick={onCloseTicket}>
          {isVi ? 'Đóng ticket' : 'Close ticket'}
        </Button>
      ) : null}
    >
      {activeTicket ? (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ background: token.colorFillAlter, padding: 16, borderRadius: 8 }}>
            <Space size="large" wrap>
              <div>
                <Text type="secondary">{isVi ? 'Trạng thái: ' : 'Status: '}</Text>
                <Tag color={statusColor[activeTicket.status] || 'default'}>
                  {getStatusLabel(activeTicket.status, isVi)}
                </Tag>
              </div>
              <div><Text type="secondary">{isVi ? 'Ưu tiên: ' : 'Priority: '}</Text><Text strong>{activeTicket.priority}</Text></div>
              <div><Text type="secondary">{isVi ? 'Nhóm: ' : 'Category: '}</Text><Text>{activeTicket.category}</Text></div>
              <div><Text type="secondary">{isVi ? 'Tạo lúc: ' : 'Created: '}</Text><Text>{dayjs(activeTicket.createdAt).format('DD/MM/YYYY HH:mm')}</Text></div>
            </Space>
            {activeTicket.shipment?.shipmentNumber ? (
              <div style={{ marginTop: 12 }}>
                <Tag icon={<TruckOutlined />} color="geekblue">
                  {activeTicket.shipment.shipmentNumber}
                </Tag>
                {activeTicket.shipment.blNumber ? <Tag>B/L: {activeTicket.shipment.blNumber}</Tag> : null}
                {activeTicket.shipment.bookingNumber ? <Tag>Booking: {activeTicket.shipment.bookingNumber}</Tag> : null}
              </div>
            ) : null}
          </div>

          <Title level={5}>{isVi ? 'Trao đổi' : 'Messages'}</Title>
          {activeTicket.messages && activeTicket.messages.length > 0 ? (
            <Timeline
              items={activeTicket.messages.map((m) => ({
                color: m.authorType === 'BUYER' ? 'blue' : 'green',
                children: (
                  <div>
                    <div style={{ marginBottom: 4 }}>
                      <Text strong>{m.authorType === 'BUYER' ? (isVi ? 'Bạn' : 'You') : (isVi ? 'Đội hỗ trợ' : 'Support Team')} </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>({m.authorUsername}) - {dayjs(m.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
                    </div>
                    <div style={{
                      background: m.authorType === 'BUYER' ? token.colorPrimaryBg : token.colorSuccessBg,
                      padding: '10px 12px',
                      borderRadius: 8,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {m.message}
                    </div>
                    {m.attachments && m.attachments.length > 0 ? (
                      <Space size={6} wrap style={{ marginTop: 8 }}>
                        {m.attachments.map((attachment) => (
                          <Tag key={attachment.fileAsset_id} icon={<FileTextOutlined />}>
                            {attachment.fileName}
                          </Tag>
                        ))}
                      </Space>
                    ) : null}
                  </div>
                ),
              }))}
            />
          ) : (
            <Text type="secondary">{isVi ? 'Chưa có tin nhắn.' : 'No messages yet.'}</Text>
          )}

          {canReply ? (
            <Form form={replyForm} onFinish={onSendReply} layout="vertical" style={{ marginTop: 24 }}>
              <Form.Item
                name="message"
                rules={[
                  {
                    validator: (_: unknown, value?: string) => (
                      typeof value === 'string' && value.trim().length > 0
                        ? Promise.resolve()
                        : Promise.reject(new Error(isVi ? 'Vui lòng nhập phản hồi' : 'Please enter a message'))
                    ),
                  },
                ]}
              >
                <Input.TextArea
                  rows={4}
                  maxLength={3000}
                  showCount
                  placeholder={isVi ? 'Nhập phản hồi của bạn...' : 'Type your reply here...'}
                />
              </Form.Item>
              <div style={{ textAlign: 'right' }}>
                <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={loading}>
                  {isVi ? 'Gửi phản hồi' : 'Send reply'}
                </Button>
              </div>
            </Form>
          ) : null}
        </Space>
      ) : null}
    </Drawer>
  );
}
