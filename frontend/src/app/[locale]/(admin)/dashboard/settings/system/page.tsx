'use client';

import {
  BellOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  LockOutlined,
  MailOutlined,
  PercentageOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import { getSetting, updateSetting } from '@/services/settings.service';
import CurrencyPage from '../currencies/page';
import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Steps,
  Tabs,
  Tag,
  Typography,
  theme,
} from 'antd';
import { signOut, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { IAuthSessionUser } from '@/types/next-auth';

const { Text, Title, Paragraph } = Typography;

type ForgotPasswordResponse = {
  _id: string;
  username: string;
  email: string;
};

type CurrentUserProfileResponse = {
  _id: string;
  username: string;
  email: string;
  name?: string;
};

type PasswordFormValues = {
  code: string;
  password: string;
  confirmPassword: string;
};

type TaxSettingsFormValues = {
  defaultPurchaseVatRate: number;
};

type MatchingSettingsFormValues = {
  quantityTolerance: number;
  priceTolerancePercent: number;
};

const DEFAULT_PURCHASE_VAT_RATE_KEY = 'DEFAULT_PURCHASE_VAT_RATE';
const THREE_WAY_MATCHING_QTY_TOLERANCE_KEY = 'THREE_WAY_MATCHING_QTY_TOLERANCE';
const THREE_WAY_MATCHING_PRICE_TOLERANCE_PERCENT_KEY = 'THREE_WAY_MATCHING_PRICE_TOLERANCE_PERCENT';

const sectionStyle: CSSProperties = {
  padding: '28px 32px',
};

const normalizeVerificationCode = (code: string): string =>
  code.replace(/[\s\u200B-\u200D\uFEFF]+/g, '');

function normalizedLocale(locale: string | string[] | undefined) {
  return Array.isArray(locale) ? locale[0] : locale || 'vi';
}

function TaxSettingsPanel({ accessToken }: { accessToken?: string }) {
  const t = useTranslations('SystemSettings');
  const { notification } = App.useApp();
  const [taxForm] = Form.useForm<TaxSettingsFormValues>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    setLoading(true);

    getSetting(DEFAULT_PURCHASE_VAT_RATE_KEY, accessToken)
      .then((setting) => {
        if (cancelled) return;

        const rate = Number(setting?.value ?? 10);
        taxForm.setFieldsValue({
          defaultPurchaseVatRate: Number.isFinite(rate) ? rate : 10,
        });
      })
      .catch(() => {
        if (cancelled) return;

        notification.error({
          title: t('taxSettings.errorTitle'),
          description: t('taxSettings.loadErrorDescription'),
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, notification, t, taxForm]);

  const handleSaveTaxSettings = async (values: TaxSettingsFormValues) => {
    if (!accessToken) {
      notification.warning({
        title: t('taxSettings.errorTitle'),
        description: t('taxSettings.missingToken'),
      });
      return;
    }

    const rate = Number(values.defaultPurchaseVatRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      notification.error({
        title: t('taxSettings.errorTitle'),
        description: t('taxSettings.validation'),
      });
      return;
    }

    setSaving(true);
    try {
      const res = await updateSetting(
        DEFAULT_PURCHASE_VAT_RATE_KEY,
        String(rate),
        accessToken,
      );

      if (res?.data) {
        notification.success({
          title: t('taxSettings.successTitle'),
          description: t('taxSettings.successDescription', { rate }),
        });
      } else {
        notification.error({
          title: t('taxSettings.errorTitle'),
          description: res?.message || t('taxSettings.saveErrorDescription'),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={sectionStyle}>
      <Row gutter={[32, 32]}>
        <Col xs={24} lg={7}>
          <Space orientation="vertical" size={8}>
            <Title level={4} style={{ margin: 0 }}>{t('taxSettings.title')}</Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              {t('taxSettings.description')}
            </Paragraph>
          </Space>
        </Col>
        <Col xs={24} lg={17}>
          <Form
            form={taxForm}
            layout="vertical"
            requiredMark={false}
            initialValues={{ defaultPurchaseVatRate: 10 }}
            onFinish={handleSaveTaxSettings}
            disabled={loading || !accessToken}
            style={{ maxWidth: 560 }}
          >
            <Form.Item
              label={t('taxSettings.field')}
              name="defaultPurchaseVatRate"
              rules={[
                { required: true, message: t('taxSettings.validation') },
                {
                  validator: (_, value) => {
                    const rate = Number(value);
                    if (Number.isFinite(rate) && rate >= 0 && rate <= 100) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t('taxSettings.validation')));
                  },
                },
              ]}
            >
              <InputNumber
                min={0}
                max={100}
                precision={2}
                suffix="%"
                style={{ width: 220 }}
              />
            </Form.Item>

            <Paragraph type="secondary">
              {loading ? t('taxSettings.loading') : t('taxSettings.help')}
            </Paragraph>

            <Button
              type="primary"
              htmlType="submit"
              icon={<PercentageOutlined />}
              loading={saving}
            >
              {t('taxSettings.save')}
            </Button>
          </Form>
        </Col>
      </Row>
    </div>
  );
}

function MatchingSettingsPanel({ accessToken }: { accessToken?: string }) {
  const t = useTranslations('SystemSettings');
  const { notification } = App.useApp();
  const [matchingForm] = Form.useForm<MatchingSettingsFormValues>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    setLoading(true);

    Promise.all([
      getSetting(THREE_WAY_MATCHING_QTY_TOLERANCE_KEY, accessToken),
      getSetting(THREE_WAY_MATCHING_PRICE_TOLERANCE_PERCENT_KEY, accessToken),
    ])
      .then(([qtySetting, priceSetting]) => {
        if (cancelled) return;

        const quantityTolerance = Number(qtySetting?.value ?? 0);
        const priceTolerancePercent = Number(priceSetting?.value ?? 0);
        matchingForm.setFieldsValue({
          quantityTolerance: Number.isFinite(quantityTolerance) ? quantityTolerance : 0,
          priceTolerancePercent: Number.isFinite(priceTolerancePercent) ? priceTolerancePercent : 0,
        });
      })
      .catch(() => {
        if (cancelled) return;

        notification.error({
          title: t('matchingSettings.errorTitle'),
          description: t('matchingSettings.loadErrorDescription'),
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, matchingForm, notification, t]);

  const handleSaveMatchingSettings = async (values: MatchingSettingsFormValues) => {
    if (!accessToken) {
      notification.warning({
        title: t('matchingSettings.errorTitle'),
        description: t('matchingSettings.missingToken'),
      });
      return;
    }

    const quantityTolerance = Number(values.quantityTolerance);
    const priceTolerancePercent = Number(values.priceTolerancePercent);

    if (
      !Number.isFinite(quantityTolerance)
      || quantityTolerance < 0
      || !Number.isFinite(priceTolerancePercent)
      || priceTolerancePercent < 0
      || priceTolerancePercent > 100
    ) {
      notification.error({
        title: t('matchingSettings.errorTitle'),
        description: t('matchingSettings.validation'),
      });
      return;
    }

    setSaving(true);
    try {
      const [qtyRes, priceRes] = await Promise.all([
        updateSetting(
          THREE_WAY_MATCHING_QTY_TOLERANCE_KEY,
          String(quantityTolerance),
          accessToken,
        ),
        updateSetting(
          THREE_WAY_MATCHING_PRICE_TOLERANCE_PERCENT_KEY,
          String(priceTolerancePercent),
          accessToken,
        ),
      ]);

      if (qtyRes?.data && priceRes?.data) {
        notification.success({
          title: t('matchingSettings.successTitle'),
          description: t('matchingSettings.successDescription', {
            qty: quantityTolerance,
            price: priceTolerancePercent,
          }),
        });
      } else {
        notification.error({
          title: t('matchingSettings.errorTitle'),
          description: qtyRes?.message || priceRes?.message || t('matchingSettings.saveErrorDescription'),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={sectionStyle}>
      <Row gutter={[32, 32]}>
        <Col xs={24} lg={7}>
          <Space orientation="vertical" size={8}>
            <Title level={4} style={{ margin: 0 }}>{t('matchingSettings.title')}</Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              {t('matchingSettings.description')}
            </Paragraph>
          </Space>
        </Col>
        <Col xs={24} lg={17}>
          <Form
            form={matchingForm}
            layout="vertical"
            requiredMark={false}
            initialValues={{ quantityTolerance: 0, priceTolerancePercent: 0 }}
            onFinish={handleSaveMatchingSettings}
            disabled={loading || !accessToken}
            style={{ maxWidth: 720 }}
          >
            <Row gutter={16}>
              <Col xs={24} md={10}>
                <Form.Item
                  label={t('matchingSettings.quantityTolerance')}
                  name="quantityTolerance"
                  rules={[{ required: true, message: t('matchingSettings.validation') }]}
                >
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={10}>
                <Form.Item
                  label={t('matchingSettings.priceTolerance')}
                  name="priceTolerancePercent"
                  rules={[{ required: true, message: t('matchingSettings.validation') }]}
                >
                  <InputNumber min={0} max={100} precision={2} suffix="%" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Paragraph type="secondary">
              {loading ? t('matchingSettings.loading') : t('matchingSettings.help')}
            </Paragraph>

            <Button
              type="primary"
              htmlType="submit"
              icon={<SafetyCertificateOutlined />}
              loading={saving}
            >
              {t('matchingSettings.save')}
            </Button>
          </Form>
        </Col>
      </Row>
    </div>
  );
}

function SecuritySettingsPanel({
  userEmail,
  accessToken,
  locale,
}: {
  userEmail: string;
  accessToken?: string;
  locale: string | string[] | undefined;
}) {
  const t = useTranslations('SystemSettings');
  const { notification } = App.useApp();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [resetUserId, setResetUserId] = useState('');
  const [resolvedUserEmail, setResolvedUserEmail] = useState(userEmail);
  const [loadingProfileEmail, setLoadingProfileEmail] = useState(false);
  const [passwordStep, setPasswordStep] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setResolvedUserEmail(userEmail);
  }, [userEmail]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let cancelled = false;
    setLoadingProfileEmail(true);

    sendRequest<IBackendRes<CurrentUserProfileResponse>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/profile`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (cancelled) return;

        if (res?.data?.email) {
          setResolvedUserEmail(res.data.email);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProfileEmail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const handleSendResetCode = async () => {
    if (!accessToken) {
      notification.warning({
        title: t('security.notifications.missingEmailTitle'),
        description: t('security.notifications.tryAgain'),
      });
      return;
    }

    setSendingCode(true);
    try {
      const res = await sendRequest<IBackendRes<ForgotPasswordResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/me/password-reset-code`,
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data?._id) {
        setResetUserId(res.data._id);
        setResolvedUserEmail(res.data.email);
        setPasswordStep(1);
        notification.success({
          title: t('security.notifications.codeSentTitle'),
          description: t('security.notifications.codeSentDescription', { email: res.data.email }),
        });
      } else {
        notification.error({
          title: t('security.notifications.codeErrorTitle'),
          description: res?.message || t('security.notifications.tryAgain'),
        });
      }
    } finally {
      setSendingCode(false);
    }
  };

  const handleChangePassword = async (values: PasswordFormValues) => {
    if (!resetUserId) {
      notification.warning({
        title: t('security.notifications.needCodeTitle'),
        description: t('security.notifications.needCodeDescription'),
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
          title: t('security.notifications.passwordUpdatedTitle'),
          description: t('security.notifications.passwordUpdatedDescription'),
        });
      } else {
        notification.error({
          title: t('security.notifications.passwordErrorTitle'),
          description: res?.message || t('security.notifications.invalidCode'),
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
            <Title level={4} style={{ margin: 0 }}>{t('security.title')}</Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              {t('security.description')}
            </Paragraph>
          </Space>
        </Col>
        <Col xs={24} lg={17}>
          <Steps
            current={passwordStep}
            size="small"
            style={{ marginBottom: 28 }}
            items={[
              { title: t('security.steps.sendCode'), icon: <MailOutlined /> },
              { title: t('security.steps.setPassword'), icon: <LockOutlined /> },
              { title: t('security.steps.done'), icon: <CheckCircleOutlined /> },
            ]}
          />

          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={handleChangePassword}
            requiredMark={false}
            style={{ maxWidth: 560 }}
          >
            <Form.Item
              label={t('security.fields.email')}
            >
              <Input
                prefix={<MailOutlined />}
                disabled
                value={resolvedUserEmail}
                placeholder={loadingProfileEmail ? '...' : 'name@company.com'}
              />
            </Form.Item>

            <Button
              icon={<MailOutlined />}
              loading={sendingCode}
              onClick={handleSendResetCode}
              disabled={!accessToken}
              style={{ marginBottom: 24 }}
            >
              {t('security.actions.sendCode')}
            </Button>

            <Form.Item
              label={t('security.fields.code')}
              name="code"
              rules={[
                {
                  validator: (_, value?: string) =>
                    /^\d{6}$/.test(normalizeVerificationCode(value || ''))
                      ? Promise.resolve()
                      : Promise.reject(new Error(t('security.validation.code'))),
                },
              ]}
            >
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder={t('security.placeholders.code')}
              />
            </Form.Item>

            <Form.Item
              label={t('security.fields.password')}
              name="password"
              rules={[
                { required: true, message: t('security.validation.password') },
                { min: 6, message: t('security.validation.passwordLength') },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('security.placeholders.password')} />
            </Form.Item>

            <Form.Item
              label={t('security.fields.confirmPassword')}
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: t('security.validation.confirmPassword') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t('security.validation.passwordMismatch')));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('security.placeholders.confirmPassword')} />
            </Form.Item>

            <Space wrap>
              <Button
                type="primary"
                htmlType="submit"
                icon={<LockOutlined />}
                loading={changingPassword}
              >
                {t('security.actions.updatePassword')}
              </Button>
              {passwordStep === 2 && (
                <Button onClick={() => signOut({ callbackUrl: `/${normalizedLocale(locale)}/auth/login` })}>
                  {t('security.actions.signInAgain')}
                </Button>
              )}
            </Space>
          </Form>
        </Col>
      </Row>
    </div>
  );
}

function AccountSettingsPanel({
  userEmail,
  userName,
  userRole,
  userInitial,
}: {
  userEmail: string;
  userName: string;
  userRole: string;
  userInitial: string;
}) {
  const t = useTranslations('SystemSettings');
  const { token } = theme.useToken();
  const [profileForm] = Form.useForm();

  useEffect(() => {
    profileForm.setFieldsValue({
      name: userName,
      email: userEmail,
      role: userRole,
      timezone: 'Asia/Saigon',
    });
  }, [profileForm, userEmail, userName, userRole]);

  return (
    <div style={sectionStyle}>
      <Row gutter={[32, 32]}>
        <Col xs={24} lg={7}>
          <Space orientation="vertical" size={8}>
            <Title level={4} style={{ margin: 0 }}>{t('account.title')}</Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              {t('account.description')}
            </Paragraph>
          </Space>
        </Col>
        <Col xs={24} lg={17}>
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
                <Title level={4} style={{ margin: 0 }}>{userName}</Title>
                <Tag color="blue">{userRole}</Tag>
              </Space>
              <Text type="secondary">{userEmail}</Text>
            </div>
          </Space>

          <Form form={profileForm} layout="vertical" disabled>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label={t('account.fields.username')} name="name">
                  <Input prefix={<UserOutlined />} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('account.fields.email')} name="email">
                  <Input prefix={<MailOutlined />} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('account.fields.role')} name="role">
                  <Input prefix={<SafetyCertificateOutlined />} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('account.fields.timezone')} name="timezone">
                  <Select
                    options={[
                      { value: 'Asia/Saigon', label: 'Asia/Saigon' },
                      { value: 'UTC', label: 'UTC' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Col>
      </Row>
    </div>
  );
}

export default function SystemSettingsPage() {
  const t = useTranslations('SystemSettings');
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const params = useParams();
  const locale = params?.locale;
  const { token } = theme.useToken();
  const [activeTab, setActiveTab] = useState('account');

  const currentUser = session?.user as IAuthSessionUser | undefined;
  const userEmail = currentUser?.email || '';
  const userName = currentUser?.name || userEmail.split('@')[0] || 'admin';
  const userRole = currentUser?.role?.name || 'ADMIN';
  const userInitial = (userName || userEmail || 'A').charAt(0).toUpperCase();

  const panelStyle = useMemo<CSSProperties>(() => ({
    borderRadius: 20,
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorBgContainer,
    boxShadow: token.boxShadowTertiary,
    overflow: 'hidden',
  }), [token]);

  const notificationContent = (
    <div style={sectionStyle}>
      <Row gutter={[32, 32]}>
        <Col xs={24} lg={7}>
          <Space orientation="vertical" size={8}>
            <Title level={4} style={{ margin: 0 }}>{t('notifications.title')}</Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              {t('notifications.description')}
            </Paragraph>
          </Space>
        </Col>
        <Col xs={24} lg={17}>
          <Space orientation="vertical" size={10}>
            <Text strong>{t('notifications.enabled')}</Text>
            <Text type="secondary">{t('notifications.future')}</Text>
          </Space>
        </Col>
      </Row>
    </div>
  );

  const currencyContent = (
    <div style={sectionStyle}>
      <CurrencyPage embedded />
    </div>
  );

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('pageTitle')}
        icon={<SettingOutlined />}
        description={t('pageDescription')}
      />

      <Card variant="borderless" style={panelStyle} styles={{ body: { padding: 0 } }}>
        <div
          style={{
            padding: '22px 32px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
          }}
        >
          <Space orientation="vertical" size={4}>
            <Text strong style={{ fontSize: 16 }}>{t('cardTitle')}</Text>
            <Text type="secondary">{t('cardDescription')}</Text>
          </Space>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'account',
              label: <Space><UserOutlined />{t('tabs.account')}</Space>,
              children: (
                <AccountSettingsPanel
                  userEmail={userEmail}
                  userName={userName}
                  userRole={userRole}
                  userInitial={userInitial}
                />
              ),
            },
            {
              key: 'security',
              label: <Space><LockOutlined />{t('tabs.security')}</Space>,
              children: (
                <SecuritySettingsPanel
                  userEmail={userEmail}
                  accessToken={accessToken}
                  locale={locale}
                />
              ),
            },
            {
              key: 'notifications',
              label: <Space><BellOutlined />{t('tabs.notifications')}</Space>,
              children: notificationContent,
            },
            {
              key: 'currencies',
              label: <Space><DollarOutlined />{t('tabs.currencies')}</Space>,
              children: currencyContent,
            },
            {
              key: 'tax',
              label: <Space><PercentageOutlined />{t('tabs.tax')}</Space>,
              children: <TaxSettingsPanel accessToken={accessToken} />,
            },
            {
              key: 'matching',
              label: <Space><SafetyCertificateOutlined />{t('tabs.matching')}</Space>,
              children: <MatchingSettingsPanel accessToken={accessToken} />,
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
