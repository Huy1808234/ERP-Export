'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Result,
  Row,
  Space,
  Spin,
  Steps,
  Table,
  Tag,
  Typography,
  Alert,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Statistic from 'antd/es/statistic';
import {
  CheckCircleOutlined,
  FileProtectOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { sendRequest } from '@/lib/api-client';

const { Text, Title } = Typography;
const { Timer } = Statistic;

type SigningItem = {
  _id: string;
  productName: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type SigningSession = {
  invitation: {
    _id: string;
    signerName: string;
    signerTitle: string | null;
    signerEmailMasked: string | null;
    status: string;
    expiresAt: string;
    otpExpiresAt: string | null;
    sentAt: string | null;
    openedAt: string | null;
    verifiedAt: string | null;
    signedAt: string | null;
    certificateNumber: string | null;
    certificateHash: string | null;
    otpVerified: boolean;
  };
  contract: {
    _id: string;
    contractNumber: string;
    status: string;
    signatureStatus: string;
    buyerName: string | null;
    buyerCountry: string | null;
    incoterm: string;
    currencyCode: string;
    totalAmount: number;
    totalAmountVnd: number;
    deliveryDate: string | null;
    paymentTerms: string | null;
    notes: string | null;
    items: SigningItem[];
  };
  documentHash: string;
};

type SignatureAuditPacket = {
  certificate: {
    certificateNumber: string | null;
    certificateHash: string | null;
    packetHash: string;
    generatedAt: string;
  };
};

type SignResponse = {
  session: SigningSession;
  auditPacket: SignatureAuditPacket;
};

type SignFormValues = {
  signerName: string;
  signerTitle?: string;
  signerEmail?: string;
  consentText: string;
};

type ResendResponse = {
  message: string;
  expiresAt: string;
};

const formatAmount = (value: number, currencyCode: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode || 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const defaultConsentText = 'I confirm that I am authorized to sign this sales contract and agree to its commercial terms.';

export default function BuyerSigningPage() {
  const params = useParams<{ token: string }>();
  const locale = useLocale() as 'en' | 'vi';
  const token = useMemo(() => String(params?.token || ''), [params]);
  const { message: antMessage } = App.useApp();
  const [form] = Form.useForm<SignFormValues>();

  const [session, setSession] = useState<SigningSession | null>(null);
  const [auditPacket, setAuditPacket] = useState<SignatureAuditPacket | null>(null);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [signing, setSigning] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await sendRequest<IBackendRes<SigningSession>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/signing/${token}`,
        method: 'GET',
      });

      if (!res?.data) {
        // Extract detailed error message from backend
        const errorMsg = res?.message || res?.error || 'Signing session is unavailable.';
        setError(String(errorMsg));
        return;
      }

      setSession(res.data);
    } catch {
      // Network error
      setError('Unable to connect to the server. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const signerName = session?.invitation.signerName;
  const signerTitle = session?.invitation.signerTitle;
  const signerEmailMasked = session?.invitation.signerEmailMasked;
  const otpExpiresAt = session?.invitation.otpExpiresAt;

  useEffect(() => {
    if (!signerName || loading || error || auditPacket) return;
    form.setFieldsValue({
      signerName,
      signerTitle: signerTitle || undefined,
      consentText: defaultConsentText,
    });
  }, [auditPacket, error, form, loading, signerName, signerTitle]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const verifyOtp = async () => {
    if (!token || otp.trim().length !== 6) {
      antMessage.error(locale === 'vi' ? 'Mã OTP phải gồm 6 chữ số.' : 'OTP must be 6 digits.');
      return;
    }

    setVerifying(true);
    try {
      const res = await sendRequest<IBackendRes<SigningSession>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/signing/${token}/otp`,
        method: 'POST',
        body: { otp: otp.trim() },
      });

      if (!res?.data) {
        antMessage.error(typeof res?.message === 'string' ? res.message : 'OTP verification failed.');
        return;
      }

      setSession(res.data);
      antMessage.success(locale === 'vi' ? 'Đã xác minh OTP' : 'OTP verified.');
    } finally {
      setVerifying(false);
    }
  };

  const resendOtp = async () => {
    if (!token || resendCooldown > 0) return;

    setResending(true);
    try {
      const res = await sendRequest<IBackendRes<ResendResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/signing/${token}/resend-otp`,
        method: 'POST',
      });

      if (!res?.data) {
        antMessage.error(typeof res?.message === 'string' ? res.message : (locale === 'vi' ? 'Gửi lại OTP thất bại. Vui lòng thử lại.' : 'Failed to resend OTP. Please try again.'));
        return;
      }

      setSession((prev) =>
        prev
          ? {
              ...prev,
              invitation: {
                ...prev.invitation,
                otpExpiresAt: res.data!.expiresAt,
              },
            }
          : prev,
      );
      setResendCooldown(60);
      antMessage.success(locale === 'vi' ? 'Mã OTP mới đã được gửi đến email của bạn' : 'New OTP sent to your email.');
    } finally {
      setResending(false);
    }
  };

  const submitSignature = async (values: SignFormValues) => {
    if (!token) return;

    setSigning(true);
    try {
      const res = await sendRequest<IBackendRes<SignResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/signing/${token}/sign`,
        method: 'POST',
        body: {
          signerName: values.signerName,
          signerTitle: values.signerTitle || null,
          signerEmail: values.signerEmail || null,
          consentText: values.consentText,
        },
      });

      if (!res?.data) {
        antMessage.error(typeof res?.message === 'string' ? res.message : 'Signing failed.');
        return;
      }

      setSession(res.data.session);
      setAuditPacket(res.data.auditPacket);

      if (window.parent !== window) {
        window.parent.postMessage({ type: 'SIGNING_COMPLETE', token }, '*');
      }
    } finally {
      setSigning(false);
    }
  };

  const itemColumns: ColumnsType<SigningItem> = [
    {
      title: locale === 'vi' ? 'Sản phẩm' : 'Product',
      key: 'product',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.productName || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.sku || '-'}</Text>
        </Space>
      ),
    },
    {
      title: locale === 'vi' ? 'Số lượng' : 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
    },
    {
      title: locale === 'vi' ? 'Đơn giá' : 'Unit price',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right',
      render: (value: number) => session ? formatAmount(value, session.contract.currencyCode) : value,
    },
    {
      title: locale === 'vi' ? 'Thành tiền' : 'Line total',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      align: 'right',
      render: (value: number) => session ? formatAmount(value, session.contract.currencyCode) : value,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (error || !session) {
    const isExpired = error?.toLowerCase().includes('expired') || error?.toLowerCase().includes('hết hạn');
    const isRevoked = error?.toLowerCase().includes('revoked') || error?.toLowerCase().includes('thu hồi');
    const isAlreadySigned = error?.toLowerCase().includes('signed') || error?.toLowerCase().includes('đã ký');
    const isNotFound = error?.toLowerCase().includes('not found') || error?.toLowerCase().includes('không tìm thấy');

    let statusType: 'success' | 'warning' | 'error' | 'info' = 'warning';
    let icon = <LockOutlined />;
    let title = locale === 'vi' ? 'Phiên ký không khả dụng' : 'Signing session unavailable';

    if (isExpired) {
      statusType = 'warning';
      icon = <ClockCircleOutlined />;
      title = locale === 'vi' ? 'Link ký đã hết hạn' : 'Signing link expired';
    } else if (isRevoked) {
      statusType = 'error';
      icon = <LockOutlined />;
      title = locale === 'vi' ? 'Link ký đã bị thu hồi' : 'Signing link has been revoked';
    } else if (isAlreadySigned) {
      statusType = 'success';
      icon = <CheckCircleOutlined />;
      title = locale === 'vi' ? 'Hợp đồng đã được ký' : 'Contract already signed';
    } else if (isNotFound) {
      statusType = 'error';
      icon = <LockOutlined />;
      title = locale === 'vi' ? 'Link ký không hợp lệ' : 'Invalid signing link';
    }

    return (
      <div className="max-w-3xl mx-auto w-full px-6 py-12">
        <Result
          status={statusType}
          icon={icon}
          title={title}
          subTitle={error}
          extra={
            <Space orientation="vertical" size="middle" style={{ width: '100%', maxWidth: 400 }}>
              <Text type="secondary" style={{ textAlign: 'center' }}>
                {locale === 'vi'
                  ? 'Vui lòng liên hệ với người gửi để yêu cầu một liên kết mới.'
                  : 'Please contact the sender to request a new signing link.'}
              </Text>
              <Alert
                type="info"
                showIcon
                title={
                  locale === 'vi'
                    ? 'Nếu bạn cần hỗ trợ, vui lòng liên hệ bộ phận chăm sóc khách hàng.'
                    : 'If you need assistance, please contact customer support.'
                }
              />
            </Space>
          }
        />
      </div>
    );
  }

  if (auditPacket) {
    const certNo = auditPacket.certificate.certificateNumber || session.contract.contractNumber;
    return (
      <div className="max-w-4xl mx-auto w-full px-6 py-12">
        <Result
          status="success"
          icon={<SafetyCertificateOutlined />}
          title={locale === 'vi' ? 'Hợp đồng đã được ký' : 'Sales contract signed'}
          subTitle={`${locale === 'vi' ? 'Chứng chỉ' : 'Certificate'} ${certNo}`}
          extra={(
            <Card>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label={locale === 'vi' ? 'Mã băm tài liệu' : 'Document hash'}>
                  <Text copyable style={{ fontSize: 12 }}>{session.documentHash}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={locale === 'vi' ? 'Mã băm chứng chỉ' : 'Certificate hash'}>
                  <Text copyable style={{ fontSize: 12 }}>{auditPacket.certificate.certificateHash || '-'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={locale === 'vi' ? 'Mã băm gói kiểm toán' : 'Audit packet hash'}>
                  <Text copyable style={{ fontSize: 12 }}>{auditPacket.certificate.packetHash}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        />
      </div>
    );
  }

  const otpVerified = session.invitation.otpVerified;
  const otpExpiryMs = otpExpiresAt ? new Date(otpExpiresAt).getTime() : Date.now() + 15 * 60 * 1000;
  const isOtpExpired = otpExpiryMs <= Date.now();
  const linkExpiryDays = Math.ceil(
    (new Date(session.invitation.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="max-w-6xl mx-auto w-full px-6 py-10">
      <Space orientation="vertical" size={24} className="w-full">
        {/* Header */}
        <div>
          <Tag color="purple" icon={<FileProtectOutlined />}>
            {locale === 'vi' ? 'Ký kết an toàn cho người mua' : 'Secure buyer signing'}
          </Tag>
          <Title level={2} style={{ marginTop: 12, marginBottom: 0 }}>
            {session.contract.contractNumber}
          </Title>
          <Text type="secondary">
            {session.contract.buyerName || 'Buyer'} &middot; {session.contract.buyerCountry || '-'}
          </Text>
        </div>

        <Steps
          current={otpVerified ? 1 : 0}
          items={[
            { title: locale === 'vi' ? 'Xác minh OTP' : 'OTP Verification', icon: <LockOutlined /> },
            { title: locale === 'vi' ? 'Ký kết' : 'Signature', icon: <FileProtectOutlined /> },
            { title: locale === 'vi' ? 'Hoàn tất' : 'Certificate', icon: <CheckCircleOutlined /> },
          ]}
        />

        {/* OTP Email Banner */}
        {!otpVerified && (
          <Alert
            type="info"
            icon={<MailOutlined />}
            showIcon
            message={
              <Space orientation="vertical" size={4}>
                <Text strong>
                  {locale === 'vi'
                    ? 'Mã OTP đã được gửi đến email của bạn'
                    : 'Your 6-digit OTP has been sent to your email'}
                </Text>
                {signerEmailMasked && (
                  <Text>
                    {locale === 'vi' ? 'Kiểm tra hộp thư: ' : 'Check your inbox at: '}
                    <Text code>{signerEmailMasked}</Text>
                  </Text>
                )}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {locale === 'vi'
                    ? 'Nhấn vào đường link trong email để mở trang ký này, sau đó nhập mã OTP 6 số bên dưới.'
                    : 'Click the link in your email to open this page, then enter the 6-digit OTP below.'}
                </Text>
              </Space>
            }
          />
        )}

        <Row gutter={[24, 24]}>
          {/* Left: Contract Snapshot */}
          <Col xs={24} lg={15}>
            <Card
              title={locale === 'vi' ? 'Tóm tắt hợp đồng' : 'Contract snapshot'}
              extra={
                <Tag color="blue">
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {locale === 'vi'
                    ? `Link ký còn ${linkExpiryDays} ngày`
                    : `Link expires in ${linkExpiryDays} days`}
                </Tag>
              }
            >
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label={locale === 'vi' ? 'Incoterm' : 'Incoterm'}>
                  <Tag color="magenta">{session.contract.incoterm}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={locale === 'vi' ? 'Tiền tệ' : 'Currency'}>
                  {session.contract.currencyCode}
                </Descriptions.Item>
                <Descriptions.Item label={locale === 'vi' ? 'Tổng giá trị' : 'Total value'}>
                  <Text strong>{formatAmount(session.contract.totalAmount, session.contract.currencyCode)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={locale === 'vi' ? 'Ngày giao hàng' : 'Delivery date'}>
                  {session.contract.deliveryDate || '-'}
                </Descriptions.Item>
                <Descriptions.Item label={locale === 'vi' ? 'Điều khoản TT' : 'Payment terms'} span={2}>
                  {session.contract.paymentTerms || '-'}
                </Descriptions.Item>
                <Descriptions.Item label={locale === 'vi' ? 'Mã băm tài liệu' : 'Document hash'} span={2}>
                  <Text copyable style={{ fontSize: 12 }}>{session.documentHash}</Text>
                </Descriptions.Item>
              </Descriptions>

              <Table
                style={{ marginTop: 20 }}
                dataSource={session.contract.items}
                columns={itemColumns}
                rowKey={(record) => record._id}
                pagination={false}
                size="small"
              />
            </Card>
          </Col>

          {/* Right: OTP + Signer Form */}
          <Col xs={24} lg={9}>
            <Space orientation="vertical" size={16} className="w-full">
              {/* OTP Card */}
              <Card
                title={
                  <Space>
                    <LockOutlined />
                    {locale === 'vi' ? 'Xác minh mã OTP' : 'OTP Verification'}
                  </Space>
                }
                extra={
                  !otpVerified && !isOtpExpired && otpExpiresAt ? (
                    <Timer
                      type="countdown"
                      value={otpExpiryMs}
                      styles={{ content: { fontSize: 13, color: '#fa8c16' } }}
                      format="mm:ss"
                    />
                  ) : null
                }
              >
                {isOtpExpired && !otpVerified ? (
                  <Alert
                    type="warning"
                    title={locale === 'vi' ? 'Mã OTP đã hết hạn' : 'OTP has expired'}
                    description={
                      locale === 'vi'
                        ? 'Vui lòng nhấn "Gửi lại mã OTP" để nhận mã mới.'
                        : 'Please request a new OTP below.'
                    }
                  />
                ) : (
                  <>
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        placeholder={locale === 'vi' ? 'Nhập mã 6 số' : 'Enter 6-digit OTP'}
                        disabled={otpVerified}
                        size="large"
                        style={{ fontSize: 18, letterSpacing: 8, textAlign: 'center' }}
                      />
                      <Button
                        type="primary"
                        loading={verifying}
                        disabled={otpVerified}
                        onClick={verifyOtp}
                        size="large"
                      >
                        {locale === 'vi' ? 'Xác minh' : 'Verify'}
                      </Button>
                    </Space.Compact>

                    {!otpVerified && (
                      <>
                        <Divider style={{ margin: '12px 0' }} />
                        <Space orientation="vertical" style={{ width: '100%' }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            <ThunderboltOutlined style={{ color: '#fa8c16', marginRight: 4 }} />
                            {locale === 'vi'
                              ? 'Mã OTP có hiệu lực trong 15 phút kể từ khi email được gửi.'
                              : 'OTP is valid for 15 minutes from when the email was sent.'}
                          </Text>
                          <Button
                            type="link"
                            size="small"
                            icon={<ReloadOutlined />}
                            loading={resending}
                            disabled={resendCooldown > 0}
                            onClick={resendOtp}
                            style={{ padding: 0, height: 'auto' }}
                          >
                            {resendCooldown > 0
                              ? locale === 'vi'
                                ? `Đợi ${resendCooldown}s để gửi lại`
                                : `Resend in ${resendCooldown}s`
                              : locale === 'vi'
                                ? 'Gửi lại mã OTP'
                                : 'Resend OTP'}
                          </Button>
                        </Space>
                      </>
                    )}
                  </>
                )}
              </Card>

              {/* Signer Details */}
              <Card
                title={
                  <Space>
                    <FileProtectOutlined />
                    {locale === 'vi' ? 'Thông tin người ký' : 'Signer details'}
                  </Space>
                }
              >
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={submitSignature}
                  disabled={!otpVerified || signing}
                >
                  <Form.Item
                    label={locale === 'vi' ? 'Tên người ký' : 'Signer name'}
                    name="signerName"
                    rules={[{ required: true, message: locale === 'vi' ? 'Tên người ký là bắt buộc.' : 'Signer name is required.' }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item label={locale === 'vi' ? 'Chức vụ' : 'Title'} name="signerTitle">
                    <Input />
                  </Form.Item>
                  <Form.Item
                    label={locale === 'vi' ? 'Email' : 'Email'}
                    name="signerEmail"
                    rules={[{ type: 'email', message: locale === 'vi' ? 'Email không hợp lệ.' : 'Email is invalid.' }]}
                  >
                    <Input placeholder={signerEmailMasked || undefined} />
                  </Form.Item>
                  <Form.Item
                    label={locale === 'vi' ? 'Xác nhận đồng ý' : 'Consent'}
                    name="consentText"
                    rules={[{ required: true, message: locale === 'vi' ? 'Bạn phải đồng ý với văn bản xác nhận trước khi ký.' : 'You must agree to the consent text before signing.' }]}
                  >
                    <Input.TextArea rows={4} placeholder={locale === 'vi' ? 'Tôi xác nhận rằng tôi được ủy quyền ký hợp đồng bán hàng này và đồng ý với các điều khoản thương mại.' : 'I confirm that I am authorized to sign this sales contract and agree to its commercial terms.'} />
                  </Form.Item>
                  <Button
                    type="primary"
                    block
                    htmlType="submit"
                    loading={signing}
                    disabled={!otpVerified}
                    size="large"
                    icon={<CheckCircleOutlined />}
                  >
                    {locale === 'vi' ? 'Ký hợp đồng' : 'Sign contract'}
                  </Button>
                </Form>
              </Card>
            </Space>
          </Col>
        </Row>
      </Space>
    </div>
  );
}
