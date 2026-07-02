'use client';

import React, { useMemo, useState } from 'react';
import { Button, Empty, Space, Typography, theme } from 'antd';
import {
  CheckOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/context/theme.context';
import type { AppNotification } from '@/hooks/useNotifications';
import { useRouter } from '@/i18n/routing';

const { Text } = Typography;
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

interface AdminNotificationPanelProps {
  notifications: AppNotification[];
  unreadCount: number;
  onOpenNotification: (notification: AppNotification) => void;
  onMarkAllAsRead: () => void;
  onRefresh: () => void;
  locale?: string;
}

const AdminNotificationPanel: React.FC<AdminNotificationPanelProps> = ({
  notifications,
  unreadCount,
  onOpenNotification,
  onMarkAllAsRead,
  onRefresh,
  locale = 'vi',
}) => {
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const t = useTranslations('Header');
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<string>('ALL');

  const tabs = useMemo(() => {
    const types = Array.from(new Set(notifications.map((n) => n.kind)));
    return ['ALL', 'UNREAD', ...types];
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'ALL') return notifications;
    if (activeTab === 'UNREAD') return notifications.filter((n) => !n.isRead);
    return notifications.filter((n) => n.kind === activeTab);
  }, [notifications, activeTab]);

  const renderTabLabel = (tab: string) => {
    if (tab === 'ALL') return `${t('all')} (${notifications.length})`;
    if (tab === 'UNREAD') return `${t('unread')} (${unreadCount})`;
    return tab;
  };

  return (
    <div
      style={{
        width: 480,
        maxWidth: 'calc(100vw - 32px)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '80vh',
        background: isDark ? '#141414' : '#fff',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Text strong style={{ fontSize: 16 }}>
          {t('notifications')}
        </Text>
        <Space size="middle">
          <Button
            type="text"
            size="small"
            icon={<SyncOutlined />}
            onClick={onRefresh}
            style={{ color: token.colorTextSecondary }}
          >
            {t('refresh')}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<CheckOutlined />}
            onClick={onMarkAllAsRead}
            disabled={!notifications.some((n) => !n.isRead)}
            style={{ color: token.colorTextSecondary }}
          >
            {t('markAllRead')}
          </Button>
        </Space>
      </div>

      <div
        style={{
          padding: '12px 20px',
          borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          flexShrink: 0,
          scrollbarWidth: 'none',
        }}
        className="premium-scrollbar-hidden"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <div
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '4px 12px',
                borderRadius: 20,
                cursor: 'pointer',
                background: isActive
                  ? token.colorPrimary
                  : isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.04)',
                color: isActive ? '#fff' : token.colorText,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >
              {renderTabLabel(tab)}
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredNotifications.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('noNotifications')}
            style={{ padding: '40px 0' }}
          />
        ) : (
          <div>
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => onOpenNotification(notification)}
                style={{
                  padding: '16px 20px',
                  cursor: notification.targetHref ? 'pointer' : 'default',
                  borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
                  background: !notification.isRead
                    ? isDark
                      ? 'rgba(23, 125, 220, 0.1)'
                      : '#e6f4ff'
                    : 'transparent',
                  display: 'flex',
                  gap: 12,
                  transition: 'background 0.2s',
                }}
                className="notification-item-hover"
              >
                <div style={{ width: 8, paddingTop: 6, flexShrink: 0 }}>
                  {!notification.isRead && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: token.colorPrimary,
                      }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 14 }}>
                      {notification.title}
                    </Text>
                  </div>
                  <Text
                    style={{
                      color: token.colorTextSecondary,
                      fontSize: 13,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      marginBottom: 8,
                    }}
                  >
                    {notification.body}
                  </Text>
                  <Space size="large" style={{ fontSize: 12 }}>
                    <Text type="secondary">
                      {timeAgo(notification.createdAt, locale, t)}
                    </Text>
                    <Text type="secondary" style={{ textTransform: 'uppercase' }}>
                      {notification.kind}
                    </Text>
                  </Space>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          padding: '12px 0',
          textAlign: 'center',
          borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          flexShrink: 0,
        }}
      >
        <Button type="link" onClick={() => router.push('/dashboard/notifications')}>
          {t('viewAll')}
        </Button>
      </div>

      <style jsx>{`
        .premium-scrollbar-hidden::-webkit-scrollbar {
          display: none;
        }
        .notification-item-hover:hover {
          background: ${isDark ? 'rgba(255,255,255,0.04)' : '#fafafa'} !important;
        }
      `}</style>
    </div>
  );
};

export default AdminNotificationPanel;
