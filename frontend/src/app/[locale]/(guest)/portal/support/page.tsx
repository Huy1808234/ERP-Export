'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CustomerServiceOutlined,
  MessageOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
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
  messages?: SupportMessage[];
  shipment?: {
    shipmentNumber?: string | null;
  } | null;
};

type TicketFormValues = {
  subject: string;
  category?: string;
  priority?: string;
  message: string;
};

const statusColor: Record<string, string> = {
  OPEN: 'blue',
  IN_PROGRESS: 'processing',
  WAITING_BUYER: 'warning',
  RESOLVED: 'green',
  CLOSED: 'default',
};

export default function SupportPortal() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const [form] = Form.useForm<TicketFormValues>();
  const [replyForm] = Form.useForm<{ message: string }>();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchTickets = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<SupportTicket[]>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/support/tickets`,
        method: 'GET',
        headers,
      });
      setTickets(res?.data || []);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const fetchTicketDetail = useCallback(async (recordId: string) => {
    if (!headers) return;
    const res = await sendRequest<IBackendRes<SupportTicket>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/support/tickets/${recordId}`,
      method: 'GET',
      headers,
    });
    setActiveTicket(res?.data || null);
  }, [headers]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const createTicket = async (values: TicketFormValues) => {
    if (!headers) return;
    const res = await sendRequest<IBackendRes<SupportTicket>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/support/tickets`,
      method: 'POST',
      headers,
      body: values,
    });
    if (res?.data?._id) {
      message.success('Support ticket created.');
      setModalOpen(false);
      form.resetFields();
      setActiveTicket(res.data);
      await fetchTickets();
    } else {
      message.error(String(res?.message || 'Cannot create ticket'));
    }
  };

  const sendReply = async (values: { message: string }) => {
    if (!headers || !activeTicket) return;
    const res = await sendRequest<IBackendRes<SupportMessage>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/support/tickets/${activeTicket._id}/messages`,
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

  const closeTicket = async () => {
    if (!headers || !activeTicket) return;
    const res = await sendRequest<IBackendRes<SupportTicket>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/support/tickets/${activeTicket._id}/status`,
      method: 'PATCH',
      headers,
      body: { status: 'CLOSED', note: 'Closed by buyer' },
    });
    if (res?.data?._id) {
      message.success('Ticket closed.');
      setActiveTicket(res.data);
      await fetchTickets();
    }
  };

  const columns: ColumnsType<SupportTicket> = [
    {
      title: 'Ticket',
      dataIndex: 'ticketNumber',
      render: (value: string, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.subject}</Text>
        </Space>
      ),
    },
    { title: 'Category', dataIndex: 'category', render: (value: string) => <Tag>{value}</Tag> },
    { title: 'Priority', dataIndex: 'priority' },
    { title: 'Updated', dataIndex: 'updatedAt', render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm') },
    { title: 'Status', dataIndex: 'status', render: (value: string) => <Tag color={statusColor[value] || 'default'}>{value}</Tag> },
    {
      title: 'Action',
      align: 'right',
      render: (_, record) => (
        <Button icon={<MessageOutlined />} onClick={() => fetchTicketDetail(record._id)}>
          Open
        </Button>
      ),
    },
  ];

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
            <Table<SupportTicket>
              rowKey="_id"
              loading={loading}
              dataSource={tickets}
              columns={columns}
              pagination={{ pageSize: 8 }}
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

      <Modal
        title="Create support ticket"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={640}
      >
        <Form<TicketFormValues>
          form={form}
          layout="vertical"
          initialValues={{ category: 'OTHER', priority: 'MEDIUM' }}
          onFinish={createTicket}
        >
          <Form.Item name="subject" label="Subject" rules={[{ required: true }]}>
            <Input placeholder="Short issue summary" />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="category" label="Category">
                <Select
                  options={[
                    { value: 'QUALITY', label: 'Quality claim' },
                    { value: 'LOGISTICS', label: 'Logistics' },
                    { value: 'FINANCE', label: 'Finance' },
                    { value: 'DOCUMENT', label: 'Documents' },
                    { value: 'OTHER', label: 'Other' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="priority" label="Priority">
                <Select
                  options={[
                    { value: 'LOW', label: 'Low' },
                    { value: 'MEDIUM', label: 'Medium' },
                    { value: 'HIGH', label: 'High' },
                    { value: 'URGENT', label: 'Urgent' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="message" label="Message" rules={[{ required: true }]}>
            <Input.TextArea rows={5} placeholder="Describe the issue, claim evidence, or question..." />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<SendOutlined />} block>
            Submit ticket
          </Button>
        </Form>
      </Modal>

      <Drawer
        title={activeTicket ? `${activeTicket.ticketNumber} - ${activeTicket.subject}` : 'Ticket'}
        open={Boolean(activeTicket)}
        onClose={() => setActiveTicket(null)}
        width={720}
        extra={activeTicket && activeTicket.status !== 'CLOSED' ? (
          <Button icon={<CheckCircleOutlined />} onClick={closeTicket}>Close ticket</Button>
        ) : null}
      >
        {activeTicket ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Space>
              <Tag color={statusColor[activeTicket.status]}>{activeTicket.status}</Tag>
              <Tag>{activeTicket.category}</Tag>
              <Tag>{activeTicket.priority}</Tag>
            </Space>
            <Timeline
              items={(activeTicket.messages || []).map((item) => ({
                color: item.authorType === 'BUYER' ? 'blue' : 'green',
                children: (
                  <div>
                    <Text strong>{item.authorUsername}</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>{dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
                    <div style={{ marginTop: 4 }}>{item.message}</div>
                  </div>
                ),
              }))}
            />
            {activeTicket.status !== 'CLOSED' ? (
              <Form form={replyForm} layout="vertical" onFinish={sendReply}>
                <Form.Item name="message" label="Reply" rules={[{ required: true }]}>
                  <Input.TextArea rows={4} />
                </Form.Item>
                <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
                  Send reply
                </Button>
              </Form>
            ) : null}
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
}
