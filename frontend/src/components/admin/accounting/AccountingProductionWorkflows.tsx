'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Alert,
  message,
} from 'antd';
import {
  CalculatorOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  DollarOutlined,
  FileSearchOutlined,
  FileProtectOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { sendRequest } from '@/lib/api-client';

const { Text } = Typography;
const { RangePicker } = DatePicker;

type AccountingProductionWorkflowsProps = {
  accessToken: string;
};

type PaginatedResponse<T> = {
  results?: T[];
  total?: number;
};

type PeriodRow = {
  _id: string;
  startDate: string;
  endDate: string;
  status: string;
  closedByUsername?: string | null;
  reopenedByUsername?: string | null;
  reopenCount?: number | string | null;
  periodHash?: string | null;
  reopenApprovalWorkflowRequest_id?: string | null;
  lockApprovalWorkflowRequest_id?: string | null;
};

type FxRevaluationRow = {
  _id: string;
  runNumber: string;
  sourceType: string;
  sourceId?: string | null;
  currency: string;
  openAmountForeign: number | string;
  gainLossVnd: number | string;
  status: string;
};

type VatRefundRow = {
  _id: string;
  dossierNumber: string;
  periodStart: string;
  periodEnd: string;
  inputVatAmount: number | string;
  refundAmount: number | string;
  status: string;
};

type AuditEventRow = {
  _id: string;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  username?: string | null;
  eventAt: string;
  eventHash?: string | null;
};

const statusColor: Record<string, string> = {
  OPEN: 'processing',
  CLOSED: 'success',
  LOCKED: 'red',
  DRAFT: 'default',
  SUBMITTED: 'processing',
  APPROVED: 'warning',
  PAID: 'success',
  REJECTED: 'error',
  POSTED: 'success',
  PASSED: 'success',
  WARNING: 'warning',
  FAILED: 'error',
};

type CloseChecklistItem = {
  key: string;
  label: string;
  status: 'PASSED' | 'WARNING' | 'FAILED';
  details: string;
  evidence?: Record<string, unknown>;
};

type ClosePolicyResult = {
  period_id: string;
  startDate: string;
  endDate: string;
  periodStatus: string;
  canClose: boolean;
  failedCheckCount: number;
  warningCount: number;
  closingItemCount: number;
  policyHash: string;
  checklist: CloseChecklistItem[];
  trialBalanceSnapshot: {
    totalDebit: number;
    totalCredit: number;
    difference: number;
    hash: string;
  };
};

type TaxReportRunRow = {
  _id: string;
  runNumber: string;
  periodStart: string;
  periodEnd: string;
  generatedByUsername: string;
  reportHash: string;
  runHash: string;
  warnings?: string[];
};

type ClosePacketRow = {
  _id: string;
  packetNumber: string;
  periodStart: string;
  periodEnd: string;
  generatedByUsername: string;
  warningCount: number;
  failedCheckCount: number;
  journalCount: number;
  packetHash: string;
  taxReportHash?: string | null;
};

type TaxDocumentTraceItem = {
  _id?: string;
  documentNumber?: string | null;
  declarationNumber?: string | null;
  certificateNumber?: string | null;
  status?: string | null;
  traceDate?: string | null;
  amountVnd?: number | string | null;
};

type TaxReport = {
  reportHash?: string | null;
  summary?: {
    inputVat?: number;
    outputVat?: number;
    refundableVat?: number;
    exportRevenueVnd?: number;
  };
  warnings?: string[];
  documentTrace?: {
    customsDeclarations?: TaxDocumentTraceItem[];
    certificatesOfOrigin?: TaxDocumentTraceItem[];
    vatRefundDossiers?: TaxDocumentTraceItem[];
  };
  reconciliation?: {
    customsDeclarationCount?: number;
    certificateOfOriginCount?: number;
    vatRefundDossierCount?: number;
    warningCount?: number;
  };
};

type PeriodFormValues = {
  periodRange?: [Dayjs, Dayjs];
};

type FxFormValues = {
  revaluationDate?: Dayjs;
  currency?: string;
  closingRate?: number;
  postJournal?: boolean;
  note?: string;
};

type VatRefundFormValues = {
  periodRange?: [Dayjs, Dayjs];
  exportRevenueVnd?: number;
  refundAmount?: number;
  note?: string;
};

const AccountingProductionWorkflows: React.FC<AccountingProductionWorkflowsProps> = ({ accessToken }) => {
  const [loading, setLoading] = useState(false);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [fxRows, setFxRows] = useState<FxRevaluationRow[]>([]);
  const [vatRows, setVatRows] = useState<VatRefundRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditEventRow[]>([]);
  const [taxRunRows, setTaxRunRows] = useState<TaxReportRunRow[]>([]);
  const [closePacketRows, setClosePacketRows] = useState<ClosePacketRow[]>([]);
  const [taxReport, setTaxReport] = useState<TaxReport | null>(null);
  const [closePolicy, setClosePolicy] = useState<ClosePolicyResult | null>(null);
  const [closePolicyPeriod, setClosePolicyPeriod] = useState<PeriodRow | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [reopenRecord, setReopenRecord] = useState<PeriodRow | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [periodForm] = Form.useForm();
  const [fxForm] = Form.useForm();
  const [vatForm] = Form.useForm();

  const fetchWorkflows = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [periodRes, fxRes, vatRes, taxRes, auditRes, taxRunRes, closePacketRes] = await Promise.all([
        sendRequest<IBackendRes<PaginatedResponse<PeriodRow>>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/periods`,
          method: 'GET',
          queryParams: { current: 1, pageSize: 20 },
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<PaginatedResponse<FxRevaluationRow>>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/fx-revaluations`,
          method: 'GET',
          queryParams: { current: 1, pageSize: 20 },
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<PaginatedResponse<VatRefundRow>>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/vat-refunds`,
          method: 'GET',
          queryParams: { current: 1, pageSize: 20 },
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<TaxReport>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/tax`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<PaginatedResponse<AuditEventRow>>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/audit-events`,
          method: 'GET',
          queryParams: { current: 1, pageSize: 10 },
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<PaginatedResponse<TaxReportRunRow>>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/tax-report-runs`,
          method: 'GET',
          queryParams: { current: 1, pageSize: 10 },
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<PaginatedResponse<ClosePacketRow>>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/close-packets`,
          method: 'GET',
          queryParams: { current: 1, pageSize: 10 },
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      setPeriods(periodRes?.data?.results || []);
      setFxRows(fxRes?.data?.results || []);
      setVatRows(vatRes?.data?.results || []);
      setTaxReport(taxRes?.data || null);
      setAuditRows(auditRes?.data?.results || []);
      setTaxRunRows(taxRunRes?.data?.results || []);
      setClosePacketRows(closePacketRes?.data?.results || []);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const callAction = async (url: string, method: 'POST' | 'PATCH', body?: Record<string, unknown>) => {
    const res = await sendRequest<IBackendRes<unknown>>({
      url,
      method,
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res?.data) {
      message.success('Đã cập nhật workflow kế toán');
      await fetchWorkflows();
    }
  };

  const previewClosePolicy = async (record: PeriodRow) => {
    if (!record?._id) return;
    setPolicyLoading(true);
    setClosePolicyPeriod(record);
    try {
      const res = await sendRequest<IBackendRes<ClosePolicyResult>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/periods/${record._id}/close-policy`,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        setClosePolicy(res.data);
      } else if (res?.message) {
        message.error(String(res.message));
      }
    } finally {
      setPolicyLoading(false);
    }
  };

  const closeSelectedPeriod = async () => {
    if (!closePolicyPeriod?._id || !closePolicy?.canClose) return;
    await callAction(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/periods/${closePolicyPeriod._id}/close`,
      'POST',
      { note: 'Closed after production close policy checklist' },
    );
    setClosePolicy(null);
    setClosePolicyPeriod(null);
  };

  const openPeriod = async (values: PeriodFormValues) => {
    const [start, end] = values.periodRange || [];
    await callAction(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/periods/open`,
      'POST',
      {
        startDate: start?.toISOString(),
        endDate: end?.toISOString(),
      },
    );
    periodForm.resetFields();
  };

  const runFx = async (values: FxFormValues) => {
    await callAction(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/fx-revaluations/run`,
      'POST',
      {
        revaluationDate: values.revaluationDate?.toISOString(),
        currency: values.currency || 'USD',
        closingRate: Number(values.closingRate || 0),
        postJournal: Boolean(values.postJournal),
        note: values.note,
      },
    );
    fxForm.resetFields();
  };

  const createVatRefund = async (values: VatRefundFormValues) => {
    const [start, end] = values.periodRange || [];
    await callAction(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/vat-refunds`,
      'POST',
      {
        periodStart: start?.toISOString(),
        periodEnd: end?.toISOString(),
        exportRevenueVnd: values.exportRevenueVnd === undefined ? undefined : Number(values.exportRevenueVnd),
        refundAmount: values.refundAmount === undefined ? undefined : Number(values.refundAmount),
        note: values.note,
      },
    );
    vatForm.resetFields();
  };

  const exportTaxReport = async () => {
    if (!accessToken) return;
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/tax/export`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      message.error('Cannot export tax report');
      return;
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const filename = disposition.match(/filename="?([^"]+)"?/)?.[1] || `tax_report_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const money = (value: number | string) => Number(value || 0).toLocaleString('vi-VN');
  const customsCount = taxReport?.documentTrace?.customsDeclarations?.length || 0;
  const coCount = taxReport?.documentTrace?.certificatesOfOrigin?.length || 0;
  const refundTraceCount = taxReport?.documentTrace?.vatRefundDossiers?.length || 0;

  return (
    <div style={{ marginTop: 24 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={8}>
          <Card title={<Space orientation="horizontal"><LockOutlined />Kỳ kế toán</Space>} variant="borderless">
            <Form form={periodForm} layout="vertical" onFinish={openPeriod}>
              <Form.Item name="periodRange" label="Khoảng kỳ" rules={[{ required: true, message: 'Chọn kỳ kế toán' }]}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<UnlockOutlined />}>
                Mở kỳ
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={<Space orientation="horizontal"><CalculatorOutlined />Đánh giá lại FX</Space>} variant="borderless">
            <Form form={fxForm} layout="vertical" onFinish={runFx} initialValues={{ currency: 'USD', postJournal: true }}>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="revaluationDate" label="Ngày cuối kỳ" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="currency" label="Tiền tệ" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="closingRate" label="Tỷ giá cuối kỳ" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="postJournal" label="Hạch toán ngay" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<DollarOutlined />}>
                Chạy revaluation
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={<Space orientation="horizontal"><FileProtectOutlined />Hồ sơ hoàn thuế</Space>} variant="borderless">
            <Form form={vatForm} layout="vertical" onFinish={createVatRefund}>
              <Form.Item name="periodRange" label="Kỳ thuế" rules={[{ required: true }]}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="exportRevenueVnd" label="Doanh thu XK">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="refundAmount" label="Đề nghị hoàn">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" htmlType="submit" icon={<FileProtectOutlined />}>
                Tạo hồ sơ
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card
          title="Tax report production-grade"
          extra={(
            <Space orientation="horizontal">
              <Button icon={<DownloadOutlined />} onClick={exportTaxReport}>
                Export CSV
              </Button>
              {taxReport?.reportHash ? (
                <Text copyable={{ text: taxReport.reportHash }}>Hash: {String(taxReport.reportHash).slice(0, 12)}...</Text>
              ) : null}
            </Space>
          )}
          variant="borderless"
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}>
              <Text type="secondary">VAT đầu vào</Text>
              <div><Text strong>{money(taxReport?.summary?.inputVat || 0)} VND</Text></div>
            </Col>
            <Col xs={24} md={6}>
              <Text type="secondary">VAT đầu ra</Text>
              <div><Text strong>{money(taxReport?.summary?.outputVat || 0)} VND</Text></div>
            </Col>
            <Col xs={24} md={6}>
              <Text type="secondary">Đề nghị hoàn</Text>
              <div><Text strong type="success">{money(taxReport?.summary?.refundableVat || 0)} VND</Text></div>
            </Col>
            <Col xs={24} md={6}>
              <Text type="secondary">Doanh thu xuất khẩu</Text>
              <div><Text strong>{money(taxReport?.summary?.exportRevenueVnd || 0)} VND</Text></div>
            </Col>
          </Row>
          {taxReport?.warnings?.length ? (
            <div style={{ marginTop: 12 }}>
              {taxReport.warnings.slice(0, 3).map((warning: string) => (
                <Tag color="warning" key={warning}>{warning}</Tag>
              ))}
            </div>
          ) : null}
          <div style={{ marginTop: 12 }}>
            <Space orientation="horizontal" wrap>
              <Tag color={customsCount ? 'success' : 'warning'}>Customs traced: {customsCount}</Tag>
              <Tag color={coCount ? 'success' : 'warning'}>C/O traced: {coCount}</Tag>
              <Tag color={refundTraceCount ? 'success' : 'default'}>VAT refund dossiers: {refundTraceCount}</Tag>
              <Tag color={Number(taxReport?.reconciliation?.warningCount || 0) ? 'warning' : 'success'}>
                Reconciliation warnings: {Number(taxReport?.reconciliation?.warningCount || 0)}
              </Tag>
            </Space>
          </div>
        </Card>

        <Card
          title="Danh sách kỳ kế toán"
          extra={<Button icon={<ReloadOutlined />} onClick={fetchWorkflows}>Làm mới</Button>}
          variant="borderless"
        >
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={periods}
            pagination={false}
            columns={[
              { title: 'Bắt đầu', dataIndex: 'startDate', render: (v) => dayjs(v).format('DD/MM/YYYY') },
              { title: 'Kết thúc', dataIndex: 'endDate', render: (v) => dayjs(v).format('DD/MM/YYYY') },
              { title: 'Trạng thái', dataIndex: 'status', render: (v) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
              { title: 'Đóng bởi', dataIndex: 'closedByUsername', render: (v) => v || '-' },
              { title: 'Reopen', dataIndex: 'reopenCount', align: 'right', render: (v) => Number(v || 0) },
              {
                title: 'Approval',
                render: (_, record: PeriodRow) => (
                  <Space orientation="horizontal" size={4}>
                    {record.reopenApprovalWorkflowRequest_id ? <Tag color="processing">Reopen pending</Tag> : null}
                    {record.lockApprovalWorkflowRequest_id ? <Tag color="warning">Lock pending</Tag> : null}
                    {!record.reopenApprovalWorkflowRequest_id && !record.lockApprovalWorkflowRequest_id ? '-' : null}
                  </Space>
                ),
              },
              { title: 'Period hash', dataIndex: 'periodHash', render: (v) => v ? <Text copyable={{ text: v }}>{String(v).slice(0, 10)}...</Text> : '-' },
              { title: 'Mở lại bởi', dataIndex: 'reopenedByUsername', render: (v) => v || '-' },
              {
                title: 'Thao tác',
                align: 'right',
                render: (_, record: PeriodRow) => (
                  <Space orientation="horizontal">
                    <Button
                      size="small"
                      icon={<FileSearchOutlined />}
                      onClick={() => previewClosePolicy(record)}
                    >
                      Policy
                    </Button>
                    {record.status === 'OPEN' && (
                      <Button
                        size="small"
                        icon={<LockOutlined />}
                        onClick={() => previewClosePolicy(record)}
                      >
                        Đóng
                      </Button>
                    )}
                    {record.status === 'CLOSED' && (
                      <>
                        <Button
                          size="small"
                          icon={<UnlockOutlined />}
                          disabled={Boolean(record.reopenApprovalWorkflowRequest_id || record.lockApprovalWorkflowRequest_id)}
                          onClick={() => setReopenRecord(record)}
                        >
                          Mở lại
                        </Button>
                        <Button
                          size="small"
                          danger
                          icon={<LockOutlined />}
                          disabled={Boolean(record.lockApprovalWorkflowRequest_id || record.reopenApprovalWorkflowRequest_id)}
                          onClick={() => callAction(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/periods/${record._id}/lock`, 'PATCH', { reason: 'Final accounting lock after management review' })}
                        >
                          Gửi duyệt khóa
                        </Button>
                      </>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </Card>

        <Card title={<Space orientation="horizontal"><SafetyCertificateOutlined />Frozen tax report runs</Space>} variant="borderless">
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={taxRunRows}
            pagination={{ pageSize: 5 }}
            columns={[
              { title: 'Run', dataIndex: 'runNumber' },
              { title: 'Period', render: (_, r: TaxReportRunRow) => `${dayjs(r.periodStart).format('DD/MM/YYYY')} - ${dayjs(r.periodEnd).format('DD/MM/YYYY')}` },
              { title: 'By', dataIndex: 'generatedByUsername', render: (v) => v || 'system' },
              { title: 'Warnings', render: (_, r: TaxReportRunRow) => Number(r.warnings?.length || 0) },
              { title: 'Report hash', dataIndex: 'reportHash', render: (v) => v ? <Text copyable={{ text: v }}>{String(v).slice(0, 12)}...</Text> : '-' },
              { title: 'Run hash', dataIndex: 'runHash', render: (v) => v ? <Text copyable={{ text: v }}>{String(v).slice(0, 12)}...</Text> : '-' },
            ]}
          />
        </Card>

        <Card title={<Space orientation="horizontal"><FileProtectOutlined />Accounting close packets</Space>} variant="borderless">
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={closePacketRows}
            pagination={{ pageSize: 5 }}
            columns={[
              { title: 'Packet', dataIndex: 'packetNumber' },
              { title: 'Period', render: (_, r: ClosePacketRow) => `${dayjs(r.periodStart).format('DD/MM/YYYY')} - ${dayjs(r.periodEnd).format('DD/MM/YYYY')}` },
              { title: 'By', dataIndex: 'generatedByUsername', render: (v) => v || 'system' },
              { title: 'Journals', dataIndex: 'journalCount', align: 'right' },
              { title: 'Warnings', dataIndex: 'warningCount', align: 'right', render: (v) => <Tag color={Number(v) ? 'warning' : 'success'}>{Number(v || 0)}</Tag> },
              { title: 'Failed', dataIndex: 'failedCheckCount', align: 'right', render: (v) => <Tag color={Number(v) ? 'error' : 'success'}>{Number(v || 0)}</Tag> },
              { title: 'Packet hash', dataIndex: 'packetHash', render: (v) => v ? <Text copyable={{ text: v }}>{String(v).slice(0, 12)}...</Text> : '-' },
            ]}
          />
        </Card>

        <Card title="Đánh giá lại chênh lệch tỷ giá chưa thực hiện" variant="borderless">
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={fxRows}
            pagination={{ pageSize: 5 }}
            columns={[
              { title: 'Run', dataIndex: 'runNumber' },
              { title: 'Nguồn', render: (_, r: FxRevaluationRow) => `${r.sourceType} / ${r.sourceId?.slice(0, 12)}` },
              { title: 'Tiền tệ', dataIndex: 'currency' },
              { title: 'Open FCY', dataIndex: 'openAmountForeign', align: 'right', render: money },
              { title: 'Gain/Loss VND', dataIndex: 'gainLossVnd', align: 'right', render: (v) => <Text type={Number(v) >= 0 ? 'success' : 'danger'}>{money(v)}</Text> },
              { title: 'Trạng thái', dataIndex: 'status', render: (v) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
            ]}
          />
        </Card>

        <Card title="Workflow hoàn thuế GTGT xuất khẩu" variant="borderless">
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={vatRows}
            pagination={{ pageSize: 5 }}
            columns={[
              { title: 'Hồ sơ', dataIndex: 'dossierNumber' },
              { title: 'Kỳ', render: (_, r: VatRefundRow) => `${dayjs(r.periodStart).format('DD/MM/YYYY')} - ${dayjs(r.periodEnd).format('DD/MM/YYYY')}` },
              { title: 'VAT đầu vào', dataIndex: 'inputVatAmount', align: 'right', render: money },
              { title: 'Đề nghị hoàn', dataIndex: 'refundAmount', align: 'right', render: money },
              { title: 'Trạng thái', dataIndex: 'status', render: (v) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
              {
                title: 'Thao tác',
                align: 'right',
                render: (_, record: VatRefundRow) => (
                  <Space orientation="horizontal">
                    {['DRAFT', 'REJECTED'].includes(record.status) && (
                      <Button size="small" icon={<CheckCircleOutlined />} onClick={() => callAction(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/vat-refunds/${record._id}/submit`, 'PATCH')}>
                        Nộp
                      </Button>
                    )}
                    {record.status === 'SUBMITTED' && (
                      <>
                        <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => callAction(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/vat-refunds/${record._id}/approve`, 'PATCH', {})}>
                          Duyệt
                        </Button>
                        <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => callAction(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/vat-refunds/${record._id}/reject`, 'PATCH', { reason: 'Không đủ điều kiện hoàn thuế' })}>
                          Từ chối
                        </Button>
                      </>
                    )}
                    {record.status === 'APPROVED' && (
                      <Button size="small" icon={<DollarOutlined />} onClick={() => callAction(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/vat-refunds/${record._id}/pay`, 'PATCH', {})}>
                        Nhận tiền
                      </Button>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </Card>

        <Card title="Immutable accounting audit" variant="borderless">
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={auditRows}
            pagination={false}
            columns={[
              { title: 'Event', dataIndex: 'eventType', render: (v) => <Tag color="blue">{v}</Tag> },
              { title: 'Entity', render: (_, r: AuditEventRow) => `${r.entityType} / ${String(r.entityId || '').slice(0, 12)}` },
              { title: 'User', dataIndex: 'username', render: (v) => v || 'system' },
              { title: 'At', dataIndex: 'eventAt', render: (v) => dayjs(v).format('DD/MM/YYYY HH:mm') },
              { title: 'Hash', dataIndex: 'eventHash', render: (v) => v ? <Text copyable={{ text: v }}>{String(v).slice(0, 12)}...</Text> : '-' },
            ]}
          />
        </Card>
      </Space>

      <Modal
        title="Accounting close policy"
        open={Boolean(closePolicyPeriod)}
        width={920}
        confirmLoading={policyLoading}
        onCancel={() => {
          setClosePolicy(null);
          setClosePolicyPeriod(null);
        }}
        okButtonProps={{ disabled: !closePolicy?.canClose || closePolicyPeriod?.status !== 'OPEN' }}
        okText="Close period"
        onOk={closeSelectedPeriod}
      >
        {closePolicy ? (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type={closePolicy.canClose ? 'success' : 'error'}
              showIcon
              title={closePolicy.canClose ? 'Ready to close' : 'Close policy failed'}
              description={`Failed: ${closePolicy.failedCheckCount} | Warnings: ${closePolicy.warningCount} | Closing lines: ${closePolicy.closingItemCount}`}
            />
            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}>
                <Text type="secondary">Total debit</Text>
                <div><Text strong>{money(closePolicy.trialBalanceSnapshot.totalDebit)} VND</Text></div>
              </Col>
              <Col xs={24} md={8}>
                <Text type="secondary">Total credit</Text>
                <div><Text strong>{money(closePolicy.trialBalanceSnapshot.totalCredit)} VND</Text></div>
              </Col>
              <Col xs={24} md={8}>
                <Text type="secondary">Policy hash</Text>
                <div><Text copyable={{ text: closePolicy.policyHash }}>{closePolicy.policyHash.slice(0, 14)}...</Text></div>
              </Col>
            </Row>
            <Table
              rowKey="key"
              size="small"
              pagination={false}
              dataSource={closePolicy.checklist}
              columns={[
                { title: 'Check', dataIndex: 'label' },
                { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={statusColor[v] || 'default'}>{v}</Tag> },
                { title: 'Details', dataIndex: 'details' },
              ]}
            />
          </Space>
        ) : (
          <Alert type="info" showIcon title="Loading close policy..." />
        )}
      </Modal>

      <Modal
        title="Mở lại kỳ kế toán"
        open={Boolean(reopenRecord)}
        onCancel={() => {
          setReopenRecord(null);
          setReopenReason('');
        }}
        onOk={async () => {
          if (!reopenRecord) return;
          await callAction(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/periods/${reopenRecord._id}/reopen`,
            'PATCH',
            { reason: reopenReason || 'Điều chỉnh số liệu sau khóa sổ' },
          );
          setReopenRecord(null);
          setReopenReason('');
        }}
      >
        <Text type="secondary">Lý do mở lại sẽ được lưu audit trên kỳ kế toán.</Text>
        <Input.TextArea
          rows={4}
          value={reopenReason}
          onChange={(event) => setReopenReason(event.target.value)}
          style={{ marginTop: 12 }}
          placeholder="Nhập lý do mở lại kỳ"
        />
      </Modal>
    </div>
  );
};

export default AccountingProductionWorkflows;
