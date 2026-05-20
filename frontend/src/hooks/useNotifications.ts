'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getSocket } from '@/lib/socket-client';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';

type NotificationKind = 'INQUIRY' | 'APPROVAL';

type BrowserAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type InquiryApiItem = {
  _id?: string;
  id?: string;
  customerName?: string;
  customerEmail?: string;
  productSnapshotName?: string;
  createdAt?: string;
  timestamp?: string | Date;
  isRead?: boolean;
};

type InquiryUnreadPayload = {
  data?: InquiryApiItem[];
};

type UnreadCountPayload = {
  data?: number;
};

type InquirySocketPayload = {
  id?: string;
  _id?: string;
  customerName?: string;
  customerEmail?: string | null;
  productSnapshotName?: string | null;
  timestamp?: string | Date;
};

type ApprovalRequiredSocketPayload = {
  requestId: string;
  documentType: string;
  documentId: string;
  documentNumber: string | null;
  title: string;
  requesterUsername: string;
  currentStepOrder: number;
  approverRoleNames: string[];
  approverUsernames: string[];
  timestamp?: string | Date;
};

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  customerName?: string;
  customerEmail?: string;
  productSnapshotName?: string;
  documentType?: string;
  documentNumber?: string | null;
  requesterUsername?: string;
  targetHref?: string;
}

export type InquiryNotification = AppNotification;

const toIsoString = (value?: string | Date) => {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : value;
};

const normalizeInquiryItems = (
  payload: InquiryUnreadPayload | InquiryApiItem[] | undefined,
): InquiryApiItem[] => {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.data) ? payload.data : [];
};

const normalizeUnreadCount = (payload: UnreadCountPayload | number | undefined) => {
  if (typeof payload === 'number') return payload;
  return typeof payload?.data === 'number' ? payload.data : 0;
};

const toInquiryNotification = (item: InquiryApiItem): AppNotification => {
  const customerName = item.customerName || 'Buyer';
  return {
    id: item._id || item.id || `INQ-${toIsoString(item.createdAt)}`,
    kind: 'INQUIRY',
    title: 'Yêu cầu báo giá mới',
    body: `${customerName} đã gửi yêu cầu báo giá.`,
    customerName,
    customerEmail: item.customerEmail,
    productSnapshotName: item.productSnapshotName,
    createdAt: toIsoString(item.timestamp || item.createdAt),
    isRead: Boolean(item.isRead),
    targetHref: '/dashboard/inquiry',
  };
};

const toApprovalNotification = (payload: ApprovalRequiredSocketPayload): AppNotification => ({
  id: payload.requestId,
  kind: 'APPROVAL',
  title: 'Có yêu cầu cần phê duyệt',
  body: `${payload.title} đang chờ ${payload.approverRoleNames.join(', ') || 'người duyệt'}.`,
  documentType: payload.documentType,
  documentNumber: payload.documentNumber,
  requesterUsername: payload.requesterUsername,
  createdAt: toIsoString(payload.timestamp),
  isRead: false,
  targetHref: '/dashboard/approvals',
});

const playNotificationSound = () => {
  try {
    const browserWindow = window as BrowserAudioWindow;
    const AudioContextClass = browserWindow.AudioContext || browserWindow.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.15;

    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    oscillator.stop(audioCtx.currentTime + 0.4);
  } catch {
    // Browsers may block audio until user interaction; notifications should still render.
  }
};

const showBrowserNotification = (title: string, body: string, tag: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico', tag });
  }
};

export const useNotifications = () => {
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const isInitialized = useRef(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  const fetchInitialData = useCallback(async () => {
    if (!accessToken) return;
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [unreadRes, countRes] = await Promise.all([
        sendRequest<IBackendRes<InquiryUnreadPayload | InquiryApiItem[]>>({
          url: `${backendUrl}/api/v1/inquiries/unread`,
          method: 'GET',
          headers,
        }),
        sendRequest<IBackendRes<UnreadCountPayload | number>>({
          url: `${backendUrl}/api/v1/inquiries/unread/count`,
          method: 'GET',
          headers,
        }),
      ]);

      const inquiryNotifications = normalizeInquiryItems(unreadRes?.data).map(toInquiryNotification);
      const serverInquiryCount = normalizeUnreadCount(countRes?.data);
      setNotifications((previous) => {
        const approvalNotifications = previous.filter((notification) => notification.kind === 'APPROVAL');
        const nextNotifications = [...approvalNotifications, ...inquiryNotifications].slice(0, 30);
        const approvalUnreadCount = approvalNotifications.filter((notification) => !notification.isRead).length;
        setUnreadCount(serverInquiryCount + approvalUnreadCount);
        return nextNotifications;
      });
    } catch (error) {
      console.error('Failed to fetch notification data:', error);
    }
  }, [backendUrl, accessToken]);

  const requestBrowserPermission = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    const target = notifications.find((notification) => notification.id === notificationId);
    if (!target) return;

    if (target.kind === 'APPROVAL') {
      setNotifications((previous) => previous.filter((notification) => notification.id !== notificationId));
      setUnreadCount((previous) => Math.max(0, previous - 1));
      return;
    }

    if (!accessToken) return;
    try {
      await sendRequest({
        url: `${backendUrl}/api/v1/inquiries/${notificationId}/read`,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setNotifications((previous) => previous.filter((notification) => notification.id !== notificationId));
      setUnreadCount((previous) => Math.max(0, previous - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [accessToken, backendUrl, notifications]);

  const markAllAsRead = useCallback(async () => {
    if (!accessToken) return;
    try {
      await sendRequest({
        url: `${backendUrl}/api/v1/inquiries/read-all`,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setNotifications([]);
      setUnreadCount(0);
      setHasNewNotification(false);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [backendUrl, accessToken]);

  const pushNotification = useCallback((notification: AppNotification) => {
    setNotifications((previous) => [
      notification,
      ...previous.filter((item) => item.id !== notification.id),
    ].slice(0, 30));
    setUnreadCount((previous) => previous + 1);
    setHasNewNotification(true);

    if (localStorage.getItem('notification_sound') !== 'false') {
      playNotificationSound();
    }

    showBrowserNotification(notification.title, notification.body, notification.id);
  }, []);

  const toggleSound = useCallback(() => setSoundEnabled((previous) => !previous), []);
  const clearNewFlag = useCallback(() => setHasNewNotification(false), []);

  useEffect(() => {
    if (accessToken) fetchInitialData();
  }, [accessToken, fetchInitialData]);

  useEffect(() => {
    if (isInitialized.current) return undefined;
    isInitialized.current = true;

    requestBrowserPermission();

    const savedSound = localStorage.getItem('notification_sound');
    if (savedSound !== null) setSoundEnabled(savedSound === 'true');

    const socket = getSocket();

    const handleInquiry = (payload: InquirySocketPayload) => {
      pushNotification(toInquiryNotification({
        _id: payload._id || payload.id,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail || undefined,
        productSnapshotName: payload.productSnapshotName || undefined,
        timestamp: payload.timestamp,
        isRead: false,
      }));
    };

    const handleApprovalRequired = (payload: ApprovalRequiredSocketPayload) => {
      pushNotification(toApprovalNotification(payload));
    };

    const handleUnreadCount = (payload: { count: number }) => {
      setNotifications((previous) => {
        const nextNotifications = payload.count === 0
          ? previous.filter((notification) => notification.kind !== 'INQUIRY')
          : previous;
        const approvalUnreadCount = nextNotifications.filter(
          (notification) => notification.kind === 'APPROVAL' && !notification.isRead,
        ).length;
        setUnreadCount(payload.count + approvalUnreadCount);
        if (payload.count === 0 && approvalUnreadCount === 0) {
          setHasNewNotification(false);
        }
        return nextNotifications;
      });
    };

    socket.on('new_inquiry', handleInquiry);
    socket.on('approval_required', handleApprovalRequired);
    socket.on('unread_count', handleUnreadCount);

    return () => {
      socket.off('new_inquiry', handleInquiry);
      socket.off('approval_required', handleApprovalRequired);
      socket.off('unread_count', handleUnreadCount);
    };
  }, [pushNotification, requestBrowserPermission]);

  useEffect(() => {
    localStorage.setItem('notification_sound', String(soundEnabled));
  }, [soundEnabled]);

  return {
    notifications,
    unreadCount,
    hasNewNotification,
    soundEnabled,
    markAsRead,
    markAllAsRead,
    toggleSound,
    requestBrowserPermission,
    clearNewFlag,
  };
};
