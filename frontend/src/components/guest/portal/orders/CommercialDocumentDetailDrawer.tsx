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
import { useLocale, useTranslations } from 'next-intl';
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

type Translate = (key: string, values?: Record<string, string | number>) => string;

const buildDrawerCopy = (t: Translate) => ({
  commercialDocument: t('documentDetail.commercialDocument'),
  downloadPdf: t('documentDetail.downloadPdf'),
  exportPdf: t('documentDetail.exportPdf'),
  requestRevision: t('documentDetail.requestRevision'),
  reject: t('documentDetail.reject'),
  accept: t('documentDetail.accept'),
  acceptQuotationTitle: (documentNumber: string) => t('documentDetail.acceptQuotationTitle', { documentNumber }),
  acceptQuotationContent: t('documentDetail.acceptQuotationContent'),
  selectDocument: t('documentDetail.selectDocument'),
  expired: t('ordersTable.expired'),
  expiredAlertTitle: t('documentDetail.expiredAlertTitle'),
  expiredAlertDescription: t('documentDetail.expiredAlertDescription'),
  unavailableAction: t('documentDetail.unavailableAction'),
  quotationOnlyPdf: t('documentDetail.quotationOnlyPdf'),
  signNow: t('documentDetail.signNow'),
  signNowDescription: t('documentDetail.signNowDescription'),
  signatureActions: t('documentDetail.signatureActions'),
  documentDate: t('documentDetail.documentDate'),
  expiry: t('documentDetail.expiry'),
  currency: t('documentDetail.currency'),
  paymentTerms: t('documentDetail.paymentTerms'),
  terms: t('documentDetail.terms'),
  financials: t('documentDetail.financials'),
  totalValue: t('documentDetail.totalValue'),
  updatedAt: t('documentDetail.updatedAt'),
  lineItems: t('documentDetail.lineItems'),
  product: t('documentDetail.product'),
  qty: t('documentDetail.qty'),
  unitPrice: t('documentDetail.unitPrice'),
  amount: t('documentDetail.amount'),
  noLineItems: t('documentDetail.noLineItems'),
  commercialSummary: t('documentDetail.commercialSummary'),
  subtotal: t('documentDetail.subtotal'),
  total: t('documentDetail.total'),
  attachments: t('documentDetail.attachments'),
  open: t('documentDetail.open'),
  noAttachments: t('documentDetail.noAttachments'),
  timeline: t('documentDetail.timeline'),
  auditLogs: t('documentDetail.auditLogs'),
  auditLogHint: t('documentDetail.auditLogHint'),
  noAuditLogs: t('documentDetail.noAuditLogs'),
  system: t('documentDetail.system'),
  rejectQuotation: t('documentDetail.rejectQuotation'),
  requestQuotationRevision: t('documentDetail.requestQuotationRevision'),
  reasonPlaceholder: t('documentDetail.reasonPlaceholder'),
  documentTypes: {
    QUOTATION: t('documentTypes.QUOTATION'),
    SALES_CONTRACT: t('documentTypes.SALES_CONTRACT'),
    PROFORMA_INVOICE: t('documentTypes.PROFORMA_INVOICE'),
    COMMERCIAL_INVOICE: t('documentTypes.COMMERCIAL_INVOICE'),
    ORDER: t('documentTypes.ORDER'),
  } satisfies Record<CustomerCommercialDocument['documentType'], string>,
  buyerInfo: t('documentDetail.buyerInfo'),
  buyerName: t('documentDetail.buyerName'),
  buyerCountry: t('documentDetail.buyerCountry'),
  deliveryDate: t('documentDetail.deliveryDate'),
  notes: t('documentDetail.notes'),
  totalAmountVnd: t('documentDetail.totalAmountVnd'),
  signatureStatus: t('documentDetail.signatureStatus'),
  pendingSignature: t('pendingSignature'),
  signed: t('documentDetail.signed'),
  statuses: {
    SENT: t('documentStatuses.SENT'),
    ACCEPTED: t('documentStatuses.ACCEPTED'),
    REJECTED: t('documentStatuses.REJECTED'),
    EXPIRED: t('documentStatuses.EXPIRED'),
    PENDING_BUYER_SIGNATURE: t('documentStatuses.PENDING_BUYER_SIGNATURE'),
    BUYER_SIGNED: t('documentStatuses.BUYER_SIGNED'),
    CONFIRMED: t('documentStatuses.CONFIRMED'),
    SHIPPED: t('documentStatuses.SHIPPED'),
    PAID: t('documentStatuses.PAID'),
  } as Record<string, string>,
  lifecycleStages: {
    Quotation: t('lifecycleStages.Quotation'),
    Accepted: t('lifecycleStages.Accepted'),
    Rejected: t('lifecycleStages.Rejected'),
    Expired: t('lifecycleStages.Expired'),
    'Sales Contract': t('lifecycleStages.Sales Contract'),
    'Proforma Invoice': t('lifecycleStages.Proforma Invoice'),
    Payment: t('lifecycleStages.Payment'),
    Shipment: t('lifecycleStages.Shipment'),
    Completed: t('lifecycleStages.Completed'),
  } as Record<string, string>,
  disabledReasons: {
    'Quotation has expired': t('documentDetail.disabledReasons.quotationExpired'),
    'Action is not available in current status': t('documentDetail.disabledReasons.actionUnavailable'),
    'Read-only commercial document': t('documentDetail.disabledReasons.readOnly'),
  } as Record<string, string>,
  timelineLabels: {
    Quotation: t('lifecycleStages.Quotation'),
    'Quotation issued': t('documentDetail.timelineLabels.quotationIssued'),
    'Sales Contract': t('lifecycleStages.Sales Contract'),
    'Proforma Invoice': t('lifecycleStages.Proforma Invoice'),
    Payment: t('lifecycleStages.Payment'),
    Shipment: t('lifecycleStages.Shipment'),
    Completed: t('lifecycleStages.Completed'),
  } as Record<string, string>,
  timelineDescriptions: {
    'Payment received': t('documentDetail.timelineDescriptions.paymentReceived'),
  } as Record<string, string>,
  signing: {
    unableOpenPortal: t('documentDetail.signing.unableOpenPortal'),
    otpSent: t('documentDetail.signing.otpSent'),
    otpSendFailedTryAgain: t('documentDetail.signing.otpSendFailedTryAgain'),
    otpSendFailed: t('documentDetail.signing.otpSendFailed'),
    otpSixDigits: t('documentDetail.signing.otpSixDigits'),
    otpVerified: t('documentDetail.signing.otpVerified'),
    invalidOtp: t('documentDetail.signing.invalidOtp'),
    contractSigned: t('documentDetail.signing.contractSigned'),
    signingFailed: t('documentDetail.signing.signingFailed'),
    contractDetails: t('documentDetail.signing.contractDetails'),
    buyer: t('documentDetail.signing.buyer'),
    country: t('documentDetail.signing.country'),
    totalValue: t('documentDetail.signing.totalValue'),
    deliveryDate: t('documentDetail.signing.deliveryDate'),
    paymentTermsShort: t('documentDetail.signing.paymentTermsShort'),
    otpWillBeSentTo: t('documentDetail.signing.otpWillBeSentTo'),
    sendingOtp: t('documentDetail.signing.sendingOtp'),
    verifyOtp: t('documentDetail.signing.verifyOtp'),
    sign: t('documentDetail.signing.sign'),
    complete: t('documentDetail.signing.complete'),
    enterOtp: t('documentDetail.signing.enterOtp'),
    otpExpiredTitle: t('documentDetail.signing.otpExpiredTitle'),
    otpExpiredDescription: t('documentDetail.signing.otpExpiredDescription'),
    enterSixDigitOtp: t('documentDetail.signing.enterSixDigitOtp'),
    verify: t('documentDetail.signing.verify'),
    waitSeconds: (seconds: number) => t('documentDetail.signing.waitSeconds', { seconds }),
    resendOtp: t('documentDetail.signing.resendOtp'),
    signContract: t('documentDetail.signing.signContract'),
    consentText: t('documentDetail.signing.consentText'),
    signerName: t('documentDetail.signing.signerName'),
    signerNameRequired: t('documentDetail.signing.signerNameRequired'),
    consent: t('documentDetail.signing.consent'),
    consentRequired: t('documentDetail.signing.consentRequired'),
    confirmContractSigning: t('documentDetail.signing.confirmContractSigning'),
    updateContactEmail: t('documentDetail.signing.updateContactEmail'),
    continue: t('documentDetail.signing.continue'),
    emailRequiredTitle: t('documentDetail.signing.emailRequiredTitle'),
    emailPlaceholder: t('documentDetail.signing.emailPlaceholder'),
  },
});

type DrawerCopy = ReturnType<typeof buildDrawerCopy>;

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
  const t = useTranslations('CustomerPortal');
  const { isDark } = useTheme();
  const copy = buildDrawerCopy(t);
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
        setSigningNotice({ type: 'error', text: result.message || copy.signing.unableOpenPortal });
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
            message.success(copy.signing.otpSent);
          }
        } catch {
          message.error(copy.signing.otpSendFailedTryAgain);
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
        message.success(copy.signing.otpSent);
      }
    } catch {
      message.error(copy.signing.otpSendFailed);
    } finally {
      setOtpResending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length !== 6) {
      message.error(copy.signing.otpSixDigits);
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
        message.success(copy.signing.otpVerified);
      } else {
        message.error(typeof res?.message === 'string' ? res.message : copy.signing.invalidOtp);
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
        message.success(copy.signing.contractSigned);
        setSigningModalOpen(false);
        setSigningStep(0);
      } else {
        message.error(typeof res?.message === 'string' ? res.message : copy.signing.signingFailed);
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
      title: copy.acceptQuotationTitle(document.documentNumber),
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
                  <span>{copy.signing.contractDetails}</span>
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
                <Descriptions.Item label={copy.signing.buyer}>
                  <Text strong>{signingSession.contract.buyerName || '-'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={copy.signing.country}>
                  {signingSession.contract.buyerCountry || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Incoterm">
                  <Tag color="magenta">{signingSession.contract.incoterm}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={copy.currency}>
                  {signingSession.contract.currencyCode}
                </Descriptions.Item>
                <Descriptions.Item label={copy.signing.totalValue} span={2}>
                  <Text strong style={{ fontSize: 16 }}>
                    {formatMoney(signingSession.contract.totalAmount || 0, signingSession.contract.currencyCode || 'USD', locale)}
                  </Text>
                  {signingSession.contract.totalAmountVnd > 0 && (
                    <Text type="secondary" style={{ marginLeft: 12 }}>
                      ({formatMoney(signingSession.contract.totalAmountVnd, 'VND', locale)})
                    </Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={copy.signing.deliveryDate}>
                  {formatDate(signingSession.contract.deliveryDate, locale)}
                </Descriptions.Item>
                <Descriptions.Item label={copy.signing.paymentTermsShort}>
                  {signingSession.contract.paymentTerms || '-'}
                </Descriptions.Item>
              </Descriptions>
              {signingSession.contract.notes && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">{copy.notes}:</Text>
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
                  <span>{copy.lineItems}</span>
                  <Tag>{signingSession.contract.items.length}</Tag>
                </Space>
              }
              size="small"
            >
              <Table<SigningItem>
                dataSource={signingSession.contract.items}
                rowKey="_id"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: copy.product,
                    key: 'product',
                    render: (_, record) => (
                      <Space orientation="vertical" size={0}>
                        <Text>{record.productName || '-'}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{record.sku || '-'}</Text>
                      </Space>
                    ),
                  },
                  {
                    title: copy.qty,
                    dataIndex: 'quantity',
                    key: 'quantity',
                    align: 'center',
                  },
                  {
                    title: copy.unitPrice,
                    dataIndex: 'unitPrice',
                    key: 'unitPrice',
                    align: 'right',
                    render: (value: number) => formatMoney(value, signingSession.contract.currencyCode || 'USD', locale),
                  },
                  {
                    title: copy.total,
                    dataIndex: 'totalPrice',
                    key: 'totalPrice',
                    align: 'right',
                    render: (value: number) => (
                      <Text strong>
                        {formatMoney(value, signingSession.contract.currencyCode || 'USD', locale)}
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
              title={copy.signing.otpWillBeSentTo}
              description={<Text code>{signingSession.invitation.signerEmailMasked}</Text>}
            />
          )}

          {/* Auto-sending OTP indicator */}
          {signingStep === 0 && otpSending && (
            <Card>
              <Space orientation="vertical" size={12} style={{ width: '100%' }} align="center">
                <Spin indicator={<MailOutlined style={{ fontSize: 32, color: '#1890ff' }} spin />} />
                <Text>{copy.signing.sendingOtp}</Text>
              </Space>
            </Card>
          )}

          <Steps
            current={signingStep}
            size="small"
            items={[
              { title: copy.signing.verifyOtp, icon: <LockOutlined /> },
              { title: copy.signing.sign, icon: <FileProtectOutlined /> },
              { title: copy.signing.complete, icon: <CheckCircleOutlined /> },
            ]}
          />

          {/* Hidden Step 0: Auto-send OTP (no UI needed) */}
          {/* Step 1: Verify OTP */}
          {signingStep === 1 && (
            <Card
              title={
                <Space>
                  <LockOutlined />
                  {copy.signing.enterOtp}
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
                  title={copy.signing.otpExpiredTitle}
                  description={copy.signing.otpExpiredDescription}
                />
              ) : null}
              <Space.Compact style={{ width: '100%', marginTop: 12 }}>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  placeholder={copy.signing.enterSixDigitOtp}
                  size="large"
                  style={{ fontSize: 18, letterSpacing: 8, textAlign: 'center' }}
                />
                <Button
                  type="primary"
                  loading={signingLoading}
                  onClick={handleVerifyOtp}
                  size="large"
                >
                  {copy.signing.verify}
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
                  ? copy.signing.waitSeconds(otpResendCooldown)
                  : copy.signing.resendOtp}
              </Button>
            </Card>
          )}

          {/* Step 2: Sign */}
          {signingStep === 2 && (
            <Card
              title={
                <Space>
                  <FileProtectOutlined />
                  {copy.signing.signContract}
                </Space>
              }
            >
              <Form
                form={signingForm}
                layout="vertical"
                onFinish={handleSignSubmit}
                disabled={signing}
                initialValues={{
                  consentText: copy.signing.consentText,
                }}
              >
                <Form.Item
                  label={copy.signing.signerName}
                  name="signerName"
                  rules={[{ required: true, message: copy.signing.signerNameRequired }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label={copy.signing.consent}
                  name="consentText"
                  rules={[{ required: true, message: copy.signing.consentRequired }]}
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
                  {copy.signing.confirmContractSigning}
                </Button>
              </Form>
            </Card>
          )}
        </Space>
      </Modal>

      <Modal
        title={copy.signing.updateContactEmail}
        open={missingEmailOpen}
        onCancel={() => setMissingEmailOpen(false)}
        onOk={() => void handleRequestSigning(missingEmail)}
        okText={copy.signing.continue}
        okButtonProps={{ disabled: !missingEmail.includes('@') }}
      >
        <Alert
          type="info"
          title={copy.signing.emailRequiredTitle}
          style={{ marginBottom: 16 }}
        />
        <Input
          type="email"
          placeholder={copy.signing.emailPlaceholder}
          value={missingEmail}
          onChange={(e) => setMissingEmail(e.target.value)}
        />
      </Modal>
    </Drawer>
  );
}
