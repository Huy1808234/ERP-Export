'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Avatar, Button, Card, List, Space, Tag, Typography } from 'antd';
import {
  BellOutlined,
  CheckCircleOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  MessageOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import dayjs from 'dayjs';
import { getAccessToken } from '@/lib/auth-token';
import { sendRequest } from '@/lib/api-client';

const { Title, Text } = Typography;

type PortalNotification = {
  _id: string;
  type: 'FINANCE' | 'DOCUMENT' | 'SHIPMENT' | 'SUPPORT' | 'SYSTEM';
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  title: string;
  description: string;
  referenceType?: string | null;
  referenceId?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type NotificationResponse = {
  results: PortalNotification[];
  meta?: {
    unread?: number;
  };
};

const iconByType: Record<PortalNotification['type'], React.ReactNode> = {
  FINANCE: <CreditCardOutlined style={{ color: '#f59e0b' }} />,
  DOCUMENT: <FileTextOutlined style={{ color: '#2563eb' }} />,
  SHIPMENT: <CheckCircleOutlined style={{ color: '#10b981' }} />,
  SUPPORT: <MessageOutlined style={{ color: '#6366f1' }} />,
  SYSTEM: <BellOutlined style={{ color: '#64748b' }} />,
};

const colorBySeverity: Record<PortalNotification['severity'], string> = {
  INFO: 'blue',
  SUCCESS: 'green',
  WARNING: 'orange',
  ERROR: 'red',
};

export default function NotificationsPage() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const [rows, setRows] = useState<PortalNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<NotificationResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/notifications`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 50 },
        headers,
      });
      setRows(res?.data?.results || []);
      setUnread(Number(res?.data?.meta?.unread || 0));
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markRead = async (recordId: string) => {
    if (!headers) return;
    await sendRequest<IBackendRes<PortalNotification>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/notifications/${recordId}/read`,
      method: 'PATCH',
      headers,
    });
    await fetchNotifications();
  };

  const markAllRead = async () => {
    if (!headers) return;
    await sendRequest<IBackendRes<{ affected: number }>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/notifications/read-all`,
      method: 'PATCH',
      headers,
    });
    message.success('All notifications marked as read.');
    await fetchNotifications();
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Notification center</Title>
          <Text type="secondary">Finance, document, shipment, and support updates for your account.</Text>
        </div>
        <Space>
          <Tag color={unread ? 'blue' : 'default'}>{unread} unread</Tag>
          <Button icon={<ReloadOutlined />} onClick={fetchNotifications}>Refresh</Button>
          <Button type="primary" onClick={markAllRead}>Mark all read</Button>
        </Space>
      </div>

      <List
        loading={loading}
        itemLayout="horizontal"
        dataSource={rows}
        locale={{ emptyText: 'No portal notifications yet' }}
        renderItem={(item) => (
          <Card
            hoverable
            style={{
              marginBottom: 12,
              borderLeft: item.readAt ? '1px solid #f1f5f9' : '4px solid #2563eb',
              background: item.readAt ? '#fff' : '#f8fafc',
            }}
            styles={{ body: { padding: '16px 24px' } }}
            onClick={() => !item.readAt && markRead(item._id)}
          >
            <List.Item style={{ padding: 0, border: 'none' }}>
              <List.Item.Meta
                avatar={<Avatar icon={iconByType[item.type]} style={{ backgroundColor: '#f8fafc' }} />}
                title={(
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <Text strong>{item.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
                  </div>
                )}
                description={(
                  <div>
                    <Text type="secondary">{item.description}</Text>
                    <div style={{ marginTop: 8 }}>
                      <Space>
                        <Tag color={colorBySeverity[item.severity]}>{item.severity}</Tag>
                        <Tag>{item.type}</Tag>
                        {item.readAt ? <Tag>READ</Tag> : <Tag color="blue">NEW</Tag>}
                      </Space>
                    </div>
                  </div>
                )}
              />
            </List.Item>
          </Card>
        )}
      />
    </Space>
  );
}
