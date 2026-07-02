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
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Timeline,
  Tooltip,
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
  UserSwitchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageState } from '@/components/ui/PageState';
import { useAdminSupportTickets } from '@/hooks/useSupportTickets';
import { useDebounce } from '@/hooks/useDebounce';
import { supportService } from '@/services/support.service';
import type {
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@/types/support.type';

const { Text, Title } = Typography;

const statusColor: Record<TicketStatus, string> = {
  OPEN: 'blue',
  IN_PROGRESS: 'processing',
  WAITING_INTERNAL: 'purple',
  WAITING_BUYER: 'warning',
  RESOLVED: 'green',
  CLOSED: 'default',
};

const priorityColor: Record<TicketPriority, string> = {
  LOW: 'default',
  MEDIUM: 'blue',
  HIGH: 'orange',
  URGENT: 'red',
};

const slaStatusColor: Record<NonNullable<SupportTicket['sla']>['status'], string> = {
  ON_TRACK: 'green',
  DUE_SOON: 'gold',
  BREACHED: 'red',
  MET: 'blue',
};

const getBuyerName = (ticket: SupportTicket): string => ticket.buyer?.name || ticket.buyer?.code || '-';

const canAddMessage = (ticket: SupportTicket | null): boolean => (
  Boolean(ticket && ticket.status !== 'CLOSED')
);

const formatDuration = (hours?: number): string => {
  if (typeof hours !== 'number') return '-';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainderHours = hours % 24;
  return remainderHours > 0 ? `${days}d ${remainderHours}h` : `${days}d`;
};

export default function AdminSupportPageContent() {
  const { message } = App.useApp();
  const t = useTranslations('AdminSupport');
  const tCommon = useTranslations('SupportCommon');
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
    searchFilter,
    setSearchFilter,
    categoryFilter,
    setCategoryFilter,
    priorityFilter,
    setPriorityFilter,
    assignedToUsernameFilter,
    setAssignedToUsernameFilter,
  } = useAdminSupportTickets();
  const [searchInput, setSearchInput] = useState(searchFilter);
  const debouncedSearch = useDebounce(searchInput.trim(), 350);
  const [assigneeFilterInput, setAssigneeFilterInput] = useState(assignedToUsernameFilter);
  const debouncedAssigneeFilter = useDebounce(assigneeFilterInput.trim(), 350);
  const [assigneeInput, setAssigneeInput] = useState('');
  const [replyVisibility, setReplyVisibility] = useState<'PUBLIC' | 'INTERNAL'>('PUBLIC');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    setSearchFilter(debouncedSearch);
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [debouncedSearch, setPagination, setSearchFilter]);

  useEffect(() => {
    setAssignedToUsernameFilter(debouncedAssigneeFilter);
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [debouncedAssigneeFilter, setAssignedToUsernameFilter, setPagination]);

  useEffect(() => {
    setAssigneeInput(activeTicket?.assignedToUsername || '');
    setReplyVisibility(activeTicket?.status === 'RESOLVED' ? 'INTERNAL' : 'PUBLIC');
  }, [activeTicket?._id, activeTicket?.assignedToUsername, activeTicket?.status]);

  const hasServerFilter = Boolean(
    searchFilter ||
    statusFilter ||
    categoryFilter ||
    priorityFilter ||
    assignedToUsernameFilter,
  );

  const visibleStats = useMemo(() => {
    const openCount = tickets.filter((ticket) => ['OPEN', 'IN_PROGRESS', 'WAITING_INTERNAL'].includes(ticket.status)).length;
    const waitingBuyerCount = tickets.filter((ticket) => ticket.status === 'WAITING_BUYER').length;
    const breachedCount = tickets.filter((ticket) => ticket.sla?.breached).length;
    const urgentCount = tickets.filter((ticket) => ['HIGH', 'URGENT'].includes(ticket.priority)).length;

    return { openCount, waitingBuyerCount, breachedCount, urgentCount };
  }, [tickets]);

  const handleTableChange = useCallback((tablePagination: TablePaginationConfig): void => {
    setPagination((prev) => ({
      ...prev,
      current: tablePagination.current || 1,
      pageSize: tablePagination.pageSize || prev.pageSize,
    }));
  }, [setPagination]);

  const handleStatusFilterChange = useCallback((status?: TicketStatus): void => {
    setStatusFilter(status || '');
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [setPagination, setStatusFilter]);

  const handleCategoryFilterChange = useCallback((category?: TicketCategory): void => {
    setCategoryFilter(category || '');
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [setCategoryFilter, setPagination]);

  const handlePriorityFilterChange = useCallback((priority?: TicketPriority): void => {
    setPriorityFilter(priority || '');
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [setPagination, setPriorityFilter]);

  const handleOpenDetail = useCallback((ticket_id: string): void => {
    void fetchTicketDetail(ticket_id);
  }, [fetchTicketDetail]);

  const handleSendReply = async (values: { message: string }): Promise<void> => {
    if (!headers || !activeTicket) {
      message.error(t('feedback.missingContextReply'));
      return;
    }

    setSubmitting(true);
    const visibility = activeTicket.status === 'RESOLVED' ? 'INTERNAL' : replyVisibility;
    try {
      const res = await supportService.addAdminMessage(
        activeTicket._id,
        values.message.trim(),
        headers,
        visibility,
      );
      if (res.data) {
        replyForm.resetFields();
        await fetchTicketDetail(activeTicket._id);
        await fetchTickets();
        message.success(visibility === 'PUBLIC' ? t('feedback.replySent') : t('feedback.internalNoteAdded'));
        return;
      }

      message.error(String(res.message || t('feedback.replyError')));
    } catch {
      message.error(t('feedback.replyError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignTicket = async (assignedToUsername: string | null): Promise<void> => {
    if (!headers || !activeTicket) {
      message.error(t('feedback.missingContextAssign'));
      return;
    }

    setSubmitting(true);
    try {
      const note = assignedToUsername
        ? `Assigned to ${assignedToUsername}`
        : 'Assignee cleared';
      const res = await supportService.assignAdminTicket(
        activeTicket._id,
        assignedToUsername,
        headers,
        note,
      );
      if (res.data) {
        setActiveTicket(res.data);
        setAssigneeInput(res.data.assignedToUsername || '');
        await fetchTickets();
        message.success(assignedToUsername ? t('feedback.assignSuccess') : t('feedback.unassignSuccess'));
        return;
      }

      message.error(String(res.message || t('feedback.assignError')));
    } catch {
      message.error(t('feedback.assignError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (status: TicketStatus): Promise<void> => {
    if (!headers || !activeTicket) {
      message.error(t('feedback.missingContextStatus'));
      return;
    }

    setSubmitting(true);
    try {
      const note = `Status updated to ${status} by support desk`;
      const res = await supportService.updateAdminTicketStatus(activeTicket._id, status, headers, note);
      if (res.data) {
        setActiveTicket(res.data);
        await fetchTickets();
        message.success(t('feedback.statusSuccess', { status: tCommon(`status.${status}`) }));
        return;
      }

      message.error(String(res.message || t('feedback.statusError')));
    } catch {
      message.error(t('feedback.statusError'));
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<SupportTicket> = [
    {
      title: t('table.ticketSubject'),
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
      title: t('table.buyer'),
      width: 190,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{getBuyerName(record)}</Text>
          {record.buyer?.code ? <Text type="secondary">{record.buyer.code}</Text> : null}
        </Space>
      ),
    },
    {
      title: t('table.category'),
      dataIndex: 'category',
      width: 130,
      render: (value: TicketCategory) => <Tag>{value}</Tag>,
    },
    {
      title: t('table.priority'),
      dataIndex: 'priority',
      width: 120,
      render: (value: TicketPriority) => <Tag color={priorityColor[value]}>{tCommon(`priority.${value}`)}</Tag>,
    },
    {
      title: t('table.owner'),
      dataIndex: 'assignedToUsername',
      width: 150,
      render: (value: string | null) => (
        value ? <Tag icon={<UserSwitchOutlined />} color="blue">{value}</Tag> : <Text type="secondary">{t('table.unassigned')}</Text>
      ),
    },
    {
      title: t('table.sla'),
      width: 150,
      render: (_, record) => {
        if (!record.sla) return <Text type="secondary">-</Text>;
        return (
          <Tooltip title={t('table.due', { date: dayjs(record.sla.dueAt).format('DD/MM/YYYY HH:mm') })}>
            <Tag color={slaStatusColor[record.sla.status]}>{tCommon(`sla.${record.sla.status}`)}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('table.aging'),
      width: 130,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{formatDuration(record.aging?.ageHours)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('table.idle', { duration: formatDuration(record.aging?.lastActivityAgeHours) })}
          </Text>
        </Space>
      ),
    },
    {
      title: t('table.updated'),
      dataIndex: 'updatedAt',
      width: 170,
      render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      width: 150,
      render: (value: TicketStatus) => <Tag color={statusColor[value]}>{tCommon(`status.${value}`)}</Tag>,
    },
    {
      title: t('table.action'),
      align: 'right',
      width: 120,
      render: (_, record) => (
        <Button type="primary" ghost icon={<MessageOutlined />} onClick={() => handleOpenDetail(record._id)}>
          {t('actions.view')}
        </Button>
      ),
    },
  ];

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={<CustomerServiceOutlined />}
        extra={(
          <Space wrap>
            <Select<TicketStatus>
              allowClear
              placeholder={t('filters.status')}
              value={statusFilter || undefined}
              onChange={handleStatusFilterChange}
              style={{ width: 170 }}
              options={[
                { value: 'OPEN', label: tCommon('status.OPEN') },
                { value: 'IN_PROGRESS', label: tCommon('status.IN_PROGRESS') },
                { value: 'WAITING_INTERNAL', label: tCommon('status.WAITING_INTERNAL') },
                { value: 'WAITING_BUYER', label: tCommon('status.WAITING_BUYER') },
                { value: 'RESOLVED', label: tCommon('status.RESOLVED') },
                { value: 'CLOSED', label: tCommon('status.CLOSED') },
              ]}
            />
            <Button icon={<ReloadOutlined />} loading={isLoading} onClick={() => void fetchTickets()}>
              {t('actions.refresh')}
            </Button>
          </Space>
        )}
      />

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title={t('stats.open')} value={visibleStats.openCount} prefix={<InboxOutlined />} styles={{ content: { color: token.colorPrimary } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title={t('stats.waitingBuyer')} value={visibleStats.waitingBuyerCount} prefix={<ClockCircleOutlined />} styles={{ content: { color: token.colorWarning } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title={t('stats.slaBreached')} value={visibleStats.breachedCount} prefix={<CheckCircleOutlined />} styles={{ content: { color: token.colorError } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title={t('stats.urgent')} value={visibleStats.urgentCount} prefix={<ExclamationCircleOutlined />} styles={{ content: { color: token.colorError } }} />
            </Card>
          </Col>
        </Row>

        <Card
          title={(
            <Space>
              <CustomerServiceOutlined style={{ color: token.colorPrimary }} />
              <span>{t('table.title')}</span>
              <Tag>{tickets.length}/{pagination.total}</Tag>
            </Space>
          )}
          variant="borderless"
          styles={{ body: { padding: 0 } }}
          extra={(
            <Space wrap>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={t('filters.search')}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                style={{ width: 280 }}
              />
              <Select<TicketCategory>
                allowClear
                placeholder={t('filters.category')}
                value={categoryFilter || undefined}
                onChange={handleCategoryFilterChange}
                style={{ width: 145 }}
                options={[
                  { value: 'LOGISTICS', label: tCommon('category.LOGISTICS') },
                  { value: 'FINANCE', label: tCommon('category.FINANCE') },
                  { value: 'DOCUMENT', label: tCommon('category.DOCUMENT') },
                  { value: 'QUALITY', label: tCommon('category.QUALITY') },
                  { value: 'OTHER', label: tCommon('category.OTHER') },
                ]}
              />
              <Select<TicketPriority>
                allowClear
                placeholder={t('filters.priority')}
                value={priorityFilter || undefined}
                onChange={handlePriorityFilterChange}
                style={{ width: 135 }}
                options={[
                  { value: 'LOW', label: tCommon('priority.LOW') },
                  { value: 'MEDIUM', label: tCommon('priority.MEDIUM') },
                  { value: 'HIGH', label: tCommon('priority.HIGH') },
                  { value: 'URGENT', label: tCommon('priority.URGENT') },
                ]}
              />
              <Input
                allowClear
                prefix={<UserSwitchOutlined />}
                placeholder={t('filters.assignee')}
                value={assigneeFilterInput}
                onChange={(event) => setAssigneeFilterInput(event.target.value)}
                style={{ width: 190 }}
              />
            </Space>
          )}
        >
          <div style={{ padding: 16 }}>
            <PageState loading={isLoading} error={error} empty={false} onRetry={() => void fetchTickets()}>
              {tickets.length > 0 ? (
                <Table<SupportTicket>
                  rowKey="_id"
                  loading={isLoading}
                  dataSource={tickets}
                  columns={columns}
                  pagination={{
                    ...pagination,
                    total: pagination.total,
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
                      <Text strong>{t('table.emptyTitle')}</Text>
                      <Text type="secondary">
                        {hasServerFilter ? t('table.emptyFiltered') : t('table.emptyDefault')}
                      </Text>
                    </Space>
                  )}
                />
              )}
            </PageState>
          </div>
        </Card>
      </Space>

      <Drawer
        title={activeTicket ? `${activeTicket.ticketNumber} - ${activeTicket.subject}` : t('detail.ticketFallback')}
        open={Boolean(activeTicket)}
        onClose={() => setActiveTicket(null)}
        size={760}
        extra={activeTicket ? (
          <Space wrap>
            {!['IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(activeTicket.status) ? (
              <Button loading={submitting} onClick={() => void handleUpdateStatus('IN_PROGRESS')}>
                {t('actions.start')}
              </Button>
            ) : null}
            {!['WAITING_INTERNAL', 'RESOLVED', 'CLOSED'].includes(activeTicket.status) ? (
              <Button loading={submitting} onClick={() => void handleUpdateStatus('WAITING_INTERNAL')}>
                {t('actions.waitingInternal')}
              </Button>
            ) : null}
            {!['RESOLVED', 'CLOSED'].includes(activeTicket.status) ? (
              <Button type="primary" loading={submitting} onClick={() => void handleUpdateStatus('RESOLVED')}>
                {t('actions.markResolved')}
              </Button>
            ) : null}
            {['RESOLVED', 'CLOSED'].includes(activeTicket.status) ? (
              <Button loading={submitting} onClick={() => void handleUpdateStatus('OPEN')}>
                {t('actions.reopen')}
              </Button>
            ) : null}
            {activeTicket.status !== 'CLOSED' ? (
              <Button danger loading={submitting} onClick={() => void handleUpdateStatus('CLOSED')}>
                {t('actions.close')}
              </Button>
            ) : null}
          </Space>
        ) : null}
      >
        {activeTicket ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" variant="borderless" style={{ background: token.colorFillAlter }}>
              <Space size="large" wrap>
                <div><Text type="secondary">{t('detail.status')} </Text><Tag color={statusColor[activeTicket.status]}>{tCommon(`status.${activeTicket.status}`)}</Tag></div>
                <div><Text type="secondary">{t('detail.priority')} </Text><Tag color={priorityColor[activeTicket.priority]}>{tCommon(`priority.${activeTicket.priority}`)}</Tag></div>
                <div>
                  <Text type="secondary">{t('detail.owner')} </Text>
                  {activeTicket.assignedToUsername ? (
                    <Tag icon={<UserSwitchOutlined />} color="blue">{activeTicket.assignedToUsername}</Tag>
                  ) : (
                    <Text type="secondary">{t('table.unassigned')}</Text>
                  )}
                </div>
                {activeTicket.sla ? (
                  <div>
                    <Text type="secondary">{t('detail.sla')} </Text>
                    <Tag color={slaStatusColor[activeTicket.sla.status]}>{tCommon(`sla.${activeTicket.sla.status}`)}</Tag>
                    <Text type="secondary">{t('table.due', { date: dayjs(activeTicket.sla.dueAt).format('DD/MM/YYYY HH:mm') })}</Text>
                  </div>
                ) : null}
                {activeTicket.aging ? (
                  <div><Text type="secondary">{t('detail.aging')} </Text><Text>{formatDuration(activeTicket.aging.ageHours)}</Text></div>
                ) : null}
                <div><Text type="secondary">{t('detail.category')} </Text><Text>{tCommon(`category.${activeTicket.category}`)}</Text></div>
                <div><Text type="secondary">{t('detail.buyer')} </Text><Text strong>{getBuyerName(activeTicket)}</Text></div>
                <div><Text type="secondary">{t('detail.created')} </Text><Text>{dayjs(activeTicket.createdAt).format('DD/MM/YYYY HH:mm')}</Text></div>
              </Space>
              {activeTicket.shipment?.shipmentNumber ? (
                <div style={{ marginTop: 12 }}>
                  <Tag icon={<TruckOutlined />} color="geekblue">{activeTicket.shipment.shipmentNumber}</Tag>
                  {activeTicket.shipment.blNumber ? <Tag>B/L: {activeTicket.shipment.blNumber}</Tag> : null}
                  {activeTicket.shipment.bookingNumber ? <Tag>Booking: {activeTicket.shipment.bookingNumber}</Tag> : null}
                </div>
              ) : null}
            </Card>

            <Card size="small" title={t('detail.ownership')} variant="borderless" style={{ background: token.colorFillAlter }}>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={assigneeInput}
                  onChange={(event) => setAssigneeInput(event.target.value)}
                  placeholder={t('detail.staffUsername')}
                  prefix={<UserSwitchOutlined />}
                  disabled={submitting || activeTicket.status === 'CLOSED'}
                />
                <Button
                  type="primary"
                  loading={submitting}
                  disabled={activeTicket.status === 'CLOSED'}
                  onClick={() => void handleAssignTicket(assigneeInput.trim() || null)}
                >
                  {t('actions.assign')}
                </Button>
                <Button
                  loading={submitting}
                  disabled={activeTicket.status === 'CLOSED' || !activeTicket.assignedToUsername}
                  onClick={() => void handleAssignTicket(null)}
                >
                  {t('actions.clear')}
                </Button>
              </Space.Compact>
            </Card>

            <Title level={5}>{t('detail.conversation')}</Title>
            {isDetailLoading ? (
              <Card loading />
            ) : activeTicket.messages && activeTicket.messages.length > 0 ? (
              <Timeline
                items={activeTicket.messages.map((item) => ({
                  color: item.authorType === 'STAFF' ? 'green' : 'blue',
                  icon: item.authorType === 'STAFF'
                    ? <CustomerServiceOutlined style={{ fontSize: 16 }} />
                    : <TeamOutlined style={{ fontSize: 16 }} />,
                  content: (
                    <div>
                      <div style={{ marginBottom: 6 }}>
                        <Text strong>{item.authorType === 'STAFF' ? t('detail.supportTeam') : t('detail.buyerLabel')} </Text>
                        <Text type="secondary">({item.authorUsername}) - {dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
                        {item.visibility === 'INTERNAL' ? (
                          <Tag color="purple" style={{ marginInlineStart: 8 }}>{t('detail.internalNote')}</Tag>
                        ) : null}
                      </div>
                      <div
                        style={{
                          background: item.visibility === 'INTERNAL'
                            ? token.colorWarningBg
                            : item.authorType === 'STAFF'
                              ? token.colorSuccessBg
                              : token.colorPrimaryBg,
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
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('detail.noMessages')} />
            )}

            {canAddMessage(activeTicket) ? (
              <Card
                size="small"
                title={replyVisibility === 'PUBLIC' ? t('detail.replyToBuyer') : t('detail.internalNote')}
                extra={(
                  <Segmented<'PUBLIC' | 'INTERNAL'>
                    size="small"
                    value={replyVisibility}
                    onChange={setReplyVisibility}
                    options={[
                      {
                        value: 'PUBLIC',
                        label: t('detail.publicReply'),
                        disabled: activeTicket.status === 'RESOLVED',
                      },
                      { value: 'INTERNAL', label: t('detail.internalNote') },
                    ]}
                  />
                )}
              >
                <Form form={replyForm} layout="vertical" onFinish={handleSendReply}>
                  <Form.Item
                    name="message"
                    rules={[
                      {
                        validator: (_: unknown, value?: string) => (
                          typeof value === 'string' && value.trim().length > 0
                            ? Promise.resolve()
                            : Promise.reject(new Error(t('detail.messageRequired')))
                        ),
                      },
                    ]}
                  >
                    <Input.TextArea
                      rows={4}
                      maxLength={3000}
                      showCount
                      placeholder={replyVisibility === 'PUBLIC'
                        ? t('detail.replyPlaceholder')
                        : t('detail.internalPlaceholder')}
                    />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting}>
                    {replyVisibility === 'PUBLIC' ? t('actions.sendReply') : t('actions.addInternalNote')}
                  </Button>
                </Form>
              </Card>
            ) : (
              <Card size="small" style={{ textAlign: 'center', background: token.colorFillAlter }}>
                <Text type="secondary">{t('detail.closedHint')}</Text>
                <div style={{ marginTop: 12 }}>
                  <Button onClick={() => void handleUpdateStatus('OPEN')}>{t('actions.reopen')}</Button>
                </div>
              </Card>
            )}
          </Space>
        ) : null}
      </Drawer>
    </AdminPageScroll>
  );
}
