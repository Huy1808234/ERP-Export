'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Form, Input, DatePicker, Select, InputNumber, Button, Space, Typography, Divider } from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import { notification } from '@/providers/antd-static';
import { PlusOutlined, DeleteOutlined, RollbackOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

const RETURNABLE_PO_STATUSES = 'PARTIAL_RECEIPT,RECEIVED,COMPLETED';

type PurchaseReturnModalFallbackKey =
  | 'modal.form.purchaseOrder'
  | 'modal.form.purchaseOrderPlaceholder'
  | 'modal.form.vendor'
  | 'modal.form.receivedHint'
  | 'modal.rules.purchaseOrderRequired'
  | 'modal.rules.qtyMax';

const PURCHASE_RETURN_MODAL_FALLBACKS: Record<
  PurchaseReturnModalFallbackKey,
  { vi: string; en: string }
> = {
  'modal.form.purchaseOrder': {
    vi: 'PO đã nhập hàng',
    en: 'Received PO',
  },
  'modal.form.purchaseOrderPlaceholder': {
    vi: 'Chọn PO đã có hàng nhập',
    en: 'Select a PO with received goods',
  },
  'modal.form.vendor': {
    vi: 'NCC: {vendor}',
    en: 'Vendor: {vendor}',
  },
  'modal.form.receivedHint': {
    vi: 'Đã nhận: {quantity}',
    en: 'Received: {quantity}',
  },
  'modal.rules.purchaseOrderRequired': {
    vi: 'Vui lòng chọn PO',
    en: 'Please select PO',
  },
  'modal.rules.qtyMax': {
    vi: 'Không vượt quá số đã nhận: {max}',
    en: 'Cannot exceed received qty: {max}',
  },
};

const interpolateMessage = (
  template: string,
  values: Record<string, string | number> = {},
): string => {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    String(values[key] ?? ''),
  );
};

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
  unit?: string | null;
};

type PurchaseReturnPo = {
  _id: string;
  poNumber: string;
  status: string;
  vendor?: {
    name?: string;
  };
  items?: PurchaseReturnPoLine[];
};

type PurchaseReturnFormItem = {
  productId?: string;
  quantity?: number;
  unit?: string | null;
};

type PurchaseReturnFormValues = {
  purchaseOrderId: string;
  returnDate: Dayjs;
  reason?: string;
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

const PurchaseReturnModal = (props: IProps) => {
  const t = useTranslations('PurchaseReturn');
  const locale = useLocale();
  const { isOpen, setIsOpen, fetchData } = props;
  const { data: session } = useSession();
  const [form] = Form.useForm<PurchaseReturnFormValues>();
  const [loading, setLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseReturnPo[]>([]);
  const [poLoading, setPoLoading] = useState(false);
  const selectedPurchaseOrderId = Form.useWatch('purchaseOrderId', form);
  const watchedItems = Form.useWatch('items', form) ?? [];

  const selectedPurchaseOrder = useMemo(
    () => purchaseOrders.find((po) => po._id === selectedPurchaseOrderId) ?? null,
    [purchaseOrders, selectedPurchaseOrderId],
  );

  const returnableLines = useMemo(
    () => (selectedPurchaseOrder?.items ?? []).filter((line) => getReturnableQuantity(line) > 0),
    [selectedPurchaseOrder],
  );

  const productOptions = useMemo(
    () => returnableLines.map((line) => ({
      label: `[${line.product?.sku || line.productId}] ${line.product?.vietnameseName || line.productId}`,
      value: line.productId,
    })),
    [returnableLines],
  );

  const fallbackT = (
    key: PurchaseReturnModalFallbackKey,
    values?: Record<string, string | number>,
  ): string => {
    try {
      return values ? t(key, values) : t(key);
    } catch {
      const fallbackLocale = locale === 'en' ? 'en' : 'vi';
      return interpolateMessage(PURCHASE_RETURN_MODAL_FALLBACKS[key][fallbackLocale], values);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const fetchPurchaseOrders = async () => {
      setPoLoading(true);
      try {
        const res = await sendRequest<IBackendRes<{ results: PurchaseReturnPo[] }>>({
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

    form.setFieldsValue({ returnDate: dayjs(), items: [{}] });
    fetchPurchaseOrders();
  }, [form, isOpen, session, t]);

  const handleCancel = () => {
    form.resetFields();
    setIsOpen(false);
  };

  const onFinish = async (values: PurchaseReturnFormValues) => {
    setLoading(true);
    try {
      const payload = {
        purchaseOrderId: values.purchaseOrderId,
        returnDate: values.returnDate.format('YYYY-MM-DD'),
        reason: values.reason?.trim() || null,
        items: values.items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity || 0),
          unit: item.unit?.trim() || null,
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
        setIsOpen(false);
        fetchData();
      } else {
        notification.error({
          title: t('notifications.createError'),
          description: Array.isArray(res?.message) ? res.message.join(', ') : res?.message,
        });
      }
    } catch {
      notification.error({ title: t('notifications.createError') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={<Space><RollbackOutlined /> <Text strong>{t('modal.titleCreate')}</Text></Space>}
      open={isOpen}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={820}
      destroyOnHidden
      mask={{ closable: false }}
      okText={t('modal.okText')}
      style={{ top: 40 }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ returnDate: dayjs(), items: [{}] }}
      >
        <Form.Item
          label={fallbackT('modal.form.purchaseOrder')}
          name="purchaseOrderId"
          rules={[{ required: true, message: fallbackT('modal.rules.purchaseOrderRequired') }]}
        >
          <Select
            showSearch
            loading={poLoading}
            placeholder={fallbackT('modal.form.purchaseOrderPlaceholder')}
            optionFilterProp="label"
            options={purchaseOrders.map((po) => ({
              label: `${po.poNumber} - ${po.vendor?.name || ''}`,
              value: po._id,
            }))}
            onChange={(purchaseOrderId) => {
              form.setFieldsValue({ purchaseOrderId, items: [{}] });
            }}
          />
        </Form.Item>

        {selectedPurchaseOrder?.vendor?.name ? (
          <Text type="secondary">{fallbackT('modal.form.vendor', { vendor: selectedPurchaseOrder.vendor.name })}</Text>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
          <Form.Item label={t('modal.form.returnDate')} name="returnDate" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('modal.form.reason')} name="reason">
            <Input placeholder={t('modal.form.reasonPlaceholder')} />
          </Form.Item>
        </div>

        <Divider titlePlacement="left" style={{ fontSize: 14, color: '#8c8c8c' }}>{t('modal.form.itemsDivider')}</Divider>

        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => {
                const selectedProductId = watchedItems[name]?.productId;
                const selectedLine = returnableLines.find((line) => line.productId === selectedProductId);
                const maxQuantity = selectedLine ? getReturnableQuantity(selectedLine) : undefined;

                return (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'productId']}
                      rules={[{ required: true, message: t('modal.rules.productRequired') }]}
                      style={{ width: 340 }}
                    >
                      <Select
                        showSearch
                        disabled={!selectedPurchaseOrder}
                        placeholder={t('modal.form.productPlaceholder')}
                        optionFilterProp="label"
                        options={productOptions}
                        onChange={(productId) => {
                          const line = returnableLines.find((item) => item.productId === productId);
                          const nextItems = [...(form.getFieldValue('items') ?? [])];
                          nextItems[name] = {
                            ...nextItems[name],
                            productId,
                            unit: line?.unit || line?.product?.unitOfMeasure || '',
                          };
                          form.setFieldsValue({ items: nextItems });
                        }}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'quantity']}
                      rules={[
                        { required: true, message: t('modal.rules.qtyRequired') },
                        {
                          validator: (_rule, value: number | null | undefined) => {
                            if (!value || !maxQuantity || Number(value) <= maxQuantity) {
                              return Promise.resolve();
                            }
                            return Promise.reject(new Error(fallbackT('modal.rules.qtyMax', { max: maxQuantity })));
                          },
                        },
                      ]}
                    >
                      <InputNumber
                        min={1}
                        max={maxQuantity}
                        disabled={!selectedLine}
                        placeholder={t('modal.form.quantity')}
                        style={{ width: 110 }}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'unit']}
                      rules={[{ required: true, message: t('modal.rules.unitRequired') }]}
                    >
                      <Input placeholder={t('modal.form.unit')} style={{ width: 90 }} />
                    </Form.Item>
                    <Text type="secondary" style={{ width: 120, fontSize: 12 }}>
                      {maxQuantity ? fallbackT('modal.form.receivedHint', { quantity: maxQuantity }) : ''}
                    </Text>
                    <Button type="text" danger onClick={() => remove(name)} icon={<DeleteOutlined />} />
                  </Space>
                );
              })}
              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} disabled={!selectedPurchaseOrder}>
                {t('modal.form.addLineBtn')}
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};

export default PurchaseReturnModal;
