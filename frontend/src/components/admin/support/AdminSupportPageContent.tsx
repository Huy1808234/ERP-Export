'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Timeline,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  InboxOutlined,
  MessageOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  TeamOutlined,
  TruckOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageState } from '@/components/ui/PageState';
import { useAdminSupportTickets } from '@/hooks/useSupportTickets';
import { supportService } from '@/services/support.service';
import type { SupportTicket, TicketStatus } from '@/types/support.type';

const { Text, Title } = Typography;

type TicketFilterCategory = 'ALL' | 'QUALITY' | 'LOGISTICS' | 'FINANCE' | 'DOCUMENT' | 'OTHER';
type TicketFilterPriority = 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

const statusColor: Record<TicketStatus, string> = {
  OPEN: 'blue',
  IN_PROGRESS: 'processing',
  WAITING_BUYER: 'warning',
  RESOLVED: 'green',
  CLOSED: 'default',
};

const priorityColor: Record<string, string> = {
  LOW: 'default',
  MEDIUM: 'blue',
  HIGH: 'orange',
  URGENT: 'red',
};

const statusLabels: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_BUYER: 'Waiting buyer',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const getBuyerName = (ticket: SupportTicket): string => ticket.buyer?.name || ticket.buyer?.code || '-';

const canReply = (ticket: SupportTicket | null): boolean => (
  Boolean(ticket && !['RESOLVED', 'CLOSED'].includes(ticket.status))
);

const matchesText = (ticket: SupportTicket, search: string): boolean => {
  const keyword = search.trim().toLowerCase();
  if (!keyword) return true;

  return [
    ticket.ticketNumber,
    ticket.subject,
    ticket.category,
    ticket.priority,
    getBuyerName(ticket),
    ticket.shipment?.shipmentNumber || '',
    ticket.shipment?.bookingNumber || '',
    ticket.shipment?.blNumber || '',
  ].some((value) => value.toLowerCase().includes(keyword));
};

export default function AdminSupportPageContent() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [replyForm] = Form.useForm<{ message: string }>();
  const {
    tickets,
    activeTicket,
    setActiveTicket,
    isLoading,
    isDetailLoading,
    error,
    fetchTickets,
    fetchTicketDetail,
    headers,
    pagination,
    setPagination,
    statusFilter,
    setStatusFilter,
  } = useAdminSupportTickets();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TicketFilterCategory>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<TicketFilterPriority>('ALL');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  const filteredTickets = useMemo(() => (
    tickets.filter((ticket) => {
      const categoryMatched = categoryFilter === 'ALL' || ticket.category === categoryFilter;
      const priorityMatched = priorityFilter === 'ALL' || ticket.priority === priorityFilter;

      return categoryMatched && priorityMatched && matchesText(ticket, search);
    })
  ), [categoryFilter, priorityFilter, search, tickets]);

  const hasLocalFilter = search.trim().length > 0 || categoryFilter !== 'ALL' || priorityFilter !== 'ALL';

  const visibleStats = useMemo(() => {
    const openCount = filteredTickets.filter((ticket) => ['OPEN', 'IN_PROGRESS'].includes(ticket.status)).length;
    const waitingBuyerCount = filteredTickets.filter((ticket) => ticket.status === 'WAITING_BUYER').length;
    const resolvedCount = filteredTickets.filter((ticket) => ['RESOLVED', 'CLOSED'].includes(ticket.status)).length;
    const urgentCount = filteredTickets.filter((ticket) => ['HIGH', 'URGENT'].includes(ticket.priority)).length;

    return { openCount, waitingBuyerCount, resolvedCount, urgentCount };
  }, [filteredTickets]);

  const handleTableChange = useCallback((tablePagination: TablePaginationConfig): void => {
    setPagination((prev) => ({
      ...prev,
      current: tablePagination.current || 1,
      pageSize: tablePagination.pageSize || prev.pageSize,
    }));
  }, [setPagination]);

  const handleStatusFilterChange = useCallback((status?: string): void => {
    setStatusFilter(status || '');
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [setPagination, setStatusFilter]);

  const handleOpenDetail = useCallback((ticket_id: string): void => {
    void fetchTicketDetail(ticket_id);
  }, [fetchTicketDetail]);

  const handleSendReply = async (values: { message: string }): Promise<void> => {
    if (!headers || !activeTicket) {
      message.error('Cannot send reply. Authentication or ticket context is missing.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await supportService.addAdminMessage(activeTicket._id, values.message.trim(), headers);
      if (res.data) {
        replyForm.resetFields();
        await fetchTicketDetail(activeTicket._id);
        await fetchTickets();
        message.success('Reply sent to buyer.');
        return;
      }

      message.error(String(res.message || 'Cannot send reply'));
    } catch {
      message.error('Cannot send reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (status: TicketStatus): Promise<void> => {
    if (!headers || !activeTicket) {
      message.error('Cannot update status. Authentication or ticket context is missing.');
      return;
    }

    setSubmitting(true);
    try {
      const note = `Status updated to ${status} by support desk`;
      const res = await supportService.updateAdminTicketStatus(activeTicket._id, status, headers, note);
      if (res.data) {
        setActiveTicket(res.data);
        await fetchTickets();
        message.success(`Ticket marked as ${statusLabels[status]}.`);
        return;
      }

      message.error(String(res.message || 'Cannot update ticket status'));
    } catch {
      message.error('Cannot update ticket status');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<SupportTicket> = [
    {
      title: 'Ticket / Subject',
      dataIndex: 'ticketNumber',
      width: 320,
      render: (value: string, record) => (
        <Space orientation="vertical" size={2}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ maxWidth: 280 }} ellipsis={{ tooltip: record.subject }}>
            {record.subject}
          </Text>
          {record.shipment?.shipmentNumber ? (
            <Tag icon={<TruckOutlined />} color="geekblue" style={{ width: 'fit-content', marginInlineEnd: 0 }}>
              {record.shipment.shipmentNumber}
            </Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Buyer',
      width: 190,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{getBuyerName(record)}</Text>
          {record.buyer?.code ? <Text type="secondary">{record.buyer.code}</Text> : null}
        </Space>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      width: 130,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      width: 120,
      render: (value: string) => <Tag color={priorityColor[value] || 'default'}>{value}</Tag>,
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      width: 170,
      render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 150,
      render: (value: TicketStatus) => <Tag color={statusColor[value]}>{statusLabels[value]}</Tag>,
    },
    {
      title: 'Action',
      align: 'right',
      width: 120,
      render: (_, record) => (
        <Button type="primary" ghost icon={<MessageOutlined />} onClick={() => handleOpenDetail(record._id)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <AdminPageScroll>
      <PageHeader
        title="Support Desk"
        description="Manage buyer support tickets, logistics claims, finance requests, and document issues."
        icon={<CustomerServiceOutlined />}
        extra={(
          <Space wrap>
            <Select
              allowClear
              placeholder="Status"
              value={statusFilter || undefined}
              onChange={handleStatusFilterChange}
              style={{ width: 170 }}
              options={[
                { value: 'OPEN', label: 'Open' },
                { value: 'IN_PROGRESS', label: 'In progress' },
                { value: 'WAITING_BUYER', label: 'Waiting buyer' },
                { value: 'RESOLVED', label: 'Resolved' },
                { value: 'CLOSED', label: 'Closed' },
              ]}
            />
            <Button icon={<ReloadOutlined />} loading={isLoading} onClick={() => void fetchTickets()}>
              Refresh
            </Button>
          </Space>
        )}
      />

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title="Open / in progress" value={visibleStats.openCount} prefix={<InboxOutlined />} styles={{ content: { color: token.colorPrimary } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title="Waiting buyer" value={visibleStats.waitingBuyerCount} prefix={<ClockCircleOutlined />} styles={{ content: { color: token.colorWarning } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title="Resolved / closed" value={visibleStats.resolvedCount} prefix={<CheckCircleOutlined />} styles={{ content: { color: token.colorSuccess } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title="High / urgent" value={visibleStats.urgentCount} prefix={<ExclamationCircleOutlined />} styles={{ content: { color: token.colorError } }} />
            </Card>
          </Col>
        </Row>

        <Card
          title={(
            <Space>
              <CustomerServiceOutlined style={{ color: token.colorPrimary }} />
              <span>Support tickets</span>
              <Tag>{filteredTickets.length}/{pagination.total}</Tag>
            </Space>
          )}
          variant="borderless"
          styles={{ body: { padding: 0 } }}
          extra={(
            <Space wrap>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Search ticket, buyer, shipment..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ width: 280 }}
              />
              <Select<TicketFilterCategory>
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: 145 }}
                options={[
                  { value: 'ALL', label: 'Category' },
                  { value: 'LOGISTICS', label: 'LOGISTICS' },
                  { value: 'FINANCE', label: 'FINANCE' },
                  { value: 'DOCUMENT', label: 'DOCUMENT' },
                  { value: 'QUALITY', label: 'QUALITY' },
                  { value: 'OTHER', label: 'OTHER' },
                ]}
              />
              <Select<TicketFilterPriority>
                value={priorityFilter}
                onChange={setPriorityFilter}
                style={{ width: 135 }}
                options={[
                  { value: 'ALL', label: 'Priority' },
                  { value: 'LOW', label: 'LOW' },
                  { value: 'MEDIUM', label: 'MEDIUM' },
                  { value: 'HIGH', label: 'HIGH' },
                  { value: 'URGENT', label: 'URGENT' },
                ]}
              />
            </Space>
          )}
        >
          <div style={{ padding: 16 }}>
            <PageState loading={isLoading} error={error} empty={false} onRetry={() => void fetchTickets()}>
              {filteredTickets.length > 0 ? (
                <Table<SupportTicket>
                  rowKey="_id"
                  loading={isLoading}
                  dataSource={filteredTickets}
                  columns={columns}
                  pagination={{
                    ...pagination,
                    total: hasLocalFilter ? filteredTickets.length : pagination.total,
                    showSizeChanger: true,
                  }}
                  onChange={handleTableChange}
                  scroll={{ x: 1200 }}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={(
                    <Space orientation="vertical" size={4}>
                      <Text strong>No matching support tickets</Text>
                      <Text type="secondary">Try another status, category, priority, or search keyword.</Text>
                    </Space>
                  )}
                />
              )}
            </PageState>
          </div>
        </Card>
      </Space>

      <Drawer
        title={activeTicket ? `${activeTicket.ticketNumber} - ${activeTicket.subject}` : 'Ticket'}
        open={Boolean(activeTicket)}
        onClose={() => setActiveTicket(null)}
        size={760}
        extra={activeTicket ? (
          <Space wrap>
            {!['RESOLVED', 'CLOSED'].includes(activeTicket.status) ? (
              <Button loading={submitting} onClick={() => void handleUpdateStatus('IN_PROGRESS')}>
                Start
              </Button>
            ) : null}
            {!['RESOLVED', 'CLOSED'].includes(activeTicket.status) ? (
              <Button type="primary" loading={submitting} onClick={() => void handleUpdateStatus('RESOLVED')}>
                Mark resolved
              </Button>
            ) : null}
            {activeTicket.status === 'RESOLVED' ? (
              <Button loading={submitting} onClick={() => void handleUpdateStatus('OPEN')}>
                Reopen
              </Button>
            ) : null}
            {activeTicket.status !== 'CLOSED' ? (
              <Button danger loading={submitting} onClick={() => void handleUpdateStatus('CLOSED')}>
                Close
              </Button>
            ) : null}
          </Space>
        ) : null}
      >
        {activeTicket ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" variant="borderless" style={{ background: token.colorFillAlter }}>
              <Space size="large" wrap>
                <div><Text type="secondary">Status: </Text><Tag color={statusColor[activeTicket.status]}>{statusLabels[activeTicket.status]}</Tag></div>
                <div><Text type="secondary">Priority: </Text><Tag color={priorityColor[activeTicket.priority] || 'default'}>{activeTicket.priority}</Tag></div>
                <div><Text type="secondary">Category: </Text><Text>{activeTicket.category}</Text></div>
                <div><Text type="secondary">Buyer: </Text><Text strong>{getBuyerName(activeTicket)}</Text></div>
                <div><Text type="secondary">Created: </Text><Text>{dayjs(activeTicket.createdAt).format('DD/MM/YYYY HH:mm')}</Text></div>
              </Space>
              {activeTicket.shipment?.shipmentNumber ? (
                <div style={{ marginTop: 12 }}>
                  <Tag icon={<TruckOutlined />} color="geekblue">{activeTicket.shipment.shipmentNumber}</Tag>
                  {activeTicket.shipment.blNumber ? <Tag>B/L: {activeTicket.shipment.blNumber}</Tag> : null}
                  {activeTicket.shipment.bookingNumber ? <Tag>Booking: {activeTicket.shipment.bookingNumber}</Tag> : null}
                </div>
              ) : null}
            </Card>

            <Title level={5}>Conversation</Title>
            {isDetailLoading ? (
              <Card loading />
            ) : activeTicket.messages && activeTicket.messages.length > 0 ? (
              <Timeline
                items={activeTicket.messages.map((item) => ({
                  color: item.authorType === 'STAFF' ? 'green' : 'blue',
                  dot: item.authorType === 'STAFF'
                    ? <CustomerServiceOutlined style={{ fontSize: 16 }} />
                    : <TeamOutlined style={{ fontSize: 16 }} />,
                  children: (
                    <div>
                      <div style={{ marginBottom: 6 }}>
                        <Text strong>{item.authorType === 'STAFF' ? 'Support team' : 'Buyer'} </Text>
                        <Text type="secondary">({item.authorUsername}) - {dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
                      </div>
                      <div
                        style={{
                          background: item.authorType === 'STAFF' ? token.colorSuccessBg : token.colorPrimaryBg,
                          border: `1px solid ${token.colorBorderSecondary}`,
                          borderRadius: 8,
                          padding: '10px 12px',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {item.message}
                      </div>
                      {item.attachments && item.attachments.length > 0 ? (
                        <Space size={6} wrap style={{ marginTop: 8 }}>
                          {item.attachments.map((attachment) => (
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
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No messages yet" />
            )}

            {canReply(activeTicket) ? (
              <Card size="small" title="Reply to buyer">
                <Form form={replyForm} layout="vertical" onFinish={handleSendReply}>
                  <Form.Item
                    name="message"
                    rules={[
                      {
                        validator: (_: unknown, value?: string) => (
                          typeof value === 'string' && value.trim().length > 0
                            ? Promise.resolve()
                            : Promise.reject(new Error('Please enter a reply message'))
                        ),
                      },
                    ]}
                  >
                    <Input.TextArea rows={4} maxLength={3000} showCount placeholder="Type your reply to the buyer..." />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting}>
                    Send reply
                  </Button>
                </Form>
              </Card>
            ) : (
              <Card size="small" style={{ textAlign: 'center', background: token.colorFillAlter }}>
                <Text type="secondary">This ticket is {statusLabels[activeTicket.status].toLowerCase()}. New replies are disabled.</Text>
                {activeTicket.status === 'RESOLVED' ? (
                  <div style={{ marginTop: 12 }}>
                    <Button onClick={() => void handleUpdateStatus('OPEN')}>Reopen ticket</Button>
                  </div>
                ) : null}
              </Card>
            )}
          </Space>
        ) : null}
      </Drawer>
    </AdminPageScroll>
  );
}
