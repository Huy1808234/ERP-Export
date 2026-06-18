'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, Descriptions, Empty, Row, Space, Statistic, Tag, Typography } from 'antd';
import { BankOutlined, ReloadOutlined, SafetyCertificateOutlined, UserOutlined, VerifiedOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { getAccessToken } from '@/lib/auth-token';
import { sendRequest } from '@/lib/api-client';

const { Title, Text } = Typography;

type PortalPartner = {
  _id: string;
  name: string;
  partnerType: string;
  region?: string | null;
  country?: string | null;
  address?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  defaultPaymentTerm?: string | null;
  defaultCurrency?: string | null;
  creditLimit?: number | null;
  currentDebt?: number | null;
  riskLevel?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankSwiftCode?: string | null;
  bankAddress?: string | null;
  taxCode?: string | null;
  isActive: boolean;
};

type PortalProfile = {
  user: {
    username: string;
    partnerId: string;
    roleName?: string | null;
  };
  partner: PortalPartner;
  finance: {
    openBalanceForeign: number;
    openInvoiceCount: number;
    defaultCurrency: string;
    creditLimit: number;
    riskLevel: string;
  };
};

export default function ProfilePage() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<PortalProfile>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/profile`,
        method: 'GET',
        headers,
      });
      setProfile(res?.data || null);
    } catch {
      message.error('Không tải được hồ sơ buyer');
    } finally {
      setLoading(false);
    }
  }, [headers, message]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (!loading && !profile) {
    return (
      <Card variant="borderless">
        <Empty description="Tài khoản portal chưa được gắn với buyer hợp lệ" />
      </Card>
    );
  }

  const partner = profile?.partner;

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Hồ sơ công ty</Title>
          <Text type="secondary">Thông tin buyer được đồng bộ từ master data Partner.</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchProfile} loading={loading}>Làm mới</Button>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card loading={loading} variant="borderless" title="Thông tin chung" style={{ height: '100%' }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Tên công ty" span={2}>
                <Text strong>{partner?.name || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Mã đối tác">{partner?._id || '-'}</Descriptions.Item>
              <Descriptions.Item label="Mã số thuế">{partner?.taxCode || '-'}</Descriptions.Item>
              <Descriptions.Item label="Quốc gia">{partner?.country || '-'}</Descriptions.Item>
              <Descriptions.Item label="Khu vực">{partner?.region || '-'}</Descriptions.Item>
              <Descriptions.Item label="Người liên hệ">{partner?.contactName || '-'}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={partner?.isActive ? 'green' : 'red'}>{partner?.isActive ? 'ACTIVE' : 'INACTIVE'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ" span={2}>{partner?.address || '-'}</Descriptions.Item>
              <Descriptions.Item label="Email">{partner?.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="Điện thoại">{partner?.phone || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card loading={loading} variant="borderless" title="Trạng thái tài khoản" style={{ height: '100%', textAlign: 'center' }}>
            <div style={{ padding: '20px 0' }}>
              <VerifiedOutlined style={{ fontSize: 64, color: '#10b981' }} />
              <Title level={4} style={{ marginTop: 16, color: '#10b981' }}>ĐÃ LIÊN KẾT BUYER</Title>
              <Text type="secondary">{profile?.user.username}</Text>
            </div>
            <Space orientation="vertical" style={{ width: '100%', textAlign: 'left' }}>
              <Space><UserOutlined style={{ color: '#1677ff' }} /> Role: <Tag>{profile?.user.roleName || 'PORTAL'}</Tag></Space>
              <Space><SafetyCertificateOutlined style={{ color: '#1677ff' }} /> Risk: <Tag color={profile?.finance.riskLevel === 'HIGH' ? 'red' : 'green'}>{profile?.finance.riskLevel || '-'}</Tag></Space>
              <Space><BankOutlined style={{ color: '#1677ff' }} /> Currency: <Tag>{profile?.finance.defaultCurrency || '-'}</Tag></Space>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <Card loading={loading} variant="borderless">
            <Statistic title="Open balance" value={profile?.finance.openBalanceForeign || 0} suffix={profile?.finance.defaultCurrency || ''} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={loading} variant="borderless">
            <Statistic title="Open invoices" value={profile?.finance.openInvoiceCount || 0} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={loading} variant="borderless">
            <Statistic title="Credit limit" value={profile?.finance.creditLimit || 0} suffix={profile?.finance.defaultCurrency || ''} />
          </Card>
        </Col>
      </Row>

      <Card loading={loading} variant="borderless" title="Thông tin ngân hàng">
        <Descriptions column={2}>
          <Descriptions.Item label="Ngân hàng">{partner?.bankName || '-'}</Descriptions.Item>
          <Descriptions.Item label="SWIFT">{partner?.bankSwiftCode || '-'}</Descriptions.Item>
          <Descriptions.Item label="Tên tài khoản">{partner?.bankAccountName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Số tài khoản">{partner?.bankAccountNumber || '-'}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ ngân hàng" span={2}>{partner?.bankAddress || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
}
