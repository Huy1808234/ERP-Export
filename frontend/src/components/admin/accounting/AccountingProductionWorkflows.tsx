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
  Tabs,
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
import { backendFetch, sendRequest } from '@/lib/api-client';
import { useLocale, useTranslations } from 'next-intl';

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

const standardPagination = {
  pageSize: 10,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
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

type WorkflowTabKey = 'period' | 'tax' | 'fx' | 'audit';

const AccountingProductionWorkflows: React.FC<AccountingProductionWorkflowsProps> = ({ accessToken }) => {
  const t = useTranslations('Accounting');
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<WorkflowTabKey>('period');
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
      message.success(t('workflows.messages.updated'));
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
      { note: t('workflows.defaults.closeNote') },
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
    const response = await backendFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/report/tax/export`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      message.error(t('workflows.messages.exportTaxError'));
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

  const money = (value: number | string) => Number(value || 0).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US');
  const translateTaxWarning = (warning: string) => {
    const knownWarnings: Record<string, string> = {
      'No accounting period is configured for this tax report range.': t('workflows.taxReport.warnings.noAccountingPeriod'),
      'Export revenue exists but no customs declaration was traced for this tax period.': t('workflows.taxReport.warnings.missingCustoms'),
      'Export revenue exists but no C/O document was traced for this tax period.': t('workflows.taxReport.warnings.missingCo'),
      'Refundable VAT exists but no submitted/approved/paid VAT refund dossier overlaps this period.': t('workflows.taxReport.warnings.missingRefundDossier'),
    };
    if (knownWarnings[warning]) return knownWarnings[warning];
    const vatLine = warning.match(/^VAT line (.+) is missing referenceId\.$/);
    if (vatLine) return t('workflows.taxReport.warnings.missingVatReference', { entry: vatLine[1] });
    return warning;
  };
  const statusLabel = (status?: string | null) => {
    switch (status) {
      case 'OPEN': return t('workflows.status.OPEN');
      case 'CLOSED': return t('workflows.status.CLOSED');
      case 'LOCKED': return t('workflows.status.LOCKED');
      case 'DRAFT': return t('workflows.status.DRAFT');
      case 'SUBMITTED': return t('workflows.status.SUBMITTED');
      case 'APPROVED': return t('workflows.status.APPROVED');
      case 'PAID': return t('workflows.status.PAID');
      case 'REJECTED': return t('workflows.status.REJECTED');
      case 'POSTED': return t('workflows.status.POSTED');
      case 'PASSED': return t('workflows.status.PASSED');
      case 'WARNING': return t('workflows.status.WARNING');
      case 'FAILED': return t('workflows.status.FAILED');
      default: return status || '-';
    }
  };
  const customsCount = taxReport?.documentTrace?.customsDeclarations?.length || 0;
  const coCount = taxReport?.documentTrace?.certificatesOfOrigin?.length || 0;
  const refundTraceCount = taxReport?.documentTrace?.vatRefundDossiers?.length || 0;
  const tabVisibility = (tabKey: WorkflowTabKey): React.CSSProperties => ({
    display: activeWorkflowTab === tabKey ? undefined : 'none',
  });

  return (
    <div style={{ marginTop: 16 }}>
      <Tabs
        type="card"
        activeKey={activeWorkflowTab}
        onChange={(key) => setActiveWorkflowTab(key as WorkflowTabKey)}
        items={[
          {
            key: 'period',
            label: <Space orientation="horizontal"><LockOutlined />{t('workflows.cards.accountingPeriod')}</Space>,
          },
          {
            key: 'tax',
            label: <Space orientation="horizontal"><FileProtectOutlined />{t('workflows.cards.vatRefundDossier')}</Space>,
          },
          {
            key: 'fx',
            label: <Space orientation="horizontal"><CalculatorOutlined />{t('workflows.cards.fxRevaluation')}</Space>,
          },
          {
            key: 'audit',
            label: <Space orientation="horizontal"><SafetyCertificateOutlined />{t('workflows.sections.immutableAudit')}</Space>,
          },
        ]}
      />

      <Row
        gutter={[16, 16]}
        style={{
          marginBottom: activeWorkflowTab === 'audit' ? 0 : 16,
          display: activeWorkflowTab === 'audit' ? 'none' : undefined,
        }}
      >
        <Col xs={24} lg={8} style={tabVisibility('period')}>
          <Card size="small" title={<Space orientation="horizontal"><LockOutlined />{t('workflows.cards.accountingPeriod')}</Space>} variant="borderless">
            <Form form={periodForm} layout="vertical" onFinish={openPeriod}>
              <Form.Item name="periodRange" label={t('workflows.form.periodRange')} rules={[{ required: true, message: t('workflows.validation.periodRange') }]}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<UnlockOutlined />}>
                {t('actions.openPeriod')}
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={8} style={tabVisibility('fx')}>
          <Card size="small" title={<Space orientation="horizontal"><CalculatorOutlined />{t('workflows.cards.fxRevaluation')}</Space>} variant="borderless">
            <Form form={fxForm} layout="vertical" onFinish={runFx} initialValues={{ currency: 'USD', postJournal: true }}>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="revaluationDate" label={t('workflows.form.revaluationDate')} rules={[{ required: true, message: t('workflows.validation.revaluationDate') }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="currency" label={t('workflows.form.currency')} rules={[{ required: true, message: t('workflows.validation.currency') }]}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="closingRate" label={t('workflows.form.closingRate')} rules={[{ required: true, message: t('workflows.validation.closingRate') }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="postJournal" label={t('workflows.form.postJournal')} valuePropName="checked">
                <Switch />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<DollarOutlined />}>
                {t('actions.runRevaluation')}
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={8} style={tabVisibility('tax')}>
          <Card size="small" title={<Space orientation="horizontal"><FileProtectOutlined />{t('workflows.cards.vatRefundDossier')}</Space>} variant="borderless">
            <Form form={vatForm} layout="vertical" onFinish={createVatRefund}>
              <Form.Item name="periodRange" label={t('workflows.form.taxPeriod')} rules={[{ required: true, message: t('workflows.validation.taxPeriod') }]}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="exportRevenueVnd" label={t('workflows.form.exportRevenue')}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="refundAmount" label={t('workflows.form.refundAmount')}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" htmlType="submit" icon={<FileProtectOutlined />}>
                {t('actions.createDossier')}
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {activeWorkflowTab === 'tax' ? (
        <Card
          title={t('workflows.taxReport.title')}
          extra={(
            <Space orientation="horizontal">
              <Button icon={<DownloadOutlined />} onClick={exportTaxReport}>
                {t('actions.exportCsv')}
              </Button>
              {taxReport?.reportHash ? (
                <Text copyable={{ text: taxReport.reportHash }}>Hash: {String(taxReport.reportHash).slice(0, 12)}...</Text>
              ) : null}
            </Space>
          )}
          size="small"
          style={tabVisibility('tax')}
          variant="borderless"
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}>
              <Text type="secondary">{t('workflows.taxReport.inputVat')}</Text>
              <div><Text strong>{money(taxReport?.summary?.inputVat || 0)} VND</Text></div>
            </Col>
            <Col xs={24} md={6}>
              <Text type="secondary">{t('workflows.taxReport.outputVat')}</Text>
              <div><Text strong>{money(taxReport?.summary?.outputVat || 0)} VND</Text></div>
            </Col>
            <Col xs={24} md={6}>
              <Text type="secondary">{t('workflows.taxReport.refundableVat')}</Text>
              <div><Text strong type="success">{money(taxReport?.summary?.refundableVat || 0)} VND</Text></div>
            </Col>
            <Col xs={24} md={6}>
              <Text type="secondary">{t('workflows.taxReport.exportRevenue')}</Text>
              <div><Text strong>{money(taxReport?.summary?.exportRevenueVnd || 0)} VND</Text></div>
            </Col>
          </Row>
          {taxReport?.warnings?.length ? (
            <div style={{ marginTop: 12 }}>
              {taxReport.warnings.slice(0, 3).map((warning: string) => (
                <Tag color="warning" key={warning}>{translateTaxWarning(warning)}</Tag>
              ))}
            </div>
          ) : null}
          <div style={{ marginTop: 12 }}>
            <Space orientation="horizontal" wrap>
              <Tag color={customsCount ? 'success' : 'warning'}>{t('workflows.taxReport.customsTraced', { count: customsCount })}</Tag>
              <Tag color={coCount ? 'success' : 'warning'}>{t('workflows.taxReport.coTraced', { count: coCount })}</Tag>
              <Tag color={refundTraceCount ? 'success' : 'default'}>{t('workflows.taxReport.refundDossiers', { count: refundTraceCount })}</Tag>
              <Tag color={Number(taxReport?.reconciliation?.warningCount || 0) ? 'warning' : 'success'}>
                {t('workflows.taxReport.reconciliationWarnings', { count: Number(taxReport?.reconciliation?.warningCount || 0) })}
              </Tag>
            </Space>
          </div>
        </Card>
        ) : null}

        {activeWorkflowTab === 'period' ? (
        <Card
          title={t('workflows.sections.periodList')}
          extra={<Button icon={<ReloadOutlined />} onClick={fetchWorkflows}>{t('actions.refresh')}</Button>}
          size="small"
          style={tabVisibility('period')}
          variant="borderless"
        >
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={periods}
            pagination={false}
            size="middle"
            scroll={{ x: 1160 }}
            columns={[
              { title: t('workflows.columns.start'), dataIndex: 'startDate', render: (v) => dayjs(v).format('DD/MM/YYYY') },
              { title: t('workflows.columns.end'), dataIndex: 'endDate', render: (v) => dayjs(v).format('DD/MM/YYYY') },
              { title: t('workflows.columns.status'), dataIndex: 'status', render: (v) => <Tag color={statusColor[v] || 'default'}>{statusLabel(v)}</Tag> },
              { title: t('workflows.columns.closedBy'), dataIndex: 'closedByUsername', render: (v) => v || '-' },
              { title: t('workflows.columns.reopenCount'), dataIndex: 'reopenCount', align: 'right', render: (v) => Number(v || 0) },
              {
                title: 'Approval',
                render: (_, record: PeriodRow) => (
                  <Space orientation="horizontal" size={4}>
                    {record.reopenApprovalWorkflowRequest_id ? <Tag color="processing">{t('workflows.approval.reopenPending')}</Tag> : null}
                    {record.lockApprovalWorkflowRequest_id ? <Tag color="warning">{t('workflows.approval.lockPending')}</Tag> : null}
                    {!record.reopenApprovalWorkflowRequest_id && !record.lockApprovalWorkflowRequest_id ? '-' : null}
                  </Space>
                ),
              },
              { title: t('workflows.columns.periodHash'), dataIndex: 'periodHash', render: (v) => v ? <Text copyable={{ text: v }}>{String(v).slice(0, 10)}...</Text> : '-' },
              { title: t('workflows.columns.reopenedBy'), dataIndex: 'reopenedByUsername', render: (v) => v || '-' },
              {
                title: t('workflows.columns.actions'),
                align: 'right',
                render: (_, record: PeriodRow) => (
                  <Space orientation="horizontal">
                    <Button
                      size="small"
                      icon={<FileSearchOutlined />}
                      onClick={() => previewClosePolicy(record)}
                    >
                      {t('actions.policy')}
                    </Button>
                    {record.status === 'OPEN' && (
                      <Button
                        size="small"
                        icon={<LockOutlined />}
                        onClick={() => previewClosePolicy(record)}
                      >
                        {t('actions.close')}
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
                          {t('actions.reopen')}
                        </Button>
                        <Button
                          size="small"
                          danger
                          icon={<LockOutlined />}
                          disabled={Boolean(record.lockApprovalWorkflowRequest_id || record.reopenApprovalWorkflowRequest_id)}
                          onClick={() => callAction(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/periods/${record._id}/lock`, 'PATCH', { reason: t('workflows.defaults.lockReason') })}
                        >
                          {t('actions.requestLock')}
                        </Button>
                      </>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </Card>
        ) : null}

        {activeWorkflowTab === 'tax' ? (
        <Card size="small" style={tabVisibility('tax')} title={<Space orientation="horizontal"><SafetyCertificateOutlined />{t('workflows.sections.frozenTaxRuns')}</Space>} variant="borderless">
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={taxRunRows}
            pagination={standardPagination}
            size="middle"
            scroll={{ x: 920 }}
            columns={[
              { title: t('workflows.columns.run'), dataIndex: 'runNumber' },
              { title: t('workflows.columns.period'), render: (_, r: TaxReportRunRow) => `${dayjs(r.periodStart).format('DD/MM/YYYY')} - ${dayjs(r.periodEnd).format('DD/MM/YYYY')}` },
              { title: t('workflows.columns.by'), dataIndex: 'generatedByUsername', render: (v) => v || 'system' },
              { title: t('workflows.columns.warnings'), render: (_, r: TaxReportRunRow) => Number(r.warnings?.length || 0) },
              { title: t('workflows.columns.reportHash'), dataIndex: 'reportHash', render: (v) => v ? <Text copyable={{ text: v }}>{String(v).slice(0, 12)}...</Text> : '-' },
              { title: t('workflows.columns.runHash'), dataIndex: 'runHash', render: (v) => v ? <Text copyable={{ text: v }}>{String(v).slice(0, 12)}...</Text> : '-' },
            ]}
          />
        </Card>
        ) : null}

        {activeWorkflowTab === 'audit' ? (
        <Card size="small" style={tabVisibility('audit')} title={<Space orientation="horizontal"><FileProtectOutlined />{t('workflows.sections.closePackets')}</Space>} variant="borderless">
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={closePacketRows}
            pagination={standardPagination}
            size="middle"
            scroll={{ x: 980 }}
            columns={[
              { title: t('workflows.columns.packet'), dataIndex: 'packetNumber' },
              { title: t('workflows.columns.period'), render: (_, r: ClosePacketRow) => `${dayjs(r.periodStart).format('DD/MM/YYYY')} - ${dayjs(r.periodEnd).format('DD/MM/YYYY')}` },
              { title: t('workflows.columns.by'), dataIndex: 'generatedByUsername', render: (v) => v || 'system' },
              { title: t('workflows.columns.journals'), dataIndex: 'journalCount', align: 'right' },
              { title: t('workflows.columns.warnings'), dataIndex: 'warningCount', align: 'right', render: (v) => <Tag color={Number(v) ? 'warning' : 'success'}>{Number(v || 0)}</Tag> },
              { title: t('workflows.columns.failed'), dataIndex: 'failedCheckCount', align: 'right', render: (v) => <Tag color={Number(v) ? 'error' : 'success'}>{Number(v || 0)}</Tag> },
              { title: t('workflows.columns.packetHash'), dataIndex: 'packetHash', render: (v) => v ? <Text copyable={{ text: v }}>{String(v).slice(0, 12)}...</Text> : '-' },
            ]}
          />
        </Card>
        ) : null}

        {activeWorkflowTab === 'fx' ? (
        <Card size="small" style={tabVisibility('fx')} title={t('workflows.sections.fxRevaluations')} variant="borderless">
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={fxRows}
            pagination={standardPagination}
            size="middle"
            scroll={{ x: 900 }}
            columns={[
              { title: t('workflows.columns.run'), dataIndex: 'runNumber' },
              { title: t('workflows.columns.source'), render: (_, r: FxRevaluationRow) => `${r.sourceType} / ${r.sourceId?.slice(0, 12)}` },
              { title: t('workflows.columns.currency'), dataIndex: 'currency' },
              { title: t('workflows.columns.openFcy'), dataIndex: 'openAmountForeign', align: 'right', render: money },
              { title: t('workflows.columns.gainLossVnd'), dataIndex: 'gainLossVnd', align: 'right', render: (v) => <Text type={Number(v) >= 0 ? 'success' : 'danger'}>{money(v)}</Text> },
              { title: t('workflows.columns.status'), dataIndex: 'status', render: (v) => <Tag color={statusColor[v] || 'default'}>{statusLabel(v)}</Tag> },
            ]}
          />
        </Card>
        ) : null}

        {activeWorkflowTab === 'tax' ? (
        <Card size="small" style={tabVisibility('tax')} title={t('workflows.sections.vatRefundWorkflow')} variant="borderless">
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={vatRows}
            pagination={standardPagination}
            size="middle"
            scroll={{ x: 980 }}
            columns={[
              { title: t('workflows.columns.dossier'), dataIndex: 'dossierNumber' },
              { title: t('workflows.columns.period'), render: (_, r: VatRefundRow) => `${dayjs(r.periodStart).format('DD/MM/YYYY')} - ${dayjs(r.periodEnd).format('DD/MM/YYYY')}` },
              { title: t('workflows.taxReport.inputVat'), dataIndex: 'inputVatAmount', align: 'right', render: money },
              { title: t('workflows.taxReport.refundableVat'), dataIndex: 'refundAmount', align: 'right', render: money },
              { title: t('workflows.columns.status'), dataIndex: 'status', render: (v) => <Tag color={statusColor[v] || 'default'}>{statusLabel(v)}</Tag> },
              {
                title: t('workflows.columns.actions'),
                align: 'right',
                render: (_, record: VatRefundRow) => (
                  <Space orientation="horizontal">
                    {['DRAFT', 'REJECTED'].includes(record.status) && (
                      <Button size="small" icon={<CheckCircleOutlined />} onClick={() => callAction(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/vat-refunds/${record._id}/submit`, 'PATCH')}>
                        {t('actions.submit')}
                      </Button>
                    )}
                    {record.status === 'SUBMITTED' && (
                      <>
                        <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => callAction(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/vat-refunds/${record._id}/approve`, 'PATCH', {})}>
                          {t('actions.approve')}
                        </Button>
                        <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => callAction(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/vat-refunds/${record._id}/reject`, 'PATCH', { reason: t('workflows.defaults.rejectReason') })}>
                          {t('actions.reject')}
                        </Button>
                      </>
                    )}
                    {record.status === 'APPROVED' && (
                      <Button size="small" icon={<DollarOutlined />} onClick={() => callAction(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/accounting/vat-refunds/${record._id}/pay`, 'PATCH', {})}>
                        {t('actions.receiveMoney')}
                      </Button>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </Card>
        ) : null}

        {activeWorkflowTab === 'audit' ? (
        <Card size="small" style={tabVisibility('audit')} title={t('workflows.sections.immutableAudit')} variant="borderless">
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={auditRows}
            pagination={false}
            size="middle"
            scroll={{ x: 900 }}
            columns={[
              { title: t('workflows.columns.event'), dataIndex: 'eventType', render: (v) => <Tag color="blue">{v}</Tag> },
              { title: t('workflows.columns.entity'), render: (_, r: AuditEventRow) => `${r.entityType} / ${String(r.entityId || '').slice(0, 12)}` },
              { title: t('workflows.columns.user'), dataIndex: 'username', render: (v) => v || 'system' },
              { title: t('workflows.columns.at'), dataIndex: 'eventAt', render: (v) => dayjs(v).format('DD/MM/YYYY HH:mm') },
              { title: t('workflows.columns.hash'), dataIndex: 'eventHash', render: (v) => v ? <Text copyable={{ text: v }}>{String(v).slice(0, 12)}...</Text> : '-' },
            ]}
          />
        </Card>
        ) : null}
      </Space>

      <Modal
        title={t('workflows.closePolicy.title')}
        open={Boolean(closePolicyPeriod)}
        width={920}
        confirmLoading={policyLoading}
        onCancel={() => {
          setClosePolicy(null);
          setClosePolicyPeriod(null);
        }}
        okButtonProps={{ disabled: !closePolicy?.canClose || closePolicyPeriod?.status !== 'OPEN' }}
        okText={t('actions.close')}
        onOk={closeSelectedPeriod}
      >
        {closePolicy ? (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type={closePolicy.canClose ? 'success' : 'error'}
              showIcon
              title={closePolicy.canClose ? t('workflows.closePolicy.ready') : t('workflows.closePolicy.failed')}
              description={t('workflows.closePolicy.summary', {
                failed: closePolicy.failedCheckCount,
                warnings: closePolicy.warningCount,
                lines: closePolicy.closingItemCount,
              })}
            />
            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}>
                <Text type="secondary">{t('workflows.closePolicy.totalDebit')}</Text>
                <div><Text strong>{money(closePolicy.trialBalanceSnapshot.totalDebit)} VND</Text></div>
              </Col>
              <Col xs={24} md={8}>
                <Text type="secondary">{t('workflows.closePolicy.totalCredit')}</Text>
                <div><Text strong>{money(closePolicy.trialBalanceSnapshot.totalCredit)} VND</Text></div>
              </Col>
              <Col xs={24} md={8}>
                <Text type="secondary">{t('workflows.closePolicy.policyHash')}</Text>
                <div><Text copyable={{ text: closePolicy.policyHash }}>{closePolicy.policyHash.slice(0, 14)}...</Text></div>
              </Col>
            </Row>
            <Table
              rowKey="key"
              size="small"
              pagination={false}
              dataSource={closePolicy.checklist}
              columns={[
                { title: t('workflows.closePolicy.check'), dataIndex: 'label' },
                { title: t('workflows.columns.status'), dataIndex: 'status', render: (v) => <Tag color={statusColor[v] || 'default'}>{statusLabel(v)}</Tag> },
                { title: t('workflows.closePolicy.details'), dataIndex: 'details' },
              ]}
            />
          </Space>
        ) : (
          <Alert type="info" showIcon title={t('workflows.closePolicy.loading')} />
        )}
      </Modal>

      <Modal
        title={t('workflows.reopen.title')}
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
            { reason: reopenReason || t('workflows.defaults.reopenReason') },
          );
          setReopenRecord(null);
          setReopenReason('');
        }}
      >
        <Text type="secondary">{t('workflows.reopen.description')}</Text>
        <Input.TextArea
          rows={4}
          value={reopenReason}
          onChange={(event) => setReopenReason(event.target.value)}
          style={{ marginTop: 12 }}
          placeholder={t('workflows.reopen.placeholder')}
        />
      </Modal>
    </div>
  );
};

export default AccountingProductionWorkflows;
