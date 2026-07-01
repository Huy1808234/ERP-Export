'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Col, Empty, Form, Input, Row, Select, Space, Statistic, Tag, Typography, theme } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageState } from '@/components/ui/PageState';
import { useGuestSupportTickets } from '@/hooks/useSupportTickets';
import { supportService } from '@/services/support.service';
import TicketList from './TicketList';
import CreateTicketModal from './CreateTicketModal';
import TicketDetailDrawer from './TicketDetailDrawer';
import type { TicketFormValues, TicketStatus } from '@/types/support.type';

const { Text } = Typography;

type TicketFilterStatus = TicketStatus | 'ALL';
type TicketFilterPriority = 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type TicketFilterCategory = 'ALL' | 'QUALITY' | 'LOGISTICS' | 'FINANCE' | 'DOCUMENT' | 'OTHER';

export default function SupportPortalPageContent() {
  const { message } = App.useApp();
  const locale = useLocale();
  const isVi = locale === 'vi';
  const { token } = theme.useToken();
  const searchParams = useSearchParams();
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
  } = useGuestSupportTickets();

  const [form] = Form.useForm<TicketFormValues>();
  const [replyForm] = Form.useForm<{ message: string }>();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketFilterStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<TicketFilterCategory>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<TicketFilterPriority>('ALL');

  const copy = {
    title: isVi ? 'Hỗ trợ & Khiếu nại' : 'Support & Claims',
    subtitle: isVi
      ? 'Theo dõi ticket logistics, tài chính, chứng từ và trao đổi trực tiếp với đội vận hành.'
      : 'Track logistics, finance, document tickets and chat with the operations team.',
    refresh: isVi ? 'Làm mới' : 'Refresh',
    newTicket: isVi ? 'Tạo ticket' : 'New ticket',
    searchPlaceholder: isVi ? 'Tìm ticket, tiêu đề, lô hàng...' : 'Search ticket, subject, shipment...',
    status: isVi ? 'Trạng thái' : 'Status',
    category: isVi ? 'Nhóm' : 'Category',
    priority: isVi ? 'Ưu tiên' : 'Priority',
    all: isVi ? 'Tất cả' : 'All',
    open: isVi ? 'Đang mở' : 'Open',
    waitingBuyer: isVi ? 'Chờ phản hồi' : 'Waiting buyer',
    resolved: isVi ? 'Đã xử lý' : 'Resolved',
    urgent: isVi ? 'Cao/khẩn cấp' : 'High/urgent',
    listTitle: isVi ? 'Danh sách ticket' : 'Ticket list',
    emptyTitle: isVi ? 'Chưa có ticket phù hợp' : 'No matching tickets',
    emptyDescription: isVi
      ? 'Bạn có thể tạo ticket mới từ lô hàng, hóa đơn hoặc trực tiếp tại đây.'
      : 'Create a new ticket from a shipment, invoice, or directly from here.',
    createOk: isVi ? 'Đã tạo ticket' : 'Ticket created successfully',
    createFailed: isVi ? 'Không tạo được ticket' : 'Failed to create ticket',
    replyFailed: isVi ? 'Không gửi được phản hồi' : 'Cannot send reply',
    genericError: isVi ? 'Có lỗi xảy ra' : 'An error occurred',
    closed: isVi ? 'Ticket đã được đóng' : 'Ticket closed.',
    closeFailed: isVi ? 'Không đóng được ticket' : 'Failed to close ticket',
    prefillTitle: isVi ? 'Ticket đã được điền từ lô hàng' : 'Ticket is prefilled from shipment context',
    prefillDescription: isVi
      ? 'Vui lòng kiểm tra nội dung trước khi gửi để đội vận hành xử lý đúng vấn đề.'
      : 'Review the details before submitting so operations can triage correctly.',
  };

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (prefillApplied) return;

    const subject = searchParams.get('subject');
    const messageValue = searchParams.get('message');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const shipmentId = searchParams.get('shipmentId');

    if (!subject && !messageValue) return;

    form.setFieldsValue({
      subject: subject || undefined,
      message: messageValue || undefined,
      category: category || 'LOGISTICS',
      priority: priority || 'MEDIUM',
      shipmentId: shipmentId || undefined,
    });
    setModalOpen(true);
    setPrefillApplied(true);
  }, [form, prefillApplied, searchParams]);

  const ticketStats = useMemo(() => {
    const openCount = tickets.filter((ticket) => ['OPEN', 'IN_PROGRESS'].includes(ticket.status)).length;
    const waitingBuyerCount = tickets.filter((ticket) => ticket.status === 'WAITING_BUYER').length;
    const resolvedCount = tickets.filter((ticket) => ['RESOLVED', 'CLOSED'].includes(ticket.status)).length;
    const urgentCount = tickets.filter((ticket) => ['HIGH', 'URGENT'].includes(ticket.priority)).length;

    return { openCount, waitingBuyerCount, resolvedCount, urgentCount };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesSearch = !normalizedSearch
        || ticket.ticketNumber.toLowerCase().includes(normalizedSearch)
        || ticket.subject.toLowerCase().includes(normalizedSearch)
        || ticket.shipment?.shipmentNumber?.toLowerCase().includes(normalizedSearch);

      const matchesStatus = statusFilter === 'ALL' || ticket.status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || ticket.category === categoryFilter;
      const matchesPriority = priorityFilter === 'ALL' || ticket.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
    });
  }, [categoryFilter, priorityFilter, search, statusFilter, tickets]);

  const handleOpenCreate = useCallback((): void => {
    form.resetFields();
    form.setFieldsValue({ category: 'OTHER', priority: 'MEDIUM' });
    setModalOpen(true);
  }, [form]);

  const handleCloseCreate = useCallback((): void => {
    setModalOpen(false);
    if (!prefillApplied) {
      form.resetFields();
    }
  }, [form, prefillApplied]);

  const handleCreateTicket = async (values: TicketFormValues): Promise<void> => {
    if (!headers) {
      message.error(copy.genericError);
      return;
    }

    const payload: TicketFormValues = {
      subject: values.subject.trim(),
      message: values.message.trim(),
      category: values.category || 'OTHER',
      priority: values.priority || 'MEDIUM',
      ...(values.shipmentId ? { shipmentId: values.shipmentId } : {}),
    };

    setSubmitting(true);
    try {
      const res = await supportService.createTicket(payload, headers);
      if (res?.data) {
        message.success(copy.createOk);
        setModalOpen(false);
        form.resetFields();
        setPrefillApplied(false);
        setActiveTicket(res.data);
        await fetchTickets();
      } else {
        message.error(String(res?.message || copy.createFailed));
      }
    } catch {
      message.error(copy.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (values: { message: string }): Promise<void> => {
    if (!headers || !activeTicket) {
      message.error(copy.genericError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await supportService.addMessage(activeTicket._id, values.message.trim(), headers);
      if (res?.data) {
        replyForm.resetFields();
        await fetchTicketDetail(activeTicket._id);
        await fetchTickets();
      } else {
        message.error(String(res?.message || copy.replyFailed));
      }
    } catch {
      message.error(copy.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseTicket = async (): Promise<void> => {
    if (!headers || !activeTicket) {
      message.error(copy.genericError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await supportService.updateTicketStatus(activeTicket._id, 'CLOSED', headers);
      if (res?.data) {
        message.success(copy.closed);
        setActiveTicket(res.data);
        await fetchTickets();
      }
    } catch {
      message.error(copy.closeFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminPageScroll>
      <PageHeader
        title={copy.title}
        description={copy.subtitle}
        icon={<CustomerServiceOutlined />}
        extra={(
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void fetchTickets()} loading={isLoading}>
              {copy.refresh}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              {copy.newTicket}
            </Button>
          </Space>
        )}
      />

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {prefillApplied && modalOpen ? (
          <Alert
            showIcon
            type="info"
            title={copy.prefillTitle}
            description={copy.prefillDescription}
          />
        ) : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title={copy.open} value={ticketStats.openCount} prefix={<InboxOutlined />} styles={{ content: { color: token.colorPrimary } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title={copy.waitingBuyer} value={ticketStats.waitingBuyerCount} prefix={<ClockCircleOutlined />} styles={{ content: { color: token.colorWarning } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title={copy.resolved} value={ticketStats.resolvedCount} prefix={<CheckCircleOutlined />} styles={{ content: { color: token.colorSuccess } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title={copy.urgent} value={ticketStats.urgentCount} prefix={<ExclamationCircleOutlined />} styles={{ content: { color: token.colorError } }} />
            </Card>
          </Col>
        </Row>

        <Card
          title={<Space><CustomerServiceOutlined style={{ color: token.colorPrimary }} /><span>{copy.listTitle}</span><Tag>{filteredTickets.length}/{tickets.length}</Tag></Space>}
          variant="borderless"
          styles={{ body: { padding: 0 } }}
          extra={(
            <Space wrap>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={copy.searchPlaceholder}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ width: 280 }}
              />
              <Select<TicketFilterStatus>
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
                options={[
                  { value: 'ALL', label: copy.all },
                  { value: 'OPEN', label: isVi ? 'Đang mở' : 'Open' },
                  { value: 'IN_PROGRESS', label: isVi ? 'Đang xử lý' : 'In progress' },
                  { value: 'WAITING_BUYER', label: isVi ? 'Chờ phản hồi' : 'Waiting buyer' },
                  { value: 'RESOLVED', label: isVi ? 'Đã xử lý' : 'Resolved' },
                  { value: 'CLOSED', label: isVi ? 'Đã đóng' : 'Closed' },
                ]}
              />
              <Select<TicketFilterCategory>
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: 145 }}
                options={[
                  { value: 'ALL', label: copy.category },
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
                style={{ width: 140 }}
                options={[
                  { value: 'ALL', label: copy.priority },
                  { value: 'LOW', label: isVi ? 'Thấp' : 'Low' },
                  { value: 'MEDIUM', label: isVi ? 'Trung bình' : 'Medium' },
                  { value: 'HIGH', label: isVi ? 'Cao' : 'High' },
                  { value: 'URGENT', label: isVi ? 'Khẩn cấp' : 'Urgent' },
                ]}
              />
            </Space>
          )}
        >
          <div style={{ padding: 16 }}>
            <PageState loading={isLoading} error={error} empty={false} onRetry={() => void fetchTickets()}>
              {filteredTickets.length > 0 ? (
                <TicketList
                  tickets={filteredTickets}
                  loading={isLoading}
                  onOpenDetail={(ticket_id) => void fetchTicketDetail(ticket_id)}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={(
                    <Space orientation="vertical" size={4}>
                      <Text strong>{copy.emptyTitle}</Text>
                      <Text type="secondary">{copy.emptyDescription}</Text>
                    </Space>
                  )}
                >
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                    {copy.newTicket}
                  </Button>
                </Empty>
              )}
            </PageState>
          </div>
        </Card>
      </Space>

      <CreateTicketModal
        open={modalOpen}
        onClose={handleCloseCreate}
        form={form}
        onSubmit={handleCreateTicket}
        submitting={submitting}
      />

      <TicketDetailDrawer
        activeTicket={activeTicket}
        onClose={() => setActiveTicket(null)}
        onCloseTicket={handleCloseTicket}
        replyForm={replyForm}
        onSendReply={handleSendReply}
        loading={submitting || isDetailLoading}
      />
    </AdminPageScroll>
  );
}
