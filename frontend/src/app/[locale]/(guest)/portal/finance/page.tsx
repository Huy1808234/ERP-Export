'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  DownloadOutlined,
  DollarOutlined,
  FileDoneOutlined,
  FilePdfOutlined,
  InboxOutlined,
  ReloadOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import dayjs, { type Dayjs } from 'dayjs';
import PageBanner from '@/components/guest/PageBanner';
import { getAccessToken } from '@/lib/auth-token';
import { backendFetch, sendRequest } from '@/lib/api-client';

const { Text } = Typography;
const { Dragger } = Upload;

type StatementLine = {
  _id: string;
  invoiceNumber: string;
  salesContractId?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  amountForeign: number;
  paidAmountForeign: number;
  openAmountForeign: number;
  currency: string;
  exchangeRate?: number;
  amountVnd?: number;
  paidAmountVnd?: number;
  openAmountVnd?: number;
  status: string;
  pdfUrl?: string | null;
};

type PaymentReceipt = {
  _id: string;
  receiptNumber: string;
  receiptType: 'TT_ADVANCE' | 'TT_BALANCE' | 'SWIFT' | 'VIETQR';
  amount: number;
  currency: string;
  exchangeRate?: number;
  status: string;
  accountReceivableId?: string | null;
  bankReference?: string | null;
  submittedAt: string;
  rejectionReason?: string | null;
  accountReceivable?: {
    _id: string;
    invoiceNumber?: string | null;
    currency?: string | null;
  } | null;
  fileAsset?: {
    originalName?: string | null;
    url?: string | null;
  } | null;
};

type PortalStatement = {
  generatedAt: string;
  summary: {
    totalForeign: number;
    paidForeign: number;
    openForeign: number;
    totalVnd: number;
    paidVnd: number;
    openVnd: number;
    openInvoiceCount: number;
    pendingReceiptCount: number;
  };
  lines: StatementLine[];
  receipts: PaymentReceipt[];
};

type FileAssetResponse = {
  _id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
};

type ReceiptFormValues = {
  receiptType: 'TT_ADVANCE' | 'TT_BALANCE';
  accountReceivableId?: string;
  salesContractId?: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  bankReference?: string;
  remittingBank?: string;
  transactionDate?: Dayjs;
  note?: string;
};

const statusMeta: Record<string, { color: string; background: string; text: string; icon?: React.ReactNode }> = {
  UNPAID: { color: '#d97706', background: 'rgba(217,119,6,.16)', text: 'UNPAID', icon: <ClockCircleOutlined /> },
  PARTIAL: { color: '#2563eb', background: 'rgba(37,99,235,.16)', text: 'PARTIAL', icon: <ClockCircleOutlined /> },
  PAID: { color: '#16a34a', background: 'rgba(22,163,74,.16)', text: 'PAID', icon: <CheckCircleOutlined /> },
  OVERDUE: { color: '#dc2626', background: 'rgba(220,38,38,.16)', text: 'OVERDUE', icon: <WarningOutlined /> },
  SUBMITTED: { color: '#f59e0b', background: 'rgba(245,158,11,.18)', text: 'SUBMITTED', icon: <ClockCircleOutlined /> },
  CONFIRMED: { color: '#22c55e', background: 'rgba(34,197,94,.18)', text: 'CONFIRMED', icon: <CheckCircleOutlined /> },
  REJECTED: { color: '#ef4444', background: 'rgba(239,68,68,.18)', text: 'REJECTED', icon: <WarningOutlined /> },
};

const money = (value: number, currency = 'USD') => (
  `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
);

const renderStatusTag = (status?: string | null) => {
  const meta = statusMeta[status || ''] || {
    color: '#94a3b8',
    background: 'rgba(148,163,184,.16)',
    text: status || '-',
  };

  return (
    <Tag
      icon={meta.icon}
      style={{
        marginInlineEnd: 0,
        borderRadius: 999,
        borderColor: `${meta.color}55`,
        color: meta.color,
        background: meta.background,
        fontWeight: 800,
      }}
    >
      {meta.text}
    </Tag>
  );
};

const hasOpenBalance = (line: StatementLine): boolean => (
  line.status !== 'PAID' && line.status !== 'CANCELLED' && Number(line.openAmountForeign || 0) > 0
);

export default function FinancePortal() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const [form] = Form.useForm<ReceiptFormValues>();
  const [statement, setStatement] = useState<PortalStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const selectedAccountReceivableId = Form.useWatch('accountReceivableId', form);

  const statementLines = useMemo(() => statement?.lines || [], [statement?.lines]);
  const paymentReceipts = useMemo(() => statement?.receipts || [], [statement?.receipts]);
  const unallocatedReceipts = useMemo(() => (
    paymentReceipts.filter((receipt) => !receipt.accountReceivableId)
  ), [paymentReceipts]);
  const selectedLine = useMemo(() => (
    statementLines.find((line) => line._id === selectedAccountReceivableId) || null
  ), [selectedAccountReceivableId, statementLines]);
  const statementCurrency = useMemo(() => {
    const currencies = Array.from(
      new Set(statementLines.map((line) => line.currency).filter(Boolean)),
    );
    return currencies.length === 1 ? currencies[0] : 'FCY';
  }, [statementLines]);

  const fetchStatement = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<PortalStatement>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/finance/statement`,
        method: 'GET',
        headers,
      });
      setStatement(res?.data || null);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  const uploadReceiptFile = async (file: File): Promise<FileAssetResponse> => {
    if (!accessToken) throw new Error('Missing access token');
    const body = new FormData();
    body.append('file', file);

    const response = await backendFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/files/upload?folder=payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });
    const payload = await response.json() as IBackendRes<FileAssetResponse>;
    if (!response.ok || !payload?.data?._id) {
      throw new Error(String(payload?.message || 'Receipt upload failed'));
    }

    return payload.data;
  };

  const submitReceipt = async (values: ReceiptFormValues) => {
    if (!headers || !receiptFile) {
      message.warning('Please attach the T/T receipt or Swift MT103 file.');
      return;
    }
    const targetLine = statementLines.find((line) => line._id === values.accountReceivableId) || null;
    if (!targetLine) {
      message.warning('Please select an open invoice to allocate this T/T receipt.');
      return;
    }
    if (!hasOpenBalance(targetLine)) {
      message.warning('This invoice is already fully paid.');
      return;
    }
    const amount = Number(values.amount || 0);
    if (amount <= 0 || amount > Number(targetLine.openAmountForeign || 0)) {
      message.warning(`Amount must be within the open balance ${money(targetLine.openAmountForeign, targetLine.currency)}.`);
      return;
    }
    const bankReference = values.bankReference?.trim();
    if (!bankReference) {
      message.warning('Bank reference is required for T/T reconciliation.');
      return;
    }
    const duplicateReceipt = paymentReceipts.find((receipt) => (
      ['SUBMITTED', 'CONFIRMED'].includes(receipt.status) &&
      receipt.bankReference?.trim().toUpperCase() === bankReference.toUpperCase()
    ));
    if (duplicateReceipt) {
      message.warning(`Bank reference already exists on ${duplicateReceipt.receiptNumber}.`);
      return;
    }
    const pendingSameInvoiceAmount = paymentReceipts.find((receipt) => (
      receipt.status === 'SUBMITTED' &&
      receipt.accountReceivableId === targetLine._id &&
      Number(receipt.amount || 0) === amount &&
      receipt.currency === targetLine.currency
    ));
    if (pendingSameInvoiceAmount) {
      message.warning(`A matching receipt ${pendingSameInvoiceAmount.receiptNumber} is already waiting for review.`);
      return;
    }

    setSubmitting(true);
    try {
      const uploaded = await uploadReceiptFile(receiptFile);
      const res = await sendRequest<IBackendRes<PaymentReceipt>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/finance/tt-receipts`,
        method: 'POST',
        headers,
        body: {
          ...values,
          amount,
          currency: targetLine.currency,
          exchangeRate: Number(targetLine.exchangeRate || values.exchangeRate || 1),
          bankReference,
          transactionDate: values.transactionDate?.toISOString(),
          fileAsset_id: uploaded._id,
        },
      });

      if (res?.data?._id) {
        message.success('T/T receipt submitted for accounting review.');
        form.resetFields();
        setReceiptFile(null);
        setFileList([]);
        setModalOpen(false);
        setExpandedRowKeys((keys) => (
          keys.includes(targetLine._id) ? keys : [...keys, targetLine._id]
        ));
        await fetchStatement();
      } else {
        message.error(String(res?.message || 'Cannot submit receipt'));
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Cannot submit receipt');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadStatement = async () => {
    if (!accessToken) return;
    const response = await backendFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/finance/statement/download`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      message.error('Cannot download statement');
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statement_of_account_${dayjs().format('YYYYMMDD')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const uploadProps: UploadProps = {
    maxCount: 1,
    fileList,
    beforeUpload: (file) => {
      setReceiptFile(file);
      setFileList([file]);
      return false;
    },
    onRemove: () => {
      setReceiptFile(null);
      setFileList([]);
    },
  };

  const getReceiptsForLine = (line: StatementLine): PaymentReceipt[] => (
    paymentReceipts.filter((receipt) => receipt.accountReceivableId === line._id)
  );

  const getPendingReceiptForLine = (line: StatementLine): PaymentReceipt | undefined => (
    getReceiptsForLine(line).find((receipt) => receipt.status === 'SUBMITTED')
  );

  const expandInvoiceReceipts = (line: StatementLine) => {
    setExpandedRowKeys((keys) => (
      keys.includes(line._id) ? keys : [...keys, line._id]
    ));
  };

  const handleInvoiceSelection = (accountReceivableId?: string) => {
    const line = statementLines.find((item) => item._id === accountReceivableId);
    if (!line) return;

    form.setFieldsValue({
      accountReceivableId: line._id,
      salesContractId: line.salesContractId || undefined,
      amount: Number(line.openAmountForeign || 0),
      currency: line.currency,
      exchangeRate: Number(line.exchangeRate || 1),
    });
  };

  const openPaymentModal = (line?: StatementLine) => {
    form.resetFields();
    setReceiptFile(null);
    setFileList([]);
    if (line) {
      form.setFieldsValue({
        receiptType: 'TT_BALANCE',
        accountReceivableId: line._id,
        salesContractId: line.salesContractId || undefined,
        amount: Number(line.openAmountForeign || 0),
        currency: line.currency,
        exchangeRate: Number(line.exchangeRate || 1),
        transactionDate: dayjs(),
      });
    }
    setModalOpen(true);
  };

  const buildReceiptColumns = (line: StatementLine): ColumnsType<PaymentReceipt> => [
    {
      title: 'Reference',
      render: (_, receipt) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{receipt.accountReceivable?.invoiceNumber || line.invoiceNumber}</Text>
          <Text type="secondary">{line.salesContractId || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Receipt',
      dataIndex: 'receiptNumber',
      render: (value: string, receipt) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Tag style={{ width: 'fit-content' }}>{receipt.receiptType}</Tag>
        </Space>
      ),
    },
    {
      title: 'Amount',
      align: 'right',
      render: (_, receipt) => {
        const hasInvalidAmount = Number(receipt.amount || 0) <= 0;
        const invoiceCurrency = receipt.accountReceivable?.currency || line.currency;
        const hasCurrencyMismatch = Boolean(
          invoiceCurrency && receipt.currency && invoiceCurrency !== receipt.currency,
        );
        return (
          <Space orientation="vertical" size={0} style={{ textAlign: 'right' }}>
            <Text strong type={hasInvalidAmount || hasCurrencyMismatch ? 'danger' : undefined}>
              {money(receipt.amount || 0, receipt.currency || line.currency)}
            </Text>
            {hasInvalidAmount ? (
              <Text type="danger" style={{ fontSize: 12 }}>Invalid zero amount</Text>
            ) : null}
            {hasCurrencyMismatch ? (
              <Text type="danger" style={{ fontSize: 12 }}>Invoice currency: {invoiceCurrency}</Text>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: 'Bank ref',
      dataIndex: 'bankReference',
      render: (value?: string | null) => (
        value ? <Text code>{value}</Text> : <Text type="danger">Required</Text>
      ),
    },
    {
      title: 'Submitted',
      dataIndex: 'submittedAt',
      render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (value: string, receipt) => (
        <Space orientation="vertical" size={2}>
          {renderStatusTag(value)}
          {receipt.rejectionReason ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {receipt.rejectionReason}
            </Text>
          ) : null}
        </Space>
      ),
    },
  ];

  const statementColumns: ColumnsType<StatementLine> = [
    {
      title: 'Invoice',
      dataIndex: 'invoiceNumber',
      render: (value: string, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.salesContractId || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Due date',
      dataIndex: 'dueDate',
      render: (value?: string | null) => value ? dayjs(value).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Amount',
      align: 'right',
      render: (_, record) => <Text strong>{money(record.amountForeign, record.currency)}</Text>,
    },
    {
      title: 'Paid',
      align: 'right',
      render: (_, record) => money(record.paidAmountForeign, record.currency),
    },
    {
      title: 'Open',
      align: 'right',
      render: (_, record) => (
        <Text strong type={hasOpenBalance(record) ? 'danger' : 'success'}>
          {money(record.openAmountForeign, record.currency)}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (value: string) => renderStatusTag(value),
    },
    {
      title: 'T/T receipts',
      align: 'center',
      render: (_, record) => {
        const receipts = getReceiptsForLine(record);
        const pendingCount = receipts.filter((receipt) => receipt.status === 'SUBMITTED').length;
        if (!receipts.length) return <Text type="secondary">-</Text>;
        return (
          <Button size="small" onClick={() => expandInvoiceReceipts(record)}>
            {receipts.length} linked{pendingCount ? ` / ${pendingCount} pending` : ''}
          </Button>
        );
      },
    },
    {
      title: 'Action',
      align: 'right',
      render: (_, record) => {
        const pendingReceipt = getPendingReceiptForLine(record);
        const relatedReceipts = getReceiptsForLine(record);
        const canPay = hasOpenBalance(record) && !pendingReceipt;
        return (
          <Space size={8} style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button
              size="small"
              icon={<FilePdfOutlined />}
              href={record.pdfUrl ? `${process.env.NEXT_PUBLIC_BACKEND_URL}${record.pdfUrl}` : undefined}
              target="_blank"
              disabled={!record.pdfUrl}
            />
            {canPay ? (
              <Button
                size="small"
                type="primary"
                icon={<CreditCardOutlined />}
                onClick={() => openPaymentModal(record)}
              >
                Pay
              </Button>
            ) : relatedReceipts.length > 0 ? (
              <Button size="small" onClick={() => expandInvoiceReceipts(record)}>
                View receipts
              </Button>
            ) : (
              <Button size="small" disabled>
                {pendingReceipt ? 'Pending review' : 'Closed'}
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const summaryCards = [
    {
      title: 'Total receivables',
      value: money(statement?.summary.totalForeign || 0, statementCurrency),
      helper: `${money(statement?.summary.totalVnd || 0, 'VND')} converted`,
      icon: <DollarOutlined />,
      color: '#2563eb',
    },
    {
      title: 'Paid',
      value: money(statement?.summary.paidForeign || 0, statementCurrency),
      helper: `${money(statement?.summary.paidVnd || 0, 'VND')} reconciled`,
      icon: <CheckCircleOutlined />,
      color: '#16a34a',
    },
    {
      title: 'Open balance',
      value: money(statement?.summary.openForeign || 0, statementCurrency),
      helper: `${statement?.summary.openInvoiceCount || 0} open invoices`,
      icon: <WarningOutlined />,
      color: '#dc2626',
    },
    {
      title: 'Pending receipts',
      value: String(statement?.summary.pendingReceiptCount || 0),
      helper: unallocatedReceipts.length
        ? `${unallocatedReceipts.length} need invoice allocation`
        : 'Awaiting accounting review',
      icon: <FileDoneOutlined />,
      color: '#f59e0b',
    },
  ];

  return (
    <div style={{ margin: '-48px -48px 0 -48px' }}>
      <PageBanner
        title="Finance & Payments"
        subtitle="Statement of account, T/T receipt upload, and accounting reconciliation status."
        height="240px"
        offset={false}
        breadcrumbs={[{ title: 'Portal', href: '/portal' }, { title: 'Finance' }]}
        imageUrl="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=2500"
      >
        <Space style={{ marginTop: 20 }}>
          <Button type="primary" icon={<UploadOutlined />} size="large" onClick={() => openPaymentModal()}>
            Upload T/T receipt
          </Button>
          <Button icon={<DownloadOutlined />} size="large" onClick={downloadStatement}>
            Statement CSV
          </Button>
        </Space>
      </PageBanner>

      <div style={{ padding: 48 }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {summaryCards.map((item) => (
            <Col xs={24} md={12} xl={6} key={item.title}>
              <Card
                variant="borderless"
                style={{
                  height: '100%',
                  borderRadius: 8,
                  borderTop: `3px solid ${item.color}`,
                  boxShadow: '0 12px 32px rgba(15,23,42,.16)',
                }}
              >
                <Space align="start" style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Space orientation="vertical" size={4}>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
                      {item.title}
                    </Text>
                    <Text style={{ fontSize: 22, fontWeight: 900, color: item.color }}>
                      {item.value}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.helper}
                    </Text>
                  </Space>
                  <span
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 8,
                      display: 'inline-grid',
                      placeItems: 'center',
                      color: item.color,
                      background: `${item.color}18`,
                      fontSize: 18,
                    }}
                  >
                    {item.icon}
                  </span>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          {unallocatedReceipts.length ? (
            <Card
              variant="borderless"
              style={{
                borderLeft: '3px solid #f59e0b',
                borderRadius: 8,
              }}
            >
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                <Space>
                  <WarningOutlined style={{ color: '#f59e0b' }} />
                  <Text strong>Receipts needing invoice allocation</Text>
                </Space>
                {unallocatedReceipts.slice(0, 3).map((receipt) => (
                  <Space
                    key={receipt._id}
                    style={{ justifyContent: 'space-between', width: '100%' }}
                  >
                    <Space>
                      <Text code>{receipt.receiptNumber}</Text>
                      <Text type="secondary">{receipt.bankReference || 'Missing bank reference'}</Text>
                    </Space>
                    <Text strong>{money(receipt.amount || 0, receipt.currency || 'FCY')}</Text>
                  </Space>
                ))}
                {unallocatedReceipts.length > 3 ? (
                  <Text type="secondary">
                    +{unallocatedReceipts.length - 3} more receipts need allocation
                  </Text>
                ) : null}
              </Space>
            </Card>
          ) : null}

          <Card
            title="Statement of account"
            extra={<Button icon={<ReloadOutlined />} onClick={fetchStatement}>Refresh</Button>}
            variant="borderless"
          >
            <Table<StatementLine>
              rowKey="_id"
              loading={loading}
              dataSource={statement?.lines || []}
              columns={statementColumns}
              pagination={{ pageSize: 8 }}
              expandable={{
                expandedRowKeys,
                onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
                rowExpandable: (record) => getReceiptsForLine(record).length > 0,
                expandedRowRender: (record) => {
                  const receipts = getReceiptsForLine(record);
                  return (
                    <div
                      style={{
                        padding: '8px 0 8px 44px',
                        borderLeft: '3px solid rgba(37,99,235,.45)',
                      }}
                    >
                      <Table<PaymentReceipt>
                        rowKey="_id"
                        size="small"
                        dataSource={receipts}
                        columns={buildReceiptColumns(record)}
                        pagination={false}
                      />
                    </div>
                  );
                },
              }}
            />
          </Card>
        </Space>
      </div>

      <Modal
        title={selectedLine ? `Upload T/T receipt for ${selectedLine.invoiceNumber}` : 'Upload T/T receipt / Swift MT103'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={720}
      >
        <Form<ReceiptFormValues>
          form={form}
          layout="vertical"
          initialValues={{ receiptType: 'TT_BALANCE', currency: 'USD', exchangeRate: 1, transactionDate: dayjs() }}
          onFinish={submitReceipt}
        >
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="receiptType" label="Receipt type" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'TT_ADVANCE', label: 'T/T advance' },
                    { value: 'TT_BALANCE', label: 'T/T balance' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="accountReceivableId" label="Invoice / AR" rules={[{ required: true, message: 'Please select an open invoice' }]}>
                <Select
                  placeholder="Select invoice to allocate"
                  onChange={handleInvoiceSelection}
                  options={statementLines.map((line) => {
                    const pendingReceipt = getPendingReceiptForLine(line);
                    const open = hasOpenBalance(line);
                    return {
                      value: line._id,
                      disabled: !open || Boolean(pendingReceipt),
                      label: `${line.invoiceNumber} - ${open ? money(line.openAmountForeign, line.currency) : 'closed'}${pendingReceipt ? ' - pending review' : ''}`,
                    };
                  })}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item
                name="amount"
                label="Amount"
                rules={[
                  { required: true, message: 'Enter received amount' },
                  {
                    validator: (_, value: number | undefined) => {
                      const amount = Number(value || 0);
                      if (!selectedLine) return Promise.resolve();
                      if (amount <= 0) return Promise.reject(new Error('Amount must be greater than 0'));
                      if (amount > Number(selectedLine.openAmountForeign || 0)) {
                        return Promise.reject(new Error(`Cannot exceed ${money(selectedLine.openAmountForeign, selectedLine.currency)}`));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <InputNumber
                  min={0.01}
                  max={selectedLine?.openAmountForeign}
                  precision={2}
                  style={{ width: '100%' }}
                  addonAfter={selectedLine?.currency}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="currency" label="Currency" rules={[{ required: true }]}>
                <Input disabled={Boolean(selectedLine)} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="exchangeRate" label="Exchange rate" rules={[{ required: true }]}>
                <InputNumber min={0.000001} precision={6} style={{ width: '100%' }} disabled={Boolean(selectedLine)} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item
                name="bankReference"
                label="Bank reference"
                rules={[
                  { required: true, message: 'Bank reference is required' },
                  { whitespace: true, message: 'Bank reference is required' },
                ]}
              >
                <Input placeholder="Swift/MT103 reference" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="transactionDate" label="Transaction date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="note" label="Note">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Dragger {...uploadProps} style={{ marginBottom: 16 }}>
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Drop PDF/JPG/PNG receipt here</p>
            <p className="ant-upload-hint">Max 5MB. Accounting will confirm and reconcile this receipt.</p>
          </Dragger>
          <Button type="primary" htmlType="submit" loading={submitting} block>
            Submit receipt
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
