'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Upload,
  Button,
  Space,
  Alert,
  Typography,
  Divider,
  Tabs,
  App,
} from 'antd';
import {
  UploadOutlined,
  BankOutlined,
  QrcodeOutlined,
  CheckCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { UploadFile, RcFile } from 'antd/es/upload';
import { useLocale, useTranslations } from 'next-intl';
import {
  submitPaymentReceipt,
  uploadPaymentAttachment,
  getPaymentReceiptStatus,
  getPortalCurrencies,
  PaymentReceiptPayload,
} from '@/services/customer-portal.service';
import type { PortalStatementLine, PortalCurrency } from '@/types/customer-portal';

const { Text, Title, Paragraph } = Typography;

type PaymentAdviceModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: PortalStatementLine;
  accessToken: string;
  profile: {
    companyBankInfo?: string;
    companyName?: string;
    companyAddress?: string;
    vietQrAccountNo?: string;
    vietQrBankCode?: string;
  };
};

interface PaymentFormValues {
  amountPaidForeign: number;
  paymentDate: Dayjs;
  bankChargeType?: 'SHA' | 'OUR' | 'BEN';
  bankChargeForeign?: number;
  attachmentUrl?: string;
  attachmentFilename?: string;
  senderBankName?: string;
  senderAccountNumber?: string;
  senderName?: string;
  swiftCode?: string;
  note?: string;
}

export const PaymentAdviceModal = ({
  open,
  onClose,
  onSuccess,
  invoice,
  accessToken,
  profile,
}: PaymentAdviceModalProps) => {
  const [form] = Form.useForm<PaymentFormValues>();
  const { notification } = App.useApp();
  const t = useTranslations('CustomerPortal.paymentAdvice');
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [attachmentData, setAttachmentData] = useState<{ url: string; filename: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('qr');
  const [qrPolling, setQrPolling] = useState(false);
  const [qrPaymentConfirmed, setQrPaymentConfirmed] = useState(false);
  // Payment status tracking
  type QrPaymentPhase =
    | 'idle'           // Initial state
    | 'created'        // Receipt created, waiting for customer to pay
    | 'paid'           // Customer paid, waiting for webhook confirmation
    | 'confirmed'       // Payment confirmed
    | 'failed';        // Payment failed/timeout

  const [qrPaymentPhase, setQrPaymentPhase] = useState<QrPaymentPhase>('idle');
  const [createdReceiptId, setCreatedReceiptId] = useState<string | null>(null);
  const [createdReceiptNumber, setCreatedReceiptNumber] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<PortalCurrency[]>([]);
  const numberLocale = locale === 'vi' ? 'vi-VN' : 'en-US';

  // Load currencies (with exchange rates) when modal opens
  useEffect(() => {
    if (!open || !accessToken) return;
    let cancelled = false;
    (async () => {
      const res = await getPortalCurrencies(accessToken);
      if (cancelled) return;
      if (res?.data) {
        setCurrencies(res.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, accessToken]);

  // Convert a foreign amount to VND using the latest TRANSFER rate from the currencies module
  const convertToVnd = (
    amount: number,
    fromCode: string,
  ): { amount: number; exchangeRate: number | null; note?: string } => {
    if (!fromCode || fromCode === 'VND') {
      return { amount, exchangeRate: 1 };
    }
    const source = currencies.find((c) => c.code === fromCode);
    if (!source) {
      return {
        amount,
        exchangeRate: null,
        note: `No currency record for ${fromCode}; submitted amount kept as ${fromCode}`,
      };
    }
    const rates = source.exchangeRates || [];
    const transfer =
      rates.find((r) => (r.rateType || 'TRANSFER') === 'TRANSFER' && r.isActive !== false) ||
      rates.find((r) => r.isActive !== false) ||
      rates[0];
    if (!transfer) {
      return {
        amount,
        exchangeRate: null,
        note: `No active exchange rate for ${fromCode}; submitted amount kept as ${fromCode}`,
      };
    }
    const rate = Number(transfer.rate);
    return {
      amount: Math.round(amount * rate),
      exchangeRate: rate,
      note: `Converted from ${amount} ${fromCode} @ ${rate} (${transfer.rateType || 'TRANSFER'})`,
    };
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      form.resetFields();
      setFileList([]);
      setAttachmentData(null);
      setQrPaymentConfirmed(false);
      setQrPaymentPhase('idle');
      setQrPolling(false);
      setCreatedReceiptId(null);
    }
  }, [open, form]);

  // Reset polling state on close
  useEffect(() => {
    return () => {
      setQrPolling(false);
    };
  }, []);

  // Poll for QR payment confirmation
  useEffect(() => {
    if (!qrPolling || !invoice || !createdReceiptId || qrPaymentPhase !== 'paid') return;

    let pollCount = 0;
    const maxPolls = 12; // 12 * 5s = 60 seconds max wait

    const checkPaymentStatus = async () => {
      if (pollCount >= maxPolls) {
        setQrPolling(false);
        setQrPaymentPhase('failed');
        notification.warning({
          title: t('timeoutTitle'),
          description: t('timeoutDescription'),
        });
        return;
      }

      pollCount++;

      try {
        // Call API to check receipt status
        const response = await getPaymentReceiptStatus(accessToken, createdReceiptId);

        // Check for CONFIRMED status (PortalReceiptStatus)
        if (response.data?.status === 'CONFIRMED') {
          setQrPaymentConfirmed(true);
          setQrPaymentPhase('confirmed');
          setQrPolling(false);
          notification.success({
            title: t('qrSuccessTitle'),
            description: t('qrSuccessDescription', { invoiceNumber: invoice.invoiceNumber }),
          });
          onSuccess();
        } else if (response.data?.status === 'REJECTED' || response.error) {
          setQrPolling(false);
          setQrPaymentPhase('failed');
          notification.error({
            title: t('qrFailedTitle'),
            description: response.message || t('retryDescription'),
          });
        }
        // If status is still SUBMITTED, continue polling
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    };

    const interval = setInterval(checkPaymentStatus, 5000);
    checkPaymentStatus();

    return () => clearInterval(interval);
  }, [qrPolling, invoice, createdReceiptId, qrPaymentPhase, accessToken, onSuccess, notification]);

  const handleUpload = useCallback(async (file: RcFile) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      notification.error({ title: t('errorTitle'), description: t('fileTypeError') });
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      notification.error({ title: t('errorTitle'), description: t('fileSizeError') });
      return false;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const result = await uploadPaymentAttachment(accessToken, file, (percent) => {
        setUploadProgress(percent);
      });

      setAttachmentData(result);
      form.setFieldValue('attachmentUrl', result.url);
      form.setFieldValue('attachmentFilename', result.filename);
      notification.success({ title: t('successTitle'), description: t('uploadSuccess') });
    } catch (error) {
      notification.error({ title: t('errorTitle'), description: t('uploadFailed') });
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }

    return false;
  }, [accessToken, form, notification]);

  const handleRemove = useCallback(() => {
    setAttachmentData(null);
    form.setFieldValue('attachmentUrl', undefined);
    form.setFieldValue('attachmentFilename', undefined);
  }, [form]);

  const handleSubmitSwift = async (values: PaymentFormValues) => {
    const paymentAmount = Number(values.amountPaidForeign || 0);
    const openAmount = Number(invoice.openAmountForeign || 0);

    if (paymentAmount <= 0) {
      notification.error({ title: t('errorTitle'), description: t('amountPositive') });
      return;
    }

    if (paymentAmount > openAmount) {
      notification.error({ title: t('errorTitle'), description: t('amountExceedsOpen') });
      return;
    }

    if (!attachmentData) {
      notification.error({ title: t('errorTitle'), description: t('attachmentRequired') });
      return;
    }

    setLoading(true);

    try {
      const payload: PaymentReceiptPayload = {
        receiptType: 'SWIFT',
        accountReceivableId: invoice._id,
        amount: paymentAmount,
        currency: invoice.currency,
        source: 'CUSTOMER_PORTAL_UPLOAD',
        transactionDate: values.paymentDate.format('YYYY-MM-DD'),
        bankChargeForeign: values.bankChargeForeign || 0,
        senderBankName: values.senderBankName,
        senderAccountNumber: values.senderAccountNumber,
        senderName: values.senderName,
        swiftCode: values.swiftCode,
        note: values.note,
        // fileAsset_id to be set once attachment upload pipeline is wired to FileAsset
        ...(attachmentData ? { attachmentUrl: attachmentData.url, attachmentFilename: attachmentData.filename } : {}),
      };

      const result = await submitPaymentReceipt(accessToken, payload);

      if (result.error) {
        notification.error({ title: t('errorTitle'), description: result.message || t('genericError') });
        return;
      }

      notification.success({
        title: t('successTitle'),
        description: t('swiftSubmitted', { receiptNumber: result.data?.receiptNumber || '-' }),
      });

      form.resetFields();
      setFileList([]);
      setAttachmentData(null);
      onSuccess();
      onClose();
    } catch (error) {
      notification.error({ title: t('errorTitle'), description: t('genericRetry') });
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayWithQR = async () => {
    // Phase 1: Create receipt record
    if (qrPaymentPhase === 'idle') {
      try {
        // VietQR payment - no file required, status will be SUBMITTED
        // Convert to VND because SePay/VietQR only supports VND
        const paymentCurrency = 'VND';
        const conversion = convertToVnd(invoice.openAmountForeign, invoice.currency);

        if (conversion.amount <= 0) {
          notification.error({ title: t('errorTitle'), description: t('amountPositive') });
          return;
        }

        if (invoice.currency !== 'VND' && (!conversion.exchangeRate || conversion.exchangeRate <= 0)) {
          notification.error({
            title: t('missingRateTitle'),
            description: t('missingRateDescription'),
          });
          return;
        }

        setQrPaymentPhase('created');

        const payload: PaymentReceiptPayload = {
          receiptType: 'VIETQR',
          accountReceivableId: invoice._id,
          amount: conversion.amount,
          currency: paymentCurrency,
          ...(conversion.exchangeRate != null
            ? { exchangeRate: conversion.exchangeRate }
            : {}),
          source: 'CUSTOMER_QR_INITIATED',
          transferReference: `QR-${invoice.invoiceNumber}-${Date.now()}`,
          transactionDate: dayjs().format('YYYY-MM-DD'),
          note: conversion.note,
        };

        const result = await submitPaymentReceipt(accessToken, payload);

        if (result.error) {
          notification.error({
            title: t('errorTitle'),
            description: result.message || t('genericError'),
          });
          setQrPaymentPhase('failed');
          return;
        }

        setCreatedReceiptId(result.data?._id || null);
        setCreatedReceiptNumber(result.data?.receiptNumber || null);
        notification.info({
          title: t('qrRequestCreatedTitle'),
          description: t('qrRequestCreatedDescription', { receiptNumber: result.data?.receiptNumber || '-' }),
          duration: 8,
        });
      } catch (error) {
        notification.error({
          title: t('errorTitle'),
          description: t('genericRetry'),
        });
        console.error('QR Payment error:', error);
        setQrPaymentPhase('failed');
      }
      return;
    }

    // Phase 2: Customer confirms payment, start polling
    if (qrPaymentPhase === 'created') {
      setQrPaymentPhase('paid');
      setQrPolling(true);

      notification.info({
        title: t('waitingConfirmTitle'),
        description: t('waitingConfirmDescription'),
        duration: 3,
      });
      return;
    }
  };

  const handleClose = () => {
    form.resetFields();
    setFileList([]);
    setAttachmentData(null);
    setQrPaymentConfirmed(false);
    setQrPaymentPhase('idle');
    setQrPolling(false);
    setCreatedReceiptId(null);
    onClose();
  };

  // Generate VietQR data
  // SePay matches the transfer by the TTR-... receipt number embedded in the
  // transfer `content`. We only have a receipt number AFTER the customer has
  // click "Create payment request", so the QR is rendered with the receipt
  // number when available; otherwise we show the QR but prompt the customer
  // to create the request first.
  const generateVietQR = () => {
    const bankCode = profile.vietQrBankCode || 'VCBVNVX';
    const accountNo = profile.vietQrAccountNo || '0123456789';
    // SePay/VietQR only supports VND; convert from invoice currency if needed
    const conversion = convertToVnd(invoice.openAmountForeign, invoice.currency);
    const amount = conversion.amount.toFixed(0);
    const addInfo = createdReceiptNumber || invoice.invoiceNumber;
    const template = 'compact';
    return `https://img.vietqr.io/image/${bankCode}-${accountNo}-${template}.png?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(profile.companyName || 'CONG TY')}`;
  };

  const tabItems = [
    {
      key: 'qr',
      label: (
        <span>
          <QrcodeOutlined /> Chuyển khoản tự động (VietQR)
        </span>
      ),
      children: (
        <div style={{ padding: '16px 0' }}>
          <Alert
            type="info"
            showIcon
            icon={<CheckCircleOutlined />}
            title="Thanh toán nhanh cho VND"
            description="Quét mã QR bằng ứng dụng ngân hàng. Hệ thống sẽ tự động ghi nhận thanh toán trong vòng 5-10 giây."
            style={{ marginBottom: 16 }}
          />

          {/* Invoice Summary */}
          <Alert
            type="warning"
            title={
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <span>
                  Thanh toán hóa đơn: <Text strong>{invoice.invoiceNumber}</Text>
                </span>
                <Text strong style={{ color: '#1890ff' }}>
                  {invoice.currency === 'VND'
                    ? `${invoice.openAmountForeign.toLocaleString('vi-VN')} VND`
                    : `${invoice.openAmountForeign.toLocaleString()} ${invoice.currency}`
                  }
                </Text>
              </Space>
            }
            style={{ marginBottom: 16 }}
          />

          {/* VietQR Display */}
          <div style={{ textAlign: 'center', margin: '24px 0' }}>
            {qrPaymentConfirmed ? (
              <div style={{ padding: 32 }}>
                <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
                <Title level={4} style={{ color: '#52c41a', marginTop: 16 }}>
                  Thanh toán thành công!
                </Title>
                <Text type="secondary">
                  Hệ thống đã ghi nhận thanh toán của bạn.
                </Text>
              </div>
            ) : (
              <>
                <img
                  src={generateVietQR()}
                  alt="VietQR Payment Code"
                  style={{
                    maxWidth: 200,
                    border: '1px solid #f0f0f0',
                    borderRadius: 8,
                    padding: 8,
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <Paragraph type="secondary" style={{ marginTop: 16 }}>
                  Quét mã QR bằng ứng dụng ngân hàng
                </Paragraph>
                {createdReceiptNumber && (
                  <Alert
                    type="success"
                    showIcon
                    style={{ textAlign: 'left', marginBottom: 8 }}
                    title={`Mã giao dịch: ${createdReceiptNumber}`}
                    description="Nội dung chuyển khoản đã được nhúng vào QR. Hệ thống sẽ tự động đối soát khi nhận được thanh toán."
                  />
                )}

                {/* Bank Info */}
                <Alert
                  type="info"
                  title={
                    <pre style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: 11,
                    }}>
                      {profile.companyBankInfo || `Ngân hàng: Vietcombank\nSTK: ${profile.vietQrAccountNo || '0123456789'}\nTên: ${profile.companyName || 'CÔNG TY'}`}
                    </pre>
                  }
                  style={{ marginTop: 16, textAlign: 'left' }}
                />

                {/* Actions */}
                <Space style={{ marginTop: 24 }}>
                  <Button
                    type="primary"
                    icon={<QrcodeOutlined />}
                    loading={qrPaymentPhase === 'paid' || qrPolling}
                    onClick={handlePayWithQR}
                    disabled={qrPaymentPhase === 'confirmed' || qrPaymentPhase === 'failed'}
                    size="large"
                  >
                    {qrPaymentPhase === 'confirmed'
                      ? 'Đã thanh toán'
                      : qrPaymentPhase === 'paid' || qrPolling
                        ? 'Đang kiểm tra...'
                        : qrPaymentPhase === 'created'
                          ? 'Đã thanh toán xong'
                          : 'Tạo yêu cầu thanh toán'}
                  </Button>
                  <Button onClick={() => setActiveTab('swift')}>
                    Chuyển sang thanh toán quốc tế
                  </Button>
                </Space>

                {qrPaymentPhase === 'created' && (
                  <Alert
                    type="info"
                    showIcon
                    title="Đã tạo yêu cầu"
                    description="Vui lòng quét mã QR bằng ứng dụng ngân hàng, sau đó bấm 'Đã thanh toán xong'."
                    style={{ marginTop: 16 }}
                  />
                )}

                {qrPaymentPhase === 'paid' && (
                  <div style={{ marginTop: 16 }}>
                    <SyncOutlined spin style={{ marginRight: 8 }} />
                    <Text type="secondary">
                      Đang chờ xác nhận từ ngân hàng...
                    </Text>
                  </div>
                )}

                {qrPaymentPhase === 'failed' && (
                  <Alert
                    type="error"
                    showIcon
                    title="Thanh toán thất bại"
                    description="Không nhận được xác nhận thanh toán. Vui lòng kiểm tra với ngân hàng."
                    style={{ marginTop: 16 }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'swift',
      label: (
        <span>
          <BankOutlined /> Thanh toán quốc tế (SWIFT T/T)
        </span>
      ),
      children: (
        <div style={{ padding: '16px 0' }}>
          <Alert
            type="info"
            showIcon
            icon={<BankOutlined />}
            title="Thanh toán cho khách hàng quốc tế"
            description="Dành cho thanh toán ngoại tệ hoặc chuyển khoản quốc tế. Kế toán của chúng tôi sẽ xác nhận trong 1-3 ngày làm việc."
            style={{ marginBottom: 16 }}
          />

          {/* Invoice Summary */}
          <Alert
            type="warning"
            title={
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <span>
                  Hóa đơn: <Text strong>{invoice.invoiceNumber}</Text>
                </span>
                <Text strong style={{ color: '#1890ff' }}>
                  {invoice.currency} {invoice.openAmountForeign.toLocaleString()} outstanding
                </Text>
              </Space>
            }
            style={{ marginBottom: 16 }}
          />

          {/* Bank Information for International Transfer */}
          {profile.companyBankInfo && (
            <>
              <Title level={5} style={{ marginTop: 0 }}>
                <BankOutlined /> Thông tin tài khoản ngân hàng thụ hưởng
              </Title>
              <Alert
                type="warning"
                title={
                  <pre style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: 12,
                  }}>
                    {profile.companyBankInfo}
                  </pre>
                }
                style={{ marginBottom: 16 }}
              />
            </>
          )}

          <Divider />

          {/* SWIFT payment fields rendered outside the main Form via onFinish trigger from submit button */}
            <Form.Item
              label="Số tiền thanh toán (Amount Paid)"
              name="amountPaidForeign"
              rules={[
                { required: true, message: 'Vui lòng nhập số tiền' },
                {
                  validator: async (_rule, value: number | null | undefined) => {
                    const paymentAmount = Number(value || 0);
                    if (paymentAmount <= 0) {
                      throw new Error('Số tiền thanh toán phải lớn hơn 0');
                    }
                    if (paymentAmount > Number(invoice.openAmountForeign || 0)) {
                      throw new Error('Số tiền thanh toán không được vượt quá số còn lại');
                    }
                  },
                },
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0.01}
                step={0.01}
                precision={2}
                prefix={invoice.currency}
                placeholder={`Tối đa: ${invoice.openAmountForeign.toFixed(2)} ${invoice.currency}`}
              />
            </Form.Item>

            <Form.Item
              label="Ngày chuyển khoản (Payment Date)"
              name="paymentDate"
              rules={[{ required: true, message: 'Vui lòng chọn ngày' }]}
            >
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item
              label="Phí ngân hàng (Bank Charges)"
              extra="SHA: chia phí | OUR: người gửi trả | BEN: người nhận trả"
            >
              <Space>
                <Form.Item name="bankChargeType" noStyle>
                  <Select
                    style={{ width: 120 }}
                    options={[
                      { value: 'SHA', label: 'SHA - Shared' },
                      { value: 'OUR', label: 'OUR - Our' },
                      { value: 'BEN', label: 'BEN - Beneficiary' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="bankChargeForeign" noStyle>
                  <InputNumber
                    style={{ width: 150 }}
                    min={0}
                    step={0.01}
                    precision={2}
                    prefix={invoice.currency}
                    placeholder="Số tiền phí"
                  />
                </Form.Item>
              </Space>
            </Form.Item>

            <Divider titlePlacement="left">Thông tin người chuyển (Sender Info)</Divider>

            <Form.Item label="Tên người chuyển (Sender Name)" name="senderName">
              <Input placeholder="Tên công ty hoặc cá nhân chuyển tiền" />
            </Form.Item>

            <Form.Item label="Tên ngân hàng gửi (Sender Bank)" name="senderBankName">
              <Input placeholder="VD: BANK OF AMERICA" />
            </Form.Item>

            <Form.Item label="Số tài khoản (Account Number)" name="senderAccountNumber">
              <Input placeholder="Số tài khoản người gửi" />
            </Form.Item>

            <Form.Item label="SWIFT Code" name="swiftCode">
              <Input placeholder="VD: BFTVVNVX" style={{ textTransform: 'uppercase' }} />
            </Form.Item>

            <Divider titlePlacement="left">Chứng từ thanh toán (Payment Evidence) *</Divider>

            <Form.Item
              name="attachmentUrl"
              rules={[{ required: true, message: 'Vui lòng upload chứng từ thanh toán' }]}
            >
              <Upload.Dragger
                name="file"
                fileList={fileList}
                beforeUpload={handleUpload}
                onRemove={handleRemove}
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={uploading}
                maxCount={1}
                listType="picture"
              >
                <p className="ant-upload-drag-icon">
                  {uploading ? (
                    <span>Đang upload... {uploadProgress}%</span>
                  ) : (
                    <UploadOutlined />
                  )}
                </p>
                <p className="ant-upload-text">
                  {uploading ? 'Đang tải lên...' : 'Kéo thả file hoặc click để chọn'}
                </p>
                <p className="ant-upload-hint">
                  Chấp nhận: PDF, JPG, PNG (tối đa 10MB)
                </p>
              </Upload.Dragger>
            </Form.Item>

            {attachmentData && (
              <Alert
                type="success"
                title={`Đã upload: ${attachmentData.filename}`}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Form.Item label="Ghi chú (Note)" name="note">
              <Input.TextArea rows={2} placeholder="Thông tin bổ sung (nếu có)" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={handleClose}>Hủy</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  disabled={!attachmentData}
                >
                  Gửi chứng từ (Submit)
                </Button>
              </Space>
            </Form.Item>
        </div>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <BankOutlined />
          <span>Thanh toán hóa đơn</span>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={720}
      footer={null}
      forceRender
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmitSwift}
        initialValues={{
          amountPaidForeign: invoice.openAmountForeign,
          paymentDate: dayjs(),
          bankChargeType: 'SHA',
          bankChargeForeign: 0,
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </Form>
    </Modal>
  );
};
