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
import dayjs from 'dayjs';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { sendRequest, sendRequestFile } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import { formatMoneyStatic, formatVND } from '@/utils/format';

const { Text } = Typography;

type APStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
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
  note?: string | null;
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

const batchStatusMeta: Record<BatchStatus, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: 'Nháp' },
  SUBMITTED: { color: 'processing', label: 'Chờ duyệt' },
  APPROVED_LEVEL_1: { color: 'blue', label: 'Đã duyệt cấp 1' },
  APPROVED: { color: 'green', label: 'Đã duyệt chi' },
  REJECTED: { color: 'red', label: 'Từ chối' },
  PAID: { color: 'success', label: 'Đã chi tiền' },
  CANCELLED: { color: 'default', label: 'Đã hủy' },
};

const statusLabel: Record<APStatus, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIAL: 'Thanh toán một phần',
  PAID: 'Đã thanh toán',
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
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const { message, modal } = App.useApp();
  const [paymentForm] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [markPaidForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [rows, setRows] = useState<IAccountPayable[]>([]);
  const [batches, setBatches] = useState<IPaymentBatch[]>([]);
  const [settlementAudits, setSettlementAudits] = useState<ISettlementAudit[]>([]);
  const [search, setSearch] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<IAccountPayable | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<IPaymentBatch | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const fetchRows = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<IAccountPayable[]>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/account-payables`,
        method: 'GET',
        headers,
      });
      setRows(res?.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [headers]);

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

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;

    return rows.filter((row) => (
      row.invoiceNumber?.toLowerCase().includes(keyword)
      || row.vendor?.name?.toLowerCase().includes(keyword)
      || row._id.toLowerCase().includes(keyword)
    ));
  }, [rows, search]);

  const selectedPayables = useMemo(() => (
    rows.filter((row) => selectedRowKeys.includes(row._id) && row.status !== 'PAID' && remainingAmount(row) > 0)
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

  const approvePayment = async (record: IAccountPayable) => {
    if (!headers) return;
    const res = await sendRequest<IBackendRes<IAccountPayable>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/account-payables/${record._id}/approve-payment`,
      method: 'PATCH',
      body: { note: `Approved from admin AP page at ${dayjs().format('YYYY-MM-DD HH:mm')}` },
      headers,
    });

    if (res?.data) {
      message.success('Đã duyệt thanh toán công nợ');
      refreshAll();
    } else {
      message.error(res?.message || 'Không duyệt được công nợ');
    }
  };

  const openPaymentModal = (record: IAccountPayable) => {
    setSelectedPayable(record);
    paymentForm.setFieldsValue({
      amount: remainingAmount(record),
      note: '',
    });
    setPaymentModalOpen(true);
  };

  const recordPayment = async () => {
    if (!headers || !selectedPayable) return;
    const values = await paymentForm.validateFields();
    const res = await sendRequest<IBackendRes<IAccountPayable>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/account-payables/${selectedPayable._id}/record-payment`,
      method: 'PATCH',
      body: values,
      headers,
    });

    if (res?.data) {
      message.success('Đã ghi nhận thanh toán AP');
      setPaymentModalOpen(false);
      setSelectedPayable(null);
      paymentForm.resetFields();
      refreshAll();
    } else {
      message.error(res?.message || 'Không ghi nhận được thanh toán');
    }
  };

  const openBatchModal = () => {
    if (selectedPayables.length === 0) {
      message.warning('Chọn ít nhất một công nợ còn mở để tạo batch');
      return;
    }

    const currencies = new Set(selectedPayables.map((item) => item.currency || 'VND'));
    if (currencies.size > 1) {
      message.error('Một batch chỉ gom các công nợ cùng loại tiền');
      return;
    }

    batchForm.setFieldsValue({
      paymentDate: dayjs(),
      paymentMethod: 'BANK_TRANSFER',
      exchangeRate: selectedPayables[0]?.currency === 'VND' ? 1 : undefined,
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
      message.success('Đã tạo batch thanh toán AP');
      setBatchModalOpen(false);
      setSelectedRowKeys([]);
      batchForm.resetFields();
      refreshAll();
    } else {
      message.error(res?.message || 'Không tạo được batch thanh toán');
    }
  };

  const handleUploadPaymentProof = async (options: any) => {
    const { file, onSuccess, onError } = options;
    if (!headers) {
      const error = new Error('Missing access token');
      onError?.(error);
      return;
    }

    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append('file', file as File);

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
        throw new Error(res?.message || 'Upload chứng từ thanh toán thất bại');
      }

      markPaidForm.setFieldsValue({
        bankProofFileId: res.data.fileName,
        bankProofUrl: res.data.url,
      });
      message.success(`Đã upload ${res.data.originalName || res.data.fileName}`);
      onSuccess?.(res.data);
    } catch (error) {
      onError?.(error);
      message.error(error instanceof Error ? error.message : 'Upload chứng từ thanh toán thất bại');
    } finally {
      setUploadingProof(false);
    }
  };

  const openMarkPaidModal = (batch: IPaymentBatch) => {
    setSelectedBatch(batch);
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
      message.success('Đã ghi chi batch và tạo settlement audit');
      setMarkPaidModalOpen(false);
      setSelectedBatch(null);
      markPaidForm.resetFields();
      refreshAll();
    } else {
      message.error(res?.message || 'Không ghi chi được batch');
    }
  };

  const reverseSettlementAudit = (audit: ISettlementAudit) => {
    if (!headers) return;
    if ((audit.auditType || 'SETTLEMENT') !== 'SETTLEMENT' || audit.reversedAt) return;

    modal.confirm({
      title: 'Đảo thanh toán AP?',
      content: `${audit.invoiceNumber || audit.accountPayableId} - ${formatAmount(audit.amount, audit.currency)}. Hệ thống sẽ giảm paidAmount, mở lại AP nếu cần và tạo bút toán đảo.`,
      okText: 'Đảo thanh toán',
      cancelText: 'Hủy',
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
          message.success('Đã đảo thanh toán và ghi audit reversal');
          refreshAll();
        } else {
          message.error(res?.message || 'Không đảo được thanh toán');
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
      message.success('Đã cập nhật batch thanh toán');
      refreshAll();
    } else {
      message.error(res?.message || 'Không cập nhật được batch');
    }
  };

  const confirmBatchAction = (batch: IPaymentBatch, action: 'submit' | 'approve' | 'reject') => {
    const titleMap = {
      submit: 'Gửi duyệt batch?',
      approve: 'Duyệt batch thanh toán?',
      reject: 'Từ chối batch thanh toán?',
    };

    modal.confirm({
      title: titleMap[action],
      content: `${batch.batchNumber} - ${formatAmount(batch.totalAmount, batch.currency)}`,
      okText: action === 'reject' ? 'Từ chối' : 'Xác nhận',
      cancelText: 'Hủy',
      okButtonProps: { danger: action === 'reject' },
      onOk: () => runBatchAction(batch, action),
    });
  };

  const payableColumns = [
    {
      title: 'Hóa đơn',
      key: 'invoice',
      render: (_: unknown, record: IAccountPayable) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.invoiceNumber || record._id}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.vendor?.name || record.vendorId}</Text>
        </Space>
      ),
    },
    {
      title: 'Giá trị',
      key: 'amount',
      align: 'right' as const,
      render: (_: unknown, record: IAccountPayable) => (
        <Space orientation="vertical" size={0} align="end">
          <Text strong>{formatAmount(record.amount, record.currency)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Còn lại: {formatAmount(remainingAmount(record), record.currency)}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Hạn trả',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (value?: string) => value ? dayjs(value).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_: unknown, record: IAccountPayable) => (
        <Space orientation="vertical" size={4}>
          <Badge
            status={record.status === 'PAID' ? 'success' : record.status === 'PARTIAL' ? 'processing' : 'warning'}
            text={statusLabel[record.status]}
          />
          {record.isApprovedForPayment ? (
            <Tag color="green">Đã duyệt chi</Tag>
          ) : (
            <Tag color="orange">Chờ duyệt chi</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Người duyệt',
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
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right' as const,
      render: (_: unknown, record: IAccountPayable) => (
        <Space>
          <Button
            type="primary"
            ghost
            icon={<CheckCircleOutlined />}
            disabled={record.status === 'PAID' || record.isApprovedForPayment}
            onClick={() => approvePayment(record)}
          >
            Duyệt chi
          </Button>
          <Button
            icon={<DollarOutlined />}
            disabled={record.status === 'PAID' || !record.isApprovedForPayment}
            onClick={() => openPaymentModal(record)}
          >
            Ghi chi
          </Button>
        </Space>
      ),
    },
  ];

  const batchColumns = [
    {
      title: 'Batch',
      key: 'batch',
      render: (_: unknown, record: IPaymentBatch) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.batchNumber}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Tạo bởi {record.createdByUsername}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Tổng chi',
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
      title: 'Trạng thái',
      key: 'status',
      render: (_: unknown, record: IPaymentBatch) => {
        const meta = batchStatusMeta[record.status];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Luồng duyệt',
      key: 'approval',
      render: (_: unknown, record: IPaymentBatch) => (
        <Space orientation="vertical" size={2}>
          <Text type="secondary">Gửi: {record.submittedByUsername || '-'}</Text>
          <Text type="secondary">Cấp 1: {record.firstApprovedByUsername || '-'}</Text>
          <Text type="secondary">Cuối: {record.finalApprovedByUsername || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right' as const,
      render: (_: unknown, record: IPaymentBatch) => (
        <Space wrap>
          <Button
            icon={<SendOutlined />}
            disabled={record.status !== 'DRAFT'}
            onClick={() => confirmBatchAction(record, 'submit')}
          >
            Gửi duyệt
          </Button>
          <Button
            type="primary"
            ghost
            icon={<CheckCircleOutlined />}
            disabled={!['SUBMITTED', 'APPROVED_LEVEL_1'].includes(record.status)}
            onClick={() => confirmBatchAction(record, 'approve')}
          >
            Duyệt
          </Button>
          <Button
            danger
            disabled={!['SUBMITTED', 'APPROVED_LEVEL_1'].includes(record.status)}
            onClick={() => confirmBatchAction(record, 'reject')}
          >
            Từ chối
          </Button>
          <Button
            type="primary"
            icon={<DollarOutlined />}
            disabled={record.status !== 'APPROVED'}
            onClick={() => openMarkPaidModal(record)}
          >
            Ghi chi
          </Button>
        </Space>
      ),
    },
  ];

  const auditColumns = [
    {
      title: 'Invoice',
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
      title: 'Batch',
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
      title: 'Số tiền tất toán',
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
      title: 'Ngân hàng',
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
              Xem chứng từ
            </Button>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>Chưa có file</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Người ghi chi',
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
      title: 'Invoice / Vendor',
      key: 'invoice',
      render: (_: unknown, record: ISettlementInvoiceTrail) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.invoiceNumber || record.accountPayableId}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.vendorName || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'AP hiện tại',
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
      title: 'Đã tất toán',
      key: 'settled',
      align: 'right' as const,
      render: (_: unknown, record: ISettlementInvoiceTrail) => (
        <Text type="success" strong>{formatAmount(record.settledAmount, record.currency)}</Text>
      ),
    },
    {
      title: 'Đã đảo',
      key: 'reversed',
      align: 'right' as const,
      render: (_: unknown, record: ISettlementInvoiceTrail) => (
        <Text type={record.reversedAmount > 0 ? 'danger' : 'secondary'}>
          {formatAmount(record.reversedAmount, record.currency)}
        </Text>
      ),
    },
    {
      title: 'Net settlement',
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
      title: 'Lần cuối',
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
            title="Công nợ phải trả NCC"
            icon={<WalletOutlined />}
            description="Theo dõi AP, gom batch thanh toán và hạch toán chi tiền nhà cung cấp"
          />
          <Space orientation="horizontal">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Tìm hóa đơn hoặc nhà cung cấp"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ width: 320 }}
            />
            <Button icon={<ReloadOutlined />} onClick={refreshAll}>
              Tải lại
            </Button>
          </Space>
        </div>

        <Tabs
          defaultActiveKey="payables"
          items={[
            {
              key: 'payables',
              label: 'Công nợ AP',
              children: (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text type="secondary">
                      Đã chọn {selectedPayables.length} dòng, tổng {formatAmount(selectedBatchTotal, selectedPayables[0]?.currency || 'VND')}
                    </Text>
                    <Button
                      type="primary"
                      icon={<ApartmentOutlined />}
                      disabled={selectedPayables.length === 0}
                      onClick={openBatchModal}
                    >
                      Tạo batch chi
                    </Button>
                  </div>
                  <Table<IAccountPayable>
                    columns={payableColumns}
                    dataSource={filteredRows}
                    rowKey="_id"
                    loading={loading}
                    rowSelection={{
                      selectedRowKeys,
                      onChange: (keys) => setSelectedRowKeys(keys),
                      getCheckboxProps: (record) => ({
                        disabled: record.status === 'PAID' || remainingAmount(record) <= 0,
                      }),
                    }}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                  />
                </>
              ),
            },
            {
              key: 'batches',
              label: 'Batch thanh toán',
              children: (
                <Table<IPaymentBatch>
                  columns={batchColumns}
                  dataSource={batches}
                  rowKey="_id"
                  loading={batchLoading}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  expandable={{
                    expandedRowRender: (record) => (
                      <Table<IPaymentBatchItem>
                        size="small"
                        rowKey={(item) => item._id}
                        pagination={false}
                        dataSource={record.items || []}
                        columns={[
                          {
                            title: 'Hóa đơn',
                            render: (_, item) => (
                              <Space orientation="vertical" size={0}>
                                <Text strong>{item.invoiceNumber || item.accountPayable?._id}</Text>
                                <Text type="secondary">{item.vendor?.name || item.accountPayable?.vendor?.name || '-'}</Text>
                              </Space>
                            ),
                          },
                          {
                            title: 'Số tiền chi',
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
              label: 'Audit tất toán',
              children: (
                <Table<ISettlementInvoiceTrail>
                  columns={settlementInvoiceColumns}
                  dataSource={settlementInvoiceTrails}
                  rowKey="key"
                  loading={auditLoading}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  expandable={{
                    expandedRowRender: (record) => (
                      <Table<ISettlementAudit>
                        size="small"
                        rowKey="_id"
                        columns={[
                          ...auditColumns,
                          {
                            title: 'Trạng thái đảo',
                            key: 'reversal',
                            align: 'right' as const,
                            render: (_: unknown, audit: ISettlementAudit) => {
                              const isReversal = (audit.auditType || 'SETTLEMENT') === 'REVERSAL' || Number(audit.amount || 0) < 0;
                              if (isReversal) {
                                return <Tag color="red">Đảo từ {audit.reversedSettlementAudit_id || '-'}</Tag>;
                              }

                              return (
                                <Space orientation="vertical" size={2} align="end">
                                  {audit.reversedAt ? (
                                    <Tag color="default">Đã đảo {dayjs(audit.reversedAt).format('DD/MM/YYYY')}</Tag>
                                  ) : (
                                    <Tag color="green">Còn hiệu lực</Tag>
                                  )}
                                  <Button
                                    danger
                                    size="small"
                                    disabled={!!audit.reversedAt}
                                    onClick={() => reverseSettlementAudit(audit)}
                                  >
                                    Đảo thanh toán
                                  </Button>
                                </Space>
                              );
                            },
                          },
                        ]}
                        dataSource={record.audits}
                        pagination={false}
                      />
                    ),
                  }}
                />
              ),
            },
          ]}
        />

        <Modal
          title="Ghi nhận thanh toán AP"
          open={paymentModalOpen}
          onCancel={() => setPaymentModalOpen(false)}
          onOk={recordPayment}
          okText="Ghi nhận"
          destroyOnHidden
        >
          <Form form={paymentForm} layout="vertical">
            <Form.Item label="Hóa đơn">
              <Space orientation="vertical" size={0}>
                <Text strong>{selectedPayable?.invoiceNumber || selectedPayable?._id}</Text>
                <Text type="secondary">{selectedPayable?.vendor?.name}</Text>
              </Space>
            </Form.Item>
            <Form.Item
              name="amount"
              label="Số tiền thanh toán"
              rules={[{ required: true, message: 'Nhập số tiền thanh toán' }]}
            >
              <InputNumber
                min={1}
                max={selectedPayable ? remainingAmount(selectedPayable) : undefined}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="note" label="Ghi chú">
              <Input.TextArea rows={3} placeholder="Số lệnh chi, chứng từ ngân hàng, ghi chú nội bộ..." />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          width={720}
          title="Ghi chi batch AP"
          open={markPaidModalOpen}
          onCancel={() => {
            setMarkPaidModalOpen(false);
            setSelectedBatch(null);
          }}
          onOk={markSelectedBatchPaid}
          okText="Ghi chi & tạo audit"
          destroyOnHidden
        >
          <Form form={markPaidForm} layout="vertical">
            <Form.Item label="Batch">
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
                label="Ngày ghi chi"
                rules={[{ required: true, message: 'Chọn ngày ghi chi' }]}
                style={{ flex: 1 }}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item
                name="bankTransferAt"
                label="Thời điểm ngân hàng"
                rules={[{ required: true, message: 'Chọn thời điểm chuyển tiền' }]}
                style={{ flex: 1 }}
              >
                <DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" />
              </Form.Item>
            </Space>

            <Space style={{ width: '100%' }} size={16} align="start">
              <Form.Item
                name="paymentMethod"
                label="Phương thức"
                rules={[{ required: true, message: 'Nhập phương thức thanh toán' }]}
                style={{ flex: 1 }}
              >
                <Input placeholder="BANK_TRANSFER" />
              </Form.Item>
              <Form.Item name="exchangeRate" label="Tỷ giá" style={{ flex: 1 }}>
                <InputNumber min={0.000001} style={{ width: '100%' }} />
              </Form.Item>
            </Space>

            <Form.Item
              name="bankReference"
              label="Số tham chiếu ngân hàng"
              rules={[{ required: true, message: 'Nhập số giao dịch/ủy nhiệm chi' }]}
            >
              <Input placeholder="Mã giao dịch ngân hàng hoặc số ủy nhiệm chi" />
            </Form.Item>

            <Form.Item name="bankProofFileId" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="bankProofUrl" label="File chứng từ ngân hàng">
              <Input placeholder="/uploads/payments/..." />
            </Form.Item>
            <Space style={{ marginTop: -12, marginBottom: 16 }}>
              <Upload customRequest={handleUploadPaymentProof} showUploadList={false} accept="image/*,.pdf">
                <Button icon={<UploadOutlined />} loading={uploadingProof}>
                  Upload chứng từ
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
                      Xem file
                    </Button>
                  ) : null;
                }}
              </Form.Item>
            </Space>

            <Form.Item name="settlementNote" label="Ghi chú tất toán">
              <Input.TextArea rows={3} placeholder="Nội dung chuyển khoản, invoice được tất toán, ghi chú kiểm soát..." />
            </Form.Item>
            <Form.Item name="note" label="Ghi chú hạch toán">
              <Input.TextArea rows={2} placeholder="Ghi chú bổ sung đưa vào batch" />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          width={760}
          title="Tạo batch thanh toán AP"
          open={batchModalOpen}
          onCancel={() => setBatchModalOpen(false)}
          onOk={createBatch}
          okText="Tạo batch"
          destroyOnHidden
        >
          <Form form={batchForm} layout="vertical">
            <Table<IAccountPayable>
              size="small"
              rowKey="_id"
              pagination={false}
              dataSource={selectedPayables}
              columns={[
                {
                  title: 'Hóa đơn',
                  render: (_, record) => (
                    <Space orientation="vertical" size={0}>
                      <Text strong>{record.invoiceNumber || record._id}</Text>
                      <Text type="secondary">{record.vendor?.name}</Text>
                    </Space>
                  ),
                },
                {
                  title: 'Còn lại',
                  align: 'right' as const,
                  render: (_, record) => <Text strong>{formatAmount(remainingAmount(record), record.currency)}</Text>,
                },
              ]}
              style={{ marginBottom: 16 }}
            />

            <Space style={{ width: '100%' }} size={16} align="start">
              <Form.Item name="paymentDate" label="Ngày dự kiến chi" style={{ flex: 1 }}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item name="paymentMethod" label="Phương thức" style={{ flex: 1 }}>
                <Input placeholder="BANK_TRANSFER" />
              </Form.Item>
              <Form.Item name="exchangeRate" label="Tỷ giá" style={{ flex: 1 }}>
                <InputNumber min={0.000001} style={{ width: '100%' }} />
              </Form.Item>
            </Space>

            <Form.Item name="bankReference" label="Số tham chiếu ngân hàng">
              <Input placeholder="Ủy nhiệm chi / số giao dịch ngân hàng" />
            </Form.Item>
            <Form.Item name="note" label="Ghi chú">
              <Input.TextArea rows={3} placeholder="Lý do chi, nhóm hóa đơn, lưu ý phê duyệt..." />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </AdminPageScroll>
  );
};

export default AccountPayablesPage;
