'use client';

import React, { useEffect, useState } from 'react';
import { App, Card, Col, Row, Space, Typography, Button, Avatar, Tag, Form } from 'antd';
import { CustomerServiceOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useGuestSupportTickets } from '@/hooks/useSupportTickets';
import { supportService } from '@/services/support.service';
import TicketList from './TicketList';
import CreateTicketModal from './CreateTicketModal';
import TicketDetailDrawer from './TicketDetailDrawer';
import { TicketFormValues } from '@/types/support.type';

const { Title, Text } = Typography;

export default function SupportPortalPageContent() {
  const { message } = App.useApp();
  const {
    tickets,
    activeTicket,
    setActiveTicket,
    isLoading,
    isDetailLoading,
    fetchTickets,
    fetchTicketDetail,
    headers,
  } = useGuestSupportTickets();

  const [form] = Form.useForm<TicketFormValues>();
  const [replyForm] = Form.useForm<{ message: string }>();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCreateTicket = async (values: TicketFormValues) => {
    if (!headers) return;
    setSubmitting(true);
    try {
      const res = await supportService.createTicket(values, headers);
      if (res?.data) {
        message.success('Ticket created successfully');
        setModalOpen(false);
        form.resetFields();
        await fetchTickets();
      } else {
        message.error(String(res?.message || 'Failed to create ticket'));
      }
    } catch (err) {
      message.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (values: { message: string }) => {
    if (!headers || !activeTicket) return;
    setSubmitting(true);
    try {
      const res = await supportService.addMessage(activeTicket._id, values.message, headers);
      if (res?.data) {
        replyForm.resetFields();
        await fetchTicketDetail(activeTicket._id);
        await fetchTickets();
      } else {
        message.error(String(res?.message || 'Cannot send reply'));
      }
    } catch (err) {
      message.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!headers || !activeTicket) return;
    try {
      const res = await supportService.updateTicketStatus(activeTicket._id, 'CLOSED', headers);
      if (res?.data) {
        message.success('Ticket closed.');
        setActiveTicket(res.data);
        await fetchTickets();
      }
    } catch (err) {
      message.error('Failed to close ticket');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3}><CustomerServiceOutlined /> Support & Claims</Title>
          <Text type="secondary">Create claims, track lifecycle, and chat with the operations team.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchTickets}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>New ticket</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Ticket lifecycle" variant="borderless">
            <TicketList
              tickets={tickets}
              loading={isLoading}
              onOpenDetail={fetchTicketDetail}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card variant="borderless" style={{ background: '#111827', color: '#fff' }}>
            <Space orientation="vertical" size="large">
              <Avatar size={64} style={{ backgroundColor: '#2563eb' }} icon={<CustomerServiceOutlined />} />
              <div>
                <Title level={4} style={{ color: '#fff', margin: 0 }}>Account support</Title>
                <Text style={{ color: '#cbd5e1' }}>Operations, finance, and document support in one thread.</Text>
              </div>
              <Tag color="blue">SLA target: first response within 1 business day</Tag>
            </Space>
          </Card>
        </Col>
      </Row>

      <CreateTicketModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        form={form}
        onSubmit={handleCreateTicket}
      />

      <TicketDetailDrawer
        activeTicket={activeTicket}
        onClose={() => setActiveTicket(null)}
        onCloseTicket={handleCloseTicket}
        replyForm={replyForm}
        onSendReply={handleSendReply}
        loading={submitting || isDetailLoading}
      />
    </div>
  );
}
