'use client';

import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Spin,
  Steps,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import Statistic from 'antd/es/statistic';
import type { TableProps } from 'antd/es/table';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  FileProtectOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LockOutlined,
  MailOutlined,
  PaperClipOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useLocale } from 'next-intl';
import { useTheme } from '@/context/theme.context';
import type {
  CustomerAuditLogItem,
  CustomerCommercialDocument,
  CustomerDocumentLineItem,
  CustomerTimelineItem,
} from '@/types/customer-portal';
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

type SigningModalSession = {
  invitation: {
    _id: string;
    signerName: string;
    signerTitle: string | null;
    signerEmailMasked: string | null;
    status: string;
    expiresAt: string;
    otpExpiresAt: string | null;
    otpVerified: boolean;
    sentAt: string | null;
    verifiedAt: string | null;
    signedAt: string | null;
    certificateNumber: string | null;
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
};

type SignFormValues = {
  signerName: string;
  signerTitle?: string | null;
  signerEmail?: string | null;
  consentText: string;
};

type CommercialDocumentDetailDrawerProps = {
  open: boolean;
  document: CustomerCommercialDocument | null;
  timeline: CustomerTimelineItem[];
  loading: boolean;
  submitting: boolean;
  downloading: boolean;
  onClose: () => void;
  onAccept: (recordId: string) => Promise<void>;
  onReject: (recordId: string, reason: string) => Promise<void>;
  onRequestRevision: (recordId: string, reason: string) => Promise<void>;
  onDownloadPdf: (document: CustomerCommercialDocument) => Promise<void>;
  onRequestSigning?: (recordId: string, signerEmail?: string) => Promise<{ success: boolean; signingUrl?: string; message?: string }>;
};

const getDrawerCopy = (locale: string) => {
  const isVietnamese = locale === 'vi';

  return {
    commercialDocument: isVietnamese ? 'Chứng từ thương mại' : 'Commercial document',
    downloadPdf: isVietnamese ? 'Tải PDF' : 'Download PDF',
    exportPdf: isVietnamese ? 'Xuất Invoice PDF' : 'Export Invoice PDF',
    requestRevision: isVietnamese ? 'Yêu cầu chỉnh sửa' : 'Request revision',
    reject: isVietnamese ? 'Từ chối' : 'Reject',
    accept: isVietnamese ? 'Chấp nhận' : 'Accept',
    acceptQuotationTitle: isVietnamese ? 'Chấp nhận báo giá {documentNumber}?' : 'Accept quotation {documentNumber}?',
    acceptQuotationContent: isVietnamese
      ? 'Xác nhận các điều khoản thương mại và cho phép sales tiếp tục vòng đời chứng từ.'
      : 'This confirms the commercial terms and allows sales to continue the lifecycle.',
    selectDocument: isVietnamese ? 'Chọn một chứng từ để xem chi tiết' : 'Select a document to view details',
    expired: isVietnamese ? 'Hết hạn' : 'Expired',
    expiredAlertTitle: isVietnamese ? 'Báo giá đã hết hạn' : 'Quotation has expired',
    expiredAlertDescription: isVietnamese
      ? 'Bạn không thể chấp nhận hoặc từ chối báo giá này. Hãy yêu cầu sales phát hành bản báo giá mới.'
      : 'You can no longer accept or reject this quotation. Request sales to issue an updated quotation.',
    unavailableAction: isVietnamese ? 'Thao tác chưa khả dụng' : 'Action unavailable',
    quotationOnlyPdf: isVietnamese ? 'Chỉ báo giá mới có bản PDF để tải' : 'PDF download is only available for quotations',
    signNow: isVietnamese ? 'Ký hợp đồng ngay' : 'Sign contract now',
    signNowDescription: isVietnamese
      ? 'Mã OTP sẽ được gửi đến email của bạn để xác thực trước khi ký.'
      : 'An OTP will be sent to your email for verification before signing.',
    signatureActions: isVietnamese ? 'Thao tác ký' : 'Signing actions',
    documentDate: isVietnamese ? 'Ngày chứng từ' : 'Document date',
    expiry: isVietnamese ? 'Hết hạn' : 'Expiry',
    currency: isVietnamese ? 'Tiền tệ' : 'Currency',
    paymentTerms: isVietnamese ? 'Điều khoản thanh toán' : 'Payment terms',
    terms: isVietnamese ? 'Điều khoản' : 'Terms',
    financials: isVietnamese ? 'Giá trị thương mại' : 'Commercial value',
    totalValue: isVietnamese ? 'Tổng giá trị' : 'Total value',
    updatedAt: isVietnamese ? 'Cập nhật lần cuối' : 'Last updated',
    lineItems: isVietnamese ? 'Dòng hàng' : 'Line items',
    product: isVietnamese ? 'Sản phẩm' : 'Product',
    qty: isVietnamese ? 'Số lượng' : 'Qty',
    unitPrice: isVietnamese ? 'Đơn giá' : 'Unit Price',
    amount: isVietnamese ? 'Thành tiền' : 'Amount',
    noLineItems: isVietnamese ? 'Chưa có dòng hàng' : 'No line items',
    commercialSummary: isVietnamese ? 'Tổng hợp thương mại' : 'Commercial summary',
    subtotal: isVietnamese ? 'Tạm tính' : 'Subtotal',
    total: isVietnamese ? 'Tổng cộng' : 'Total',
    attachments: isVietnamese ? 'Tệp đính kèm' : 'Attachments',
    open: isVietnamese ? 'Mở' : 'Open',
    noAttachments: isVietnamese ? 'Chưa có tệp đính kèm' : 'No attachments',
    timeline: isVietnamese ? 'Timeline' : 'Timeline',
    auditLogs: isVietnamese ? 'Nhật ký audit' : 'Audit logs',
    auditLogHint: isVietnamese ? 'Lưu vết thực thi hệ thống và thay đổi dữ liệu.' : 'System execution and data-change trail.',
    noAuditLogs: isVietnamese ? 'Chưa có nhật ký audit' : 'No audit logs yet',
    system: isVietnamese ? 'hệ thống' : 'system',
    rejectQuotation: isVietnamese ? 'Từ chối báo giá' : 'Reject quotation',
    requestQuotationRevision: isVietnamese ? 'Yêu cầu chỉnh sửa báo giá' : 'Request quotation revision',
    reasonPlaceholder: isVietnamese ? 'Nhập lý do rõ ràng để sales xử lý tiếp' : 'Enter a clear reason for sales follow-up',
    documentTypes: {
      QUOTATION: isVietnamese ? 'Báo giá' : 'Quotation',
      SALES_CONTRACT: isVietnamese ? 'Hợp đồng' : 'Sales Contract',
      PROFORMA_INVOICE: 'Proforma Invoice',
      COMMERCIAL_INVOICE: 'Commercial Invoice',
      ORDER: isVietnamese ? 'Đơn hàng' : 'Order',
    } satisfies Record<CustomerCommercialDocument['documentType'], string>,
    buyerInfo: isVietnamese ? 'Thông tin buyer' : 'Buyer info',
    buyerName: isVietnamese ? 'Tên buyer' : 'Buyer name',
    buyerCountry: isVietnamese ? 'Quốc gia' : 'Country',
    deliveryDate: isVietnamese ? 'Ngày giao hàng' : 'Delivery date',
    notes: isVietnamese ? 'Ghi chú' : 'Notes',
    totalAmountVnd: isVietnamese ? 'Tổng (VND)' : 'Total (VND)',
    signatureStatus: isVietnamese ? 'Trạng thái ký' : 'Signature status',
    pendingSignature: isVietnamese ? 'Chờ ký' : 'Pending signature',
    signed: isVietnamese ? 'Đã ký' : 'Signed',
    statuses: {
      SENT: isVietnamese ? 'Đã gửi' : 'SENT',
      ACCEPTED: isVietnamese ? 'Đã chấp nhận' : 'ACCEPTED',
      REJECTED: isVietnamese ? 'Đã từ chối' : 'REJECTED',
      EXPIRED: isVietnamese ? 'Hết hạn' : 'EXPIRED',
      PENDING_BUYER_SIGNATURE: isVietnamese ? 'Chờ buyer ký' : 'PENDING_BUYER_SIGNATURE',
      BUYER_SIGNED: isVietnamese ? 'Buyer đã ký' : 'BUYER_SIGNED',
      CONFIRMED: isVietnamese ? 'Đã xác nhận' : 'CONFIRMED',
      SHIPPED: isVietnamese ? 'Đã giao hàng' : 'SHIPPED',
      PAID: isVietnamese ? 'Đã thanh toán' : 'PAID',
    } as Record<string, string>,
    lifecycleStages: {
      Quotation: isVietnamese ? 'Báo giá' : 'Quotation',
      Accepted: isVietnamese ? 'Đã chấp nhận' : 'Accepted',
      Rejected: isVietnamese ? 'Đã từ chối' : 'Rejected',
      Expired: isVietnamese ? 'Hết hạn' : 'Expired',
      'Sales Contract': isVietnamese ? 'Hợp đồng' : 'Sales Contract',
      'Proforma Invoice': 'Proforma Invoice',
      Payment: isVietnamese ? 'Thanh toán' : 'Payment',
      Shipment: isVietnamese ? 'Giao hàng' : 'Shipment',
      Completed: isVietnamese ? 'Hoàn tất' : 'Completed',
    } as Record<string, string>,
    disabledReasons: {
      'Quotation has expired': isVietnamese ? 'Báo giá đã hết hạn' : 'Quotation has expired',
      'Action is not available in current status': isVietnamese
        ? 'Thao tác không khả dụng ở trạng thái hiện tại'
        : 'Action is not available in current status',
      'Read-only commercial document': isVietnamese ? 'Chứng từ chỉ được xem' : 'Read-only commercial document',
    } as Record<string, string>,
    timelineLabels: {
      Quotation: isVietnamese ? 'Báo giá' : 'Quotation',
      'Quotation issued': isVietnamese ? 'Đã phát hành báo giá' : 'Quotation issued',
      'Sales Contract': isVietnamese ? 'Hợp đồng' : 'Sales Contract',
      'Proforma Invoice': 'Proforma Invoice',
      Payment: isVietnamese ? 'Thanh toán' : 'Payment',
      Shipment: isVietnamese ? 'Giao hàng' : 'Shipment',
      Completed: isVietnamese ? 'Hoàn tất' : 'Completed',
    } as Record<string, string>,
    timelineDescriptions: {
      'Payment received': isVietnamese ? 'Đã nhận thanh toán' : 'Payment received',
    } as Record<string, string>,
  };
};

type DrawerCopy = ReturnType<typeof getDrawerCopy>;

type DateFormatMode = 'date' | 'dateTime';

const formatDate = (value: string | null, locale: string, mode: DateFormatMode = 'date'): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(mode === 'dateTime'
      ? {
          hour: '2-digit',
          minute: '2-digit',
        }
      : {}),
  }).format(date);
};

const formatMoney = (value: number, currency: string, locale: string): string => {
  const normalizedCurrency = currency || 'USD';
  const fractionDigits = normalizedCurrency === 'VND' ? 0 : 2;

  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: normalizedCurrency,
    currencyDisplay: 'code',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
};

const formatQuantity = (value: number, unit: string | null, locale: string): string => {
  const quantity = Number.isFinite(value) ? value : 0;
  const formattedValue = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(quantity);

  return unit ? `${formattedValue} ${unit}` : formattedValue;
};

const statusColor = (status: string): string => {
  const normalized = status.toUpperCase();
  if (['ACCEPTED', 'APPROVED', 'CONFIRMED', 'PAID', 'COMPLETED'].includes(normalized)) {
    return 'success';
  }
  if (['SENT', 'PENDING_APPROVAL', 'PENDING_BUYER_SIGNATURE', 'SHIPPED'].includes(normalized)) {
    return 'processing';
  }
  if (['REJECTED', 'CANCELLED', 'EXPIRED'].includes(normalized)) {
    return 'error';
  }
  return 'warning';
};

const sectionStyle: CSSProperties = {
  border: '1px solid rgba(148, 163, 184, 0.24)',
  borderRadius: 12,
  padding: 20,
  background: 'rgba(15, 23, 42, 0.22)',
};

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 12,
};

const detailGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
};

const getDetailItemStyle = (isDark: boolean): CSSProperties => ({
  minHeight: 82,
  border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.18)'}`,
  borderRadius: 10,
  padding: '12px 14px',
  background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.5)',
});

const getSummaryPanelStyle = (isDark: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  alignItems: 'center',
  gap: 16,
  border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0.26)'}`,
  borderRadius: 12,
  padding: 20,
  background: isDark 
    ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.25), rgba(14, 165, 233, 0.12))'
    : 'linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(14, 165, 233, 0.08))',
});

const actionBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  border: '1px solid rgba(148, 163, 184, 0.2)',
  borderRadius: 12,
  padding: 14,
  background: 'rgba(2, 6, 23, 0.22)',
};

const actionGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
};

const listPanelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const listRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  border: '1px solid rgba(148, 163, 184, 0.16)',
  borderRadius: 10,
  padding: '10px 12px',
  background: 'rgba(255, 255, 255, 0.03)',
};

const SectionHeader = ({
  icon,
  title,
  extra,
}: {
  icon?: ReactNode;
  title: string;
  extra?: ReactNode;
}) => (
  <div style={sectionHeaderStyle}>
    <Space size={8}>
      {icon}
      <Text strong>{title}</Text>
    </Space>
    {extra}
  </div>
);

const DetailItem = ({
  label,
  value,
  strong,
  isDark,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  isDark?: boolean;
}) => (
  <div style={getDetailItemStyle(isDark || false)}>
    <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
      {label}
    </Text>
    {strong ? <Text strong>{value}</Text> : <Text>{value}</Text>}
  </div>
);

const lineColumns = (
  currency: string,
  locale: string,
  copy: DrawerCopy,
): TableProps<CustomerDocumentLineItem>['columns'] => [
  {
    title: copy.product,
    width: 340,
    render: (_, item) => (
      <Space orientation="vertical" size={2}>
        <Text strong>{item.productName}</Text>
        <Text type="secondary">{item.sku || item.product_id || '-'}</Text>
      </Space>
    ),
  },
  {
    title: copy.qty,
    dataIndex: 'quantity',
    align: 'right',
    width: 132,
    render: (value: number, item) => <Text>{formatQuantity(value, item.unit, locale)}</Text>,
  },
  {
    title: copy.unitPrice,
    dataIndex: 'unitPrice',
    align: 'right',
    width: 150,
    render: (value: number) => formatMoney(value, currency, locale),
  },
  {
    title: copy.amount,
    dataIndex: 'totalAmount',
    align: 'right',
    width: 160,
    render: (value: number) => <Text strong>{formatMoney(value, currency, locale)}</Text>,
  },
];

const AuditLogList = ({
  auditLogs,
  copy,
  locale,
}: {
  auditLogs: CustomerAuditLogItem[];
  copy: DrawerCopy;
  locale: string;
}) => {
  if (!auditLogs.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={copy.noAuditLogs} />;
  }

  return (
    <div style={listPanelStyle}>
      {auditLogs.map((item) => (
        <div key={item._id} style={listRowStyle}>
          <Space orientation="vertical" size={2}>
            <Space size={8} wrap>
              <Tag>{item.action}</Tag>
              <Text>{item.username || copy.system}</Text>
            </Space>
            <Text type="secondary">{formatDate(item.createdAt, locale, 'dateTime')}</Text>
          </Space>
        </div>
      ))}
    </div>
  );
};

export function CommercialDocumentDetailDrawer({
  open,
  document,
  timeline,
  loading,
  submitting,
  downloading,
  onClose,
  onAccept,
  onReject,
  onRequestRevision,
  onDownloadPdf,
  onRequestSigning,
}: CommercialDocumentDetailDrawerProps) {
  const { modal, message } = App.useApp();
  const locale = useLocale();
  const { isDark } = useTheme();
  const copy = getDrawerCopy(locale);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [signing, setSigning] = useState(false);
  const [signingNotice, setSigningNotice] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Signing modal state
  const [signingModalOpen, setSigningModalOpen] = useState(false);
  const [signingSession, setSigningSession] = useState<SigningModalSession | null>(null);
  const [signingToken, setSigningToken] = useState<string | null>(null);
  const [signingLoading, setSigningLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false); // For auto-send on modal open
  const [otpResending, setOtpResending] = useState(false); // For resend button in step 1
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [signingStep, setSigningStep] = useState<0 | 1 | 2>(0);
  const [signingForm] = Form.useForm<SignFormValues>();
  
  // Pre-fill signerName from session when reaching step 2
  useEffect(() => {
    if (signingStep === 2 && signingSession?.invitation.signerName) {
      signingForm.setFieldsValue({ signerName: signingSession.invitation.signerName });
    }
  }, [signingStep, signingSession, signingForm]);
  const otpExpiryMs = signingSession?.invitation.otpExpiresAt
    ? new Date(signingSession.invitation.otpExpiresAt).getTime()
    : Date.now() + 15 * 60 * 1000;
  const isOtpExpired = otpExpiryMs <= Date.now();

  // OTP cooldown timer
  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpResendCooldown]);

  // Fetch signing session
  const fetchSigningSession = async (token: string) => {
    setSigningLoading(true);
    try {
      const res = await sendRequest<IBackendRes<SigningModalSession>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/signing/${token}`,
        method: 'GET',
      });
      if (res?.data) {
        setSigningSession(res.data);
      }
    } finally {
      setSigningLoading(false);
    }
  };

  const [missingEmailOpen, setMissingEmailOpen] = useState(false);
  const [missingEmail, setMissingEmail] = useState('');

  // Step 0 -> 1: Request OTP (auto-send on modal open)
  const handleRequestSigning = async (providedEmail?: string) => {
    if (!document || !onRequestSigning) return;
    setSigning(true);
    setSigningNotice(null);
    try {
      const result = await onRequestSigning(document._id, providedEmail);
      if (!result.success) {
        if (result.message?.toLowerCase().includes('email is required')) {
          setMissingEmailOpen(true);
          return;
        }
        setSigningNotice({ type: 'error', text: result.message || 'Unable to open signing portal' });
        return;
      }
      setMissingEmailOpen(false);
      setMissingEmail('');
      if (result.signingUrl) {
        const token = result.signingUrl.match(/\/portal\/sign\/([^/?#]+)/)?.[1] || '';
        setSigningToken(token);
        setSigningModalOpen(true);
        setOtp('');
        setSigningStep(0);
        await fetchSigningSession(token);
        // Auto-send OTP after fetching session (skip Step 0 UI)
        setOtpSending(true);
        try {
          const otpRes = await sendRequest<IBackendRes<{ message: string; expiresAt: string }>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/signing/${token}/request-otp`,
            method: 'POST',
          });
          if (otpRes?.data) {
            setSigningSession((prev) => prev ? { ...prev, invitation: { ...prev.invitation, otpExpiresAt: otpRes.data!.expiresAt } } : prev);
            setOtpResendCooldown(60);
            setSigningStep(1);
            message.success(locale === 'vi' ? 'Mã OTP đã được gửi đến email của bạn.' : 'OTP sent to your email.');
          }
        } catch {
          message.error(locale === 'vi' ? 'Gửi OTP thất bại. Vui lòng thử lại.' : 'Failed to send OTP. Please try again.');
        } finally {
          setOtpSending(false);
        }
      }
    } finally {
      setSigning(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!signingToken) return;
    setOtpResending(true);
    try {
      const res = await sendRequest<IBackendRes<{ message: string; expiresAt: string }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/signing/${signingToken}/request-otp`,
        method: 'POST',
      });
      if (res?.data) {
        setSigningSession((prev) => prev ? { ...prev, invitation: { ...prev.invitation, otpExpiresAt: res.data!.expiresAt } } : prev);
        setOtpResendCooldown(60);
        setSigningStep(1);
        message.success(locale === 'vi' ? 'Mã OTP đã được gửi đến email của bạn.' : 'OTP sent to your email.');
      }
    } catch {
      message.error(locale === 'vi' ? 'Gửi OTP thất bại.' : 'Failed to send OTP.');
    } finally {
      setOtpResending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length !== 6) {
      message.error(locale === 'vi' ? 'Mã OTP phải gồm 6 chữ số.' : 'OTP must be 6 digits.');
      return;
    }
    if (!signingToken) return;

    setSigningLoading(true);
    try {
      const res = await sendRequest<IBackendRes<SigningModalSession>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/signing/${signingToken}/otp`,
        method: 'POST',
        body: { otp: otp.trim() },
      });
      if (res?.data) {
        setSigningSession(res.data);
        setSigningStep(2);
        message.success(locale === 'vi' ? 'OTP xác minh thành công.' : 'OTP verified.');
      } else {
        message.error(typeof res?.message === 'string' ? res.message : (locale === 'vi' ? 'OTP không hợp lệ.' : 'Invalid OTP.'));
      }
    } finally {
      setSigningLoading(false);
    }
  };

  const handleSignSubmit = async (values: SignFormValues) => {
    if (!signingToken) return;
    setSigning(true);
    try {
      const res = await sendRequest<IBackendRes<unknown>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/signing/${signingToken}/sign`,
        method: 'POST',
        body: {
          signerName: values.signerName,
          signerTitle: values.signerTitle || null,
          signerEmail: values.signerEmail || null,
          consentText: values.consentText,
        },
      });
      if (res?.data) {
        message.success(locale === 'vi' ? 'Hợp đồng đã được ký thành công!' : 'Contract signed successfully!');
        setSigningModalOpen(false);
        setSigningStep(0);
      } else {
        message.error(typeof res?.message === 'string' ? res.message : (locale === 'vi' ? 'Ký thất bại.' : 'Signing failed.'));
      }
    } finally {
      setSigning(false);
    }
  };

  const handleSigningModalClose = () => {
    setSigningModalOpen(false);
    setSigningSession(null);
    setSigningToken(null);
    setSigningStep(0);
    setOtp('');
    setOtpResendCooldown(0);
    setOtpSending(false);
    // Delay resetFields to avoid calling on unmounted form
    setTimeout(() => {
      signingForm.resetFields();
    }, 100);
  };

  const isPendingSignature = document?.status === 'PENDING_BUYER_SIGNATURE';
  const canSignInPortal =
    !!document &&
    document.documentType === 'SALES_CONTRACT' &&
    isPendingSignature;

  const handleAccept = () => {
    if (!document) return;
    modal.confirm({
      title: copy.acceptQuotationTitle.replace('{documentNumber}', document.documentNumber),
      content: copy.acceptQuotationContent,
      okText: copy.accept,
      onOk: () => onAccept(document._id),
    });
  };

  const handleReasonSubmit = async () => {
    if (!document || !reason.trim()) return;
    if (rejectOpen) {
      await onReject(document._id, reason.trim());
    } else {
      await onRequestRevision(document._id, reason.trim());
    }
    setReason('');
    setRejectOpen(false);
    setRevisionOpen(false);
  };

  const disabledActionReason = document?.actions.disabledReason
    ? copy.disabledReasons[document.actions.disabledReason] || document.actions.disabledReason
    : copy.unavailableAction;
  const isQuotation = document?.documentType === 'QUOTATION';
  const statusLabel = document
    ? document.isExpired
      ? copy.expired
      : copy.statuses[document.status] || document.status
    : '';
  const lifecycleLabel = document
    ? copy.lifecycleStages[document.lifecycleStage] || document.lifecycleStage
    : '';
  const shouldShowLifecycle = Boolean(document && lifecycleLabel && lifecycleLabel !== statusLabel);

  return (
    <Drawer
      title={
        document ? (
          <Space orientation="vertical" size={4}>
            <Space size={8} wrap>
              <FileTextOutlined />
              <Text strong>{document.documentNumber}</Text>
              <Tag color={document.isExpired ? 'error' : statusColor(document.status)}>
                {statusLabel}
              </Tag>
              {shouldShowLifecycle ? <Tag>{lifecycleLabel}</Tag> : null}
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {copy.documentTypes[document.documentType]}
            </Text>
          </Space>
        ) : (
          copy.commercialDocument
        )
      }
      open={open}
      onClose={onClose}
      size="min(100vw, 1040px)"
      loading={loading}
      styles={{
        header: { padding: '16px 24px' },
        body: { padding: 24 },
      }}
    >
      {!document ? (
        <Empty description={copy.selectDocument} />
      ) : (
        <Space orientation="vertical" size={24} style={{ width: '100%' }}>
          <div style={actionBarStyle}>
            <Space orientation="vertical" size={2}>
              <Text strong>{copy.documentTypes[document.documentType]}</Text>
              <Text type="secondary">{document.documentNumber}</Text>
            </Space>
            <div style={actionGroupStyle}>
              {document.documentType === 'SALES_CONTRACT' && document.status === 'PENDING_BUYER_SIGNATURE' && (
                <Tooltip title={copy.signNowDescription}>
                  <span>
                    <Button
                      type="primary"
                      icon={<FileProtectOutlined />}
                      loading={signing}
                      disabled={!canSignInPortal || !onRequestSigning}
                      onClick={() => void handleRequestSigning()}
                    >
                      {copy.signNow}
                    </Button>
                  </span>
                </Tooltip>
              )}
              {isQuotation && (
                <Tooltip title={undefined}>
                  <span>
                    <Button
                      icon={<DownloadOutlined />}
                      loading={downloading}
                      onClick={() => void onDownloadPdf(document)}
                    >
                      {copy.downloadPdf}
                    </Button>
                  </span>
                </Tooltip>
              )}
              {document.documentType === 'COMMERCIAL_INVOICE' && (
                <Tooltip title={undefined}>
                  <span>
                    <Button
                      icon={<FilePdfOutlined />}
                      onClick={() => void onDownloadPdf(document)}
                    >
                      {copy.exportPdf}
                    </Button>
                  </span>
                </Tooltip>
              )}
              {document.documentType !== 'SALES_CONTRACT' && document.documentType !== 'PROFORMA_INVOICE' && (
                <Tooltip title={document.actions.canRequestRevision ? undefined : disabledActionReason}>
                  <span>
                    <Button
                      icon={<EditOutlined />}
                      disabled={!document.actions.canRequestRevision}
                      onClick={() => setRevisionOpen(true)}
                    >
                      {copy.requestRevision}
                    </Button>
                  </span>
                </Tooltip>
              )}
              {document.documentType !== 'SALES_CONTRACT' && (
                <Tooltip title={document.actions.canReject ? undefined : disabledActionReason}>
                  <span>
                    <Button
                      danger
                      icon={<CloseCircleOutlined />}
                      disabled={!document.actions.canReject}
                      onClick={() => setRejectOpen(true)}
                    >
                      {copy.reject}
                    </Button>
                  </span>
                </Tooltip>
              )}
              {document.documentType !== 'SALES_CONTRACT' && (
                <Tooltip title={document.actions.canAccept ? undefined : disabledActionReason}>
                  <span>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      disabled={!document.actions.canAccept}
                      loading={submitting}
                      onClick={handleAccept}
                    >
                      {copy.accept}
                    </Button>
                  </span>
                </Tooltip>
              )}
            </div>
          </div>

          {document.actions.disabledReason && document.documentType === 'QUOTATION' ? (
            <Alert
              type={document.isExpired ? 'warning' : 'info'}
              showIcon
              title={document.isExpired ? copy.expiredAlertTitle : disabledActionReason}
              description={document.isExpired ? copy.expiredAlertDescription : undefined}
            />
          ) : null}

          {signingNotice ? (
            <Alert
              type={signingNotice.type}
              showIcon
              title={signingNotice.text}
            />
          ) : null}

          <div style={getSummaryPanelStyle(isDark)}>
            <Space orientation="vertical" size={2}>
              <Text type="secondary">{copy.financials}</Text>
              <Title level={3} style={{ margin: 0 }}>
                {formatMoney(document.totalAmount, document.currency, locale)}
              </Title>
            </Space>
            <Space orientation="vertical" size={2}>
              <Text type="secondary">{copy.updatedAt}</Text>
              <Text>{formatDate(document.updatedAt, locale, 'dateTime')}</Text>
            </Space>
          </div>

          <section style={sectionStyle}>
            <SectionHeader icon={<InfoCircleOutlined />} title={copy.terms} />
            <div style={detailGridStyle}>
              <DetailItem label={copy.documentDate} value={formatDate(document.documentDate, locale)} isDark={isDark} />
              <DetailItem label={copy.expiry} value={formatDate(document.expiryDate, locale)} isDark={isDark} />
              <DetailItem label="Incoterm" value={document.incoterm || '-'} strong isDark={isDark} />
              <DetailItem label={copy.paymentTerms} value={document.paymentTerms || '-'} isDark={isDark} />
              <DetailItem label={copy.currency} value={document.currency} strong isDark={isDark} />
              <DetailItem label={copy.deliveryDate} value={formatDate(document.deliveryDate ?? null, locale)} isDark={isDark} />
              {document.documentType === 'SALES_CONTRACT' && document.buyerName && (
                <>
                  <DetailItem label={copy.buyerName} value={document.buyerName} strong isDark={isDark} />
                  <DetailItem label={copy.buyerCountry} value={document.buyerCountry || '-'} isDark={isDark} />
                </>
              )}
            </div>
            {document.notes && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>{copy.notes}</Text>
                <div style={{
                  padding: 12,
                  background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.02)',
                  borderRadius: 8,
                  borderLeft: `3px solid ${isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.3)'}`,
                }}>
                  <Text>{document.notes}</Text>
                </div>
              </div>
            )}
          </section>

          {/* Commercial Value Section - Enhanced */}
          <div style={getSummaryPanelStyle(isDark)}>
            <Space orientation="vertical" size={2}>
              <Text type="secondary">{copy.financials}</Text>
              <Title level={3} style={{ margin: 0 }}>
                {formatMoney(document.totalAmount, document.currency, locale)}
              </Title>
            </Space>
            {document.totalAmountVnd && (
              <Space orientation="vertical" size={2}>
                <Text type="secondary">{copy.totalAmountVnd}</Text>
                <Text>{formatMoney(document.totalAmountVnd, 'VND', locale)}</Text>
              </Space>
            )}
            <Space orientation="vertical" size={2}>
              <Text type="secondary">{copy.updatedAt}</Text>
              <Text>{formatDate(document.updatedAt, locale, 'dateTime')}</Text>
            </Space>
          </div>

          <section style={sectionStyle}>
            <SectionHeader
              icon={<FileTextOutlined />}
              title={copy.lineItems}
              extra={<Tag>{document.lineItems.length}</Tag>}
            />
            <Table<CustomerDocumentLineItem>
              rowKey="_id"
              size="small"
              columns={lineColumns(document.currency, locale, copy)}
              dataSource={document.lineItems}
              pagination={false}
              scroll={{ x: 820 }}
              locale={{ emptyText: <Empty description={copy.noLineItems} /> }}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3}>
                      <Text strong>{copy.total}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <Text strong>{formatMoney(document.totalAmount, document.currency, locale)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </section>

          <section style={sectionStyle}>
            <SectionHeader
              icon={<PaperClipOutlined />}
              title={copy.attachments}
              extra={<Tag>{document.attachments.length}</Tag>}
            />
            {document.attachments.length ? (
              <div style={listPanelStyle}>
                {document.attachments.map((item) => (
                  <div key={item._id} style={listRowStyle}>
                    <Text strong>{item.fileName}</Text>
                    {item.url ? (
                      <Button
                        size="small"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {copy.open}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={copy.noAttachments} />
            )}
          </section>

          <section style={sectionStyle}>
            <SectionHeader icon={<ClockCircleOutlined />} title={copy.timeline} />
            {timeline.length ? (
              <Steps
                orientation="vertical"
                size="small"
                items={timeline.map((item) => ({
                  title: copy.timelineLabels[item.label] || item.label,
                  status: item.status,
                  content: (
                    <Space orientation="vertical" size={2}>
                      <Text type="secondary">
                        {item.description ? copy.timelineDescriptions[item.description] || item.description : '-'}
                      </Text>
                      <Text type="secondary">{formatDate(item.date, locale)}</Text>
                    </Space>
                  ),
                }))}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="-" />
            )}
          </section>

          <Collapse
            size="small"
            items={[
              {
                key: 'auditLogs',
                label: (
                  <Space>
                    <HistoryOutlined />
                    <Text strong>{copy.auditLogs}</Text>
                    <Tag>{document.auditLogs.length}</Tag>
                  </Space>
                ),
                children: (
                  <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                    <Text type="secondary">{copy.auditLogHint}</Text>
                    <Divider style={{ margin: 0 }} />
                    <AuditLogList auditLogs={document.auditLogs} copy={copy} locale={locale} />
                  </Space>
                ),
              },
            ]}
          />
        </Space>
      )}

      <Modal
        title={rejectOpen ? copy.rejectQuotation : copy.requestQuotationRevision}
        open={rejectOpen || revisionOpen}
        onCancel={() => {
          setReason('');
          setRejectOpen(false);
          setRevisionOpen(false);
        }}
        onOk={() => void handleReasonSubmit()}
        okButtonProps={{ disabled: reason.trim().length === 0, loading: submitting }}
        okText={rejectOpen ? copy.reject : copy.requestRevision}
      >
        <Input.TextArea
          rows={4}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={copy.reasonPlaceholder}
        />
      </Modal>

      {/* Integrated Signing Modal */}
      <Modal
        title={
          <Space>
            <FileProtectOutlined />
            <span>{copy.signNow}</span>
          </Space>
        }
        open={signingModalOpen}
        onCancel={handleSigningModalClose}
        width={900}
        footer={null}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          {/* Contract Details Card */}
          {signingSession?.contract && (
            <Card
              title={
                <Space>
                  <FileTextOutlined />
                  <span>{locale === 'vi' ? 'Chi tiết hợp đồng' : 'Contract Details'}</span>
                </Space>
              }
              extra={
                <Tag color="purple">
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {signingSession.contract.contractNumber}
                </Tag>
              }
            >
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label={locale === 'vi' ? 'Buyer' : 'Buyer'}>
                  <Text strong>{signingSession.contract.buyerName || '-'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={locale === 'vi' ? 'Quốc gia' : 'Country'}>
                  {signingSession.contract.buyerCountry || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Incoterm">
                  <Tag color="magenta">{signingSession.contract.incoterm}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={locale === 'vi' ? 'Tiền tệ' : 'Currency'}>
                  {signingSession.contract.currencyCode}
                </Descriptions.Item>
                <Descriptions.Item label={locale === 'vi' ? 'Tổng giá trị' : 'Total Value'} span={2}>
                  <Text strong style={{ fontSize: 16 }}>
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: signingSession.contract.currencyCode || 'USD',
                    }).format(signingSession.contract.totalAmount || 0)}
                  </Text>
                  {signingSession.contract.totalAmountVnd > 0 && (
                    <Text type="secondary" style={{ marginLeft: 12 }}>
                      ({new Intl.NumberFormat('vi-VN', {
                        style: 'currency',
                        currency: 'VND',
                      }).format(signingSession.contract.totalAmountVnd)})
                    </Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={locale === 'vi' ? 'Ngày giao hàng' : 'Delivery Date'}>
                  {formatDate(signingSession.contract.deliveryDate, locale)}
                </Descriptions.Item>
                <Descriptions.Item label={locale === 'vi' ? 'Điều khoản TT' : 'Payment Terms'}>
                  {signingSession.contract.paymentTerms || '-'}
                </Descriptions.Item>
              </Descriptions>
              {signingSession.contract.notes && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">{locale === 'vi' ? 'Ghi chú' : 'Notes'}:</Text>
                  <div style={{
                    padding: 12,
                    background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.02)',
                    borderRadius: 8,
                    borderLeft: `3px solid ${isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.3)'}`,
                    marginTop: 4,
                  }}>
                    <Text>{signingSession.contract.notes}</Text>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Line Items Table */}
          {signingSession?.contract?.items && signingSession.contract.items.length > 0 && (
            <Card
              title={
                <Space>
                  <FileTextOutlined />
                  <span>{locale === 'vi' ? 'Dòng hàng' : 'Line Items'}</span>
                  <Tag>{signingSession.contract.items.length}</Tag>
                </Space>
              }
              size="small"
            >
              <Table
                dataSource={signingSession.contract.items}
                rowKey="_id"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: locale === 'vi' ? 'Sản phẩm' : 'Product',
                    key: 'product',
                    render: (_, record) => (
                      <Space orientation="vertical" size={0}>
                        <Text>{record.productName || '-'}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{record.sku || '-'}</Text>
                      </Space>
                    ),
                  },
                  {
                    title: locale === 'vi' ? 'Số lượng' : 'Qty',
                    dataIndex: 'quantity',
                    key: 'quantity',
                    align: 'center',
                  },
                  {
                    title: locale === 'vi' ? 'Đơn giá' : 'Unit Price',
                    dataIndex: 'unitPrice',
                    key: 'unitPrice',
                    align: 'right',
                    render: (value: number) => new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: signingSession.contract.currencyCode || 'USD',
                    }).format(value),
                  },
                  {
                    title: locale === 'vi' ? 'Thành tiền' : 'Total',
                    dataIndex: 'totalPrice',
                    key: 'totalPrice',
                    align: 'right',
                    render: (value: number) => (
                      <Text strong>
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: signingSession.contract.currencyCode || 'USD',
                        }).format(value)}
                      </Text>
                    ),
                  },
                ]}
              />
            </Card>
          )}

          {/* OTP Sending / Verify Step */}
          <Divider style={{ margin: '8px 0' }} />
          
          {signingSession?.invitation?.signerEmailMasked && (
            <Alert
              type="info"
              showIcon
              icon={<MailOutlined />}
              title={
                locale === 'vi' ? 'Mã OTP sẽ được gửi đến:' : 'OTP will be sent to:'
              }
              description={<Text code>{signingSession.invitation.signerEmailMasked}</Text>}
            />
          )}

          {/* Auto-sending OTP indicator */}
          {signingStep === 0 && otpSending && (
            <Card>
              <Space orientation="vertical" size={12} style={{ width: '100%' }} align="center">
                <Spin indicator={<MailOutlined style={{ fontSize: 32, color: '#1890ff' }} spin />} />
                <Text>
                  {locale === 'vi' ? 'Đang gửi mã OTP...' : 'Sending OTP...'}
                </Text>
              </Space>
            </Card>
          )}

          <Steps
            current={signingStep}
            size="small"
            items={[
              { title: locale === 'vi' ? 'Xác minh OTP' : 'Verify OTP', icon: <LockOutlined /> },
              { title: locale === 'vi' ? 'Ký kết' : 'Sign', icon: <FileProtectOutlined /> },
              { title: locale === 'vi' ? 'Hoàn tất' : 'Complete', icon: <CheckCircleOutlined /> },
            ]}
          />

          {/* Hidden Step 0: Auto-send OTP (no UI needed) */}
          {/* Step 1: Verify OTP */}
          {signingStep === 1 && (
            <Card
              title={
                <Space>
                  <LockOutlined />
                  {locale === 'vi' ? 'Nhập mã OTP' : 'Enter OTP'}
                </Space>
              }
              extra={
                !isOtpExpired && signingSession?.invitation.otpExpiresAt ? (
                  <Timer
                    type="countdown"
                    value={otpExpiryMs}
                    styles={{ content: { fontSize: 13, color: '#fa8c16' } }}
                    format="mm:ss"
                  />
                ) : null
              }
            >
              {isOtpExpired ? (
                <Alert
                  type="warning"
                  title={locale === 'vi' ? 'Mã OTP đã hết hạn' : 'OTP has expired'}
                  description={locale === 'vi'
                    ? 'Vui lòng nhấn "Gửi lại mã OTP" để nhận mã mới.'
                    : 'Please request a new OTP below.'}
                />
              ) : null}
              <Space.Compact style={{ width: '100%', marginTop: 12 }}>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  placeholder={locale === 'vi' ? 'Nhập mã 6 số' : 'Enter 6-digit OTP'}
                  size="large"
                  style={{ fontSize: 18, letterSpacing: 8, textAlign: 'center' }}
                />
                <Button
                  type="primary"
                  loading={signingLoading}
                  onClick={handleVerifyOtp}
                  size="large"
                >
                  {locale === 'vi' ? 'Xác minh' : 'Verify'}
                </Button>
              </Space.Compact>
              <Divider style={{ margin: '12px 0' }} />
              <Button
                type="link"
                icon={<ReloadOutlined />}
                loading={otpResending}
                disabled={otpResendCooldown > 0}
                onClick={handleRequestOtp}
                style={{ padding: 0, height: 'auto' }}
              >
                {otpResendCooldown > 0
                  ? (locale === 'vi' ? `Đợi ${otpResendCooldown}s` : `Wait ${otpResendCooldown}s`)
                  : (locale === 'vi' ? 'Gửi lại mã OTP' : 'Resend OTP')}
              </Button>
            </Card>
          )}

          {/* Step 2: Sign */}
          {signingStep === 2 && (
            <Card
              title={
                <Space>
                  <FileProtectOutlined />
                  {locale === 'vi' ? 'Ký hợp đồng' : 'Sign contract'}
                </Space>
              }
            >
              <Form
                form={signingForm}
                layout="vertical"
                onFinish={handleSignSubmit}
                disabled={signing}
                initialValues={{
                  consentText: locale === 'vi'
                    ? 'Tôi xác nhận rằng tôi được ủy quyền ký hợp đồng này và đồng ý với các điều khoản thương mại.'
                    : 'I confirm that I am authorized to sign this contract and agree to its commercial terms.',
                }}
              >
                <Form.Item
                  label={locale === 'vi' ? 'Tên người ký' : 'Signer name'}
                  name="signerName"
                  rules={[{ required: true, message: locale === 'vi' ? 'Tên người ký là bắt buộc.' : 'Signer name is required.' }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label={locale === 'vi' ? 'Xác nhận đồng ý' : 'Consent'}
                  name="consentText"
                  rules={[{ required: true, message: locale === 'vi' ? 'Bạn phải đồng ý để tiếp tục ký.' : 'You must agree to proceed with signing.' }]}
                >
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Button
                  type="primary"
                  block
                  htmlType="submit"
                  loading={signing}
                  size="large"
                  icon={<CheckCircleOutlined />}
                >
                  {locale === 'vi' ? 'Xác nhận ký hợp đồng' : 'Confirm contract signing'}
                </Button>
              </Form>
            </Card>
          )}
        </Space>
      </Modal>

      <Modal
        title={locale === 'vi' ? 'Cập nhật Email liên hệ' : 'Update Contact Email'}
        open={missingEmailOpen}
        onCancel={() => setMissingEmailOpen(false)}
        onOk={() => void handleRequestSigning(missingEmail)}
        okText={locale === 'vi' ? 'Tiếp tục' : 'Continue'}
        okButtonProps={{ disabled: !missingEmail.includes('@') }}
      >
        <Alert
          type="info"
          message={locale === 'vi' ? 'Hệ thống cần email của bạn để gửi mã xác thực OTP phục vụ quá trình ký số bảo mật.' : 'An email is required to send the OTP for secure signing.'}
          style={{ marginBottom: 16 }}
        />
        <Input
          type="email"
          placeholder={locale === 'vi' ? 'Nhập địa chỉ email của bạn' : 'Enter your email address'}
          value={missingEmail}
          onChange={(e) => setMissingEmail(e.target.value)}
        />
      </Modal>
    </Drawer>
  );
}
