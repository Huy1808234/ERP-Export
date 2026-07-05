import { useMemo, useState } from 'react';
import { Modal, Form, Input, Alert, Button, Space, Typography, Descriptions, Tag, Steps, Checkbox, Spin, Card } from 'antd';
import { useTranslations, useFormatter } from 'next-intl';
import { CheckCircleOutlined, FileProtectOutlined, LockOutlined, ThunderboltOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import Statistic from 'antd/es/statistic';
import { formatMoney } from '../document.formatters';
import { SIGNING_STEP } from '../document.constants';
import type { useContractSigning } from './useContractSigning';

const { Text, Title } = Typography;
const { Timer } = Statistic;

type ContractSigningModalProps = {
  hookParams: ReturnType<typeof useContractSigning>;
};

export const ContractSigningModal = ({ hookParams }: ContractSigningModalProps) => {
  const t = useTranslations('CustomerPortal');
  const format = useFormatter();
  
  const {
    state: {
      signingModalOpen,
      signingSession,
      signingLoading,
      otp,
      otpSending,
      otpResending,
      otpResendCooldown,
      isOtpExpired,
      signingStep,
      signingForm,
    },
    actions: {
      setOtp,
      setIsOtpExpired,
      handleRequestOtp,
      handleVerifyOtp,
      handleSignSubmit,
      handleSigningModalClose,
    },
  } = hookParams;

  const [fallbackNow] = useState(() => Date.now());

  const otpExpiryMs = useMemo(() => {
    const inv = signingSession?.invitation;
    if (!inv) return 0;
    return inv.otpExpiresAt
      ? new Date(inv.otpExpiresAt).getTime()
      : fallbackNow + 15 * 60 * 1000;
  }, [signingSession?.invitation, fallbackNow]);

  if (!signingSession) return null;

  const { contract, invitation } = signingSession;
  const isOtpVerified = signingStep >= SIGNING_STEP.SIGN;
  const signerEmailMasked = invitation.signerEmailMasked;

  return (
    <Modal
      open={signingModalOpen}
      onCancel={handleSigningModalClose}
      footer={null}
      width={900}
      destroyOnHidden
      afterClose={() => signingForm.resetFields()}
      maskClosable={false}
      style={{ top: 20 }}
      closeIcon={<div style={{ padding: 8 }}>✕</div>}
    >
      <Spin spinning={otpSending}>
        {/* Header */}
        <div>
          <Tag color="purple" icon={<FileProtectOutlined />}>
            {t('documentDetail.signing.secureSigning')}
          </Tag>
          <Title level={2} style={{ marginTop: 12, marginBottom: 0 }}>
            {contract.contractNumber}
          </Title>
        </div>

        <Steps
          current={signingStep}
          items={[
            { title: t('documentDetail.signing.verifyOtp'), icon: <LockOutlined /> },
            { title: t('documentDetail.signing.sign'), icon: <FileProtectOutlined /> },
            { title: t('documentDetail.signing.complete'), icon: <CheckCircleOutlined /> },
          ]}
          style={{ margin: '32px 0' }}
        />

        {signingStep === SIGNING_STEP.COMPLETE ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <SafetyCertificateOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 24 }} />
            <Title level={3}>{t('documentDetail.signing.contractSigned')}</Title>
            <Text type="secondary">
              {t('documentDetail.signing.contractSignedDescription')}
            </Text>
            <div style={{ marginTop: 32 }}>
              <Button type="primary" size="large" onClick={handleSigningModalClose}>
                {t('documentDetail.signing.continue')}
              </Button>
            </div>
          </div>
        ) : (
          <Alert
            message={
              <Space orientation="vertical" size={4}>
                <Text strong>{t('documentDetail.signing.otpWillBeSentTo')}</Text>
                {signerEmailMasked && (
                  <Text>
                    {t('documentDetail.signing.checkInbox')}
                    <Text code>{signerEmailMasked}</Text>
                  </Text>
                )}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('documentDetail.signing.otpInstruction')}
                </Text>
              </Space>
            }
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {signingStep !== SIGNING_STEP.COMPLETE && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.2fr)', gap: 24 }}>
            {/* Left: Contract Snapshot */}
            <Card
              title={t('documentDetail.signing.contractSnapshot')}
            >
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label={t('documentDetail.signing.incoterm')}>
                  <Tag color="magenta">{contract.incoterm}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('documentDetail.signing.currency')}>
                  {contract.currencyCode}
                </Descriptions.Item>
                <Descriptions.Item label={t('documentDetail.signing.totalValue')}>
                  <Text strong>{formatMoney(contract.totalAmount, contract.currencyCode, format)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('documentDetail.signing.deliveryDate')}>
                  {contract.deliveryDate || '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Right: Action Area */}
            <Space orientation="vertical" size="large" style={{ width: '100%' }}>
              {/* Step 0/1: OTP Verification */}
              <Card
                type="inner"
                title={
                  <Space>
                    <LockOutlined />
                    {t('documentDetail.signing.otpVerification')}
                  </Space>
                }
                extra={
                  !isOtpVerified ? (
                    <Timer
                      type="countdown"
                      value={otpExpiryMs}
                      onFinish={() => setIsOtpExpired(true)}
                      styles={{ content: { fontSize: 13, color: '#fa8c16' } }}
                      format="mm:ss"
                    />
                  ) : (
                    <Tag color="success" icon={<CheckCircleOutlined />}>
                      {t('documentDetail.signing.verified')}
                    </Tag>
                  )
                }
                style={{ opacity: isOtpVerified ? 0.6 : 1 }}
              >
                {isOtpExpired && !isOtpVerified ? (
                  <Alert
                    type="warning"
                    title={t('documentDetail.signing.otpExpiredTitle')}
                    description={t('documentDetail.signing.requestNewOtp')}
                  />
                ) : (
                  <>
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        placeholder={t('documentDetail.signing.enterSixDigitOtp')}
                        disabled={isOtpVerified || signingLoading}
                        size="large"
                        style={{ fontSize: 18, letterSpacing: 8, textAlign: 'center' }}
                      />
                      <Button
                        type="primary"
                        loading={signingLoading && !isOtpVerified}
                        disabled={isOtpExpired || otp.length !== 6 || isOtpVerified}
                        onClick={handleVerifyOtp}
                        size="large"
                      >
                        {t('documentDetail.signing.verify')}
                      </Button>
                    </Space.Compact>

                    {!isOtpVerified && (
                      <div style={{ marginTop: 12, textAlign: 'center' }}>
                        <Space orientation="vertical" style={{ width: '100%' }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            <ThunderboltOutlined style={{ color: '#fa8c16', marginRight: 4 }} />
                            {t('documentDetail.signing.otpValidTime')}
                          </Text>
                          <Button
                            type="link"
                            disabled={otpResendCooldown > 0 || otpResending}
                            onClick={handleRequestOtp}
                            loading={otpResending}
                            style={{ padding: 0, height: 'auto' }}
                          >
                            {otpResendCooldown > 0
                              ? t('documentDetail.signing.resendIn', { seconds: otpResendCooldown })
                              : t('documentDetail.signing.resendOtp')}
                          </Button>
                        </Space>
                      </div>
                    )}
                  </>
                )}
              </Card>

              {/* Step 1/2: Signer Details */}
              <Card
                type="inner"
                title={
                  <Space>
                    <FileProtectOutlined />
                    {t('documentDetail.signing.signerDetails')}
                  </Space>
                }
              >
                <Form
                  form={signingForm}
                  layout="vertical"
                  onFinish={handleSignSubmit}
                  disabled={!isOtpVerified || signingStep >= SIGNING_STEP.COMPLETE}
                  preserve={false}
                >
                  <Form.Item
                    label={t('documentDetail.signing.signerName')}
                    name="signerName"
                    rules={[{ required: true, message: t('documentDetail.signing.signerNameRequired') }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item label={t('documentDetail.signing.signerTitle')} name="signerTitle">
                    <Input />
                  </Form.Item>
                  <Form.Item
                    label={t('documentDetail.signing.email')}
                    name="signerEmail"
                    rules={[{ type: 'email', message: t('documentDetail.signing.invalidEmail') }]}
                  >
                    <Input placeholder={signerEmailMasked || undefined} />
                  </Form.Item>

                  {/* Read-only consent text */}
                  <Alert
                    type="info"
                    description={t('documentDetail.signing.consentText')}
                    style={{ marginBottom: 16 }}
                  />

                  <Form.Item
                    name="acceptedConsent"
                    valuePropName="checked"
                    rules={[
                      {
                        validator: (_, checked) =>
                          checked
                            ? Promise.resolve()
                            : Promise.reject(new Error(t('documentDetail.signing.consentRequired'))),
                      },
                    ]}
                  >
                    <Form.Item noStyle name="acceptedConsent" valuePropName="checked">
                      {/* Using an explicit checkbox imported from antd below. Wait, Checkbox is not in imports. Adding it. */}
                      <Checkbox>{t('documentDetail.signing.confirmConsent')}</Checkbox>
                    </Form.Item>
                  </Form.Item>

                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={signingLoading && isOtpVerified}
                    size="large"
                    icon={<CheckCircleOutlined />}
                  >
                    {t('documentDetail.signing.signContract')}
                  </Button>
                </Form>
              </Card>
            </Space>
          </div>
        )}
      </Spin>
    </Modal>
  );
};
