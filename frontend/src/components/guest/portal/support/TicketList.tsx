import React from 'react';
import { Table, Space, Tag, Button, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MessageOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { SupportTicket } from '@/types/support.type';

const { Text } = Typography;

const statusColor: Record<string, string> = {
  OPEN: 'blue',
  IN_PROGRESS: 'processing',
  WAITING_BUYER: 'warning',
  RESOLVED: 'green',
  CLOSED: 'default',
};

interface TicketListProps {
  tickets: SupportTicket[];
  loading: boolean;
  onOpenDetail: (id: string) => void;
}

export default function TicketList({ tickets, loading, onOpenDetail }: TicketListProps) {
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
        <Button icon={<MessageOutlined />} onClick={() => onOpenDetail(record._id)}>
          Open
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
    />
  );
}
