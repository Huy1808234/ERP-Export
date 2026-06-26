'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CustomerServiceOutlined,
  MessageOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { getAccessToken } from '@/lib/auth-token';
import { sendRequest } from '@/lib/api-client';

const { Title, Text } = Typography;

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_BUYER' | 'RESOLVED' | 'CLOSED';

type SupportMessage = {
  _id: string;
  authorUsername: string;
  authorType: 'BUYER' | 'STAFF';
  message: string;
  createdAt: string;
};

type SupportTicket = {
  _id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  buyer?: {
    name?: string;
  } | null;
  shipment?: {
    shipmentNumber?: string | null;
  } | null;
  messages?: SupportMessage[];
};

const statusColor: Record<string, string> = {
  OPEN: 'blue',
  IN_PROGRESS: 'processing',
  WAITING_BUYER: 'warning',
  RESOLVED: 'green',
  CLOSED: 'default',
};

export default function AdminSupportPage() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const [replyForm] = Form.useForm<{ message: string }>();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const fetchTickets = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<{ results: SupportTicket[], totalItems: number }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/admin/support/tickets`,
        method: 'GET',
        headers,
        queryParams: {
          current: pagination.current,
          pageSize: pagination.pageSize,
          ...(statusFilter ? { status: statusFilter } : {}),
        },
      });
      setTickets(res?.data?.results || []);
      setPagination((prev) => ({ ...prev, total: res?.data?.totalItems || 0 }));
    } finally {
      setLoading(false);
    }
  }, [headers, pagination.current, pagination.pageSize, statusFilter]);

  const fetchTicketDetail = useCallback(async (recordId: string) => {
    if (!headers) return;
    const res = await sendRequest<IBackendRes<SupportTicket>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/admin/support/tickets/${recordId}`,
      method: 'GET',
      headers,
    });
    setActiveTicket(res?.data || null);
  }, [headers]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleTableChange = (pag: TablePaginationConfig) => {
    setPagination((prev) => ({
      ...prev,
      current: pag.current || 1,
      pageSize: pag.pageSize || 10,
    }));
  };

  const sendReply = async (values: { message: string }) => {
    if (!headers || !activeTicket) return;
    const res = await sendRequest<IBackendRes<SupportMessage>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/admin/support/tickets/${activeTicket._id}/messages`,
      method: 'POST',
      headers,
      body: values,
    });
    if (res?.data?._id) {
      replyForm.resetFields();
      await fetchTicketDetail(activeTicket._id);
      await fetchTickets();
    } else {
      message.error(String(res?.message || 'Cannot send reply'));
    }
  };

  const updateTicketStatus = async (status: TicketStatus) => {
    if (!headers || !activeTicket) return;
    const res = await sendRequest<IBackendRes<SupportTicket>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/admin/support/tickets/${activeTicket._id}/status`,
      method: 'PATCH',
      headers,
      body: { status, note: `Status updated to ${status} by admin` },
    });
    if (res?.data?._id) {
      message.success(`Ticket marked as ${status}.`);
      setActiveTicket(res.data);
      await fetchTickets();
    }
  };

  const columns: ColumnsType<SupportTicket> = [
    {
      title: 'Ticket / Subject',
      dataIndex: 'ticketNumber',
      render: (value: string, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 13 }}>{record.subject}</Text>
        </Space>
      ),
    },
    {
      title: 'Buyer',
      dataIndex: ['buyer', 'name'],
      render: (value: string) => <Text>{value || '-'}</Text>,
    },
    { title: 'Category', dataIndex: 'category', render: (value: string) => <Tag>{value}</Tag> },
    {
      title: 'Priority',
      dataIndex: 'priority',
      render: (value: string) => (
        <Text type={value === 'URGENT' || value === 'HIGH' ? 'danger' : 'secondary'}>{value}</Text>
      ),
    },
    { title: 'Updated', dataIndex: 'updatedAt', render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm') },
    { title: 'Status', dataIndex: 'status', render: (value: string) => <Badge status={value === 'CLOSED' || value === 'RESOLVED' ? 'default' : value === 'OPEN' ? 'error' : 'processing'} text={<Tag color={statusColor[value] || 'default'}>{value}</Tag>} /> },
    {
      title: 'Action',
      align: 'right',
      render: (_, record) => (
        <Button type="primary" ghost icon={<MessageOutlined />} onClick={() => fetchTicketDetail(record._id)}>
          View
        </Button>
      ),
    },
  ];

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
            onChange={(val) => { setStatusFilter(val); setPagination({ ...pagination, current: 1 }); }}
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
        <Table<SupportTicket>
          rowKey="_id"
          loading={loading}
          dataSource={tickets}
          columns={columns}
          pagination={{ ...pagination, showSizeChanger: true }}
          onChange={handleTableChange}
        />
      </Card>

      <Drawer
        title={activeTicket ? `${activeTicket.ticketNumber} - ${activeTicket.subject}` : 'Ticket'}
        open={Boolean(activeTicket)}
        onClose={() => setActiveTicket(null)}
        size={720}
        extra={activeTicket && (
          <Space>
            {activeTicket.status !== 'RESOLVED' && activeTicket.status !== 'CLOSED' && (
              <Button type="primary" onClick={() => updateTicketStatus('RESOLVED')}>Mark Resolved</Button>
            )}
            {activeTicket.status !== 'CLOSED' && (
              <Button danger onClick={() => updateTicketStatus('CLOSED')}>Close Ticket</Button>
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
              <Text type="secondary">Buyer: {activeTicket.buyer?.name || '-'}</Text>
            </Space>
            
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
              <Timeline
                mode="left"
                items={(activeTicket.messages || []).map((item) => ({
                  color: item.authorType === 'STAFF' ? 'green' : 'blue',
                  dot: item.authorType === 'STAFF' ? <CustomerServiceOutlined style={{ fontSize: '16px' }} /> : <Avatar size="small">{item.authorUsername.charAt(0).toUpperCase()}</Avatar>,
                  content: (
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
                <Form form={replyForm} layout="vertical" onFinish={sendReply}>
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
                     <Button onClick={() => updateTicketStatus('OPEN')}>Reopen Ticket</Button>
                   </div>
                )}
              </Card>
            )}
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
}
