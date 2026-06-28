import React from 'react';
import { Table, Space, Tag, Button, Typography, Badge } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { MessageOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { SupportTicket } from '@/types/support.type';

const { Text } = Typography;

const statusColor: Record<string, string> = {
  OPEN: 'error',
  IN_PROGRESS: 'processing',
  WAITING_BUYER: 'warning',
  RESOLVED: 'success',
  CLOSED: 'default',
};

interface TicketAdminTableProps {
  tickets: SupportTicket[];
  loading: boolean;
  pagination: TablePaginationConfig;
  onTableChange: (pagination: TablePaginationConfig) => void;
  onOpenDetail: (id: string) => void;
}

export default function TicketAdminTable({ tickets, loading, pagination, onTableChange, onOpenDetail }: TicketAdminTableProps) {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: (value: string, record: any) => <Text>{value || record.buyerId || '-'}</Text>,
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
    { 
      title: 'Status', 
      dataIndex: 'status', 
      render: (value: string) => (
        <Badge 
          status={value === 'CLOSED' || value === 'RESOLVED' ? 'default' : value === 'OPEN' ? 'error' : 'processing'} 
          text={<Tag color={statusColor[value] || 'default'}>{value}</Tag>} 
        />
      ) 
    },
    {
      title: 'Action',
      align: 'right',
      render: (_, record) => (
        <Button type="primary" ghost icon={<MessageOutlined />} onClick={() => onOpenDetail(record._id)}>
          View
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
