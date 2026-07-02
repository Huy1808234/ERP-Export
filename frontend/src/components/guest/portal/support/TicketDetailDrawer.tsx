import React from 'react';
import { Button, Drawer, Form, FormInstance, Input, Space, Tag, Timeline, Typography, theme } from 'antd';
import { CheckCircleOutlined, FileTextOutlined, SendOutlined, TruckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import type { SupportTicket, TicketStatus } from '@/types/support.type';

const { Title, Text } = Typography;

const statusColor: Record<TicketStatus, string> = {
  OPEN: 'blue',
  IN_PROGRESS: 'processing',
  WAITING_INTERNAL: 'processing',
  WAITING_BUYER: 'warning',
  RESOLVED: 'green',
  CLOSED: 'default',
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
  const t = useTranslations('PortalSupport');
  const tCommon = useTranslations('SupportCommon');
  const { token } = theme.useToken();
  const canReply = Boolean(activeTicket && !['RESOLVED', 'CLOSED'].includes(activeTicket.status));
  const canClose = Boolean(activeTicket && activeTicket.status !== 'CLOSED');

  return (
    <Drawer
      title={activeTicket ? `${activeTicket.ticketNumber} - ${activeTicket.subject}` : t('detail.ticketFallback')}
      open={Boolean(activeTicket)}
      onClose={onClose}
      size={720}
      extra={canClose ? (
        <Button icon={<CheckCircleOutlined />} onClick={onCloseTicket}>
          {t('actions.closeTicket')}
        </Button>
      ) : null}
    >
      {activeTicket ? (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ background: token.colorFillAlter, padding: 16, borderRadius: 8 }}>
            <Space size="large" wrap>
              <div>
                <Text type="secondary">{t('detail.status')} </Text>
                <Tag color={statusColor[activeTicket.status]}>
                  {tCommon(`customerStatus.${activeTicket.status}`)}
                </Tag>
              </div>
              <div><Text type="secondary">{t('detail.priority')} </Text><Text strong>{tCommon(`priority.${activeTicket.priority}`)}</Text></div>
              <div><Text type="secondary">{t('detail.category')} </Text><Text>{tCommon(`category.${activeTicket.category}`)}</Text></div>
              <div><Text type="secondary">{t('detail.created')} </Text><Text>{dayjs(activeTicket.createdAt).format('DD/MM/YYYY HH:mm')}</Text></div>
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

          <Title level={5}>{t('detail.messages')}</Title>
          {activeTicket.messages && activeTicket.messages.length > 0 ? (
            <Timeline
              items={activeTicket.messages.map((m) => ({
                color: m.authorType === 'BUYER' ? 'blue' : 'green',
                content: (
                  <div>
                    <div style={{ marginBottom: 4 }}>
                      <Text strong>{m.authorType === 'BUYER' ? t('detail.you') : t('detail.supportTeam')} </Text>
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
            <Text type="secondary">{t('detail.noMessages')}</Text>
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
                        : Promise.reject(new Error(t('detail.replyRequired')))
                    ),
                  },
                ]}
              >
                <Input.TextArea
                  rows={4}
                  maxLength={3000}
                  showCount
                  placeholder={t('detail.replyPlaceholder')}
                />
              </Form.Item>
              <div style={{ textAlign: 'right' }}>
                <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={loading}>
                  {t('actions.sendReply')}
                </Button>
              </div>
            </Form>
          ) : null}
        </Space>
      ) : null}
    </Drawer>
  );
}
