import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Space, Button, Typography, Empty } from 'antd';
import { PlusOutlined, CustomerServiceOutlined } from '@ant-design/icons';
import { useCustomerPortalTickets } from '@/hooks/useCustomerPortalTickets';
import { CreateTicketModal } from './CreateTicketModal';
import { PageState } from '@/components/ui/PageState';
import { PortalShell } from '@/components/layout/portal.shell';
import type { ColumnsType } from 'antd/es/table';
import { Ticket } from '@/services/ticket.service';

const { Text } = Typography;

export const TicketsPageContent = ({ locale }: { locale: string }) => {
  const isVi = locale === 'vi';
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
      title: isVi ? 'Mã Ticket' : 'Ticket ID',
      dataIndex: '_id',
      render: (value: string) => <Text strong>{value.slice(-6).toUpperCase()}</Text>,
    },
    {
      title: isVi ? 'Tiêu đề' : 'Subject',
      dataIndex: 'title',
    },
    {
      title: isVi ? 'Trạng thái' : 'Status',
      dataIndex: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status}
        </Tag>
      ),
    },
    {
      title: isVi ? 'Mức độ ưu tiên' : 'Priority',
      dataIndex: 'priority',
      render: (priority: string) => (
        <Tag color={getPriorityColor(priority)}>
          {priority}
        </Tag>
      ),
    },
    {
      title: isVi ? 'Ngày tạo' : 'Created At',
      dataIndex: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(locale),
    },
  ];

  return (
    <PortalShell
      title={isVi ? 'Hỗ trợ khách hàng' : 'Customer Support'}
      subtitle={isVi ? 'Gửi yêu cầu hỗ trợ và theo dõi tiến độ xử lý' : 'Submit support tickets and track resolution progress'}
      icon={<CustomerServiceOutlined />}
      extra={
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => setModalOpen(true)}
          style={{ background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', border: 'none' }}
        >
          {isVi ? 'Tạo Yêu Cầu Mới' : 'New Ticket'}
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
                <Text type="secondary">{isVi ? 'Bạn chưa có yêu cầu hỗ trợ nào' : 'You have no support tickets yet'}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {isVi ? 'Bấm vào "Tạo Yêu Cầu Mới" nếu bạn cần hỗ trợ.' : 'Click "New Ticket" if you need assistance.'}
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
        locale={locale}
      />
    </PortalShell>
  );
};
