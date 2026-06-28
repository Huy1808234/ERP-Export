'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Avatar,
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Row,
  Skeleton,
  Space,
  Steps,
  Tabs,
  Tag,
  Typography,
  theme,
} from 'antd';
import {
  BellOutlined,
  CheckCircleOutlined,
  LockOutlined,
  MailOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { signOut, useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import type { CSSProperties } from 'react';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { getAccessToken } from '@/lib/auth-token';
import { sendRequest } from '@/lib/api-client';
import type { IAuthSessionUser } from '@/types/next-auth';

const { Paragraph, Text, Title } = Typography;

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

type CurrentUserProfileResponse = {
  _id: string;
  username: string;
  email: string;
  name?: string;
  roleName?: string | null;
};

type PasswordResetCodeResponse = {
  _id: string;
  username: string;
  email: string;
};

type PasswordFormValues = {
  code: string;
  password: string;
  confirmPassword: string;
};

type PortalAccountFormValues = {
  username: string;
  email: string;
  buyer: string;
  phone: string;
  defaultCurrency: string;
  defaultPaymentTerm: string;
};

const sectionStyle: CSSProperties = {
  padding: '28px 32px',
};

const normalizeLocale = (value: unknown): 'en' | 'vi' => (value === 'en' ? 'en' : 'vi');

const normalizeVerificationCode = (code: string): string =>
  code.replace(/[\s\u200B-\u200D\uFEFF]+/g, '');

function AccountSettingsPanel({
  authProfile,
  portalProfile,
  loading,
}: {
  authProfile: CurrentUserProfileResponse | null;
  portalProfile: PortalSettingsProfile | null;
  loading: boolean;
}) {
  const { token } = theme.useToken();
  const displayName = authProfile?.name || portalProfile?.partner.name || authProfile?.username || '-';
  const userInitial = displayName.charAt(0).toUpperCase();
  const userRole = authProfile?.roleName || portalProfile?.user.roleName || 'CUSTOMER';
  const isActive = portalProfile?.partner.isActive;
  const accountFormValues: PortalAccountFormValues = {
    username: authProfile?.username || portalProfile?.user.username || '-',
    email: authProfile?.email || portalProfile?.partner.email || '-',
    buyer: portalProfile?.partner.name || '-',
    phone: portalProfile?.partner.phone || '-',
    defaultCurrency: portalProfile?.partner.defaultCurrency || '-',
    defaultPaymentTerm: portalProfile?.partner.defaultPaymentTerm || '-',
  };

  return (
    <div style={sectionStyle}>
      <Row gutter={[32, 32]}>
        <Col xs={24} lg={7}>
          <Space orientation="vertical" size={8}>
            <Title level={4} style={{ margin: 0 }}>Thông tin tài khoản</Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              Dữ liệu hiển thị được lấy từ phiên đăng nhập hiện tại.
            </Paragraph>
          </Space>
        </Col>
        <Col xs={24} lg={17}>
          <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
            <Space size={18} align="center" style={{ marginBottom: 28 }}>
              <Avatar
                size={72}
                style={{
                  background: `linear-gradient(135deg, ${token.colorPrimary}, #8b5cf6)`,
                  fontSize: 28,
                  fontWeight: 800,
                }}
              >
                {userInitial}
              </Avatar>
              <div>
                <Space align="center" wrap>
                  <Title level={4} style={{ margin: 0 }}>{displayName}</Title>
                  <Tag color="blue">{userRole}</Tag>
                  {isActive !== undefined && (
                    <Tag color={isActive ? 'green' : 'red'}>
                      {isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Tag>
                  )}
                </Space>
                <Text type="secondary">{authProfile?.email || portalProfile?.partner.email || '-'}</Text>
              </div>
            </Space>

            <Form layout="vertical" disabled>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Tên đăng nhập">
                    <Input prefix={<UserOutlined />} value={accountFormValues.username} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Email">
                    <Input prefix={<MailOutlined />} value={accountFormValues.email} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Buyer">
                    <Input value={accountFormValues.buyer} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Điện thoại liên hệ">
                    <Input value={accountFormValues.phone} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Tiền tệ mặc định">
                    <Input value={accountFormValues.defaultCurrency} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Điều khoản thanh toán">
                    <Input value={accountFormValues.defaultPaymentTerm} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Skeleton>
        </Col>
      </Row>
    </div>
  );
}

function SecuritySettingsPanel({
  accessToken,
  accountEmail,
  locale,
}: {
  accessToken?: string;
  accountEmail: string;
  locale: 'en' | 'vi';
}) {
  const { notification } = App.useApp();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [resetUserId, setResetUserId] = useState('');
  const [resolvedUserEmail, setResolvedUserEmail] = useState(accountEmail);
  const [passwordStep, setPasswordStep] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setResolvedUserEmail(accountEmail);
  }, [accountEmail]);

  const handleSendResetCode = async () => {
    if (!accessToken) {
      notification.warning({
        message: 'Cần phiên đăng nhập hợp lệ',
        description: 'Vui lòng đăng nhập lại rồi thử lại.',
      });
      return;
    }

    setSendingCode(true);
    try {
      const res = await sendRequest<IBackendRes<PasswordResetCodeResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/me/password-reset-code`,
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data?._id) {
        setResetUserId(res.data._id);
        setResolvedUserEmail(res.data.email);
        setPasswordStep(1);
        notification.success({
          message: 'Đã gửi mã xác thực',
          description: `Vui lòng kiểm tra email ${res.data.email}.`,
        });
      } else {
        notification.error({
          message: 'Không thể gửi mã',
          description: res?.message || 'Vui lòng thử lại.',
        });
      }
    } finally {
      setSendingCode(false);
    }
  };

  const handleChangePassword = async (values: PasswordFormValues) => {
    if (!resetUserId) {
      notification.warning({
        message: 'Cần gửi mã xác thực trước',
        description: 'Hãy gửi OTP đến email của tài khoản trước khi đặt mật khẩu mới.',
      });
      return;
    }

    setChangingPassword(true);
    try {
      const res = await sendRequest<IBackendRes<{ isBeforeCheck: boolean }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/change-password`,
        method: 'POST',
        body: {
          accountRef: resetUserId,
          code: normalizeVerificationCode(values.code),
          password: values.password,
        },
      });

      if (res?.data) {
        setPasswordStep(2);
        passwordForm.resetFields(['code', 'password', 'confirmPassword']);
        notification.success({
          message: 'Đã đổi mật khẩu',
          description: 'Mật khẩu mới đã được cập nhật.',
        });
      } else {
        notification.error({
          message: 'Đổi mật khẩu thất bại',
          description: res?.message || 'OTP không đúng hoặc đã hết hạn.',
        });
      }
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div style={sectionStyle}>
      <Row gutter={[32, 32]}>
        <Col xs={24} lg={7}>
          <Space orientation="vertical" size={8}>
            <Title level={4} style={{ margin: 0 }}>Bảo mật</Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              Mã OTP được gửi đến email của tài khoản đang đăng nhập.
            </Paragraph>
          </Space>
        </Col>
        <Col xs={24} lg={17}>
          <Steps
            current={passwordStep}
            size="small"
            style={{ marginBottom: 28 }}
            items={[
              { title: 'Gửi mã', icon: <MailOutlined /> },
              { title: 'Đặt mật khẩu', icon: <LockOutlined /> },
              { title: 'Hoàn tất', icon: <CheckCircleOutlined /> },
            ]}
          />

          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={handleChangePassword}
            requiredMark={false}
            style={{ maxWidth: 560 }}
          >
            <Form.Item label="Email nhận mã xác thực">
              <Input
                prefix={<MailOutlined />}
                disabled
                value={resolvedUserEmail}
                placeholder="name@company.com"
              />
            </Form.Item>

            <Button
              icon={<MailOutlined />}
              loading={sendingCode}
              disabled={!accessToken}
              onClick={handleSendResetCode}
              style={{ marginBottom: 24 }}
            >
              Gửi mã xác thực
            </Button>

            <Form.Item
              label="Mã OTP"
              name="code"
              rules={[
                {
                  validator: (_, value?: string) =>
                    /^\d{6}$/.test(normalizeVerificationCode(value || ''))
                      ? Promise.resolve()
                      : Promise.reject(new Error('Vui lòng nhập OTP 6 số')),
                },
              ]}
            >
              <Input inputMode="numeric" maxLength={6} placeholder="Nhập mã trong email" />
            </Form.Item>

            <Form.Item
              label="Mật khẩu mới"
              name="password"
              rules={[
                { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                { min: 6, message: 'Mật khẩu phải từ 6 ký tự trở lên' },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Tối thiểu 6 ký tự" />
            </Form.Item>

            <Form.Item
              label="Xác nhận mật khẩu mới"
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Vui lòng xác nhận mật khẩu mới' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu mới" />
            </Form.Item>

            <Space wrap>
              <Button
                type="primary"
                htmlType="submit"
                icon={<LockOutlined />}
                loading={changingPassword}
              >
                Cập nhật mật khẩu
              </Button>
              {passwordStep === 2 && (
                <Button onClick={() => signOut({ callbackUrl: `/${locale}/auth/login` })}>
                  Đăng nhập lại
                </Button>
              )}
            </Space>
          </Form>
        </Col>
      </Row>
    </div>
  );
}

function NotificationsSettingsPanel() {
  return (
    <div style={sectionStyle}>
      <Row gutter={[32, 32]}>
        <Col xs={24} lg={7}>
          <Space orientation="vertical" size={8}>
            <Title level={4} style={{ margin: 0 }}>Thông báo</Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              Tùy chọn nhận thông báo cho tài khoản customer portal.
            </Paragraph>
          </Space>
        </Col>
        <Col xs={24} lg={17}>
          <Space orientation="vertical" size={10}>
            <Text strong>Thông báo hệ thống đang bật</Text>
            <Text type="secondary">
              Các tùy chọn email và in-app notification chi tiết sẽ được cấu hình khi backend có preference riêng cho customer portal.
            </Text>
          </Space>
        </Col>
      </Row>
    </div>
  );
}

export default function PortalSettingsPageContent() {
  const params = useParams();
  const locale = normalizeLocale(params?.locale);
  const { data: session } = useSession();
  const { token } = theme.useToken();
  const accessToken = getAccessToken(session);
  const sessionUser = session?.user as IAuthSessionUser | undefined;
  const headers = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    [accessToken],
  );

  const [portalProfile, setPortalProfile] = useState<PortalSettingsProfile | null>(null);
  const [authProfile, setAuthProfile] = useState<CurrentUserProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('account');

  const fetchProfiles = useCallback(async () => {
    if (!headers) return;

    setLoading(true);
    setErrorMessage(null);
    try {
      const [portalRes, authRes] = await Promise.all([
        sendRequest<IBackendRes<PortalSettingsProfile>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/profile`,
          method: 'GET',
          headers,
        }),
        sendRequest<IBackendRes<CurrentUserProfileResponse>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/profile`,
          method: 'GET',
          headers,
        }),
      ]);

      setPortalProfile(portalRes?.data || null);
      setAuthProfile(authRes?.data || null);
      if (!portalRes?.data && !authRes?.data) {
        setErrorMessage(portalRes?.message || authRes?.message || 'Không tải được cấu hình tài khoản portal.');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không tải được cấu hình tài khoản portal.');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const fallbackAuthProfile = authProfile || {
    _id: sessionUser?._id || '',
    username: sessionUser?.username || '',
    email: sessionUser?.email || '',
    name: sessionUser?.name || undefined,
    roleName: sessionUser?.roleName,
  };

  const accountEmail = authProfile?.email || sessionUser?.email || '';

  const panelStyle = useMemo<CSSProperties>(() => ({
    borderRadius: 20,
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorBgContainer,
    boxShadow: token.boxShadowTertiary,
    overflow: 'hidden',
  }), [token]);

  if (!loading && !portalProfile && !authProfile && !sessionUser) {
    return (
      <AdminPageScroll>
        <PageHeader
          title="Cài đặt hệ thống"
          icon={<SettingOutlined />}
          description="Quản lý hồ sơ, bảo mật tài khoản và tùy chọn hệ thống"
        />
        <Card variant="borderless">
          <Empty description="Không tải được cấu hình tài khoản portal" />
        </Card>
      </AdminPageScroll>
    );
  }

  return (
    <AdminPageScroll>
      <PageHeader
        title="Cài đặt hệ thống"
        icon={<SettingOutlined />}
        description="Quản lý hồ sơ, bảo mật tài khoản và tùy chọn hệ thống"
      />

      {errorMessage && (
        <Alert
          showIcon
          type="error"
          message="Không tải được dữ liệu cài đặt"
          description={errorMessage}
          action={<Button size="small" onClick={fetchProfiles}>Thử lại</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card variant="borderless" style={panelStyle} styles={{ body: { padding: 0 } }}>
        <div
          style={{
            padding: '22px 32px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
          }}
        >
          <Space orientation="vertical" size={4}>
            <Text strong style={{ fontSize: 16 }}>Cài đặt hệ thống</Text>
            <Text type="secondary">
              Màu sắc và điều khiển đồng bộ theo light/dark mode của dashboard.
            </Text>
          </Space>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'account',
              label: <Space><UserOutlined />Tài khoản</Space>,
              children: (
                <AccountSettingsPanel
                  authProfile={fallbackAuthProfile}
                  portalProfile={portalProfile}
                  loading={loading}
                />
              ),
            },
            {
              key: 'security',
              label: <Space><LockOutlined />Bảo mật</Space>,
              children: (
                <SecuritySettingsPanel
                  accessToken={accessToken}
                  accountEmail={accountEmail}
                  locale={locale}
                />
              ),
            },
            {
              key: 'notifications',
              label: <Space><BellOutlined />Thông báo</Space>,
              children: <NotificationsSettingsPanel />,
            },
          ]}
          tabBarStyle={{
            margin: 0,
            padding: '0 32px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        />
      </Card>
    </AdminPageScroll>
  );
}
