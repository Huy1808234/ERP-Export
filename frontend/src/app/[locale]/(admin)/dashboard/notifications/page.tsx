'use client';

import React from 'react';
import { Card, Typography, Badge, Button, Space, Tag, Empty } from 'antd';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { CheckOutlined, SyncOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

import { useParams } from 'next/navigation';

const { Title, Text } = Typography;
type Translator = ReturnType<typeof useTranslations>;

function timeAgo(dateString: string, locale: string, t: Translator): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return t('justNow');
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return t('minutesAgo', { count: diffInMinutes });
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return t('hoursAgo', { count: diffInHours });
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return t('daysAgo', { count: diffInDays });
  
  return date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US');
}

function parseInternalHref(targetHref: string): string | { pathname: string; query: Record<string, string> } {
  const queryStartIndex = targetHref.indexOf('?');
  if (queryStartIndex === -1) return targetHref;

  const pathname = targetHref.slice(0, queryStartIndex) || '/';
  const queryString = targetHref.slice(queryStartIndex + 1);
  return {
    pathname,
    query: Object.fromEntries(new URLSearchParams(queryString)),
  };
}

export default function NotificationsPage() {
  const params = useParams();
  const locale = typeof params?.locale === 'string' ? params.locale : 'vi';
  const t = useTranslations('Header');
  const router = useRouter();
  
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
  } = useNotifications();

  const handleOpenNotification = (notification: AppNotification) => {
    markAsRead(notification.id);
    if (!notification.targetHref) return;
    router.push(parseInternalHref(notification.targetHref));
  };

  return (
    <Card
      title={<Title level={4} style={{ margin: 0 }}>{t('notifications')}</Title>}
      extra={
        <Space>
          <Button icon={<SyncOutlined />} onClick={refreshNotifications}>
            {t('refresh')}
          </Button>
          <Button 
            icon={<CheckOutlined />} 
            onClick={markAllAsRead} 
            disabled={!notifications.some(n => !n.isRead)}
          >
            {t('markAllRead')}
          </Button>
        </Space>
      }
      style={{ margin: 24 }}
    >
      {notifications.length === 0 ? (
        <Empty description={t('noNotifications')} style={{ padding: '32px 0' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => handleOpenNotification(item)}
              style={{
                cursor: item.targetHref ? 'pointer' : 'default',
                background: !item.isRead ? 'rgba(23, 125, 220, 0.04)' : 'transparent',
                padding: '16px 24px',
                borderBottom: '1px solid #f0f0f0',
                transition: 'background 0.3s',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
              }}
              className="hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Badge dot={!item.isRead} color="blue" offset={[-4, 4]}>
                <div style={{ width: 4 }} />
              </Badge>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 12 }}>
                  <Text strong>{item.title}</Text>
                  <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                    {timeAgo(item.createdAt, locale, t)}
                  </Text>
                </div>
                <div>
                  <div style={{ marginBottom: 8, color: 'inherit' }}>{item.body}</div>
                  <Space>
                    <Tag>{item.kind}</Tag>
                    {item.documentNumber && <Text code>{item.documentNumber}</Text>}
                  </Space>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
