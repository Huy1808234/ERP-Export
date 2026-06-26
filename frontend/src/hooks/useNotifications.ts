"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { getSocket } from "@/lib/socket-client";
import { sendRequest } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-token";

type BrowserAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export interface AppNotification {
  id: string;
  kind: string; // Map to backend SystemNotificationType or legacy ones
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  targetHref?: string;
  // Legacy fields for backward compatibility
  documentNumber?: string | null;
}

type SystemNotificationApiItem = {
  _id: string;
  userId?: string;
  username?: string | null;
  type: string;
  title: string;
  content: string;
  targetUrl?: string;
  isRead: boolean;
  createdAt: string;
};

type FetchNotificationsPayload = {
  data?: SystemNotificationApiItem[];
  total?: number;
};

const toIsoString = (value?: string | Date) => {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : value;
};

const toAppNotification = (
  item: SystemNotificationApiItem,
): AppNotification => {
  return {
    id: item._id,
    kind: item.type,
    title: item.title,
    body: item.content,
    createdAt: toIsoString(item.createdAt),
    isRead: Boolean(item.isRead),
    targetHref: item.targetUrl,
  };
};

const playNotificationSound = () => {
  try {
    const browserWindow = window as BrowserAudioWindow;
    const AudioContextClass =
      browserWindow.AudioContext || browserWindow.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.frequency.value = 880;
    oscillator.type = "sine";
    gainNode.gain.value = 0.15;

    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + 0.4,
    );
    oscillator.stop(audioCtx.currentTime + 0.4);
  } catch {
    // Browsers may block audio until user interaction; notifications should still render.
  }
};

const showBrowserNotification = (title: string, body: string, tag: string) => {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico", tag });
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
      const [listRes, countRes] = await Promise.all([
        sendRequest<IBackendRes<FetchNotificationsPayload>>({
          url: `${backendUrl}/api/v1/notifications`,
          method: "GET",
          headers,
        }),
        sendRequest<IBackendRes<{ data: number }>>({
          url: `${backendUrl}/api/v1/notifications/unread-count`,
          method: "GET",
          headers,
        }),
      ]);

      const items = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
      const appNotifications = items.map(toAppNotification);

      setNotifications(appNotifications.slice(0, 30));
      const count = countRes?.data?.data;
      setUnreadCount(typeof count === "number" ? count : 0);
    } catch (error) {
      console.error("Failed to fetch notification data:", error);
    }
  }, [backendUrl, accessToken]);

  const requestBrowserPermission = useCallback(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      const target = notifications.find((n) => n.id === notificationId);
      if (!target) return;

      if (!accessToken) return;

      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await sendRequest({
          url: `${backendUrl}/api/v1/notifications/${notificationId}/read`,
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    },
    [accessToken, backendUrl, notifications],
  );

  const markAllAsRead = useCallback(async () => {
    if (!accessToken) return;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    setHasNewNotification(false);

    try {
      await sendRequest({
        url: `${backendUrl}/api/v1/notifications/read-all`,
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }, [backendUrl, accessToken]);

  const pushNotification = useCallback((notification: AppNotification) => {
    setNotifications((prev) =>
      [
        notification,
        ...prev.filter((item) => item.id !== notification.id),
      ].slice(0, 30),
    );
    setUnreadCount((prev) => prev + 1);
    setHasNewNotification(true);

    if (localStorage.getItem("notification_sound") !== "false") {
      playNotificationSound();
    }

    showBrowserNotification(
      notification.title,
      notification.body,
      notification.id,
    );
  }, []);

  const toggleSound = useCallback(() => setSoundEnabled((prev) => !prev), []);
  const clearNewFlag = useCallback(() => setHasNewNotification(false), []);

  useEffect(() => {
    if (accessToken) fetchInitialData();
  }, [accessToken, fetchInitialData]);

  useEffect(() => {
    if (isInitialized.current) return undefined;
    isInitialized.current = true;

    requestBrowserPermission();

    const savedSound = localStorage.getItem("notification_sound");
    if (savedSound !== null) setSoundEnabled(savedSound === "true");

    const socket = getSocket();
    if (!socket) return undefined;

    // Listen to new system notifications
    const handleNewSystemNotification = (
      payload: SystemNotificationApiItem,
    ) => {
      pushNotification(toAppNotification(payload));
    };

    const handleUnreadCount = (payload: { userId?: string; count: number }) => {
      setUnreadCount(payload.count);
      if (payload.count === 0) {
        setHasNewNotification(false);
      }
    };

    // Legacy listeners (optional: keep if backend still emits them, but map them to AppNotification)
    const handleLegacyInquiry = (payload: any) => {
      pushNotification({
        id: payload._id || payload.id,
        kind: "INQUIRY",
        title: "Yêu cầu báo giá mới",
        body: `${payload.customerName || "Buyer"} đã gửi yêu cầu báo giá.`,
        createdAt: toIsoString(payload.timestamp),
        isRead: false,
        targetHref: "/dashboard/inquiry",
      });
    };

    const handleLegacyApproval = (payload: any) => {
      pushNotification({
        id: payload.requestId,
        kind: "APPROVAL",
        title: "Có yêu cầu cần phê duyệt",
        body: `${payload.title} đang chờ phê duyệt.`,
        documentNumber: payload.documentNumber,
        createdAt: toIsoString(payload.timestamp),
        isRead: false,
        targetHref: "/dashboard/approvals",
      });
    };

    socket.on("new_system_notification", handleNewSystemNotification);
    socket.on("unread_count", handleUnreadCount);
    socket.on("new_inquiry", handleLegacyInquiry);
    socket.on("approval_required", handleLegacyApproval);

    return () => {
      socket.off("new_system_notification", handleNewSystemNotification);
      socket.off("unread_count", handleUnreadCount);
      socket.off("new_inquiry", handleLegacyInquiry);
      socket.off("approval_required", handleLegacyApproval);
    };
  }, [pushNotification, requestBrowserPermission]);

  useEffect(() => {
    localStorage.setItem("notification_sound", String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !session?.user?.username) return undefined;

    const joinRoom = () => {
      socket.emit("join", { username: session.user.username });
    };

    if (socket.connected) {
      joinRoom();
    }

    socket.on("connect", joinRoom);
    return () => {
      socket.off("connect", joinRoom);
    };
  }, [session?.user?.username]);

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
    refreshNotifications: fetchInitialData,
  };
};
