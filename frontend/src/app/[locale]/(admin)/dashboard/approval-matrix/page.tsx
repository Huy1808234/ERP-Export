'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import { formatVND } from '@/utils/format';

const { Text } = Typography;

type ApprovalDocumentType =
  | 'PURCHASE_REQUEST'
  | 'PURCHASE_ORDER'
  | 'QUOTATION'
  | 'PROFORMA_INVOICE'
  | 'SALES_CONTRACT'
  | 'AP_PAYMENT_BATCH'
  | 'AP_PAYMENT_REVERSAL'
  | 'INVENTORY_COUNT'
  | 'INVENTORY_ADJUSTMENT'
  | 'PRODUCT_CHANGE_REQUEST'
  | 'VAT_REFUND'
  | 'ACCOUNTING_PERIOD_REOPEN'
  | 'ACCOUNTING_PERIOD_LOCK'
  | 'SALES_CONTRACT_CANCEL'
  | 'EXPORT_DOCUMENT_REVIEW'
  | 'TRADE_FINANCE';

type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface IApprovalRuleStep {
  _id?: string;
  stepOrder: number;
  approverRoleName: string;
  approverUsername?: string | null;
  label?: string | null;
  isRequired?: boolean;
}

interface IApprovalRule {
  _id: string;
  code: string;
  name: string;
  documentType: ApprovalDocumentType;
  currency?: string | null;
  minAmountVnd: number;
  maxAmountVnd?: number | null;
  priority: number;
  isActive: boolean;
  description?: string | null;
  createdByUsername: string;
  updatedByUsername?: string | null;
  steps: IApprovalRuleStep[];
  updatedAt: string;
}

interface IApprovalRuleFormValues {
  code?: string;
  name?: string;
  documentType?: ApprovalDocumentType;
  currency?: string | null;
  minAmountVnd?: number | null;
  maxAmountVnd?: number | null;
  priority?: number | null;
  isActive?: boolean;
  description?: string | null;
  steps?: IApprovalRuleStep[];
}

interface IApprovalWorkflowRequest {
  _id: string;
  documentType: ApprovalDocumentType;
  documentId: string;
  documentNumber?: string | null;
  title: string;
  currency: string;
  amount: number;
  amountVnd: number;
  status: ApprovalStatus;
  currentStepOrder: number;
  requesterUsername: string;
  completedByUsername?: string | null;
  completedAt?: string | null;
  rejectionReason?: string | null;
  steps?: Array<IApprovalRuleStep & { status: ApprovalStatus | 'SKIPPED'; actedByUsername?: string | null; actedAt?: string | null }>;
  createdAt: string;
}

const approvalDocumentTypes: ApprovalDocumentType[] = [
  'PURCHASE_REQUEST',
  'PURCHASE_ORDER',
  'QUOTATION',
  'PROFORMA_INVOICE',
  'SALES_CONTRACT',
  'AP_PAYMENT_BATCH',
  'AP_PAYMENT_REVERSAL',
  'INVENTORY_COUNT',
  'INVENTORY_ADJUSTMENT',
  'PRODUCT_CHANGE_REQUEST',
  'VAT_REFUND',
  'ACCOUNTING_PERIOD_REOPEN',
  'ACCOUNTING_PERIOD_LOCK',
  'SALES_CONTRACT_CANCEL',
  'EXPORT_DOCUMENT_REVIEW',
  'TRADE_FINANCE',
];

const fallbackDocumentTypeLabels: Record<ApprovalDocumentType, string> = {
  PURCHASE_REQUEST: 'Purchase Request',
  PURCHASE_ORDER: 'Purchase Order',
  QUOTATION: 'Quotation',
  PROFORMA_INVOICE: 'Proforma Invoice',
  SALES_CONTRACT: 'Sales Contract',
  AP_PAYMENT_BATCH: 'AP Payment Batch',
  AP_PAYMENT_REVERSAL: 'AP Payment Reversal',
  INVENTORY_COUNT: 'Inventory Count',
  INVENTORY_ADJUSTMENT: 'Inventory Adjustment',
  PRODUCT_CHANGE_REQUEST: 'Product Change Request',
  VAT_REFUND: 'VAT Refund',
  ACCOUNTING_PERIOD_REOPEN: 'Accounting Period Reopen',
  ACCOUNTING_PERIOD_LOCK: 'Accounting Period Lock',
  SALES_CONTRACT_CANCEL: 'Sales Contract Cancel',
  EXPORT_DOCUMENT_REVIEW: 'Export Document Review',
  TRADE_FINANCE: 'Trade Finance',
};

const roleOptions = [
  'DIRECTOR',
  'MANAGER',
  'SALES_EXPORT',
  'PURCHASING',
  'LOGISTICS',
  'WAREHOUSE',
  'ACCOUNTANT',
  'CHIEF_ACCOUNTANT',
  'ADMIN',
].map((role) => ({ value: role, label: role }));

const statusColor: Record<ApprovalStatus, string> = {
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
};

const ApprovalMatrixPage = () => {
  const t = useTranslations('ApprovalMatrix');
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<IApprovalRuleFormValues>();

  const [rules, setRules] = useState<IApprovalRule[]>([]);
  const [requests, setRequests] = useState<IApprovalWorkflowRequest[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<IApprovalRule | null>(null);
  const [selectedType, setSelectedType] = useState<ApprovalDocumentType | undefined>();

  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const documentTypeOptions = useMemo(
    () => approvalDocumentTypes.map((value) => ({
      value,
      label: (() => {
        try {
          return t(`documentTypes.${value}`);
        } catch {
          return fallbackDocumentTypeLabels[value];
        }
      })(),
    })),
    [t],
  );

  const formatDocumentType = useCallback(
    (value: ApprovalDocumentType) => {
      try {
        return t(`documentTypes.${value}`);
      } catch {
        return fallbackDocumentTypeLabels[value] || value;
      }
    },
    [t],
  );

  const fetchRules = useCallback(async () => {
    if (!headers) return;
    setLoadingRules(true);
    try {
      const res = await sendRequest<IBackendRes<IApprovalRule[]>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/approval-matrix/rules`,
        method: 'GET',
        queryParams: selectedType ? { documentType: selectedType } : undefined,
        headers,
      });
      setRules(res?.data ?? []);
    } finally {
      setLoadingRules(false);
    }
  }, [headers, selectedType]);

  const fetchRequests = useCallback(async () => {
    if (!headers) return;
    setLoadingRequests(true);
    try {
      const res = await sendRequest<IBackendRes<IApprovalWorkflowRequest[]>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/approval-matrix/requests`,
        method: 'GET',
        queryParams: { status: 'PENDING' },
        headers,
      });
      setRequests(res?.data ?? []);
    } finally {
      setLoadingRequests(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openCreate = () => {
    setEditingRule(null);
    setModalOpen(true);
  };

  const openEdit = (record: IApprovalRule) => {
    setEditingRule(record);
    setModalOpen(true);
  };

  useEffect(() => {
    if (!modalOpen) return;

    form.resetFields();
    if (!editingRule) {
      form.setFieldsValue({
        priority: 100,
        minAmountVnd: 0,
        isActive: true,
        steps: [{ stepOrder: 1, approverRoleName: 'MANAGER', isRequired: true }],
      });
      return;
    }

    form.setFieldsValue({
      ...editingRule,
      steps: (editingRule.steps || []).map((step) => ({
        stepOrder: step.stepOrder,
        approverRoleName: step.approverRoleName,
        approverUsername: step.approverUsername,
        label: step.label,
        isRequired: step.isRequired ?? true,
      })),
    });
  }, [editingRule, form, modalOpen]);

  const submitRule = async () => {
    if (!headers) return;
    const values = await form.validateFields();
    const normalizedSteps = (values.steps || []).map((step: IApprovalRuleStep, index: number) => ({
      ...step,
      stepOrder: Number(step.stepOrder || index + 1),
      approverRoleName: step.approverRoleName,
      approverUsername: step.approverUsername || null,
      label: step.label || null,
      isRequired: step.isRequired ?? true,
    }));

    const body = {
      ...values,
      currency: values.currency || null,
      maxAmountVnd: values.maxAmountVnd === undefined || values.maxAmountVnd === null ? null : Number(values.maxAmountVnd),
      minAmountVnd: Number(values.minAmountVnd || 0),
      priority: Number(values.priority || 100),
      isActive: values.isActive ?? true,
      steps: normalizedSteps,
    };

    const url = editingRule
      ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/approval-matrix/rules/${editingRule._id}`
      : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/approval-matrix/rules`;

    const payload = editingRule
      ? (({ name, currency, minAmountVnd, maxAmountVnd, priority, isActive, description, steps }) => ({
          name,
          currency,
          minAmountVnd,
          maxAmountVnd,
          priority,
          isActive,
          description,
          steps,
        }))(body)
      : body;

    const res = await sendRequest<IBackendRes<IApprovalRule>>({
      url,
      method: editingRule ? 'PATCH' : 'POST',
      body: payload,
      headers,
    });

    if (res?.data) {
      message.success(editingRule ? t('notifications.updateSuccess') : t('notifications.createSuccess'));
      setModalOpen(false);
      fetchRules();
    } else {
      message.error(res?.message || t('notifications.saveError'));
    }
  };

  const deactivateRule = (record: IApprovalRule) => {
    modal.confirm({
      title: t('confirmDeactivate.title'),
      content: t('confirmDeactivate.content', { code: record.code }),
      okText: t('actions.deactivate'),
      okButtonProps: { danger: true },
      cancelText: t('actions.cancel'),
      onOk: async () => {
        if (!headers) return;
        const res = await sendRequest<IBackendRes<IApprovalRule>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/approval-matrix/rules/${record._id}`,
          method: 'DELETE',
          headers,
        });
        if (res?.data) {
          message.success(t('notifications.deactivateSuccess'));
          fetchRules();
        }
      },
    });
  };

  const ruleColumns: ColumnsType<IApprovalRule> = [
    {
      title: t('table.rule'),
      key: 'rule',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text code>{record.code}</Text>
        </Space>
      ),
    },
    {
      title: t('table.documentType'),
      dataIndex: 'documentType',
      key: 'documentType',
      render: (value: ApprovalDocumentType) => <Tag color="blue">{formatDocumentType(value)}</Tag>,
    },
    {
      title: t('table.thresholdVnd'),
      key: 'amount',
      align: 'right',
      render: (_, record) => (
        <Space orientation="vertical" size={0} align="end">
          <Text>{formatVND(record.minAmountVnd || 0)}</Text>
          <Text type="secondary">
            {record.maxAmountVnd
              ? t('table.toAmount', { amount: formatVND(record.maxAmountVnd) })
              : t('table.unlimited')}
          </Text>
        </Space>
      ),
    },
    {
      title: t('table.steps'),
      key: 'steps',
      render: (_, record) => (
        <Space wrap>
          {(record.steps || []).map((step) => (
            <Tag key={`${record._id}-${step.stepOrder}`} color="purple">
              {step.stepOrder}. {step.approverUsername || step.approverRoleName}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('table.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? t('status.active') : t('status.inactive')}
        </Tag>
      ),
    },
    {
      title: t('table.updatedAt'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: t('table.actions'),
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>{t('actions.edit')}</Button>
          <Button size="small" danger disabled={!record.isActive} onClick={() => deactivateRule(record)}>{t('actions.deactivate')}</Button>
        </Space>
      ),
    },
  ];

  const requestColumns: ColumnsType<IApprovalWorkflowRequest> = [
    {
      title: t('requestTable.request'),
      key: 'request',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.title}</Text>
          <Text type="secondary">{record.documentNumber || record.documentId}</Text>
        </Space>
      ),
    },
    { title: t('requestTable.documentType'), dataIndex: 'documentType', render: (value: ApprovalDocumentType) => <Tag>{formatDocumentType(value)}</Tag> },
    { title: t('requestTable.requester'), dataIndex: 'requesterUsername' },
    { title: t('requestTable.amount'), dataIndex: 'amountVnd', align: 'right', render: (value) => formatVND(Number(value || 0)) },
    { title: t('requestTable.currentStep'), dataIndex: 'currentStepOrder', align: 'center' },
    { title: t('requestTable.status'), dataIndex: 'status', render: (value: ApprovalStatus) => <Tag color={statusColor[value]}>{t(`workflowStatus.${value}`)}</Tag> },
    { title: t('requestTable.createdAt'), dataIndex: 'createdAt', render: (value) => dayjs(value).format('DD/MM/YYYY HH:mm') },
  ];

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('title')}
        icon={<SafetyCertificateOutlined />}
        description={t('description')}
        extra={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchRules(); fetchRequests(); }}>
              {t('actions.reload')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t('actions.create')}
            </Button>
          </Space>
        )}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card variant="borderless">
            <Statistic title={t('stats.activeRules')} value={rules.filter((rule) => rule.isActive).length} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card variant="borderless">
            <Statistic title={t('stats.pendingRequests')} value={requests.filter((request) => request.status === 'PENDING').length} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card variant="borderless">
            <Statistic title={t('stats.coveredTypes')} value={new Set(rules.filter((rule) => rule.isActive).map((rule) => rule.documentType)).size} />
          </Card>
        </Col>
      </Row>

      <Card
        variant="borderless"
        title={t('sections.ruleConfig')}
        extra={(
          <Select
            allowClear
            placeholder={t('filters.documentType')}
            style={{ width: 240 }}
            options={documentTypeOptions}
            value={selectedType}
            onChange={setSelectedType}
          />
        )}
        style={{ marginBottom: 16 }}
      >
        <Table<IApprovalRule>
          rowKey="_id"
          columns={ruleColumns}
          dataSource={rules}
          loading={loadingRules}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Card variant="borderless" title={t('sections.openRequests')}>
        <Table<IApprovalWorkflowRequest>
          rowKey="_id"
          columns={requestColumns}
          dataSource={requests}
          loading={loadingRequests}
          expandable={{
            expandedRowRender: (record) => (
              <Space wrap>
                {(record.steps || []).map((step) => (
                  <Tag key={`${record._id}-${step.stepOrder}`} color={step.status === 'APPROVED' ? 'success' : step.status === 'REJECTED' ? 'error' : 'processing'}>
                    {step.stepOrder}. {step.approverUsername || step.approverRoleName} - {t(`workflowStatus.${step.status}`)}
                  </Tag>
                ))}
              </Space>
            ),
          }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title={editingRule ? t('modal.editTitle') : t('modal.createTitle')}
        open={modalOpen}
        onOk={submitRule}
        onCancel={() => setModalOpen(false)}
        okText={editingRule ? t('actions.update') : t('actions.submitCreate')}
        cancelText={t('actions.cancel')}
        width={920}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label={t('form.name')} rules={[{ required: true }]}>
                <Input placeholder={t('form.namePlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="code" label={t('form.code')}>
                <Input disabled={!!editingRule} placeholder={t('form.codePlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="documentType" label={t('form.documentType')} rules={[{ required: true }]}>
                <Select disabled={!!editingRule} options={documentTypeOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="minAmountVnd" label={t('form.minAmountVnd')} rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="maxAmountVnd" label={t('form.maxAmountVnd')}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder={t('form.unlimitedPlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="currency" label={t('form.currency')}>
                <Select
                  allowClear
                  options={['VND', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD'].map((value) => ({ value, label: value }))}
                  placeholder={t('form.allCurrencies')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="priority" label={t('form.priority')} rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="isActive" label={t('form.isActive')} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label={t('form.description')}>
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>

          <Form.List name="steps">
            {(fields, { add, remove }) => (
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Row align="middle" justify="space-between">
                  <Col><Text strong>{t('form.stepsTitle')}</Text></Col>
                  <Col><Button icon={<PlusOutlined />} onClick={() => add({ stepOrder: fields.length + 1, approverRoleName: 'MANAGER', isRequired: true })}>{t('actions.addStep')}</Button></Col>
                </Row>
                {fields.map((field) => {
                  const { key, name, ...restField } = field;

                  return (
                    <Card key={key} size="small" variant="borderless" styles={{ body: { padding: 12 } }}>
                    <Row gutter={12} align="middle">
                      <Col xs={24} md={3}>
                        <Form.Item {...restField} name={[name, 'stepOrder']} label={t('form.stepOrder')} rules={[{ required: true }]}>
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={6}>
                        <Form.Item {...restField} name={[name, 'approverRoleName']} label={t('form.approverRole')} rules={[{ required: true }]}>
                          <Select options={roleOptions} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={6}>
                        <Form.Item {...restField} name={[name, 'approverUsername']} label={t('form.approverUsername')}>
                          <Input placeholder={t('form.approverUsernamePlaceholder')} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={5}>
                        <Form.Item {...restField} name={[name, 'label']} label={t('form.stepLabel')}>
                          <Input placeholder={t('form.stepLabelPlaceholder')} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={2}>
                        <Form.Item {...restField} name={[name, 'isRequired']} label={t('form.isRequired')} valuePropName="checked">
                          <Switch />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={2}>
                        <Button
                          danger
                          icon={<CloseCircleOutlined />}
                          disabled={fields.length === 1}
                          onClick={() => remove(name)}
                        />
                      </Col>
                    </Row>
                    </Card>
                  );
                })}
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
    </AdminPageScroll>
  );
};

export default ApprovalMatrixPage;
