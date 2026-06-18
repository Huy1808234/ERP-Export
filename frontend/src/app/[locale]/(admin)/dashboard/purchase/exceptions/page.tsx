'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePurchaseExceptions } from '@/hooks/usePurchaseExceptions';
import type { IGRNLine, IGoodsReceipt } from '@/types/goods-receipt';
import type {
  CreateQualityCheckPayload,
  IP2PExceptionCandidate,
  IQualityCheck,
  IQualityCheckProduct,
  QCClaimStatus,
  QCExceptionStatus,
  QCResult,
  ResolveQualityExceptionPayload,
} from '@/types/purchase-exception';

const { Text } = Typography;

type ProductLike = Pick<IQualityCheckProduct, '_id'> & {
  sku?: string | null;
  vietnameseName?: string | null;
  englishName?: string | null;
};

interface IGRNLineOption {
  value: string;
  label: string;
  grn: IGoodsReceipt;
  line: IGRNLine;
}

interface IFormValidationError {
  errorFields?: Array<{
    errors?: string[];
  }>;
}

const exceptionColor: Record<QCExceptionStatus, string> = {
  NONE: 'default',
  QUARANTINED: 'orange',
  RETURN_CREATED: 'purple',
  CLAIM_OPEN: 'gold',
  CLOSED: 'green',
};

const claimColor: Record<QCClaimStatus, string> = {
  NONE: 'default',
  OPEN: 'orange',
  SENT: 'blue',
  RESOLVED: 'green',
  CANCELLED: 'red',
};

const resultColor: Record<QCResult, string> = {
  PASSED: 'green',
  FAILED: 'red',
  CONDITIONAL: 'orange',
};

const TECHNICAL_ENTITY_ID_REGEX = /^_[a-z][a-z0-9_]*_\d{8}_[a-z0-9]{8}$/;

const isTechnicalEntityId = (value?: string | null): boolean => (
  typeof value === 'string' && TECHNICAL_ENTITY_ID_REGEX.test(value)
);

const isFormValidationError = (error: unknown): error is IFormValidationError => (
  typeof error === 'object' && error !== null && 'errorFields' in error
);

const P2PExceptionsPage = () => {
  const t = useTranslations('PurchaseExceptions');
  const locale = useLocale();
  const { data: session } = useSession();
  const { message } = App.useApp();
  const [form] = Form.useForm<CreateQualityCheckPayload>();
  const [closeForm] = Form.useForm<ResolveQualityExceptionPayload>();
  const {
    rows,
    candidates,
    grns,
    dashboard,
    loading,
    error,
    fetchBoard,
    createException,
    sendClaim: sendQualityClaim,
    resolveException: resolveQualityException,
  } = usePurchaseExceptions(session);

  const [modalOpen, setModalOpen] = useState(false);
  const [resolvingRecord, setResolvingRecord] = useState<IQualityCheck | null>(null);

  const dateLocale = locale === 'vi' ? 'vi-VN' : 'en-US';

  const productName = useCallback((product?: ProductLike | null): string => {
    if (!product) return '-';
    if (locale === 'vi') {
      return product.vietnameseName || product.englishName || product.sku || '-';
    }
    return product.englishName || product.vietnameseName || product.sku || '-';
  }, [locale]);

  const formatNumber = useCallback((value: number | string | null | undefined): string => {
    const numericValue = Number(value ?? 0);
    return Number.isFinite(numericValue) ? numericValue.toLocaleString(dateLocale) : '0';
  }, [dateLocale]);

  const calculateDefectRate = useCallback((
    receivedQuantity: number | string | null | undefined,
    rejectedQuantity: number | string | null | undefined,
  ): number => {
    const received = Number(receivedQuantity ?? 0);
    const rejected = Number(rejectedQuantity ?? 0);
    if (!Number.isFinite(received) || received <= 0) return 0;
    if (!Number.isFinite(rejected) || rejected <= 0) return 0;
    return Number(((rejected / received) * 100).toFixed(2));
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  useEffect(() => {
    if (error) message.error(error);
  }, [error, message]);

  const grnLineOptions = useMemo<IGRNLineOption[]>(() => (
    grns.flatMap((grn) => (grn.items ?? []).map((line) => ({
      value: line._id,
      label: [
        grn.grNumber || grn.grnNumber || 'GRN',
        grn.purchaseOrder?.poNumber || 'PO',
        `${line.product?.sku || line.productId} - ${productName(line.product)}`,
      ].join(' | '),
      grn,
      line,
    })))
  ), [grns, productName]);

  const selectedLine_id = Form.useWatch('goodsReceiptItemId', form);
  const selectedLine = useMemo(() => (
    grnLineOptions.find((option) => option.value === selectedLine_id)
  ), [grnLineOptions, selectedLine_id]);

  const openCreateModal = useCallback((candidate?: IP2PExceptionCandidate) => {
    const receivedQuantity = candidate?.receivedQuantity ?? 0;
    const rejectedQuantity = candidate?.exceptionQuantity ?? 0;
    form.resetFields();
    form.setFieldsValue({
      goodsReceiptItemId: candidate?.goodsReceiptItem_id ?? undefined,
      result: 'FAILED',
      receivedQuantity,
      rejectedQuantity,
      defectRate: calculateDefectRate(receivedQuantity, rejectedQuantity),
      correctiveAction: candidate?.sourceType === 'PO_SHORT_RECEIPT'
        ? t('form.defaultBackorderAction')
        : t('form.defaultRejectAction'),
      inspectorNotes: candidate?.reason ?? undefined,
    });
    setModalOpen(true);
  }, [calculateDefectRate, form, t]);

  const submitException = async (): Promise<void> => {
    let values: CreateQualityCheckPayload;
    try {
      values = await form.validateFields();
    } catch (error) {
      if (isFormValidationError(error)) return;
      message.error(error instanceof Error ? error.message : t('messages.createError'));
      return;
    }

    const selectedOption = grnLineOptions.find((option) => option.value === values.goodsReceiptItemId);
    const goodsReceipt_id = values.goodsReceiptId ?? selectedOption?.grn._id;
    const purchaseOrder_id = values.purchaseOrderId ?? selectedOption?.grn.purchaseOrder?._id ?? selectedOption?.grn.purchaseOrderId;
    const payload: CreateQualityCheckPayload = {
      ...values,
      goodsReceiptItemId: isTechnicalEntityId(values.goodsReceiptItemId)
        ? values.goodsReceiptItemId
        : undefined,
      goodsReceiptId: isTechnicalEntityId(goodsReceipt_id) ? goodsReceipt_id : undefined,
      purchaseOrderId: isTechnicalEntityId(purchaseOrder_id) ? purchaseOrder_id : undefined,
      productId: values.productId ?? selectedOption?.line.productId,
    };
    const result = await createException(payload);

    if (result.data) {
      message.success(t('messages.createSuccess'));
      setModalOpen(false);
      fetchBoard();
    } else {
      message.error(result.error || t('messages.createError'));
    }
  };

  const sendClaim = async (record: IQualityCheck): Promise<void> => {
    const result = await sendQualityClaim(
      record._id,
      t('messages.claimNote', { number: record.claimNumber || record.checkNumber }),
    );

    if (result.data) {
      message.success(t('messages.claimSuccess'));
      fetchBoard();
    } else {
      message.error(result.error || t('messages.claimError'));
    }
  };

  const resolveSelectedException = async (): Promise<void> => {
    if (!resolvingRecord) return;
    let values: ResolveQualityExceptionPayload;
    try {
      values = await closeForm.validateFields();
    } catch (error) {
      if (isFormValidationError(error)) return;
      message.error(error instanceof Error ? error.message : t('messages.resolveError'));
      return;
    }

    const result = await resolveQualityException(resolvingRecord._id, values);

    if (result.data) {
      message.success(t('messages.resolveSuccess'));
      setResolvingRecord(null);
      closeForm.resetFields();
      fetchBoard();
    } else {
      message.error(result.error || t('messages.resolveError'));
    }
  };

  const openCount = dashboard?.summary.openExceptionCount
    ?? rows.filter((row) => row.exceptionStatus !== 'CLOSED').length + candidates.length;
  const rejectedTotal = dashboard?.summary.rejectedQuantity
    ?? rows.reduce((sum, row) => sum + Number(row.rejectedQuantity || 0), 0)
      + candidates.reduce((sum, row) => sum + Number(row.rejectedQuantity || 0), 0);
  const backorderTotal = dashboard?.summary.backorderQuantity
    ?? rows.reduce((sum, row) => sum + Number(row.backorderQuantity || 0), 0)
      + candidates.reduce((sum, row) => sum + Number(row.backorderQuantity || 0), 0);
  const sentClaimCount = dashboard?.summary.sentClaimCount ?? rows.filter((row) => row.claimStatus === 'SENT').length;
  const pendingSourceCount = dashboard?.summary.pendingSourceCount ?? candidates.length;

  const candidateColumns: ColumnsType<IP2PExceptionCandidate> = [
    {
      title: t('candidateTable.source'),
      key: 'source',
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Space wrap>
            <Tag color={record.sourceType === 'GRN_REJECTED_LINE' ? 'red' : 'orange'}>
              {t(`sourceTypes.${record.sourceType}`)}
            </Tag>
            <Text strong>{record.sourceNumber}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.poNumber || '-'} {record.grNumber ? `/ ${record.grNumber}` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: t('candidateTable.product'),
      key: 'product',
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Text strong>{record.product?.sku || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{productName(record.product)}</Text>
        </Space>
      ),
    },
    {
      title: t('candidateTable.vendor'),
      dataIndex: 'vendorName',
      render: (value: string | null) => value || '-',
    },
    {
      title: t('candidateTable.quantity'),
      key: 'quantity',
      width: 220,
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Text>{t('labels.ordered')}: <Text strong>{formatNumber(record.quantityOrdered)}</Text></Text>
          <Text>{t('labels.received')}: <Text strong>{formatNumber(record.receivedQuantity)}</Text></Text>
          <Text type={record.rejectedQuantity > 0 ? 'danger' : 'secondary'}>
            {t('labels.rejected')}: <Text strong>{formatNumber(record.rejectedQuantity)}</Text>
          </Text>
          <Text type="secondary">{t('labels.backorder')}: {formatNumber(record.backorderQuantity)}</Text>
        </Space>
      ),
    },
    {
      title: t('candidateTable.reason'),
      key: 'reason',
      ellipsis: true,
      render: (_, record) => record.reason || record.qualityStatus || '-',
    },
    {
      title: t('candidateTable.actions'),
      key: 'actions',
      align: 'right',
      width: 170,
      render: (_, record) => (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!record.canCreateQc}
          onClick={() => openCreateModal(record)}
        >
          {t(record.canCreateQc ? 'actions.createQc' : 'actions.waitingGrn')}
        </Button>
      ),
    },
  ];

  const exceptionColumns: ColumnsType<IQualityCheck> = [
    {
      title: t('exceptionTable.qc'),
      key: 'qc',
      render: (_, record) => {
        const product = record.goodsReceiptItem?.product ?? record.product;
        return (
          <Space orientation="vertical" size={2}>
            <Space wrap>
              <Text strong>{record.checkNumber}</Text>
              <Tag color={resultColor[record.result]}>{t(`results.${record.result}`)}</Tag>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {product?.sku || '-'} - {productName(product)}
            </Text>
          </Space>
        );
      },
    },
    {
      title: t('exceptionTable.source'),
      key: 'source',
      render: (_, record) => {
        const po = record.purchaseOrder ?? record.goodsReceipt?.purchaseOrder;
        return (
          <Space orientation="vertical" size={2}>
            <Space wrap>
              <Tag color="blue">{po?.poNumber || '-'}</Tag>
              <Tag>{record.goodsReceipt?.grNumber || '-'}</Tag>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>{po?.vendor?.name || '-'}</Text>
          </Space>
        );
      },
    },
    {
      title: t('exceptionTable.quantity'),
      key: 'quantities',
      width: 220,
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Text>{t('labels.received')}: <Text strong>{formatNumber(record.receivedQuantity)}</Text></Text>
          <Text type="danger">{t('labels.rejected')}: <Text strong type="danger">{formatNumber(record.rejectedQuantity)}</Text></Text>
          <Text type="secondary">{t('labels.backorder')}: {formatNumber(record.backorderQuantity)}</Text>
        </Space>
      ),
    },
    {
      title: t('exceptionTable.claim'),
      key: 'claim',
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Space wrap>
            <Tag color={exceptionColor[record.exceptionStatus]}>{t(`exceptionStatus.${record.exceptionStatus}`)}</Tag>
            <Tag color={claimColor[record.claimStatus]}>{t(`claimStatus.${record.claimStatus}`)}</Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.claimNumber || '-'} | {record.purchaseReturn?.returnNumber || t('labels.noReturn')}
          </Text>
          {record.claimSentAt ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('labels.sentBy', {
                username: record.claimSentByUsername || '-',
                date: new Date(record.claimSentAt).toLocaleDateString(dateLocale),
              })}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('exceptionTable.settlement'),
      key: 'settlement',
      width: 190,
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Tag color={record.resolutionType && record.resolutionType !== 'NONE' ? 'green' : 'default'}>
            {t(`resolutionTypes.${record.resolutionType || 'NONE'}`)}
          </Tag>
          {Number(record.creditAmount || 0) > 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('labels.credit')}: {formatNumber(record.creditAmount)}
            </Text>
          ) : null}
          {record.replacementDueDate ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('labels.replacementDue')}: {record.replacementDueDate}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('exceptionTable.notes'),
      key: 'notes',
      ellipsis: true,
      render: (_, record) => record.inspectorNotes || record.correctiveAction || '-',
    },
    {
      title: t('exceptionTable.actions'),
      key: 'actions',
      align: 'right',
      width: 220,
      render: (_, record) => (
        <Space wrap>
          <Button
            icon={<SendOutlined />}
            disabled={!['OPEN', 'SENT'].includes(record.claimStatus) || record.exceptionStatus === 'CLOSED'}
            onClick={() => sendClaim(record)}
          >
            {t('actions.sendClaim')}
          </Button>
          <Popconfirm
            title={t('confirm.resolveTitle')}
            okText={t('confirm.openForm')}
            cancelText={t('actions.cancel')}
            onConfirm={() => {
              closeForm.setFieldsValue({
                resolutionType: 'REPLACEMENT',
                note: t('form.defaultResolutionNote'),
              });
              setResolvingRecord(record);
            }}
          >
            <Button
              icon={<CheckCircleOutlined />}
              disabled={record.exceptionStatus === 'CLOSED'}
            >
              {t('actions.resolve')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('title')}
        icon={<ExclamationCircleOutlined />}
        description={t('description')}
        extra={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchBoard}>
              {t('actions.reload')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal()}>
              {t('actions.createQc')}
            </Button>
          </Space>
        )}
      />

      {error ? (
        <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />
      ) : null}

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={8} xl={4}>
          <Card size="small" variant="borderless" styles={{ body: { minHeight: 76 } }}>
            <Statistic title={t('stats.openExceptions')} value={openCount} />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Card size="small" variant="borderless" styles={{ body: { minHeight: 76 } }}>
            <Statistic
              title={t('stats.rejectedQuantity')}
              value={rejectedTotal}
              suffix={t('units.unit')}
              styles={{ content: { color: '#cf1322' } }}
            />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Card size="small" variant="borderless" styles={{ body: { minHeight: 76 } }}>
            <Statistic title={t('stats.sentClaims')} value={sentClaimCount} suffix={t('units.claim')} />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Card size="small" variant="borderless" styles={{ body: { minHeight: 76 } }}>
            <Statistic title={t('stats.pendingSources')} value={pendingSourceCount} />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Card size="small" variant="borderless" styles={{ body: { minHeight: 76 } }}>
            <Statistic title={t('stats.backorderQuantity')} value={backorderTotal} suffix={t('units.unit')} />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Card size="small" variant="borderless" styles={{ body: { minHeight: 76 } }}>
            <Statistic
              title={t('stats.overdueReplacement')}
              value={dashboard?.summary.overdueReplacementCount ?? 0}
              suffix={t('units.line')}
              styles={{ content: { color: '#fa8c16' } }}
            />
          </Card>
        </Col>
      </Row>

      {openCount > 0 ? (
        <Alert
          type="warning"
          showIcon
          title={t('alerts.openTitle', { count: openCount })}
          description={t('alerts.openDescription')}
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Alert
          type="success"
          showIcon
          title={t('alerts.clearTitle')}
          description={t('alerts.clearDescription')}
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs
        defaultActiveKey="pendingSources"
        items={[
          {
            key: 'pendingSources',
            label: t('sections.pendingSources'),
            children: (
              <Card title={t('sections.pendingSources')} variant="borderless" style={{ overflow: 'hidden' }}>
                <Table<IP2PExceptionCandidate>
                  rowKey="_id"
                  columns={candidateColumns}
                  dataSource={candidates}
                  loading={loading}
                  locale={{ emptyText: t('empty.noCandidates') }}
                  pagination={{ pageSize: 8, showSizeChanger: true }}
                  scroll={{ x: 1120 }}
                />
              </Card>
            ),
          },
          {
            key: 'activeClaims',
            label: t('sections.activeClaims'),
            children: (
              <Card title={t('sections.activeClaims')} variant="borderless" style={{ overflow: 'hidden' }}>
                <Table<IQualityCheck>
                  rowKey="_id"
                  columns={exceptionColumns}
                  dataSource={rows}
                  loading={loading}
                  locale={{ emptyText: t('empty.noExceptions') }}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 1360 }}
                />
              </Card>
            ),
          },
          {
            key: 'overview',
            label: t('sections.overview'),
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card title={t('sections.vendorBackorder')} variant="borderless" style={{ overflow: 'hidden' }}>
                    <Table
                      size="small"
                      rowKey="vendor_id"
                      pagination={false}
                      dataSource={(dashboard?.byVendor ?? []).slice(0, 8)}
                      locale={{ emptyText: t('empty.noVendor') }}
                      scroll={{ x: 520 }}
                      columns={[
                        { title: t('vendorTable.vendor'), dataIndex: 'vendorName' },
                        { title: t('vendorTable.open'), dataIndex: 'openExceptionCount', align: 'right' as const, width: 92 },
                        { title: t('vendorTable.claim'), dataIndex: 'openClaimCount', align: 'right' as const, width: 92 },
                        { title: t('vendorTable.backorder'), dataIndex: 'backorderQuantity', align: 'right' as const, width: 120 },
                      ]}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title={t('sections.productBackorder')} variant="borderless" style={{ overflow: 'hidden' }}>
                    <Table
                      size="small"
                      rowKey="product_id"
                      pagination={false}
                      dataSource={(dashboard?.byProduct ?? []).slice(0, 8)}
                      locale={{ emptyText: t('empty.noProduct') }}
                      scroll={{ x: 560 }}
                      columns={[
                        { title: t('productTable.sku'), dataIndex: 'sku', width: 150 },
                        { title: t('productTable.product'), dataIndex: 'productName' },
                        { title: t('productTable.open'), dataIndex: 'openExceptionCount', align: 'right' as const, width: 92 },
                        { title: t('productTable.backorder'), dataIndex: 'backorderQuantity', align: 'right' as const, width: 120 },
                      ]}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />

      <Modal
        title={t('modal.createTitle')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submitException}
        okText={t('modal.createOk')}
        cancelText={t('actions.cancel')}
        width={760}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="goodsReceiptItemId"
            label={t('form.grnLine')}
            rules={[{ required: true, message: t('validation.selectGrnLine') }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t('form.selectGrnLine')}
              options={grnLineOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={(value) => {
                const option = grnLineOptions.find((item) => item.value === value);
                const receivedQuantity = option?.line.quantityReceived ?? 0;
                const rejectedQuantity = option?.line.quantityRejected ?? 0;
                form.setFieldsValue({
                  receivedQuantity,
                  rejectedQuantity,
                  defectRate: calculateDefectRate(receivedQuantity, rejectedQuantity),
                });
              }}
            />
          </Form.Item>

          {selectedLine ? (
            <Alert
              type="info"
              showIcon
              title={`${selectedLine.grn.grNumber || 'GRN'} - ${selectedLine.grn.purchaseOrder?.poNumber || 'PO'}`}
              description={t('form.selectedLineDescription', {
                sku: selectedLine.line.product?.sku || '',
                product: productName(selectedLine.line.product),
                received: formatNumber(selectedLine.line.quantityReceived),
                rejected: formatNumber(selectedLine.line.quantityRejected || 0),
              })}
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="result" label={t('form.qcResult')} rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'FAILED', label: t('results.FAILED') },
                    { value: 'CONDITIONAL', label: t('results.CONDITIONAL') },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="receivedQuantity" label={t('form.receivedQuantity')}>
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  onChange={(value) => {
                    form.setFieldValue(
                      'defectRate',
                      calculateDefectRate(value, form.getFieldValue('rejectedQuantity')),
                    );
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="rejectedQuantity"
                label={t('form.rejectedQuantity')}
                rules={[{ required: true, message: t('validation.rejectedQuantity') }]}
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  onChange={(value) => {
                    form.setFieldValue(
                      'defectRate',
                      calculateDefectRate(form.getFieldValue('receivedQuantity'), value),
                    );
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="defectRate" label={t('form.defectRate')}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item name="correctiveAction" label={t('form.correctiveAction')}>
                <Input placeholder={t('form.correctiveActionPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="inspectorNotes"
                label={t('form.inspectorNotes')}
                rules={[{ required: true, message: t('validation.inspectorNotes') }]}
              >
                <Input.TextArea rows={3} placeholder={t('form.inspectorNotesPlaceholder')} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={t('modal.resolveTitle', { number: resolvingRecord?.checkNumber || '' })}
        open={Boolean(resolvingRecord)}
        onCancel={() => setResolvingRecord(null)}
        onOk={resolveSelectedException}
        okText={t('modal.resolveOk')}
        cancelText={t('actions.cancel')}
        destroyOnHidden
      >
        <Form form={closeForm} layout="vertical">
          <Form.Item
            name="resolutionType"
            label={t('form.resolutionType')}
            rules={[{ required: true, message: t('validation.resolutionType') }]}
          >
            <Select
              options={[
                { value: 'REPLACEMENT', label: t('resolutionTypes.REPLACEMENT') },
                { value: 'CREDIT_NOTE', label: t('resolutionTypes.CREDIT_NOTE') },
                { value: 'ACCEPT_AS_IS', label: t('resolutionTypes.ACCEPT_AS_IS') },
                { value: 'CANCELLED', label: t('resolutionTypes.CANCELLED') },
                { value: 'OTHER', label: t('resolutionTypes.OTHER') },
              ]}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="creditAmount" label={t('form.creditAmount')}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="replacementDueDate" label={t('form.replacementDueDate')}>
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="note"
            label={t('form.resolutionNote')}
            rules={[{ required: true, message: t('validation.resolutionNote') }]}
          >
            <Input.TextArea rows={4} placeholder={t('form.resolutionNotePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </AdminPageScroll>
  );
};

export default P2PExceptionsPage;
