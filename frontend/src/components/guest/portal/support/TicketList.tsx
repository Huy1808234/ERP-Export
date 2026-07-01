import React from 'react';
import { Button, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MessageOutlined, TruckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLocale } from 'next-intl';
import { SupportTicket } from '@/types/support.type';

const { Text } = Typography;

const statusColor: Record<string, string> = {
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

const getStatusLabel = (status: string, isVi: boolean): string => {
  if (!isVi) return status.replace(/_/g, ' ');
  const labels: Record<string, string> = {
    OPEN: 'Đang mở',
    IN_PROGRESS: 'Đang xử lý',
    WAITING_BUYER: 'Chờ phản hồi',
    RESOLVED: 'Đã xử lý',
    CLOSED: 'Đã đóng',
  };
  return labels[status] || status;
};

const getPriorityLabel = (priority: string, isVi: boolean): string => {
  if (!isVi) return priority;
  const labels: Record<string, string> = {
    LOW: 'Thấp',
    MEDIUM: 'Trung bình',
    HIGH: 'Cao',
    URGENT: 'Khẩn cấp',
  };
  return labels[priority] || priority;
};

interface TicketListProps {
  tickets: SupportTicket[];
  loading: boolean;
  onOpenDetail: (id: string) => void;
}

export default function TicketList({ tickets, loading, onOpenDetail }: TicketListProps) {
  const locale = useLocale();
  const isVi = locale === 'vi';
  const columns: ColumnsType<SupportTicket> = [
    {
      title: isVi ? 'Ticket' : 'Ticket',
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
      title: isVi ? 'Nhóm' : 'Category',
      dataIndex: 'category',
      width: 140,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: isVi ? 'Ưu tiên' : 'Priority',
      dataIndex: 'priority',
      width: 130,
      render: (value: string) => <Tag color={priorityColor[value] || 'default'}>{getPriorityLabel(value, isVi)}</Tag>,
    },
    {
      title: isVi ? 'Cập nhật' : 'Updated',
      dataIndex: 'updatedAt',
      width: 170,
      render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: isVi ? 'Trạng thái' : 'Status',
      dataIndex: 'status',
      width: 150,
      render: (value: string) => <Tag color={statusColor[value] || 'default'}>{getStatusLabel(value, isVi)}</Tag>,
    },
    {
      title: isVi ? 'Thao tác' : 'Action',
      align: 'right',
      width: 120,
      render: (_, record) => (
        <Button icon={<MessageOutlined />} onClick={() => onOpenDetail(record._id)}>
          {isVi ? 'Mở' : 'Open'}
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
      locale={{ emptyText: isVi ? 'Chưa có ticket phù hợp' : 'No matching tickets' }}
    />
  );
}
