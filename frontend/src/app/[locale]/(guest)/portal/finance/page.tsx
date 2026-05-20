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
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd';
import {
  DownloadOutlined,
  FileDoneOutlined,
  InboxOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import dayjs, { type Dayjs } from 'dayjs';
import PageBanner from '@/components/guest/PageBanner';
import { getAccessToken } from '@/lib/auth-token';
import { sendRequest } from '@/lib/api-client';

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
  status: string;
};

type PaymentReceipt = {
  _id: string;
  receiptNumber: string;
  receiptType: 'TT_ADVANCE' | 'TT_BALANCE';
  amount: number;
  currency: string;
  status: string;
  bankReference?: string | null;
  submittedAt: string;
  rejectionReason?: string | null;
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

const statusColor: Record<string, string> = {
  UNPAID: 'orange',
  PARTIAL: 'blue',
  PAID: 'green',
  OVERDUE: 'red',
  SUBMITTED: 'processing',
  CONFIRMED: 'green',
  REJECTED: 'red',
};

const money = (value: number, currency = 'USD') => (
  `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
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

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/files/upload?folder=payments`, {
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

    setSubmitting(true);
    try {
      const uploaded = await uploadReceiptFile(receiptFile);
      const res = await sendRequest<IBackendRes<PaymentReceipt>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/finance/tt-receipts`,
        method: 'POST',
        headers,
        body: {
          ...values,
          amount: Number(values.amount || 0),
          exchangeRate: Number(values.exchangeRate || 1),
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
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal/finance/statement/download`, {
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
      render: (_, record) => money(record.amountForeign, record.currency),
    },
    {
      title: 'Paid',
      align: 'right',
      render: (_, record) => money(record.paidAmountForeign, record.currency),
    },
    {
      title: 'Open',
      align: 'right',
      render: (_, record) => <Text strong>{money(record.openAmountForeign, record.currency)}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (value: string) => <Tag color={statusColor[value] || 'default'}>{value}</Tag>,
    },
  ];

  const receiptColumns: ColumnsType<PaymentReceipt> = [
    { title: 'Receipt', dataIndex: 'receiptNumber' },
    { title: 'Type', dataIndex: 'receiptType', render: (value: string) => <Tag>{value}</Tag> },
    { title: 'Amount', align: 'right', render: (_, record) => money(record.amount, record.currency) },
    { title: 'Bank ref', dataIndex: 'bankReference', render: (value?: string | null) => value || '-' },
    { title: 'Submitted', dataIndex: 'submittedAt', render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm') },
    { title: 'Status', dataIndex: 'status', render: (value: string) => <Tag color={statusColor[value] || 'default'}>{value}</Tag> },
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
          <Button type="primary" icon={<UploadOutlined />} size="large" onClick={() => setModalOpen(true)}>
            Upload T/T receipt
          </Button>
          <Button icon={<DownloadOutlined />} size="large" onClick={downloadStatement}>
            Statement CSV
          </Button>
        </Space>
      </PageBanner>

      <div style={{ padding: 48 }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={8}>
            <Card variant="borderless">
              <Statistic title="Open balance" value={statement?.summary.openForeign || 0} suffix="FCY" />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card variant="borderless">
              <Statistic title="Paid" value={statement?.summary.paidForeign || 0} suffix="FCY" />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card variant="borderless">
              <Statistic title="Pending receipts" value={statement?.summary.pendingReceiptCount || 0} prefix={<FileDoneOutlined />} />
            </Card>
          </Col>
        </Row>

        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
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
            />
          </Card>

          <Card title="Uploaded T/T receipts" variant="borderless">
            <Table<PaymentReceipt>
              rowKey="_id"
              loading={loading}
              dataSource={statement?.receipts || []}
              columns={receiptColumns}
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </Space>
      </div>

      <Modal
        title="Upload T/T receipt / Swift MT103"
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
              <Form.Item name="accountReceivableId" label="Invoice / AR">
                <Select
                  allowClear
                  placeholder="Select invoice to allocate"
                  options={(statement?.lines || []).map((line) => ({
                    value: line._id,
                    label: `${line.invoiceNumber} - ${money(line.openAmountForeign, line.currency)}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
                <InputNumber min={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="currency" label="Currency" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="exchangeRate" label="Exchange rate" rules={[{ required: true }]}>
                <InputNumber min={0.000001} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="bankReference" label="Bank reference">
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
