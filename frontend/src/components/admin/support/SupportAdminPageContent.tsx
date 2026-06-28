'use client';

import React, { useEffect } from 'react';
import { App, Card, Space, Typography, Button, Select, Form } from 'antd';
import { CustomerServiceOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAdminSupportTickets } from '@/hooks/useSupportTickets';
import { supportService } from '@/services/support.service';
import { TicketStatus } from '@/types/support.type';
import TicketAdminTable from './TicketAdminTable';
import TicketAdminDetailDrawer from './TicketAdminDetailDrawer';

const { Title, Text } = Typography;

export default function SupportAdminPageContent() {
  const { message } = App.useApp();
  const {
    tickets,
    activeTicket,
    setActiveTicket,
    isLoading,
    fetchTickets,
    fetchTicketDetail,
    headers,
    pagination,
    setPagination,
    statusFilter,
    setStatusFilter,
  } = useAdminSupportTickets();

  const [replyForm] = Form.useForm<{ message: string }>();

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleSendReply = async (values: { message: string }) => {
    if (!headers || !activeTicket) return;
    try {
      const res = await supportService.addAdminMessage(activeTicket._id, values.message, headers);
      if (res?.data) {
        replyForm.resetFields();
        await fetchTicketDetail(activeTicket._id);
        await fetchTickets();
      } else {
        message.error(String(res?.message || 'Cannot send reply'));
      }
    } catch (err) {
      message.error('An error occurred');
    }
  };

  const handleUpdateStatus = async (status: TicketStatus) => {
    if (!headers || !activeTicket) return;
    try {
      const res = await supportService.updateAdminTicketStatus(activeTicket._id, status, headers);
      if (res?.data) {
        message.success(`Ticket marked as ${status}.`);
        setActiveTicket(res.data);
        await fetchTickets();
      }
    } catch (err) {
      message.error('Failed to update ticket status');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}><CustomerServiceOutlined /> Support Desk</Title>
          <Text type="secondary">Manage customer claims, requests, and support tickets.</Text>
        </div>
        <Space>
          <Select
            placeholder="Filter by Status"
            style={{ width: 160 }}
            allowClear
            value={statusFilter}
            onChange={(val) => { setStatusFilter(val); setPagination(prev => ({ ...prev, current: 1 })); }}
            options={[
              { value: 'OPEN', label: 'Open' },
              { value: 'IN_PROGRESS', label: 'In Progress' },
              { value: 'WAITING_BUYER', label: 'Waiting Buyer' },
              { value: 'RESOLVED', label: 'Resolved' },
              { value: 'CLOSED', label: 'Closed' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchTickets}>Refresh</Button>
        </Space>
      </div>

      <Card variant="borderless">
        <TicketAdminTable
          tickets={tickets}
          loading={isLoading}
          pagination={pagination}
          onTableChange={(pag) => setPagination(prev => ({ ...prev, current: pag.current || 1, pageSize: pag.pageSize || 10 }))}
          onOpenDetail={fetchTicketDetail}
        />
      </Card>

      <TicketAdminDetailDrawer
        activeTicket={activeTicket}
        onClose={() => setActiveTicket(null)}
        onUpdateStatus={handleUpdateStatus}
        replyForm={replyForm}
        onSendReply={handleSendReply}
      />
    </div>
  );
}
