'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Descriptions, Empty, Space, Tag, Typography } from 'antd';
import { LogoutOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { signOut, useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { getAccessToken } from '@/lib/auth-token';
import { sendRequest } from '@/lib/api-client';

const { Title, Text } = Typography;

type PortalSettingsProfile = {
  user: {
    username: string;
    partnerId: string;
    roleName?: string | null;
  };
  partner: {
    _id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    defaultCurrency?: string | null;
    defaultPaymentTerm?: string | null;
    isActive: boolean;
  };
};

const normalizeLocale = (value: unknown) => (value === 'en' ? 'en' : 'vi');

export default function SettingsPage() {
  const { message } = App.useApp();
  const params = useParams();
  const locale = normalizeLocale(params?.locale);
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const [profile, setProfile] = useState<PortalSettingsProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<PortalSettingsProfile>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/profile`,
        method: 'GET',
        headers,
      });
      setProfile(res?.data || null);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const logoutCurrentSession = async () => {
    if (!headers) {
      await signOut({ callbackUrl: `/${locale}` });
      return;
    }

    setLoggingOut(true);
    try {
      await sendRequest<IBackendRes<{ success: boolean }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/logout`,
        method: 'POST',
        headers,
      });
    } catch {
      message.warning('Không revoke được refresh token backend, sẽ đăng xuất local session.');
    } finally {
      await signOut({ callbackUrl: `/${locale}` });
      setLoggingOut(false);
    }
  };

  if (!loading && !profile) {
    return (
      <Card variant="borderless">
        <Empty description="Không tải được cấu hình tài khoản portal" />
      </Card>
    );
  }

  return (
    <main className="w-full px-4 py-8 font-sans text-slate-950 sm:px-6 lg:px-10">
      <Space orientation="vertical" size={20} className="w-full">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Title level={3} style={{ margin: 0 }}>Cài đặt tài khoản</Title>
            <Text type="secondary">Quản lý phiên đăng nhập và thông tin liên kết buyer.</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={fetchProfile} loading={loading}>Làm mới</Button>
        </div>

        <Card loading={loading} variant="borderless" title={<Space><SafetyCertificateOutlined /> Phiên đăng nhập</Space>}>
          <Descriptions column={2} bordered>
            <Descriptions.Item label="Username">{profile?.user.username || '-'}</Descriptions.Item>
            <Descriptions.Item label="Role">{profile?.user.roleName || 'PORTAL'}</Descriptions.Item>
            <Descriptions.Item label="Buyer">{profile?.partner.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={profile?.partner.isActive ? 'green' : 'red'}>{profile?.partner.isActive ? 'ACTIVE' : 'INACTIVE'}</Tag>
            </Descriptions.Item>
          </Descriptions>
          <div className="mt-6">
            <Button danger icon={<LogoutOutlined />} loading={loggingOut} onClick={logoutCurrentSession}>
              Đăng xuất và revoke refresh token
            </Button>
          </div>
        </Card>

        <Card loading={loading} variant="borderless" title="Thông tin liên hệ mặc định">
          <Descriptions column={2}>
            <Descriptions.Item label="Email liên hệ">{profile?.partner.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="Điện thoại">{profile?.partner.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="Tiền tệ mặc định">{profile?.partner.defaultCurrency || '-'}</Descriptions.Item>
            <Descriptions.Item label="Điều khoản thanh toán">{profile?.partner.defaultPaymentTerm || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>
      </Space>
    </main>
  );
}
