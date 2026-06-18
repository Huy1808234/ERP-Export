'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Badge,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { TablePaginationConfig, UploadProps } from 'antd';
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  FileProtectOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  UploadOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { sendRequest, sendRequestFile } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import { formatMoneyStatic, formatVND } from '@/utils/format';

const { Text } = Typography;

type APStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'VOID';
type BatchStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED_LEVEL_1' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED';
type SettlementAuditType = 'SETTLEMENT' | 'REVERSAL';

interface IAccountPayable {
  _id: string;
  vendor?: { _id?: string; name?: string };
  vendorId: string;
  vendorInvoiceId?: string | null;
  invoiceNumber?: string | null;
  amount: number;
  paidAmount: number;
  currency: string;
  dueDate?: string | null;
  status: APStatus;
  isApprovedForPayment: boolean;
  approvedByUsername?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  voidedAt?: string | null;
  voidedByUsername?: string | null;
  voidReason?: string | null;
  note?: string | null;
}

interface IAccountPayableListResponse {
  results: IAccountPayable[];
  totalItems: number;
  totalPages: number;
  current: number;
  pageSize: number;
}

interface IPaymentBatchItem {
  _id: string;
  invoiceNumber?: string | null;
  amount: number;
  currency: string;
  vendor?: { name?: string };
  accountPayable?: IAccountPayable;
}

interface IPaymentBatch {
  _id: string;
  batchNumber: string;
  status: BatchStatus;
  currency: string;
  totalAmount: number;
  exchangeRate: number;
  totalAmountVnd: number;
  paymentDate?: string | null;
  paymentMethod?: string | null;
  bankReference?: string | null;
  bankProofFileId?: string | null;
  bankProofUrl?: string | null;
  bankTransferAt?: string | null;
  settlementNote?: string | null;
  createdByUsername: string;
  submittedByUsername?: string | null;
  firstApprovedByUsername?: string | null;
  finalApprovedByUsername?: string | null;
  rejectedByUsername?: string | null;
  paidByUsername?: string | null;
  paidAt?: string | null;
  rejectionReason?: string | null;
  note?: string | null;
  items?: IPaymentBatchItem[];
}

interface ISettlementAudit {
  _id: string;
  accountPayableId: string;
  paymentBatchId?: string | null;
  vendorInvoiceId?: string | null;
  invoiceNumber?: string | null;
  settlementDate: string;
  amount: number;
  amountVnd: number;
  exchangeRate: number;
  currency: string;
  paymentMethod?: string | null;
  bankReference?: string | null;
  bankProofUrl?: string | null;
  settlementNote?: string | null;
  auditType?: SettlementAuditType;
  reversedSettlementAudit_id?: string | null;
  reversedAt?: string | null;
  reversedByUsername?: string | null;
  reversalReason?: string | null;
  reversalJournalEntry_id?: string | null;
  settledByUsername: string;
  accountPayable?: IAccountPayable;
  paymentBatch?: Pick<IPaymentBatch, '_id' | 'batchNumber'>;
  vendor?: { name?: string };
}

interface ISettlementInvoiceTrail {
  key: string;
  accountPayableId: string;
  invoiceNumber?: string | null;
  vendorName?: string | null;
  currency: string;
  settledAmount: number;
  reversedAmount: number;
  netAmount: number;
  amountVnd: number;
  latestSettlementDate?: string | null;
  accountPayable?: IAccountPayable;
  audits: ISettlementAudit[];
}

const batchStatusColor: Record<BatchStatus, string> = {
  DRAFT: 'default',
  SUBMITTED: 'processing',
  APPROVED_LEVEL_1: 'blue',
  APPROVED: 'green',
  REJECTED: 'red',
  PAID: 'success',
  CANCELLED: 'default',
};

const formatAmount = (amount: number, currency = 'VND') => (
  currency === 'VND' ? formatVND(amount || 0) : formatMoneyStatic(amount || 0, currency)
);

const remainingAmount = (record: IAccountPayable) => (
  Math.max(Number(record.amount || 0) - Number(record.paidAmount || 0), 0)
);

const resolveFileUrl = (url?: string | null) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${process.env.NEXT_PUBLIC_BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const AccountPayablesPage = () => {
  const t = useTranslations('AccountPayables');
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const { message, modal } = App.useApp();
  const [batchForm] = Form.useForm();
  const [markPaidForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [rows, setRows] = useState<IAccountPayable[]>([]);
  const [apMeta, setApMeta] = useState({ current: 1, pageSize: 10, total: 0 });
  const [batches, setBatches] = useState<IPaymentBatch[]>([]);
  const [settlementAudits, setSettlementAudits] = useState<ISettlementAudit[]>([]);
  const [search, setSearch] = useState('');
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<IPaymentBatch | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const tableLocale = useMemo(() => ({ emptyText: t('empty.noData') }), [t]);
  const { current: apCurrent, pageSize: apPageSize } = apMeta;

  const apStatusText = useCallback((status: APStatus) => t(`status.${status}`), [t]);
  const batchStatusText = useCallback((status: BatchStatus) => t(`batchStatus.${status}`), [t]);

  const fetchRows = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<IAccountPayable[] | IAccountPayableListResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/account-payables`,
        method: 'GET',
        queryParams: {
          current: apCurrent,
          pageSize: apPageSize,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
        headers,
      });
      const data = res?.data;
      if (Array.isArray(data)) {
        setRows(data);
        setApMeta((prev) => ({ ...prev, total: data.length }));
      } else {
        const listData = data as IAccountPayableListResponse | undefined;
        setRows(listData?.results ?? []);
        setApMeta((prev) => ({
          ...prev,
          current: listData?.current ?? prev.current,
          pageSize: listData?.pageSize ?? prev.pageSize,
          total: listData?.totalItems ?? 0,
        }));
      }
    } finally {
      setLoading(false);
    }
  }, [apCurrent, apPageSize, headers, search]);

  const fetchBatches = useCallback(async () => {
    if (!headers) return;
    setBatchLoading(true);
    try {
      const res = await sendRequest<IBackendRes<IPaymentBatch[]>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/account-payables/payment-batches`,
        method: 'GET',
        headers,
      });
      setBatches(res?.data ?? []);
    } finally {
      setBatchLoading(false);
    }
  }, [headers]);

  const fetchSettlementAudits = useCallback(async () => {
    if (!headers) return;
    setAuditLoading(true);
    try {
      const res = await sendRequest<IBackendRes<ISettlementAudit[]>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/account-payables/settlement-audits`,
        method: 'GET',
        queryParams: { pageSize: 100 },
        headers,
      });
      setSettlementAudits(res?.data ?? []);
    } finally {
      setAuditLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchRows();
    fetchBatches();
    fetchSettlementAudits();
  }, [fetchRows, fetchBatches, fetchSettlementAudits]);

  const refreshAll = useCallback(() => {
    fetchRows();
    fetchBatches();
    fetchSettlementAudits();
  }, [fetchRows, fetchBatches, fetchSettlementAudits]);

  const handlePayableTableChange = useCallback((pagination: TablePaginationConfig) => {
    setApMeta((prev) => ({
      ...prev,
      current: pagination.current || 1,
      pageSize: pagination.pageSize || prev.pageSize,
    }));
  }, []);

  const selectedPayables = useMemo(() => (
    rows.filter((row) => (
      selectedRowKeys.includes(row._id)
      && row.status !== 'PAID'
      && row.status !== 'VOID'
      && remainingAmount(row) > 0
    ))
  ), [rows, selectedRowKeys]);

  const selectedBatchTotal = useMemo(() => (
    selectedPayables.reduce((sum, row) => sum + remainingAmount(row), 0)
  ), [selectedPayables]);

  const settlementInvoiceTrails = useMemo<ISettlementInvoiceTrail[]>(() => {
    const grouped = new Map<string, ISettlementInvoiceTrail>();

    settlementAudits.forEach((audit) => {
      const key = audit.accountPayableId || audit.vendorInvoiceId || audit._id;
      const current = grouped.get(key) || {
        key,
        accountPayableId: audit.accountPayableId,
        invoiceNumber: audit.invoiceNumber || audit.accountPayable?.invoiceNumber,
        vendorName: audit.vendor?.name || audit.accountPayable?.vendor?.name,
        currency: audit.currency || audit.accountPayable?.currency || 'VND',
        settledAmount: 0,
        reversedAmount: 0,
        netAmount: 0,
        amountVnd: 0,
        latestSettlementDate: audit.settlementDate,
        accountPayable: audit.accountPayable,
        audits: [],
      };

      const amount = Number(audit.amount || 0);
      if ((audit.auditType || 'SETTLEMENT') === 'REVERSAL' || amount < 0) {
        current.reversedAmount += Math.abs(amount);
      } else {
        current.settledAmount += amount;
      }
      current.netAmount += amount;
      current.amountVnd += Number(audit.amountVnd || 0);
      current.latestSettlementDate = !current.latestSettlementDate || dayjs(audit.settlementDate).isAfter(dayjs(current.latestSettlementDate))
        ? audit.settlementDate
        : current.latestSettlementDate;
      current.audits.push(audit);
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).map((item) => ({
      ...item,
      audits: item.audits.sort((left, right) => dayjs(right.settlementDate).valueOf() - dayjs(left.settlementDate).valueOf()),
    }));
  }, [settlementAudits]);

  const openBatchModal = () => {
    if (selectedPayables.length === 0) {
      message.warning(t('messages.selectOpenPayable'));
      return;
    }

    const currencies = new Set(selectedPayables.map((item) => item.currency || 'VND'));
    if (currencies.size > 1) {
      message.error(t('messages.sameCurrencyOnly'));
      return;
    }

    batchForm.resetFields();
    batchForm.setFieldsValue({
      paymentDate: dayjs(),
      paymentMethod: 'BANK_TRANSFER',
      exchangeRate: selectedPayables[0]?.currency === 'VND' ? 1 : undefined,
      bankReference: '',
      note: '',
    });
    setBatchModalOpen(true);
  };

  const createBatch = async () => {
    if (!headers) return;
    const values = await batchForm.validateFields();
    const payload = {
      ...values,
      paymentDate: values.paymentDate ? values.paymentDate.format('YYYY-MM-DD') : undefined,
      items: selectedPayables.map((item) => ({
        accountPayableId: item._id,
        amount: remainingAmount(item),
      })),
    };

    const res = await sendRequest<IBackendRes<IPaymentBatch>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/account-payables/payment-batches`,
      method: 'POST',
      body: payload,
      headers,
    });

    if (res?.data) {
      message.success(t('messages.batchCreateSuccess'));
      setBatchModalOpen(false);
      setSelectedRowKeys([]);
      batchForm.resetFields();
      refreshAll();
    } else {
      message.error(res?.message || t('messages.batchCreateError'));
    }
  };

  const handleUploadPaymentProof: NonNullable<UploadProps['customRequest']> = async (options) => {
    const { file, onSuccess, onError } = options;
    if (!headers) {
      const error = new Error(t('messages.missingAccessToken'));
      onError?.(error);
      return;
    }

    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await sendRequestFile<IBackendRes<{
        fileName: string;
        originalName: string;
        mimeType: string;
        size: number;
        url: string;
      }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/files/upload`,
        method: 'POST',
        queryParams: { folder: 'payments' },
        body: formData,
        headers,
      });

      if (!res?.data?.url) {
        throw new Error(res?.message || t('messages.uploadError'));
      }

      markPaidForm.setFieldsValue({
        bankProofFileId: res.data.fileName,
        bankProofUrl: res.data.url,
      });
      message.success(t('messages.uploadSuccess', { file: res.data.originalName || res.data.fileName }));
      onSuccess?.(res.data);
    } catch (error) {
      const uploadError = error instanceof Error ? error : new Error(t('messages.uploadError'));
      onError?.(uploadError);
      message.error(uploadError.message);
    } finally {
      setUploadingProof(false);
    }
  };

  const openMarkPaidModal = (batch: IPaymentBatch) => {
    setSelectedBatch(batch);
    markPaidForm.resetFields();
    markPaidForm.setFieldsValue({
      paymentDate: batch.paymentDate ? dayjs(batch.paymentDate) : dayjs(),
      bankTransferAt: batch.bankTransferAt ? dayjs(batch.bankTransferAt) : dayjs(),
      paymentMethod: batch.paymentMethod || 'BANK_TRANSFER',
      bankReference: batch.bankReference || '',
      bankProofFileId: batch.bankProofFileId || '',
      bankProofUrl: batch.bankProofUrl || '',
      exchangeRate: batch.exchangeRate || 1,
      settlementNote: batch.settlementNote || '',
      note: '',
    });
    setMarkPaidModalOpen(true);
  };

  const markSelectedBatchPaid = async () => {
    if (!headers || !selectedBatch) return;
    const values = await markPaidForm.validateFields();
    const payload = {
      ...values,
      paymentDate: values.paymentDate ? values.paymentDate.format('YYYY-MM-DD') : undefined,
      bankTransferAt: values.bankTransferAt ? values.bankTransferAt.toISOString() : undefined,
    };

    const res = await sendRequest<IBackendRes<IPaymentBatch>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/account-payables/payment-batches/${selectedBatch._id}/mark-paid`,
      method: 'PATCH',
      body: payload,
      headers,
    });

    if (res?.data) {
      message.success(t('messages.markPaidSuccess'));
      setMarkPaidModalOpen(false);
      setSelectedBatch(null);
      markPaidForm.resetFields();
      refreshAll();
    } else {
      message.error(res?.message || t('messages.markPaidError'));
    }
  };

  const reverseSettlementAudit = (audit: ISettlementAudit) => {
    if (!headers) return;
    if ((audit.auditType || 'SETTLEMENT') !== 'SETTLEMENT' || audit.reversedAt) return;

    modal.confirm({
      title: t('confirm.reverseTitle'),
      content: t('confirm.reverseContent', {
        invoice: audit.invoiceNumber || audit.accountPayableId,
        amount: formatAmount(audit.amount, audit.currency),
      }),
      okText: t('actions.reversePayment'),
      cancelText: t('actions.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        const res = await sendRequest<IBackendRes<ISettlementAudit>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/account-payables/settlement-audits/${audit._id}/reverse`,
          method: 'PATCH',
          body: {
            reason: `Reversed from AP settlement audit UI at ${dayjs().format('YYYY-MM-DD HH:mm')}`,
          },
          headers,
        });

        if (res?.data) {
          message.success(t('messages.reverseSuccess'));
          refreshAll();
        } else {
          message.error(res?.message || t('messages.reverseError'));
        }
      },
    });
  };

  const runBatchAction = async (batch: IPaymentBatch, action: 'submit' | 'approve' | 'reject') => {
    if (!headers) return;
    const body = action === 'reject'
      ? { reason: 'Rejected from AP payment batch screen' }
      : { note: `Action ${action} from AP payment batch screen` };

    const res = await sendRequest<IBackendRes<IPaymentBatch>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/account-payables/payment-batches/${batch._id}/${action}`,
      method: 'PATCH',
      body,
      headers,
    });

    if (res?.data) {
      message.success(t('messages.batchWorkflowSuccess'));
      refreshAll();
    } else {
      message.error(res?.message || t('messages.batchWorkflowError'));
    }
  };

  const confirmBatchAction = (batch: IPaymentBatch, action: 'submit' | 'approve' | 'reject') => {
    const titleMap = {
      submit: t('confirm.submitBatchTitle'),
      approve: t('confirm.approveBatchTitle'),
      reject: t('confirm.rejectBatchTitle'),
    };

    modal.confirm({
      title: titleMap[action],
      content: `${batch.batchNumber} - ${formatAmount(batch.totalAmount, batch.currency)}`,
      okText: action === 'reject' ? t('actions.reject') : t('actions.confirm'),
      cancelText: t('actions.cancel'),
      okButtonProps: { danger: action === 'reject' },
      onOk: () => runBatchAction(batch, action),
    });
  };

  const payableColumns = [
    {
      title: t('columns.invoice'),
      key: 'invoice',
      render: (_: unknown, record: IAccountPayable) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.invoiceNumber || record._id}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.vendor?.name || record.vendorId}</Text>
        </Space>
      ),
    },
    {
      title: t('columns.amount'),
      key: 'amount',
      align: 'right' as const,
      render: (_: unknown, record: IAccountPayable) => (
        <Space orientation="vertical" size={0} align="end">
          <Text strong>{formatAmount(record.amount, record.currency)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('labels.remaining', { amount: formatAmount(remainingAmount(record), record.currency) })}
          </Text>
        </Space>
      ),
    },
    {
      title: t('columns.dueDate'),
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (value?: string) => value ? dayjs(value).format('DD/MM/YYYY') : '-',
    },
    {
      title: t('columns.status'),
      key: 'status',
      render: (_: unknown, record: IAccountPayable) => (
        <Space orientation="vertical" size={4}>
          <Badge
            status={record.status === 'PAID' ? 'success' : record.status === 'PARTIAL' ? 'processing' : record.status === 'VOID' ? 'default' : 'warning'}
            text={apStatusText(record.status)}
          />
          {record.status === 'VOID' ? (
            <Tag color="default">{record.voidReason || '-'}</Tag>
          ) : record.isApprovedForPayment ? (
            <Tag color="green">{t('labels.approvedForPayment')}</Tag>
          ) : (
            <Tag color="orange">{t('labels.waitingPaymentApproval')}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('columns.approvedBy'),
      key: 'approvedBy',
      render: (_: unknown, record: IAccountPayable) => (
        record.approvedByUsername ? (
          <Space orientation="vertical" size={0}>
            <Text>{record.approvedByUsername}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.approvedAt ? dayjs(record.approvedAt).format('DD/MM/YYYY HH:mm') : ''}</Text>
          </Space>
        ) : '-'
      ),
    },
  ];

  const batchColumns = [
    {
      title: t('columns.batch'),
      key: 'batch',
      render: (_: unknown, record: IPaymentBatch) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.batchNumber}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('labels.createdBy', { username: record.createdByUsername })}
          </Text>
        </Space>
      ),
    },
    {
      title: t('columns.totalPayment'),
      key: 'total',
      align: 'right' as const,
      render: (_: unknown, record: IPaymentBatch) => (
        <Space orientation="vertical" size={0} align="end">
          <Text strong>{formatAmount(record.totalAmount, record.currency)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{formatVND(record.totalAmountVnd || 0)}</Text>
        </Space>
      ),
    },
    {
      title: t('columns.status'),
      key: 'status',
      render: (_: unknown, record: IPaymentBatch) => {
        return <Tag color={batchStatusColor[record.status]}>{batchStatusText(record.status)}</Tag>;
      },
    },
    {
      title: t('columns.approvalFlow'),
      key: 'approval',
      render: (_: unknown, record: IPaymentBatch) => (
        <Space orientation="vertical" size={2}>
          <Text type="secondary">{t('labels.submittedBy', { username: record.submittedByUsername || '-' })}</Text>
          <Text type="secondary">{t('labels.levelOneBy', { username: record.firstApprovedByUsername || '-' })}</Text>
          <Text type="secondary">{t('labels.finalBy', { username: record.finalApprovedByUsername || '-' })}</Text>
        </Space>
      ),
    },
    {
      title: t('columns.actions'),
      key: 'actions',
      align: 'right' as const,
      render: (_: unknown, record: IPaymentBatch) => (
        <Space wrap>
          <Button
            icon={<SendOutlined />}
            disabled={record.status !== 'DRAFT'}
            onClick={() => confirmBatchAction(record, 'submit')}
          >
            {t('actions.submit')}
          </Button>
          <Button
            type="primary"
            ghost
            icon={<CheckCircleOutlined />}
            disabled={!['SUBMITTED', 'APPROVED_LEVEL_1'].includes(record.status)}
            onClick={() => confirmBatchAction(record, 'approve')}
          >
            {t('actions.approve')}
          </Button>
          <Button
            danger
            disabled={!['SUBMITTED', 'APPROVED_LEVEL_1'].includes(record.status)}
            onClick={() => confirmBatchAction(record, 'reject')}
          >
            {t('actions.reject')}
          </Button>
          <Button
            type="primary"
            icon={<DollarOutlined />}
            disabled={record.status !== 'APPROVED'}
            onClick={() => openMarkPaidModal(record)}
          >
            {t('actions.recordPayment')}
          </Button>
        </Space>
      ),
    },
  ];

  const auditColumns = [
    {
      title: t('columns.invoice'),
      key: 'invoice',
      render: (_: unknown, record: ISettlementAudit) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.invoiceNumber || record.accountPayable?._id || record.accountPayableId}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.vendor?.name || record.accountPayable?.vendor?.name || record.vendorInvoiceId || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: t('columns.batch'),
      key: 'batch',
      render: (_: unknown, record: ISettlementAudit) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.paymentBatch?.batchNumber || record.paymentBatchId || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.settlementDate ? dayjs(record.settlementDate).format('DD/MM/YYYY HH:mm') : '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: t('columns.settlementAmount'),
      key: 'amount',
      align: 'right' as const,
      render: (_: unknown, record: ISettlementAudit) => (
        <Space orientation="vertical" size={0} align="end">
          <Text strong>{formatAmount(record.amount, record.currency)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{formatVND(record.amountVnd || 0)}</Text>
        </Space>
      ),
    },
    {
      title: t('columns.bank'),
      key: 'bank',
      render: (_: unknown, record: ISettlementAudit) => (
        <Space orientation="vertical" size={2}>
          <Text>{record.bankReference || '-'}</Text>
          {record.bankProofUrl ? (
            <Button
              size="small"
              type="link"
              icon={<FileProtectOutlined />}
              onClick={() => window.open(resolveFileUrl(record.bankProofUrl), '_blank', 'noopener,noreferrer')}
            >
              {t('actions.viewProof')}
            </Button>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>{t('empty.noFile')}</Text>
          )}
        </Space>
      ),
    },
    {
      title: t('columns.settledBy'),
      key: 'actor',
      render: (_: unknown, record: ISettlementAudit) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.settledByUsername}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.settlementNote || ''}</Text>
        </Space>
      ),
    },
  ];

  const settlementInvoiceColumns = [
    {
      title: t('columns.invoiceVendor'),
      key: 'invoice',
      render: (_: unknown, record: ISettlementInvoiceTrail) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.invoiceNumber || record.accountPayableId}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.vendorName || '-'}</Text>
        </Space>
      ),
    },
    {
      title: t('columns.currentAp'),
      key: 'currentAp',
      align: 'right' as const,
      render: (_: unknown, record: ISettlementInvoiceTrail) => (
        <Space orientation="vertical" size={0} align="end">
          <Text>{formatAmount(record.accountPayable?.paidAmount || 0, record.currency)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            / {formatAmount(record.accountPayable?.amount || 0, record.currency)}
          </Text>
        </Space>
      ),
    },
    {
      title: t('columns.settled'),
      key: 'settled',
      align: 'right' as const,
      render: (_: unknown, record: ISettlementInvoiceTrail) => (
        <Text type="success" strong>{formatAmount(record.settledAmount, record.currency)}</Text>
      ),
    },
    {
      title: t('columns.reversed'),
      key: 'reversed',
      align: 'right' as const,
      render: (_: unknown, record: ISettlementInvoiceTrail) => (
        <Text type={record.reversedAmount > 0 ? 'danger' : 'secondary'}>
          {formatAmount(record.reversedAmount, record.currency)}
        </Text>
      ),
    },
    {
      title: t('columns.netSettlement'),
      key: 'net',
      align: 'right' as const,
      render: (_: unknown, record: ISettlementInvoiceTrail) => (
        <Space orientation="vertical" size={0} align="end">
          <Text strong type={record.netAmount < 0 ? 'danger' : 'success'}>
            {formatAmount(record.netAmount, record.currency)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{formatVND(record.amountVnd || 0)}</Text>
        </Space>
      ),
    },
    {
      title: t('columns.latest'),
      key: 'latest',
      render: (_: unknown, record: ISettlementInvoiceTrail) => (
        record.latestSettlementDate ? dayjs(record.latestSettlementDate).format('DD/MM/YYYY HH:mm') : '-'
      ),
    },
  ];

  return (
    <AdminPageScroll>
      <Card variant="borderless" style={{ borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <PageHeader
            title={t('title')}
            icon={<WalletOutlined />}
            description={t('description')}
          />
          <Space orientation="horizontal">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder={t('actions.searchPlaceholder')}
              value={search}
              onChange={(event) => {
                setApMeta((prev) => ({ ...prev, current: 1 }));
                setSearch(event.target.value);
              }}
              style={{ width: 320 }}
            />
            <Button icon={<ReloadOutlined />} onClick={refreshAll}>
              {t('actions.reload')}
            </Button>
          </Space>
        </div>

        <Tabs
          defaultActiveKey="payables"
          items={[
            {
              key: 'payables',
              label: t('tabs.payables'),
              children: (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text type="secondary">
                      {t('selection.summary', {
                        count: selectedPayables.length,
                        amount: formatAmount(selectedBatchTotal, selectedPayables[0]?.currency || 'VND'),
                      })}
                    </Text>
                    <Button
                      type="primary"
                      icon={<ApartmentOutlined />}
                      disabled={selectedPayables.length === 0}
                      onClick={openBatchModal}
                    >
                      {t('actions.createBatch')}
                    </Button>
                  </div>
                  <Table<IAccountPayable>
                    columns={payableColumns}
                    dataSource={rows}
                    rowKey="_id"
                    loading={loading}
                    locale={tableLocale}
                    onChange={handlePayableTableChange}
                    rowSelection={{
                      selectedRowKeys,
                      onChange: (keys) => setSelectedRowKeys(keys),
                      getCheckboxProps: (record) => ({
                        disabled: record.status === 'PAID' || record.status === 'VOID' || remainingAmount(record) <= 0,
                      }),
                    }}
                    pagination={{
                      current: apMeta.current,
                      pageSize: apMeta.pageSize,
                      total: apMeta.total,
                      showSizeChanger: true,
                    }}
                  />
                </>
              ),
            },
            {
              key: 'batches',
              label: t('tabs.batches'),
              children: (
                <Table<IPaymentBatch>
                  columns={batchColumns}
                  dataSource={batches}
                  rowKey="_id"
                  loading={batchLoading}
                  locale={tableLocale}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  expandable={{
                    expandedRowRender: (record) => (
                      <Table<IPaymentBatchItem>
                        size="small"
                        rowKey={(item) => item._id}
                        pagination={false}
                        dataSource={record.items || []}
                        locale={tableLocale}
                        columns={[
                          {
                            title: t('columns.invoice'),
                            render: (_, item) => (
                              <Space orientation="vertical" size={0}>
                                <Text strong>{item.invoiceNumber || item.accountPayable?._id}</Text>
                                <Text type="secondary">{item.vendor?.name || item.accountPayable?.vendor?.name || '-'}</Text>
                              </Space>
                            ),
                          },
                          {
                            title: t('columns.paymentAmount'),
                            align: 'right' as const,
                            render: (_, item) => <Text strong>{formatAmount(item.amount, item.currency)}</Text>,
                          },
                        ]}
                      />
                    ),
                  }}
                />
              ),
            },
            {
              key: 'settlement-audit',
              label: t('tabs.settlementAudit'),
              children: (
                <Table<ISettlementInvoiceTrail>
                  columns={settlementInvoiceColumns}
                  dataSource={settlementInvoiceTrails}
                  rowKey="key"
                  loading={auditLoading}
                  locale={tableLocale}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  expandable={{
                    expandedRowRender: (record) => (
                      <Table<ISettlementAudit>
                        size="small"
                        rowKey="_id"
                        columns={[
                          ...auditColumns,
                          {
                            title: t('columns.reversalStatus'),
                            key: 'reversal',
                            align: 'right' as const,
                            render: (_: unknown, audit: ISettlementAudit) => {
                              const isReversal = (audit.auditType || 'SETTLEMENT') === 'REVERSAL' || Number(audit.amount || 0) < 0;
                              if (isReversal) {
                                return <Tag color="red">{t('labels.reversalFrom', { audit: audit.reversedSettlementAudit_id || '-' })}</Tag>;
                              }

                              return (
                                <Space orientation="vertical" size={2} align="end">
                                  {audit.reversedAt ? (
                                    <Tag color="default">{t('labels.reversedAt', { date: dayjs(audit.reversedAt).format('DD/MM/YYYY') })}</Tag>
                                  ) : (
                                    <Tag color="green">{t('labels.effective')}</Tag>
                                  )}
                                  <Button
                                    danger
                                    size="small"
                                    disabled={!!audit.reversedAt}
                                    onClick={() => reverseSettlementAudit(audit)}
                                  >
                                    {t('actions.reversePayment')}
                                  </Button>
                                </Space>
                              );
                            },
                          },
                        ]}
                        dataSource={record.audits}
                        pagination={false}
                        locale={tableLocale}
                      />
                    ),
                  }}
                />
              ),
            },
          ]}
        />

        {hasHydrated ? (
          <>
            <Modal
              width={720}
              title={t('modal.markPaidTitle')}
              open={markPaidModalOpen}
              onCancel={() => {
                setMarkPaidModalOpen(false);
                setSelectedBatch(null);
                markPaidForm.resetFields();
              }}
              onOk={markSelectedBatchPaid}
              okText={t('actions.markPaidAndAudit')}
              cancelText={t('actions.cancel')}
              forceRender
            >
              <Form form={markPaidForm} layout="vertical">
                <Form.Item label={t('columns.batch')}>
                  <Space orientation="vertical" size={0}>
                    <Text strong>{selectedBatch?.batchNumber}</Text>
                    <Text type="secondary">
                      {selectedBatch ? formatAmount(selectedBatch.totalAmount, selectedBatch.currency) : '-'}
                    </Text>
                  </Space>
                </Form.Item>

                <Space style={{ width: '100%' }} size={16} align="start">
                  <Form.Item
                    name="paymentDate"
                    label={t('form.paymentDate')}
                    rules={[{ required: true, message: t('validation.paymentDate') }]}
                    style={{ flex: 1 }}
                  >
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                  <Form.Item
                    name="bankTransferAt"
                    label={t('form.bankTransferAt')}
                    rules={[{ required: true, message: t('validation.bankTransferAt') }]}
                    style={{ flex: 1 }}
                  >
                    <DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" />
                  </Form.Item>
                </Space>

                <Space style={{ width: '100%' }} size={16} align="start">
                  <Form.Item
                    name="paymentMethod"
                    label={t('form.paymentMethod')}
                    rules={[{ required: true, message: t('validation.paymentMethod') }]}
                    style={{ flex: 1 }}
                  >
                    <Input placeholder="BANK_TRANSFER" />
                  </Form.Item>
                  <Form.Item name="exchangeRate" label={t('form.exchangeRate')} style={{ flex: 1 }}>
                    <InputNumber min={0.000001} style={{ width: '100%' }} />
                  </Form.Item>
                </Space>

                <Form.Item
                  name="bankReference"
                  label={t('form.bankReference')}
                  rules={[{ required: true, message: t('validation.bankReference') }]}
                >
                  <Input placeholder={t('form.bankReferencePlaceholder')} />
                </Form.Item>

                <Form.Item name="bankProofFileId" hidden>
                  <Input />
                </Form.Item>
                <Form.Item name="bankProofUrl" label={t('form.bankProofUrl')}>
                  <Input placeholder="/uploads/payments/..." />
                </Form.Item>
                <Space style={{ marginTop: -12, marginBottom: 16 }}>
                  <Upload customRequest={handleUploadPaymentProof} showUploadList={false} accept="image/*,.pdf">
                    <Button icon={<UploadOutlined />} loading={uploadingProof}>
                      {t('actions.uploadProof')}
                    </Button>
                  </Upload>
                  <Form.Item noStyle shouldUpdate={(prev, next) => prev.bankProofUrl !== next.bankProofUrl}>
                    {({ getFieldValue }) => {
                      const proofUrl = getFieldValue('bankProofUrl');
                      return proofUrl ? (
                        <Button
                          type="link"
                          icon={<FileProtectOutlined />}
                          onClick={() => window.open(resolveFileUrl(proofUrl), '_blank', 'noopener,noreferrer')}
                        >
                          {t('actions.viewFile')}
                        </Button>
                      ) : null;
                    }}
                  </Form.Item>
                </Space>

                <Form.Item name="settlementNote" label={t('form.settlementNote')}>
                  <Input.TextArea rows={3} placeholder={t('form.settlementNotePlaceholder')} />
                </Form.Item>
                <Form.Item name="note" label={t('form.accountingNote')}>
                  <Input.TextArea rows={2} placeholder={t('form.accountingNotePlaceholder')} />
                </Form.Item>
              </Form>
            </Modal>

            <Modal
              width={760}
              title={t('modal.createBatchTitle')}
              open={batchModalOpen}
              onCancel={() => {
                setBatchModalOpen(false);
                batchForm.resetFields();
              }}
              onOk={createBatch}
              okText={t('actions.createBatch')}
              cancelText={t('actions.cancel')}
              forceRender
            >
              <Form form={batchForm} layout="vertical">
                <Table<IAccountPayable>
                  size="small"
                  rowKey="_id"
                  pagination={false}
                  dataSource={selectedPayables}
                  locale={tableLocale}
                  columns={[
                    {
                      title: t('columns.invoice'),
                      render: (_, record) => (
                        <Space orientation="vertical" size={0}>
                          <Text strong>{record.invoiceNumber || record._id}</Text>
                          <Text type="secondary">{record.vendor?.name}</Text>
                        </Space>
                      ),
                    },
                    {
                      title: t('columns.remainingAmount'),
                      align: 'right' as const,
                      render: (_, record) => <Text strong>{formatAmount(remainingAmount(record), record.currency)}</Text>,
                    },
                  ]}
                  style={{ marginBottom: 16 }}
                />

                <Space style={{ width: '100%' }} size={16} align="start">
                  <Form.Item name="paymentDate" label={t('form.plannedPaymentDate')} style={{ flex: 1 }}>
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                  <Form.Item name="paymentMethod" label={t('form.paymentMethod')} style={{ flex: 1 }}>
                    <Input placeholder="BANK_TRANSFER" />
                  </Form.Item>
                  <Form.Item name="exchangeRate" label={t('form.exchangeRate')} style={{ flex: 1 }}>
                    <InputNumber min={0.000001} style={{ width: '100%' }} />
                  </Form.Item>
                </Space>

                <Form.Item name="bankReference" label={t('form.bankReference')}>
                  <Input placeholder={t('form.batchBankReferencePlaceholder')} />
                </Form.Item>
                <Form.Item name="note" label={t('form.note')}>
                  <Input.TextArea rows={3} placeholder={t('form.batchNotePlaceholder')} />
                </Form.Item>
              </Form>
            </Modal>
          </>
        ) : null}
      </Card>
    </AdminPageScroll>
  );
};

export default AccountPayablesPage;
