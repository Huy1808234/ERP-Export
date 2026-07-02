import React from 'react';
import { Table, Space, Tag, Button, Typography, Badge } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { MessageOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import type { SupportTicket, TicketStatus } from '@/types/support.type';

const { Text } = Typography;

const statusColor: Record<TicketStatus, string> = {
  OPEN: 'error',
  IN_PROGRESS: 'processing',
  WAITING_INTERNAL: 'purple',
  WAITING_BUYER: 'warning',
  RESOLVED: 'success',
  CLOSED: 'default',
};

interface TicketAdminTableProps {
  tickets: SupportTicket[];
  loading: boolean;
  pagination: TablePaginationConfig;
  onTableChange: (pagination: TablePaginationConfig) => void;
  onOpenDetail: (_id: string) => void;
}

export default function TicketAdminTable({ tickets, loading, pagination, onTableChange, onOpenDetail }: TicketAdminTableProps) {
  const t = useTranslations('AdminSupport');
  const tCommon = useTranslations('SupportCommon');
  const columns: ColumnsType<SupportTicket> = [
    {
      title: t('table.ticketSubject'),
      dataIndex: 'ticketNumber',
      render: (value: string, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 13 }}>{record.subject}</Text>
        </Space>
      ),
    },
    {
      title: t('table.buyer'),
      dataIndex: ['buyer', 'name'],
      render: (value: string | undefined, record) => <Text>{value || record.buyer?.code || '-'}</Text>,
    },
    { title: t('table.category'), dataIndex: 'category', render: (value: SupportTicket['category']) => <Tag>{tCommon(`category.${value}`)}</Tag> },
    {
      title: t('table.priority'),
      dataIndex: 'priority',
      render: (value: SupportTicket['priority']) => (
        <Text type={value === 'URGENT' || value === 'HIGH' ? 'danger' : 'secondary'}>{tCommon(`priority.${value}`)}</Text>
      ),
    },
    { title: t('table.updated'), dataIndex: 'updatedAt', render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm') },
    { 
      title: t('table.status'), 
      dataIndex: 'status', 
      render: (value: TicketStatus) => (
        <Badge 
          status={value === 'CLOSED' || value === 'RESOLVED' ? 'default' : value === 'OPEN' ? 'error' : 'processing'} 
          text={<Tag color={statusColor[value] || 'default'}>{tCommon(`status.${value}`)}</Tag>} 
        />
      ) 
    },
    {
      title: t('table.action'),
      align: 'right',
      render: (_, record) => (
        <Button type="primary" ghost icon={<MessageOutlined />} onClick={() => onOpenDetail(record._id)}>
          {t('actions.view')}
        </Button>
      ),
    },
  ];

  return (
    <Table<SupportTicket>
      rowKey="_id"
      loading={loading}
      dataSource={tickets}
      columns={columns}
      pagination={{ ...pagination, showSizeChanger: true }}
      onChange={onTableChange}
    />
  );
}
