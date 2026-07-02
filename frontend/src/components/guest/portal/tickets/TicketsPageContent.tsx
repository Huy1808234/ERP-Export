import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Space, Button, Typography, Empty } from 'antd';
import { PlusOutlined, CustomerServiceOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useCustomerPortalTickets } from '@/hooks/useCustomerPortalTickets';
import { CreateTicketModal } from './CreateTicketModal';
import { PageState } from '@/components/ui/PageState';
import { PortalShell } from '@/components/layout/portal.shell';
import type { ColumnsType } from 'antd/es/table';
import { Ticket } from '@/services/ticket.service';

const { Text } = Typography;

export const TicketsPageContent = ({ locale }: { locale: string }) => {
  const t = useTranslations('PortalSupport');
  const tCommon = useTranslations('SupportCommon');
  const { tickets, loading, error, fetchTickets, submitTicket } = useCustomerPortalTickets();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'blue';
      case 'IN_PROGRESS': return 'orange';
      case 'RESOLVED': return 'green';
      case 'CLOSED': return 'default';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'default';
      case 'MEDIUM': return 'blue';
      case 'HIGH': return 'orange';
      case 'URGENT': return 'red';
      default: return 'default';
    }
  };

  const columns: ColumnsType<Ticket> = [
    {
      title: t('list.ticket'),
      dataIndex: '_id',
      render: (value: string) => <Text strong>{value.slice(-6).toUpperCase()}</Text>,
    },
    {
      title: t('form.subject'),
      dataIndex: 'title',
    },
    {
      title: t('list.status'),
      dataIndex: 'status',
      render: (status: Ticket['status']) => (
        <Tag color={getStatusColor(status)}>
          {tCommon(`customerStatus.${status}`)}
        </Tag>
      ),
    },
    {
      title: t('list.priority'),
      dataIndex: 'priority',
      render: (priority: Ticket['priority']) => (
        <Tag color={getPriorityColor(priority)}>
          {tCommon(`priority.${priority}`)}
        </Tag>
      ),
    },
    {
      title: t('detail.created'),
      dataIndex: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(locale),
    },
  ];

  return (
    <PortalShell
      title={t('title')}
      subtitle={t('description')}
      icon={<CustomerServiceOutlined />}
      extra={
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => setModalOpen(true)}
          style={{ background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', border: 'none' }}
        >
          {t('actions.newTicket')}
        </Button>
      }
    >
      <PageState loading={loading} error={error} empty={tickets.length === 0} onRetry={() => void fetchTickets()}>
        {tickets.length > 0 ? (
          <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <Table
              rowKey="_id"
              columns={columns}
              dataSource={tickets}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        ) : (
          <Empty
            description={
              <Space orientation="vertical" size={4}>
                <Text type="secondary">{t('list.emptyTitle')}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('list.emptyDescription')}
                </Text>
              </Space>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </PageState>

      <CreateTicketModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onSubmit={submitTicket}
      />
    </PortalShell>
  );
};
