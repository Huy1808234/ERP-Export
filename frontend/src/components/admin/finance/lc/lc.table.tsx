'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  BankOutlined,
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  FilterOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SendOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { lcService } from '@/services/lc.service';
import type { IBackendRes } from '@/services/base.service';
import dayjs, { type Dayjs } from 'dayjs';
import { useTheme } from '@/context/theme.context';
import LCModal from './lc.modal';
import { useLocale, useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';

const { Text, Title } = Typography;

type LCStatus = 'DRAFT' | 'RECEIVED' | 'DOCUMENTS_PRESENTED' | 'ACCEPTED' | 'PAID' | 'EXPIRED' | 'CANCELLED';
type LCType = 'AT_SIGHT' | 'DEFERRED' | 'USANCE';
type DeadlineSeverity = 'OVERDUE' | 'TODAY' | 'CRITICAL' | 'WARNING' | 'UPCOMING';
type DeadlineType = 'EXPIRY' | 'LATEST_SHIPMENT' | 'PRESENTATION' | 'DISCREPANCY' | 'INVOICE_DUE';
type DiscrepancySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type DiscrepancyStatus = 'OPEN' | 'AMENDED' | 'WAIVED' | 'ACCEPTED_BY_BUYER' | 'RESOLVED' | 'CANCELLED';

type PartnerSummary = {
  name?: string | null;
};

type SalesContractSummary = {
  _id: string;
  contractNumber?: string | null;
  buyer?: PartnerSummary | null;
};

type LetterOfCreditRecord = {
  _id: string;
  lcNumber: string;
  salesContractId: string;
  salesContract?: SalesContractSummary | null;
  status: LCStatus;
  lcType: LCType;
  issuingBank: string;
  advisingBank?: string | null;
  amount: number;
  currency: string;
  issueDate: string;
  expiryDate: string;
  latestShipmentDate?: string | null;
  presentationDeadline?: string | null;
  createdByUsername?: string;
  attachmentUrl?: string | null;
};

type PaginationMeta = {
  current: number;
  pageSize: number;
  pages: number;
  total: number;
};

type LCListResponse = {
  results: LetterOfCreditRecord[];
  meta: PaginationMeta;
};

type LCDiscrepancyRecord = {
  _id: string;
  lcId: string;
  documentType?: string | null;
  severity: DiscrepancySeverity;
  status: DiscrepancyStatus;
  description: string;
  dueDate?: string | null;
  reportedByUsername: string;
  resolvedByUsername?: string | null;
};

type LCDeadlineInvoiceSnapshot = {
  invoiceNumber: string;
  openAmountForeign: number;
  currency: string;
};

type LCDeadlineItem = {
  _id: string;
  lcId: string;
  lcNumber: string;
  salesContractId: string;
  contractNumber: string | null;
  buyerName: string | null;
  type: DeadlineType;
  label: string;
  dueDate: string | null;
  daysRemaining: number | null;
  severity: DeadlineSeverity;
  status: string;
  amount: number;
  currency: string;
  action: string;
  description?: string;
  invoiceNumber?: string;
  openAmountForeign?: number;
  invoices?: LCDeadlineInvoiceSnapshot[];
  notificationChannels?: string[];
};

type LCDeadlineGroup = {
  key: string;
  label: string;
  buyerName?: string | null;
  lcNumbers: string[];
  nextDeadline: string | null;
  severity: DeadlineSeverity;
  amountExposure: number;
  counts: {
    overdue: number;
    dueToday: number;
    critical: number;
    warning: number;
    upcoming: number;
  };
  typeBuckets: Record<DeadlineType, number>;
  deadlineItems: LCDeadlineItem[];
};

type LCAlerts = {
  days: number;
  nextActions: LCDeadlineItem[];
  byContract: LCDeadlineGroup[];
  notificationChannels: Array<{ channel: string; enabled: boolean }>;
  exposure: {
    activeLcAmount: number;
    deadlineAmount: number;
    overdueAmount: number;
    criticalAmount: number;
    presentationAmount: number;
    discrepancyAmount: number;
    invoiceOpenAmount: number;
  };
  counts: {
    expiring: number;
    shipmentDeadline: number;
    presentationDeadline: number;
    openDiscrepancies: number;
    deadlineItems: number;
    invoiceDue: number;
    overdue: number;
    dueToday: number;
    critical: number;
    actionRequired: number;
  };
};

type DiscrepancyFormValues = {
  documentType?: string;
  severity: DiscrepancySeverity;
  dueDate?: Dayjs;
  description: string;
};

const emptyMeta: PaginationMeta = {
  current: 1,
  pageSize: 10,
  pages: 0,
  total: 0,
};

const statusColor: Record<LCStatus, string> = {
  DRAFT: 'default',
  RECEIVED: 'processing',
  DOCUMENTS_PRESENTED: 'warning',
  ACCEPTED: 'success',
  PAID: 'cyan',
  EXPIRED: 'error',
  CANCELLED: 'magenta',
};

const lcTypeLabel: Record<LCType, string> = {
  AT_SIGHT: 'At sight',
  DEFERRED: 'Deferred',
  USANCE: 'Usance',
};

const deadlineSeverityMeta: Record<DeadlineSeverity, { color: string; badge: 'error' | 'warning' | 'processing' | 'success' | 'default' }> = {
  OVERDUE: { color: 'red', badge: 'error' },
  TODAY: { color: 'volcano', badge: 'error' },
  CRITICAL: { color: 'orange', badge: 'warning' },
  WARNING: { color: 'gold', badge: 'warning' },
  UPCOMING: { color: 'blue', badge: 'processing' },
};

const formatMoney = (value?: number | string | null, currency = 'USD') => {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'VND' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
};

const getDaysFromToday = (date?: string | null) => {
  if (!date) return null;
  return dayjs(date).startOf('day').diff(dayjs().startOf('day'), 'day');
};

const LCTable = () => {
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const { message, notification } = App.useApp();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const t = useTranslations('LetterOfCredit');
  const locale = useLocale();
  const isVi = locale === 'vi';

  const copy = useMemo(() => ({
    dashboardTitle: isVi ? 'Bảng kiểm deadline L/C' : 'L/C Deadline Control',
    dashboardDescription: isVi
      ? 'Theo dõi hạn giao hàng, hạn xuất trình chứng từ, discrepancy và công nợ liên quan.'
      : 'Track shipment deadlines, presentation deadlines, discrepancies, and linked receivables.',
    noRisk: isVi ? `Không có deadline rủi ro trong kỳ theo dõi.` : 'No risky deadlines in the selected window.',
    activeExposure: isVi ? 'Giá trị L/C đang theo dõi' : 'Monitored L/C Exposure',
    actionRequired: isVi ? 'Cần xử lý' : 'Action Required',
    overdue: isVi ? 'Quá hạn' : 'Overdue',
    discrepancy: isVi ? 'Discrepancy mở' : 'Open Discrepancies',
    nextActions: isVi ? 'Việc cần xử lý trước' : 'Priority Actions',
    lcRegister: isVi ? 'Sổ theo dõi L/C' : 'L/C Register',
    searchPlaceholder: isVi ? 'Tìm số L/C, ngân hàng, hợp đồng, buyer...' : 'Search L/C, bank, contract, buyer...',
    allStatuses: isVi ? 'Tất cả trạng thái' : 'All statuses',
    refresh: isVi ? 'Tải lại' : 'Refresh',
    pushNotify: isVi ? 'Gửi cảnh báo' : 'Push Notify',
    due: isVi ? 'Hạn' : 'Due',
    workflow: isVi ? 'Luồng xử lý' : 'Workflow',
    contractBuyer: isVi ? 'Hợp đồng / Buyer' : 'Contract / Buyer',
    banks: isVi ? 'Ngân hàng' : 'Banks',
    amount: isVi ? 'Giá trị' : 'Amount',
    keyDates: isVi ? 'Mốc ngày' : 'Key Dates',
    status: isVi ? 'Trạng thái' : 'Status',
    actions: isVi ? 'Thao tác' : 'Actions',
    issue: isVi ? 'Mở' : 'Issue',
    expiry: isVi ? 'Hết hạn' : 'Expiry',
    shipment: isVi ? 'Giao hàng' : 'Shipment',
    presentation: isVi ? 'Xuất trình' : 'Presentation',
    noDueDate: isVi ? 'Chưa có hạn' : 'No due date',
    today: isVi ? 'Hôm nay' : 'Today',
    daysLeft: isVi ? 'ngày còn lại' : 'days left',
    daysOverdue: isVi ? 'ngày quá hạn' : 'days overdue',
    recordReceived: isVi ? 'Ghi nhận đã nhận L/C' : 'Mark L/C received',
    presentDocuments: isVi ? 'Xuất trình chứng từ' : 'Present documents',
    acceptDocuments: isVi ? 'Chấp nhận chứng từ' : 'Accept documents',
    markPaid: isVi ? 'Ghi nhận đã thanh toán' : 'Mark paid',
    cancelLc: isVi ? 'Hủy L/C' : 'Cancel L/C',
    reportDiscrepancy: isVi ? 'Ghi nhận discrepancy' : 'Report discrepancy',
    edit: isVi ? 'Xem / sửa' : 'View / edit',
    noAction: isVi ? 'Không còn thao tác' : 'No open actions',
    discrepancyTitle: isVi ? 'Ghi nhận discrepancy' : 'Report discrepancy',
    documentType: isVi ? 'Loại chứng từ' : 'Document type',
    severity: isVi ? 'Mức độ' : 'Severity',
    resolutionDue: isVi ? 'Deadline xử lý' : 'Resolution deadline',
    description: isVi ? 'Mô tả sai biệt' : 'Description',
    submit: isVi ? 'Ghi nhận' : 'Submit',
    close: isVi ? 'Đóng' : 'Close',
    resolved: isVi ? 'Đã xử lý' : 'Resolved',
    amended: isVi ? 'Đã sửa' : 'Amended',
    waived: isVi ? 'Waive' : 'Waive',
    notificationsSent: isVi ? 'Đã gửi cảnh báo deadline' : 'Deadline notifications sent',
    statusUpdated: isVi ? 'Đã cập nhật trạng thái L/C' : 'L/C status updated',
    discrepancyCreated: isVi ? 'Đã ghi nhận discrepancy' : 'Discrepancy recorded',
    discrepancyResolved: isVi ? 'Đã xử lý discrepancy' : 'Discrepancy resolved',
  }), [isVi]);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LetterOfCreditRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta);
  const [searchText, setSearchText] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LCStatus | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLC, setSelectedLC] = useState<LetterOfCreditRecord | null>(null);
  const [alerts, setAlerts] = useState<LCAlerts | null>(null);
  const [deadlineWindow, setDeadlineWindow] = useState(14);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [discrepanciesByLc, setDiscrepanciesByLc] = useState<Record<string, LCDiscrepancyRecord[]>>({});
  const [isDiscrepancyOpen, setIsDiscrepancyOpen] = useState(false);
  const [discrepancyForm] = Form.useForm<DiscrepancyFormValues>();
  const currentPage = meta.current;
  const currentPageSize = meta.pageSize;

  const fetchData = useCallback(async (current: number, pageSize: number, search = '', status?: LCStatus) => {
    if (!accessToken) {
      setRows([]);
      setMeta(emptyMeta);
      return;
    }

    setLoading(true);
    try {
      const res = await lcService.findAll<LCListResponse>({
        current,
        pageSize,
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      }, accessToken);
      if (res?.error) {
        throw new Error(res.message || 'Cannot load L/C records');
      }
      setRows(res?.data?.results || []);
      setMeta(res?.data?.meta || emptyMeta);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Cannot load L/C records');
    } finally {
      setLoading(false);
    }
  }, [accessToken, message]);

  const fetchAlerts = useCallback(async () => {
    if (!accessToken) return;
    const res = await sendRequest<IBackendRes<LCAlerts>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/lc/deadline-dashboard`,
      method: 'GET',
      queryParams: { days: deadlineWindow },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) setAlerts(res.data);
  }, [accessToken, deadlineWindow]);

  useEffect(() => {
    fetchData(currentPage, currentPageSize, submittedSearch, statusFilter);
    fetchAlerts();
  }, [currentPage, currentPageSize, fetchData, fetchAlerts, submittedSearch, statusFilter]);

  const submitSearch = (value: string) => {
    setSubmittedSearch(value.trim());
    setMeta((current) => ({ ...current, current: 1 }));
  };

  const publishDeadlineNotifications = async () => {
    if (!accessToken) return;
    setNotifyLoading(true);
    try {
      const res = await sendRequest<IBackendRes<{ emitted: number }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/lc/deadline-dashboard/notify`,
        method: 'POST',
        queryParams: { days: deadlineWindow },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.error) throw new Error(res.message || 'Cannot publish deadline notifications');
      notification.success({
        title: copy.notificationsSent,
        description: `${res?.data?.emitted || 0} alert(s)`,
      });
      fetchAlerts();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Cannot publish deadline notifications');
    } finally {
      setNotifyLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedLC(null);
    setIsModalOpen(true);
  };

  const handleEdit = (record: LetterOfCreditRecord) => {
    setSelectedLC(record);
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    fetchData(meta.current, meta.pageSize, submittedSearch, statusFilter);
    fetchAlerts();
  };

  const handleLCStatus = async (record: LetterOfCreditRecord, status: LCStatus) => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<LetterOfCreditRecord>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/lc/${record._id}/status`,
        method: 'PATCH',
        body: { status },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.error) throw new Error(res.message || 'Cannot update L/C status');
      message.success(copy.statusUpdated);
      fetchData(meta.current, meta.pageSize, submittedSearch, statusFilter);
      fetchAlerts();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Cannot update L/C status');
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscrepancies = async (recordId: string) => {
    if (!accessToken) return;
    const res = await sendRequest<IBackendRes<LCDiscrepancyRecord[]>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/lc/${recordId}/discrepancies`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setDiscrepanciesByLc((current) => ({ ...current, [recordId]: res?.data || [] }));
  };

  const openDiscrepancyModal = (record: LetterOfCreditRecord) => {
    setSelectedLC(record);
    discrepancyForm.resetFields();
    discrepancyForm.setFieldsValue({ severity: 'MEDIUM' });
    setIsDiscrepancyOpen(true);
  };

  const submitDiscrepancy = async (values: DiscrepancyFormValues) => {
    if (!selectedLC?._id || !accessToken) return;
    try {
      const res = await sendRequest<IBackendRes<LCDiscrepancyRecord>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/lc/${selectedLC._id}/discrepancies`,
        method: 'POST',
        body: {
          ...values,
          dueDate: values.dueDate?.toISOString(),
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.error) throw new Error(res.message || 'Cannot create discrepancy');
      notification.success({ title: copy.discrepancyCreated });
      setIsDiscrepancyOpen(false);
      fetchDiscrepancies(selectedLC._id);
      fetchAlerts();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Cannot create discrepancy');
    }
  };

  const resolveDiscrepancy = async (lcId: string, discrepancyId: string, status: DiscrepancyStatus) => {
    if (!accessToken) return;
    try {
      const res = await sendRequest<IBackendRes<LCDiscrepancyRecord>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/lc/${lcId}/discrepancies/${discrepancyId}/resolve`,
        method: 'PATCH',
        body: { status },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.error) throw new Error(res.message || 'Cannot resolve discrepancy');
      message.success(copy.discrepancyResolved);
      fetchDiscrepancies(lcId);
      fetchAlerts();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Cannot resolve discrepancy');
    }
  };

  const getStatusTag = (status: LCStatus) => (
    <Tag color={statusColor[status]} style={{ borderRadius: 6, marginInlineEnd: 0 }}>
      {t(`status.${status}`)}
    </Tag>
  );

  const renderDateSignal = (label: string, value?: string | null) => {
    const days = getDaysFromToday(value);
    const isOverdue = days !== null && days < 0;
    const isSoon = days !== null && days >= 0 && days <= 7;

    return (
      <div className="lc-date-line">
        <Text type="secondary">{label}</Text>
        <Text strong type={isOverdue ? 'danger' : undefined}>
          {value ? dayjs(value).format('DD/MM/YYYY') : '-'}
        </Text>
        {days !== null && (
          <Tag color={isOverdue ? 'red' : isSoon ? 'gold' : 'default'} style={{ borderRadius: 6, marginInlineEnd: 0 }}>
            {days < 0 ? `${Math.abs(days)} ${copy.daysOverdue}` : days === 0 ? copy.today : `${days} ${copy.daysLeft}`}
          </Tag>
        )}
      </div>
    );
  };

  const getStatusActions = (record: LetterOfCreditRecord) => {
    const statusActions: Array<{ key: LCStatus; label: string; icon: React.ReactNode; danger?: boolean }> = [];

    if (record.status === 'DRAFT') {
      statusActions.push({ key: 'RECEIVED', label: copy.recordReceived, icon: <CheckCircleOutlined /> });
      statusActions.push({ key: 'CANCELLED', label: copy.cancelLc, icon: <CloseCircleOutlined />, danger: true });
    }
    if (record.status === 'RECEIVED') {
      statusActions.push({ key: 'DOCUMENTS_PRESENTED', label: copy.presentDocuments, icon: <SendOutlined /> });
      statusActions.push({ key: 'CANCELLED', label: copy.cancelLc, icon: <CloseCircleOutlined />, danger: true });
    }
    if (record.status === 'DOCUMENTS_PRESENTED') {
      statusActions.push({ key: 'ACCEPTED', label: copy.acceptDocuments, icon: <SafetyCertificateOutlined /> });
      statusActions.push({ key: 'CANCELLED', label: copy.cancelLc, icon: <CloseCircleOutlined />, danger: true });
    }
    if (record.status === 'ACCEPTED') {
      statusActions.push({ key: 'PAID', label: copy.markPaid, icon: <DollarOutlined /> });
      statusActions.push({ key: 'CANCELLED', label: copy.cancelLc, icon: <CloseCircleOutlined />, danger: true });
    }

    return statusActions;
  };

  const canReportDiscrepancy = (record: LetterOfCreditRecord) => ['RECEIVED', 'DOCUMENTS_PRESENTED', 'ACCEPTED'].includes(record.status);

  const deadlineColumns: ColumnsType<LCDeadlineItem> = [
    {
      title: copy.due,
      dataIndex: 'dueDate',
      width: 150,
      render: (value: string | null, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value ? dayjs(value).format('DD/MM/YYYY') : copy.noDueDate}</Text>
          <Badge
            status={deadlineSeverityMeta[record.severity]?.badge || 'default'}
            text={record.daysRemaining === null
              ? copy.noDueDate
              : record.daysRemaining < 0
                ? `${Math.abs(record.daysRemaining)} ${copy.daysOverdue}`
                : record.daysRemaining === 0
                  ? copy.today
                  : `${record.daysRemaining} ${copy.daysLeft}`}
          />
        </Space>
      ),
    },
    {
      title: copy.workflow,
      key: 'workflow',
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Space wrap size={6}>
            <Tag color={deadlineSeverityMeta[record.severity]?.color || 'default'} style={{ borderRadius: 6 }}>{record.severity}</Tag>
            <Text strong>{record.label}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.lcNumber} - {record.contractNumber || record.salesContractId} - {record.buyerName || '-'}
          </Text>
          {record.invoiceNumber && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Invoice {record.invoiceNumber}: {formatMoney(record.openAmountForeign, record.currency)}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: copy.actions,
      dataIndex: 'action',
      render: (value: string, record) => (
        <Space orientation="vertical" size={2}>
          <Text>{value}</Text>
          {record.description && <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>}
          {(record.invoices || []).length > 0 && !record.invoiceNumber && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {(record.invoices || []).slice(0, 2).map((invoice) => `${invoice.invoiceNumber} ${formatMoney(invoice.openAmountForeign, invoice.currency)}`).join(', ')}
            </Text>
          )}
        </Space>
      ),
    },
  ];

  const discrepancyColumns: ColumnsType<LCDiscrepancyRecord> = [
    {
      title: copy.description,
      dataIndex: 'description',
      render: (value: string, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.documentType || 'Document'} - {record.reportedByUsername}
          </Text>
        </Space>
      ),
    },
    {
      title: copy.severity,
      dataIndex: 'severity',
      width: 120,
      render: (value: DiscrepancySeverity) => (
        <Tag color={value === 'CRITICAL' ? 'red' : value === 'HIGH' ? 'volcano' : value === 'MEDIUM' ? 'orange' : 'blue'} style={{ borderRadius: 6 }}>
          {value}
        </Tag>
      ),
    },
    {
      title: copy.status,
      dataIndex: 'status',
      width: 150,
      render: (value: DiscrepancyStatus) => (
        <Tag color={value === 'OPEN' ? 'red' : 'green'} style={{ borderRadius: 6 }}>
          {value}
        </Tag>
      ),
    },
    {
      title: copy.actions,
      width: 220,
      render: (_, record) => record.status === 'OPEN' ? (
        <Space>
          <Button size="small" onClick={() => resolveDiscrepancy(record.lcId, record._id, 'AMENDED')}>{copy.amended}</Button>
          <Button size="small" type="primary" onClick={() => resolveDiscrepancy(record.lcId, record._id, 'WAIVED')}>{copy.waived}</Button>
        </Space>
      ) : (
        <Text type="secondary">{record.resolvedByUsername || copy.resolved}</Text>
      ),
    },
  ];

  const columns: ColumnsType<LetterOfCreditRecord> = [
    {
      title: copy.contractBuyer,
      dataIndex: 'lcNumber',
      width: 260,
      render: (value: string, record) => {
        const fileUrl = record.attachmentUrl
          ? (record.attachmentUrl.startsWith('http')
              ? record.attachmentUrl
              : `${process.env.NEXT_PUBLIC_BACKEND_URL || ''}${record.attachmentUrl}`)
          : null;

        return (
          <Space orientation="vertical" size={2}>
            <Space>
              <Text strong style={{ color: token.colorPrimary }}>{value}</Text>
              {fileUrl && (
                <Tooltip title={isVi ? 'Xem/Tải chứng từ L/C gốc' : 'View/Download L/C attachment'}>
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <PaperClipOutlined style={{ color: '#1890ff', fontSize: 15 }} />
                  </a>
                </Tooltip>
              )}
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.salesContract?.contractNumber || record.salesContractId}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.salesContract?.buyer?.name || '-'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: copy.banks,
      dataIndex: 'issuingBank',
      width: 240,
      render: (value: string, record) => (
        <Space orientation="vertical" size={2}>
          <Text strong><BankOutlined /> {value}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.advisingBank || '-'}</Text>
        </Space>
      ),
    },
    {
      title: copy.amount,
      dataIndex: 'amount',
      width: 160,
      align: 'right',
      render: (amount: number, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{formatMoney(amount, record.currency)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{lcTypeLabel[record.lcType]}</Text>
        </Space>
      ),
    },
    {
      title: copy.keyDates,
      key: 'dates',
      width: 300,
      render: (_, record) => (
        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          {renderDateSignal(copy.expiry, record.expiryDate)}
          {renderDateSignal(copy.shipment, record.latestShipmentDate)}
          {renderDateSignal(copy.presentation, record.presentationDeadline)}
        </Space>
      ),
    },
    {
      title: copy.status,
      dataIndex: 'status',
      width: 180,
      render: (status: LCStatus, record) => (
        <Space orientation="vertical" size={4}>
          {getStatusTag(status)}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {copy.issue}: {record.issueDate ? dayjs(record.issueDate).format('DD/MM/YYYY') : '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: copy.actions,
      key: 'action',
      width: 150,
      align: 'right',
      render: (_, record) => {
        const statusActions = getStatusActions(record);
        const menuItems = [
          ...statusActions.map((item) => ({
            key: item.key,
            label: item.label,
            icon: item.icon,
            danger: item.danger,
          })),
          ...(canReportDiscrepancy(record)
            ? [{
                key: 'DISCREPANCY',
                label: copy.reportDiscrepancy,
                icon: <ExclamationCircleOutlined />,
                danger: true,
              }]
            : []),
        ];

        return (
          <Space>
            <Tooltip title={copy.edit}>
              <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
            </Tooltip>
            <Dropdown
              trigger={['click']}
              disabled={menuItems.length === 0}
              menu={{
                items: menuItems,
                onClick: ({ key }) => {
                  if (key === 'DISCREPANCY') {
                    openDiscrepancyModal(record);
                    return;
                  }
                  handleLCStatus(record, key as LCStatus);
                },
              }}
            >
              <Button type="text" icon={<MoreOutlined />} disabled={menuItems.length === 0} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  const statusOptions = [
    { value: undefined, label: copy.allStatuses },
    ...(['DRAFT', 'RECEIVED', 'DOCUMENTS_PRESENTED', 'ACCEPTED', 'PAID', 'EXPIRED', 'CANCELLED'] as LCStatus[]).map((status) => ({
      value: status,
      label: t(`status.${status}`),
    })),
  ];

  const riskCards = [
    {
      title: copy.activeExposure,
      value: formatMoney(alerts?.exposure?.activeLcAmount || 0),
      icon: <DollarOutlined />,
      tone: token.colorPrimary,
    },
    {
      title: copy.actionRequired,
      value: alerts?.counts?.actionRequired || 0,
      icon: <ExclamationCircleOutlined />,
      tone: token.colorError,
    },
    {
      title: copy.overdue,
      value: alerts?.counts?.overdue || 0,
      icon: <CalendarOutlined />,
      tone: token.colorError,
    },
    {
      title: copy.discrepancy,
      value: alerts?.counts?.openDiscrepancies || 0,
      icon: <FileDoneOutlined />,
      tone: token.colorWarning,
    },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        icon={<FileProtectOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />}
        description={t('description')}
        extra={(
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={handleCreate}>
            {t('actions.create')}
          </Button>
        )}
      />

      <section className="lc-section">
        <div className="lc-section-heading">
          <div>
            <Title level={4} style={{ margin: 0 }}>{copy.dashboardTitle}</Title>
            <Text type="secondary">{copy.dashboardDescription}</Text>
          </div>
          <Space wrap>
            <Segmented
              value={deadlineWindow}
              options={[
                { label: isVi ? '7 ngày' : '7 days', value: 7 },
                { label: isVi ? '14 ngày' : '14 days', value: 14 },
                { label: isVi ? '30 ngày' : '30 days', value: 30 },
              ]}
              onChange={(value) => setDeadlineWindow(Number(value))}
            />
            <Button icon={<BellOutlined />} loading={notifyLoading} onClick={publishDeadlineNotifications}>
              {copy.pushNotify}
            </Button>
          </Space>
        </div>

        <Row gutter={[12, 12]}>
          {riskCards.map((card) => (
            <Col xs={24} sm={12} xl={6} key={card.title}>
              <Card className="lc-metric-card" variant="borderless">
                <Statistic
                  title={card.title}
                  value={card.value}
                  prefix={<span style={{ color: card.tone }}>{card.icon}</span>}
                  styles={{ content: { color: card.tone, fontSize: 22, fontWeight: 700 } }}
                />
              </Card>
            </Col>
          ))}
        </Row>

        <div className="lc-signal-row">
          <Space wrap size={[8, 8]}>
            <Badge status="warning" text={`${alerts?.counts?.expiring || 0} ${isVi ? 'L/C sắp hết hạn' : 'expiring L/Cs'}`} />
            <Badge status="processing" text={`${alerts?.counts?.shipmentDeadline || 0} ${isVi ? 'hạn giao hàng' : 'shipment deadlines'}`} />
            <Badge status="processing" text={`${alerts?.counts?.presentationDeadline || 0} ${isVi ? 'hạn xuất trình' : 'presentation deadlines'}`} />
            <Badge status="default" text={`${alerts?.counts?.invoiceDue || 0} ${isVi ? 'invoice đến hạn' : 'invoice dues'}`} />
          </Space>
          <Space wrap size={[4, 4]}>
            {(alerts?.notificationChannels || []).map((channel) => (
              <Tag key={channel.channel} color={channel.enabled ? 'blue' : 'default'} style={{ borderRadius: 6 }}>
                {channel.channel}: {channel.enabled ? 'on' : 'prepared'}
              </Tag>
            ))}
          </Space>
        </div>

        {(alerts?.nextActions || []).length > 0 ? (
          <Card className="lc-work-card" title={copy.nextActions} variant="borderless">
            <Table
              rowKey="_id"
              size="small"
              columns={deadlineColumns}
              dataSource={alerts?.nextActions || []}
              pagination={false}
              scroll={{ x: 860 }}
            />
          </Card>
        ) : (
          <Alert type="success" showIcon title={copy.noRisk} />
        )}
      </section>

      <Card
        className="lc-table-card"
        title={(
          <Space>
            <FileProtectOutlined />
            <span>{copy.lcRegister}</span>
          </Space>
        )}
        extra={(
          <Space wrap>
            <Input.Search
              allowClear
              value={searchText}
              placeholder={copy.searchPlaceholder}
              prefix={<SearchOutlined />}
              onChange={(event) => setSearchText(event.target.value)}
              onSearch={submitSearch}
              style={{ width: 340, maxWidth: '100%' }}
            />
            <Select
              allowClear
              value={statusFilter}
              placeholder={copy.allStatuses}
              suffixIcon={<FilterOutlined />}
              options={statusOptions}
              onChange={(value) => {
                setStatusFilter(value);
                setMeta((current) => ({ ...current, current: 1 }));
              }}
              style={{ width: 190 }}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                fetchData(meta.current, meta.pageSize, submittedSearch, statusFilter);
                fetchAlerts();
              }}
            >
              {copy.refresh}
            </Button>
          </Space>
        )}
      >
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="_id"
          bordered={false}
          locale={{
            emptyText: <Empty description={isVi ? 'Chưa có L/C' : 'No L/C records'} />,
          }}
          expandable={{
            onExpand: (expanded, record) => {
              if (expanded && record._id) fetchDiscrepancies(record._id);
            },
            expandedRowRender: (record) => (
              <Table
                rowKey="_id"
                size="small"
                columns={discrepancyColumns}
                dataSource={discrepanciesByLc[record._id] || []}
                pagination={false}
                locale={{
                  emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={isVi ? 'Không có discrepancy' : 'No discrepancies'} />,
                }}
              />
            ),
          }}
          pagination={{
            current: meta.current,
            pageSize: meta.pageSize,
            total: meta.total,
            showSizeChanger: true,
            onChange: (page, size) => setMeta((current) => ({ ...current, current: page, pageSize: size })),
          }}
          scroll={{ x: 1250 }}
        />
      </Card>

      <LCModal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        initialValues={selectedLC}
      />

      <Modal
        title={`${copy.discrepancyTitle} - ${selectedLC?.lcNumber || ''}`}
        open={isDiscrepancyOpen}
        onCancel={() => setIsDiscrepancyOpen(false)}
        onOk={() => discrepancyForm.submit()}
        okText={copy.submit}
        cancelText={copy.close}
        destroyOnHidden
      >
        <Form form={discrepancyForm} layout="vertical" onFinish={submitDiscrepancy}>
          <Form.Item label={copy.documentType} name="documentType">
            <Input placeholder="Commercial Invoice, B/L, C/O" />
          </Form.Item>
          <Form.Item label={copy.severity} name="severity" initialValue="MEDIUM" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'CRITICAL', label: 'Critical' },
              ]}
            />
          </Form.Item>
          <Form.Item label={copy.resolutionDue} name="dueDate">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={copy.description} name="description" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder={isVi ? 'VD: Invoice amount không khớp L/C, thiếu ký hậu B/L...' : 'e.g. Invoice amount does not match L/C, missing B/L endorsement...'} />
          </Form.Item>
        </Form>
      </Modal>

      <style jsx global>{`
        .lc-section {
          margin-bottom: 16px;
        }
        .lc-section-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 12px;
        }
        .lc-metric-card,
        .lc-work-card,
        .lc-table-card {
          border-radius: 8px;
          border: 1px solid ${isDark ? '#334155' : '#eef1f5'};
          background: ${isDark ? '#111827' : '#ffffff'};
          box-shadow: ${isDark ? 'none' : '0 8px 24px rgba(15, 23, 42, 0.04)'};
        }
        .lc-metric-card .ant-card-body {
          padding: 18px;
        }
        .lc-signal-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 12px 0;
          padding: 10px 12px;
          border: 1px solid ${isDark ? '#334155' : '#e8edf3'};
          border-radius: 8px;
          background: ${isDark ? '#0f172a' : '#fbfcfe'};
        }
        .lc-date-line {
          display: grid;
          grid-template-columns: 82px minmax(92px, 1fr) auto;
          align-items: center;
          gap: 8px;
        }
        .lc-table-card .ant-card-head,
        .lc-work-card .ant-card-head {
          border-bottom-color: ${isDark ? '#334155' : '#eef1f5'};
        }
        .lc-table-card .ant-table-thead > tr > th,
        .lc-work-card .ant-table-thead > tr > th {
          background: ${isDark ? '#172033' : '#f8fafc'} !important;
          color: ${isDark ? '#cbd5e1' : '#475569'} !important;
          font-weight: 700 !important;
          border-bottom: 1px solid ${isDark ? '#334155' : '#e8edf3'} !important;
        }
        .lc-table-card .ant-table-tbody > tr > td,
        .lc-work-card .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${isDark ? '#253047' : '#eef1f5'} !important;
        }
        @media (max-width: 768px) {
          .lc-section-heading,
          .lc-signal-row {
            flex-direction: column;
            align-items: stretch;
          }
          .lc-table-card .ant-card-extra {
            width: 100%;
            margin-top: 12px;
          }
        }
      `}</style>
    </>
  );
};

export default LCTable;
