'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, Descriptions, Form, Input, Result, Row, Space, Spin, Steps, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, FileProtectOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useParams } from 'next/navigation';
import { sendRequest } from '@/lib/api-client';

const { Text, Title } = Typography;

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

const formatAmount = (value: number, currencyCode: string) => (
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode || 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
);

const defaultConsentText = 'I confirm that I am authorized to sign this sales contract and agree to its commercial terms.';

export default function BuyerSigningPage() {
  const params = useParams<{ token: string }>();
  const token = useMemo(() => String(params?.token || ''), [params]);
  const { message } = App.useApp();
  const [form] = Form.useForm<SignFormValues>();

  const [session, setSession] = useState<SigningSession | null>(null);
  const [auditPacket, setAuditPacket] = useState<SignatureAuditPacket | null>(null);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [signing, setSigning] = useState(false);
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
        setError(typeof res?.message === 'string' ? res.message : 'Signing session is unavailable.');
        return;
      }

      setSession(res.data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const signerName = session?.invitation.signerName;
  const signerTitle = session?.invitation.signerTitle;

  useEffect(() => {
    if (!signerName || loading || error || auditPacket) return;

    form.setFieldsValue({
      signerName,
      signerTitle: signerTitle || undefined,
      consentText: defaultConsentText,
    });
  }, [
    auditPacket,
    error,
    form,
    loading,
    signerName,
    signerTitle,
  ]);

  const verifyOtp = async () => {
    if (!token || otp.trim().length !== 6) {
      message.error('OTP must be 6 digits.');
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
        message.error(typeof res?.message === 'string' ? res.message : 'OTP verification failed.');
        return;
      }

      setSession(res.data);
      message.success('OTP verified.');
    } finally {
      setVerifying(false);
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
        message.error(typeof res?.message === 'string' ? res.message : 'Signing failed.');
        return;
      }

      setSession(res.data.session);
      setAuditPacket(res.data.auditPacket);
    } finally {
      setSigning(false);
    }
  };

  const itemColumns: ColumnsType<SigningItem> = [
    {
      title: 'Product',
      key: 'product',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.productName || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.sku || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
    },
    {
      title: 'Unit price',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right',
      render: (value: number) => session ? formatAmount(value, session.contract.currencyCode) : value,
    },
    {
      title: 'Line total',
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
    return (
      <div className="max-w-3xl mx-auto w-full px-6 py-12">
        <Result
          status="warning"
          title="Signing session unavailable"
          subTitle={error || 'The signing link is invalid, expired, or revoked.'}
        />
      </div>
    );
  }

  if (auditPacket) {
    return (
      <div className="max-w-4xl mx-auto w-full px-6 py-12">
        <Result
          status="success"
          icon={<SafetyCertificateOutlined />}
          title="Sales contract signed"
          subTitle={`Certificate ${auditPacket.certificate.certificateNumber || session.contract.contractNumber}`}
          extra={(
            <Card>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Document hash">
                  <Text copyable>{session.documentHash}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Certificate hash">
                  <Text copyable>{auditPacket.certificate.certificateHash || '-'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Audit packet hash">
                  <Text copyable>{auditPacket.certificate.packetHash}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        />
      </div>
    );
  }

  const otpVerified = session.invitation.otpVerified;

  return (
    <div className="max-w-6xl mx-auto w-full px-6 py-10">
      <Space orientation="vertical" size={24} className="w-full">
        <div>
          <Tag color="purple" icon={<FileProtectOutlined />}>Secure buyer signing</Tag>
          <Title level={2} style={{ marginTop: 12, marginBottom: 0 }}>
            {session.contract.contractNumber}
          </Title>
          <Text type="secondary">{session.contract.buyerName || 'Buyer'} · {session.contract.buyerCountry || '-'}</Text>
        </div>

        <Steps
          current={otpVerified ? 1 : 0}
          items={[
            { title: 'OTP', icon: <LockOutlined /> },
            { title: 'Signature', icon: <FileProtectOutlined /> },
            { title: 'Certificate', icon: <CheckCircleOutlined /> },
          ]}
        />

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={15}>
            <Card title="Contract snapshot">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Incoterm">
                  <Tag color="magenta">{session.contract.incoterm}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Currency">
                  {session.contract.currencyCode}
                </Descriptions.Item>
                <Descriptions.Item label="Total value">
                  <Text strong>{formatAmount(session.contract.totalAmount, session.contract.currencyCode)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Delivery date">
                  {session.contract.deliveryDate || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Payment terms" span={2}>
                  {session.contract.paymentTerms || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Document hash" span={2}>
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

          <Col xs={24} lg={9}>
            <Space orientation="vertical" size={16} className="w-full">
              <Card title="OTP verification">
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    placeholder="6-digit OTP"
                    disabled={otpVerified}
                  />
                  <Button type="primary" loading={verifying} disabled={otpVerified} onClick={verifyOtp}>
                    Verify
                  </Button>
                </Space.Compact>
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">
                    Sent to {session.invitation.signerEmailMasked || 'registered buyer contact'} · expires {new Date(session.invitation.expiresAt).toLocaleString()}
                  </Text>
                </div>
              </Card>

              <Card title="Signer details">
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={submitSignature}
                  disabled={!otpVerified || signing}
                >
                  <Form.Item
                    label="Signer name"
                    name="signerName"
                    rules={[{ required: true, message: 'Signer name is required.' }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item label="Title" name="signerTitle">
                    <Input />
                  </Form.Item>
                  <Form.Item label="Email" name="signerEmail" rules={[{ type: 'email', message: 'Email is invalid.' }]}>
                    <Input placeholder={session.invitation.signerEmailMasked || undefined} />
                  </Form.Item>
                  <Form.Item
                    label="Consent"
                    name="consentText"
                    rules={[{ required: true, message: 'Consent text is required.' }]}
                  >
                    <Input.TextArea rows={4} />
                  </Form.Item>
                  <Button type="primary" block htmlType="submit" loading={signing} disabled={!otpVerified}>
                    Sign contract
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
