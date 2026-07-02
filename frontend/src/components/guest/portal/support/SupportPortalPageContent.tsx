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
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageState } from '@/components/ui/PageState';
import { useGuestSupportTickets } from '@/hooks/useSupportTickets';
import { supportService } from '@/services/support.service';
import TicketList from './TicketList';
import CreateTicketModal from './CreateTicketModal';
import TicketDetailDrawer from './TicketDetailDrawer';
import type {
  TicketCategory,
  TicketFormValues,
  TicketPriority,
  TicketStatus,
} from '@/types/support.type';

const { Text } = Typography;

type TicketFilterStatus = TicketStatus | 'ALL';
type TicketFilterPriority = 'ALL' | TicketPriority;
type TicketFilterCategory = 'ALL' | TicketCategory;

const ticketCategories: readonly TicketCategory[] = [
  'QUALITY',
  'LOGISTICS',
  'FINANCE',
  'DOCUMENT',
  'OTHER',
];

const ticketPriorities: readonly TicketPriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
];

const getTicketCategory = (value: string | null): TicketCategory | undefined => (
  ticketCategories.includes(value as TicketCategory) ? value as TicketCategory : undefined
);

const getTicketPriority = (value: string | null): TicketPriority | undefined => (
  ticketPriorities.includes(value as TicketPriority) ? value as TicketPriority : undefined
);

export default function SupportPortalPageContent() {
  const { message } = App.useApp();
  const t = useTranslations('PortalSupport');
  const tCommon = useTranslations('SupportCommon');
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

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (prefillApplied) return;

    const subject = searchParams.get('subject');
    const messageValue = searchParams.get('message');
    const category = getTicketCategory(searchParams.get('category'));
    const priority = getTicketPriority(searchParams.get('priority'));
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
    const openCount = tickets.filter((ticket) => ['OPEN', 'IN_PROGRESS', 'WAITING_INTERNAL'].includes(ticket.status)).length;
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

      const matchesStatus = statusFilter === 'ALL'
        || ticket.status === statusFilter
        || (statusFilter === 'IN_PROGRESS' && ticket.status === 'WAITING_INTERNAL');
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
      message.error(t('feedback.genericError'));
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
        message.success(t('feedback.createOk'));
        setModalOpen(false);
        form.resetFields();
        setPrefillApplied(false);
        setActiveTicket(res.data);
        await fetchTickets();
      } else {
        message.error(String(res?.message || t('feedback.createFailed')));
      }
    } catch {
      message.error(t('feedback.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (values: { message: string }): Promise<void> => {
    if (!headers || !activeTicket) {
      message.error(t('feedback.genericError'));
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
        message.error(String(res?.message || t('feedback.replyFailed')));
      }
    } catch {
      message.error(t('feedback.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseTicket = async (): Promise<void> => {
    if (!headers || !activeTicket) {
      message.error(t('feedback.genericError'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await supportService.updateTicketStatus(activeTicket._id, 'CLOSED', headers);
      if (res?.data) {
        message.success(t('feedback.closed'));
        setActiveTicket(res.data);
        await fetchTickets();
      }
    } catch {
      message.error(t('feedback.closeFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={<CustomerServiceOutlined />}
        extra={(
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void fetchTickets()} loading={isLoading}>
              {t('actions.refresh')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              {t('actions.newTicket')}
            </Button>
          </Space>
        )}
      />

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {prefillApplied && modalOpen ? (
          <Alert
            showIcon
            type="info"
            title={t('feedback.prefillTitle')}
            description={t('feedback.prefillDescription')}
          />
        ) : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title={t('stats.open')} value={ticketStats.openCount} prefix={<InboxOutlined />} styles={{ content: { color: token.colorPrimary } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title={t('stats.waitingBuyer')} value={ticketStats.waitingBuyerCount} prefix={<ClockCircleOutlined />} styles={{ content: { color: token.colorWarning } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title={t('stats.resolved')} value={ticketStats.resolvedCount} prefix={<CheckCircleOutlined />} styles={{ content: { color: token.colorSuccess } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card variant="borderless">
              <Statistic title={t('stats.urgent')} value={ticketStats.urgentCount} prefix={<ExclamationCircleOutlined />} styles={{ content: { color: token.colorError } }} />
            </Card>
          </Col>
        </Row>

        <Card
          title={<Space><CustomerServiceOutlined style={{ color: token.colorPrimary }} /><span>{t('list.title')}</span><Tag>{filteredTickets.length}/{tickets.length}</Tag></Space>}
          variant="borderless"
          styles={{ body: { padding: 0 } }}
          extra={(
            <Space wrap>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={t('filters.search')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ width: 280 }}
              />
              <Select<TicketFilterStatus>
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
                options={[
                  { value: 'ALL', label: t('filters.all') },
                  { value: 'OPEN', label: tCommon('customerStatus.OPEN') },
                  { value: 'IN_PROGRESS', label: tCommon('customerStatus.IN_PROGRESS') },
                  { value: 'WAITING_BUYER', label: tCommon('customerStatus.WAITING_BUYER') },
                  { value: 'RESOLVED', label: tCommon('customerStatus.RESOLVED') },
                  { value: 'CLOSED', label: tCommon('customerStatus.CLOSED') },
                ]}
              />
              <Select<TicketFilterCategory>
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: 145 }}
                options={[
                  { value: 'ALL', label: t('filters.category') },
                  { value: 'LOGISTICS', label: tCommon('category.LOGISTICS') },
                  { value: 'FINANCE', label: tCommon('category.FINANCE') },
                  { value: 'DOCUMENT', label: tCommon('category.DOCUMENT') },
                  { value: 'QUALITY', label: tCommon('category.QUALITY') },
                  { value: 'OTHER', label: tCommon('category.OTHER') },
                ]}
              />
              <Select<TicketFilterPriority>
                value={priorityFilter}
                onChange={setPriorityFilter}
                style={{ width: 140 }}
                options={[
                  { value: 'ALL', label: t('filters.priority') },
                  { value: 'LOW', label: tCommon('priority.LOW') },
                  { value: 'MEDIUM', label: tCommon('priority.MEDIUM') },
                  { value: 'HIGH', label: tCommon('priority.HIGH') },
                  { value: 'URGENT', label: tCommon('priority.URGENT') },
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
                      <Text strong>{t('list.emptyTitle')}</Text>
                      <Text type="secondary">{t('list.emptyDescription')}</Text>
                    </Space>
                  )}
                >
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                    {t('actions.newTicket')}
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
