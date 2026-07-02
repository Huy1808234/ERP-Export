'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Steps,
  Tag,
  Typography,
  theme,
} from 'antd';
import {
  CheckCircleOutlined,
  ContainerOutlined,
  DeleteOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  RollbackOutlined,
  ShopOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { notification } from '@/providers/antd-static';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { getAccessToken } from '@/lib/auth-token';
import { useTheme } from '@/context/theme.context';
import type { PurchaseReturnLineCondition, PurchaseReturnReasonCode } from '@/types/purchase-return';

const { Text } = Typography;

const RETURNABLE_PO_STATUSES = 'PARTIAL_RECEIPT,RECEIVED,COMPLETED';

type PurchaseReturnProduct = {
  _id: string;
  sku?: string;
  vietnameseName?: string;
  unitOfMeasure?: string;
};

type PurchaseReturnPoLine = {
  _id: string;
  productId: string;
  product?: PurchaseReturnProduct;
  quantity: number | string;
  receivedQuantity: number | string;
  rejectedQuantity?: number | string;
  unitPrice?: number | string;
  unit?: string | null;
};

type PurchaseReturnPo = {
  _id: string;
  poNumber: string;
  status: string;
  vendor?: { _id?: string; name?: string };
  currency?: string;
  items?: PurchaseReturnPoLine[];
};

type PurchaseReturnFormItem = {
  productId?: string;
  quantity?: number;
  unit?: string | null;
  unitPrice?: number;
  condition?: PurchaseReturnLineCondition;
  batchNumber?: string | null;
  expiryDate?: Dayjs | null;
  note?: string | null;
};

type PurchaseReturnFormValues = {
  purchaseOrderId: string;
  returnDate: Dayjs;
  reasonCode?: PurchaseReturnReasonCode;
  reason?: string;
  claimNumber?: string;
  carrierTrackingRef?: string;
  expectedPickupAt?: Dayjs | null;
  items: PurchaseReturnFormItem[];
};

interface IProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  fetchData: () => void;
}

const toNumber = (value: number | string | null | undefined): number => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getReturnableQuantity = (line: PurchaseReturnPoLine): number => {
  return Math.max(toNumber(line.receivedQuantity), 0);
};

const REASON_CODE_KEYS: PurchaseReturnReasonCode[] = [
  'DEFECTIVE',
  'EXPIRED',
  'WRONG_SPEC',
  'DAMAGED_IN_TRANSIT',
  'OVERSUPPLY',
  'QUALITY_REJECT',
  'OTHER',
];

const CONDITION_KEYS: PurchaseReturnLineCondition[] = [
  'GOOD',
  'DAMAGED',
  'DEFECTIVE',
  'EXPIRED',
  'WRONG_SPEC',
];

const PurchaseReturnModal = (props: IProps) => {
  const t = useTranslations('PurchaseReturn');
  const { isOpen, setIsOpen, fetchData } = props;
  const { data: session } = useSession();
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const [form] = Form.useForm<PurchaseReturnFormValues>();
  const [loading, setLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseReturnPo[]>([]);
  const [poLoading, setPoLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const selectedPurchaseOrderId = Form.useWatch('purchaseOrderId', form);
  const watchedFormItems = Form.useWatch('items', form);
  const watchedItems = useMemo(
    () => watchedFormItems ?? [],
    [watchedFormItems],
  );
  const watchedReasonCode = Form.useWatch('reasonCode', form);

  const selectedPurchaseOrder = useMemo(
    () =>
      purchaseOrders.find((po) => po._id === selectedPurchaseOrderId) ?? null,
    [purchaseOrders, selectedPurchaseOrderId],
  );

  const returnableLines = useMemo(
    () =>
      (selectedPurchaseOrder?.items ?? []).filter(
        (line) => getReturnableQuantity(line) > 0,
      ),
    [selectedPurchaseOrder],
  );

  const productOptions = useMemo(
    () =>
      returnableLines.map((line) => ({
        label: `[${line.product?.sku || line.productId}] ${
          line.product?.vietnameseName || line.productId
        }`,
        value: line.productId,
      })),
    [returnableLines],
  );

  /** Pre-computed totals for live preview. */
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalRefund = 0;
    for (const item of watchedItems) {
      const q = Number(item?.quantity || 0);
      const p = Number(item?.unitPrice || 0);
      totalQty += q;
      totalRefund += q * p;
    }
    return {
      totalQty: +totalQty.toFixed(2),
      totalRefund: +totalRefund.toFixed(2),
    };
  }, [watchedItems]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      return;
    }

    const fetchPurchaseOrders = async () => {
      setPoLoading(true);
      try {
        const res = await sendRequest<
          IBackendRes<{ results: PurchaseReturnPo[] }>
        >({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders`,
          method: 'GET',
          queryParams: {
            current: 1,
            pageSize: 100,
            status: RETURNABLE_PO_STATUSES,
          },
          headers: { Authorization: `Bearer ${getAccessToken(session)}` },
        });
        const rows = (res?.data?.results ?? []).filter((po) =>
          (po.items ?? []).some((line) => getReturnableQuantity(line) > 0),
        );
        setPurchaseOrders(rows);
      } catch {
        notification.error({ title: t('notifications.createError') });
      } finally {
        setPoLoading(false);
      }
    };

    form.setFieldsValue({
      returnDate: dayjs(),
      reasonCode: 'DEFECTIVE',
      items: [{}],
    });
    fetchPurchaseOrders();
  }, [form, isOpen, session, t]);

  const handleCancel = () => {
    form.resetFields();
    setCurrentStep(0);
    setIsOpen(false);
  };

  const onFinish = async (values: PurchaseReturnFormValues) => {
    setLoading(true);
    try {
      const payload = {
        purchaseOrderId: values.purchaseOrderId,
        returnDate: values.returnDate.format('YYYY-MM-DD'),
        reasonCode: values.reasonCode || null,
        reason: values.reason?.trim() || null,
        claimNumber: values.claimNumber?.trim() || null,
        carrierTrackingRef: values.carrierTrackingRef?.trim() || null,
        expectedPickupAt: values.expectedPickupAt
          ? values.expectedPickupAt.format('YYYY-MM-DD')
          : null,
        items: values.items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity || 0),
          unit: item.unit?.trim() || null,
          unitPrice: Number(item.unitPrice || 0),
          condition: item.condition || 'DAMAGED',
          batchNumber: item.batchNumber?.trim() || null,
          expiryDate: item.expiryDate
            ? item.expiryDate.format('YYYY-MM-DD')
            : null,
          note: item.note?.trim() || null,
        })),
      };

      const res = await sendRequest<IBackendRes<unknown>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-returns`,
        method: 'POST',
        body: payload,
        headers: { Authorization: `Bearer ${getAccessToken(session)}` },
      });

      if (res?.data) {
        notification.success({ title: t('notifications.createSuccess') });
        form.resetFields();
        setCurrentStep(0);
        setIsOpen(false);
        fetchData();
      } else {
        notification.error({
          title: t('notifications.createError'),
          description: Array.isArray(res?.message)
            ? res.message.join(', ')
            : res?.message,
        });
      }
    } catch {
      notification.error({ title: t('notifications.createError') });
    } finally {
      setLoading(false);
    }
  };

  const goToStep = async (next: number) => {
    if (next > currentStep) {
      try {
        if (currentStep === 0) {
          await form.validateFields([
            'purchaseOrderId',
            'returnDate',
            'reasonCode',
          ]);
        } else if (currentStep === 1) {
          await form.validateFields(['items']);
        }
      } catch {
        return;
      }
    }
    setCurrentStep(next);
  };

  const cardBg = isDark ? 'rgba(15, 23, 42, 0.45)' : token.colorFillAlter;
  const cardBorder = isDark ? 'rgba(148, 163, 184, 0.16)' : token.colorBorderSecondary;

  return (
    <Modal
      title={
        <Space>
          <RollbackOutlined style={{ color: token.colorError }} />
          <Text strong style={{ fontSize: 17 }}>
            {t('modal.titleCreate')}
          </Text>
        </Space>
      }
      open={isOpen}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={960}
      destroyOnHidden
      okText={t('modal.okText')}
      style={{ top: 32 }}
      styles={{
        body: { paddingTop: 8, paddingBottom: 8 },
      }}
    >
      <Steps
        current={currentStep}
        size="small"
        className="mb-4"
        items={[
          {
            title: 'PO',
            icon: <ShopOutlined />,
            content: selectedPurchaseOrder?.poNumber,
          },
          {
            title: t('modal.steps.items'),
            icon: <ContainerOutlined />,
            content:
              totals.totalQty > 0
                ? `${totals.totalQty} • ${totals.totalRefund.toLocaleString()}`
                : undefined,
          },
          {
            title: t('modal.steps.reason'),
            icon: <SolutionOutlined />,
            content: watchedReasonCode,
          },
        ]}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          returnDate: dayjs(),
          reasonCode: 'DEFECTIVE',
          items: [{}],
        }}
        requiredMark="optional"
      >
        {/* STEP 0 — PO selection + meta */}
        <div hidden={currentStep !== 0}>
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item
                label={t('modal.form.purchaseOrder')}
                name="purchaseOrderId"
                rules={[
                  {
                    required: true,
                    message: t('modal.rules.purchaseOrderRequired'),
                  },
                ]}
              >
                <Select
                  showSearch
                  loading={poLoading}
                  placeholder={t('modal.form.purchaseOrderPlaceholder')}
                  optionFilterProp="label"
                  options={purchaseOrders.map((po) => ({
                    label: `${po.poNumber} • ${po.vendor?.name || 'NCC'}`,
                    value: po._id,
                  }))}
                  onChange={(purchaseOrderId) => {
                    form.setFieldsValue({ purchaseOrderId, items: [{}] });
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label={t('modal.form.returnDate')}
                name="returnDate"
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          {selectedPurchaseOrder?.vendor?.name ? (
            <Tag
              color="blue"
              icon={<ShopOutlined />}
              style={{ marginBottom: 12, padding: '4px 10px' }}
            >
              {t('modal.form.vendor', {
                vendor: selectedPurchaseOrder.vendor.name,
              })}
            </Tag>
          ) : null}

          {selectedPurchaseOrder ? (
            <Card
              size="small"
              style={{
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                borderRadius: 12,
              }}
            >
              <Space size="large" wrap>
                <StatisticMini
                  label={t('modal.form.poNo')}
                  value={selectedPurchaseOrder.poNumber}
                />
                <StatisticMini
                  label={t('detail.currency')}
                  value={selectedPurchaseOrder.currency || 'VND'}
                />
                <StatisticMini
                  label={t('modal.form.returnableLines')}
                  value={`${returnableLines.length}`}
                />
              </Space>
            </Card>
          ) : (
            <Alert
              type="info"
              showIcon
              title={t('modal.form.purchaseOrderPlaceholder')}
            />
          )}
        </div>

        {/* STEP 1 — Line items */}
        <div hidden={currentStep !== 1}>
          {!selectedPurchaseOrder ? (
            <Alert
              type="warning"
              showIcon
              title={t('modal.rules.purchaseOrderRequired')}
            />
          ) : (
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => {
                    const selectedProductId = watchedItems[name]?.productId;
                    const selectedLine = returnableLines.find(
                      (line) => line.productId === selectedProductId,
                    );
                    const maxQuantity = selectedLine
                      ? getReturnableQuantity(selectedLine)
                      : undefined;
                    const defaultUnitPrice = selectedLine
                      ? toNumber(selectedLine.unitPrice)
                      : 0;

                    return (
                      <Card
                        key={key}
                        size="small"
                        style={{
                          marginBottom: 12,
                          borderRadius: 12,
                          background: cardBg,
                          border: `1px solid ${cardBorder}`,
                        }}
                        styles={{
                          body: { padding: 12 },
                        }}
                      >
                        <Row gutter={[12, 8]}>
                          <Col xs={24} md={8}>
                            <Form.Item
                              {...restField}
                              label={t('modal.form.product')}
                              name={[name, 'productId']}
                              rules={[
                                {
                                  required: true,
                                  message: t('modal.rules.productRequired'),
                                },
                              ]}
                              style={{ marginBottom: 0 }}
                            >
                              <Select
                                showSearch
                                placeholder={t(
                                  'modal.form.productPlaceholder',
                                )}
                                optionFilterProp="label"
                                options={productOptions}
                                onChange={(productId) => {
                                  const line = returnableLines.find(
                                    (item) => item.productId === productId,
                                  );
                                  const nextItems = [
                                    ...(form.getFieldValue('items') ?? []),
                                  ];
                                  nextItems[name] = {
                                    ...nextItems[name],
                                    productId,
                                    unit:
                                      line?.unit ||
                                      line?.product?.unitOfMeasure ||
                                      '',
                                    unitPrice:
                                      toNumber(line?.unitPrice) ||
                                      Number(
                                        nextItems[name]?.unitPrice || 0,
                                      ),
                                  };
                                  form.setFieldsValue({ items: nextItems });
                                }}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={4}>
                            <Form.Item
                              {...restField}
                              label={t('modal.form.quantity')}
                              name={[name, 'quantity']}
                              rules={[
                                {
                                  required: true,
                                  message: t('modal.rules.qtyRequired'),
                                },
                                {
                                  validator: (
                                    _rule,
                                    value: number | null | undefined,
                                  ) => {
                                    if (
                                      !value ||
                                      !maxQuantity ||
                                      Number(value) <= maxQuantity
                                    ) {
                                      return Promise.resolve();
                                    }
                                    return Promise.reject(
                                      new Error(
                                        t('modal.rules.qtyMax', {
                                          max: maxQuantity,
                                        }),
                                      ),
                                    );
                                  },
                                },
                              ]}
                              style={{ marginBottom: 0 }}
                            >
                              <InputNumber
                                min={1}
                                max={maxQuantity}
                                disabled={!selectedLine}
                                placeholder={t('modal.form.quantity')}
                                style={{ width: '100%' }}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={4}>
                            <Form.Item
                              {...restField}
                              label={t('modal.form.lineUnitPrice')}
                              name={[name, 'unitPrice']}
                              style={{ marginBottom: 0 }}
                            >
                              <InputNumber
                                min={0}
                                disabled={!selectedLine}
                                style={{ width: '100%' }}
                                placeholder={String(defaultUnitPrice || 0)}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={4}>
                            <Form.Item
                              {...restField}
                              label={t('modal.form.unit')}
                              name={[name, 'unit']}
                              rules={[
                                {
                                  required: true,
                                  message: t('modal.rules.unitRequired'),
                                },
                              ]}
                              style={{ marginBottom: 0 }}
                            >
                              <Input
                                placeholder={t('modal.form.unit')}
                                style={{ width: '100%' }}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={4}>
                            <Form.Item
                              {...restField}
                              label={t('modal.form.lineCondition')}
                              name={[name, 'condition']}
                              style={{ marginBottom: 0 }}
                            >
                              <Select
                                placeholder={t('modal.form.lineCondition')}
                                options={CONDITION_KEYS.map((c) => ({
                                  value: c,
                                  label: t(`modal.condition.${c}`),
                                }))}
                              />
                            </Form.Item>
                          </Col>

                          <Col xs={12} md={6}>
                            <Form.Item
                              {...restField}
                              label={t('modal.form.lineBatch')}
                              name={[name, 'batchNumber']}
                              style={{ marginBottom: 0 }}
                            >
                              <Input
                                placeholder={t('modal.form.lineBatchPlaceholder')}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={12} md={6}>
                            <Form.Item
                              {...restField}
                              label={t('modal.form.lineExpiry')}
                              name={[name, 'expiryDate']}
                              style={{ marginBottom: 0 }}
                            >
                              <DatePicker
                                style={{ width: '100%' }}
                                format="DD/MM/YYYY"
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item
                              {...restField}
                              label={t('modal.form.lineNote')}
                              name={[name, 'note']}
                              style={{ marginBottom: 0 }}
                            >
                              <Input
                                placeholder={t('modal.form.lineNotePlaceholder')}
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: 8,
                            color: token.colorTextSecondary,
                            fontSize: 12,
                          }}
                        >
                          <span>
                            {maxQuantity
                              ? t('modal.form.receivedHint', {
                                  quantity: maxQuantity,
                                })
                              : ''}
                          </span>
                          <span>
                            {t('modal.form.lineRefund')}:{' '}
                            <Text
                              strong
                              style={{ color: token.colorError }}
                            >
                              {(
                                (Number(watchedItems[name]?.quantity) || 0) *
                                (Number(watchedItems[name]?.unitPrice) || 0)
                              ).toLocaleString()}
                            </Text>
                          </span>
                          <a
                            onClick={() => remove(name)}
                            style={{ color: token.colorError }}
                          >
                            <DeleteOutlined />{' '}
                            {t('modal.form.removeLine')}
                          </a>
                        </div>
                      </Card>
                    );
                  })}
                  <Button
                    type="dashed"
                    onClick={() => add({ condition: 'DAMAGED' })}
                    block
                    icon={<PlusOutlined />}
                    disabled={
                      !selectedPurchaseOrder ||
                      watchedItems.length >= returnableLines.length
                    }
                  >
                    {t('modal.form.addLineBtn')}
                  </Button>
                </>
              )}
            </Form.List>
          )}

          {watchedItems.length > 0 ? (
            <Card
              size="small"
              style={{
                marginTop: 12,
                borderRadius: 12,
                background: isDark
                  ? 'rgba(59, 130, 246, 0.08)'
                  : 'rgba(59, 130, 246, 0.04)',
                border: `1px dashed ${token.colorPrimary}`,
              }}
            >
              <Space size="large">
                <StatisticMini
                  icon={<ContainerOutlined />}
                  label={t('modal.form.itemsDivider')}
                  value={`${totals.totalQty}`}
                />
                <StatisticMini
                  icon={<DollarOutlined />}
                  label={t('modal.form.totalRefundable')}
                  value={`${totals.totalRefund.toLocaleString()} ${
                    selectedPurchaseOrder?.currency || 'VND'
                  }`}
                />
              </Space>
            </Card>
          ) : null}
        </div>

        {/* STEP 2 — Reason + logistics */}
        <div hidden={currentStep !== 2}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label={t('modal.form.reasonCode')}
                name="reasonCode"
                rules={[{ required: true }]}
              >
                <Select
                  options={REASON_CODE_KEYS.map((c) => ({
                    value: c,
                    label: t(`modal.reasonCode.${c}`),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('modal.form.claimNumber')} name="claimNumber">
                <Input placeholder={t('modal.form.claimNumberPlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={t('modal.form.carrierTrackingRef')}
                name="carrierTrackingRef"
              >
                <Input
                  placeholder={t('modal.form.carrierTrackingRefPlaceholder')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={t('modal.form.expectedPickupAt')}
                name="expectedPickupAt"
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t('modal.form.reason')} name="reason">
                <Input.TextArea
                  rows={3}
                  placeholder={t('modal.form.reasonPlaceholder')}
                />
              </Form.Item>
            </Col>
          </Row>

          {totals.totalRefund > 0 ? (
            <Alert
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              title={
                <Space wrap>
                  <Text strong>{t('modal.form.totalRefundable')}:</Text>
                  <Text strong style={{ color: token.colorPrimary }}>
                    {totals.totalRefund.toLocaleString()}{' '}
                    {selectedPurchaseOrder?.currency || 'VND'}
                  </Text>
                </Space>
              }
            />
          ) : (
            <Alert
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
              title={t('modal.form.reasonPlaceholder')}
            />
          )}
        </div>
      </Form>

      <Divider style={{ margin: '12px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => goToStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}>
          {t('modal.navigation.back')}
        </Button>
        {currentStep < 2 ? (
          <Button type="primary" onClick={() => goToStep(currentStep + 1)}>
            {t('modal.navigation.next')}
          </Button>
        ) : (
          <Button
            type="primary"
            danger
            icon={<RollbackOutlined />}
            loading={loading}
            onClick={() => form.submit()}
          >
            {t('modal.okText')}
          </Button>
        )}
      </div>
    </Modal>
  );
};

const StatisticMini = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) => {
  const { token } = theme.useToken();
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: token.colorTextSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: 600,
        }}
      >
        {icon ? <span style={{ marginRight: 4 }}>{icon}</span> : null}
        {label}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{value}</div>
    </div>
  );
};

export default PurchaseReturnModal;
