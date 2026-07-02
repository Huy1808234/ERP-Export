import React from 'react';
import { Button, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MessageOutlined, TruckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import type { SupportTicket, TicketPriority, TicketStatus } from '@/types/support.type';

const { Text } = Typography;

const statusColor: Record<TicketStatus, string> = {
  OPEN: 'blue',
  IN_PROGRESS: 'processing',
  WAITING_INTERNAL: 'processing',
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

interface TicketListProps {
  tickets: SupportTicket[];
  loading: boolean;
  onOpenDetail: (_id: string) => void;
}

export default function TicketList({ tickets, loading, onOpenDetail }: TicketListProps) {
  const t = useTranslations('PortalSupport');
  const tCommon = useTranslations('SupportCommon');
  const columns: ColumnsType<SupportTicket> = [
    {
      title: t('list.ticket'),
      dataIndex: 'ticketNumber',
      render: (value: string, record) => (
        <Space orientation="vertical" size={2}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ maxWidth: 420 }} ellipsis={{ tooltip: record.subject }}>
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
      title: t('list.category'),
      dataIndex: 'category',
      width: 140,
      render: (value: SupportTicket['category']) => <Tag>{tCommon(`category.${value}`)}</Tag>,
    },
    {
      title: t('list.priority'),
      dataIndex: 'priority',
      width: 130,
      render: (value: SupportTicket['priority']) => <Tag color={priorityColor[value]}>{tCommon(`priority.${value}`)}</Tag>,
    },
    {
      title: t('list.updated'),
      dataIndex: 'updatedAt',
      width: 170,
      render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: t('list.status'),
      dataIndex: 'status',
      width: 150,
      render: (value: SupportTicket['status']) => <Tag color={statusColor[value]}>{tCommon(`customerStatus.${value}`)}</Tag>,
    },
    {
      title: t('list.action'),
      align: 'right',
      width: 120,
      render: (_, record) => (
        <Button icon={<MessageOutlined />} onClick={() => onOpenDetail(record._id)}>
          {t('actions.open')}
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
      pagination={{ pageSize: 8 }}
      scroll={{ x: 980 }}
      locale={{ emptyText: t('list.emptyTitle') }}
    />
  );
}
