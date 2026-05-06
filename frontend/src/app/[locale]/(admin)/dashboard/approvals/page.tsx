'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Table, Tag, Space, Button, Card, Typography, 
  Row, Col, Statistic, theme, Modal, Input, 
  Badge, Avatar, Divider, Empty, App
} from 'antd';
import { 
  CheckCircleOutlined, CloseCircleOutlined, 
  SafetyCertificateOutlined, UserOutlined,
  ClockCircleOutlined, FileSearchOutlined,
  ShoppingOutlined, ContainerOutlined,
  FileProtectOutlined, ReloadOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/library/theme.context';
import { sendRequest } from '@/utils/api';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { TextArea } = Input;

const ApprovalsPage = () => {
  const { data: session } = useSession();
  const accessToken = (session as any)?.user?.access_token;
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const { modal, notification } = App.useApp();

  // --- States ---
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");

  // --- Logic Fetch ---
  const fetchApprovals = useCallback(async () => {
    if (!accessToken) return;
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!baseUrl) {
      console.error("NEXT_PUBLIC_BACKEND_URL is not defined!");
      setLoading(false);
      return;
    }

    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${baseUrl}/api/v1/approvals/pending`,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) setItems(res.data);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // --- Actions ---
  const handleApprove = async (item: any) => {
    modal.confirm({
      title: 'Xác nhận phê duyệt',
      content: `Bạn có chắc chắn muốn phê duyệt ${item.number}?`,
      okText: 'Đồng ý phê duyệt',
      okButtonProps: { type: 'primary' },
      onOk: async () => {
        try {
          const res = await sendRequest<IBackendRes<any>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/approvals/${item.id}/approve`,
            method: 'POST',
            body: { type: item.type },
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (res?.data) {
            notification.success({ title: 'Thành công', description: `Đã phê duyệt ${item.number}` });
            fetchApprovals();
          }
        } catch (error) {
          notification.error({ title: 'Lỗi', description: 'Không thể phê duyệt yêu cầu này' });
        }
      }
    });
  };

  const handleReject = async () => {
    if (!rejectReason) {
      notification.warning({ message: 'Cảnh báo', description: 'Vui lòng nhập lý do từ chối' });
      return;
    }
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/approvals/${selectedItem.id}/reject`,
        method: 'POST',
        body: { type: selectedItem.type, reason: rejectReason },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        notification.success({ title: 'Thành công', description: `Đã từ chối ${selectedItem.number}` });
        setRejectModalOpen(false);
        setRejectReason("");
        fetchApprovals();
      }
    } catch (error) {
      notification.error({ title: 'Lỗi', description: 'Không thể thực hiện thao tác' });
    }
  };

  // --- UI Helpers ---
  const getTypeConfig = (type: string) => {
    const configs: any = {
      PURCHASE_REQUEST: { color: 'green', label: 'Yêu cầu mua hàng', icon: <FileProtectOutlined /> },
      PURCHASE_ORDER: { color: 'blue', label: 'Đơn đặt hàng (PO)', icon: <ShoppingOutlined /> },
      SALES_CONTRACT: { color: 'purple', label: 'Hợp đồng bán hàng', icon: <ContainerOutlined /> },
    };
    return configs[type] || { color: 'default', label: type, icon: <ClockCircleOutlined /> };
  };

  // --- Table Columns ---
  const columns = [
    {
      title: 'LOẠI CHỨNG TỪ',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const config = getTypeConfig(type);
        return <Tag color={config.color} icon={config.icon}>{config.label}</Tag>;
      },
    },
    {
      title: 'SỐ CHỨNG TỪ',
      dataIndex: 'number',
      key: 'number',
      render: (text: string) => <Text strong color="blue">{text}</Text>,
    },
    {
      title: 'NGƯỜI YÊU CẦU',
      dataIndex: 'requestedBy',
      key: 'requestedBy',
      render: (text: string) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <Text>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'NGÀY YÊU CẦU',
      dataIndex: 'requestedAt',
      key: 'requestedAt',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'THAO TÁC',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button 
            type="primary" 
            size="small" 
            icon={<CheckCircleOutlined />} 
            onClick={() => handleApprove(record)}
            style={{ background: token.colorSuccess, borderColor: token.colorSuccess }}
          >
            Duyệt
          </Button>
          <Button 
            danger 
            size="small" 
            icon={<CloseCircleOutlined />} 
            onClick={() => {
              setSelectedItem(record);
              setRejectModalOpen(true);
            }}
          >
            Từ chối
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', backgroundColor: token.colorBgLayout, minHeight: '100vh' }}>
      <Row justify="space-between" align="bottom" style={{ marginBottom: '24px' }}>
        <Col>
          <PageHeader 
            title="Trung Tâm Phê Duyệt" 
            icon={<SafetyCertificateOutlined />} 
            description="Phê duyệt tập trung các yêu cầu mua hàng, đơn hàng và hợp đồng bán hàng" 
          />
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={fetchApprovals} size="large">Làm mới danh sách</Button>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Card variant="borderless" style={{ borderRadius: 16 }}>
            <Statistic 
              title="Tổng số đang chờ duyệt" 
              value={items.length} 
              prefix={<ClockCircleOutlined style={{ color: token.colorWarning }} />} 
            />
          </Card>
        </Col>
      </Row>

      <Card 
        variant="borderless" 
        style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}
        styles={{ body: { padding: 0 } }}
      >
        <Table 
          columns={columns} 
          dataSource={items} 
          rowKey="id"
          loading={loading}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '16px 48px', background: isDark ? '#141414' : '#fafafa' }}>
                <Title level={5}>Chi tiết yêu cầu: {record.number}</Title>
                <Text type="secondary">{record.description}</Text>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(record.data?.items || []).map((item: any) => (
                    <div key={item.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      padding: '8px 16px', 
                      background: isDark ? '#1d1d1d' : '#fff',
                      borderRadius: 8,
                      border: `1px solid ${token.colorBorderSecondary}`
                    }}>
                      <Space size="large">
                        <Text strong>{item.product?.vietnameseName}</Text>
                        <Text>Số lượng: <Badge count={item.quantity} color="blue" /></Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>Ghi chú: {item.note || '-'}</Text>
                      </Space>
                    </div>
                  ))}
                </div>
              </div>
            ),
          }}
          pagination={false}
          locale={{ emptyText: <Empty description="Tuyệt vời! Không có yêu cầu nào đang chờ phê duyệt" /> }}
        />
      </Card>

      <Modal
        title={`Từ chối phê duyệt: ${selectedItem?.number}`}
        open={rejectModalOpen}
        onOk={handleReject}
        onCancel={() => setRejectModalOpen(false)}
        okText="Xác nhận từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
        destroyOnHidden
        mask={{ closable: false }}
      >
        <div style={{ marginTop: 16 }}>
          <Text strong>Lý do từ chối:</Text>
          <TextArea 
            rows={4} 
            placeholder="Vui lòng nhập lý do để người yêu cầu có thể điều chỉnh..." 
            style={{ marginTop: 8 }}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default ApprovalsPage;
