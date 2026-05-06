'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, InputNumber, Space, Typography, Divider, Table, Tag } from 'antd';
import { notification } from '@/library/antd.static';
import { BarcodeOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useCurrency } from '@/hooks/useCurrency';

const { Text } = Typography;

interface IProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  poId: string | null;
  fetchData: () => void;
}

const GoodsReceiptModal = (props: IProps) => {
  const t = useTranslations('GoodsReceipt');
  const { isOpen, setIsOpen, poId, fetchData } = props;
  const { data: session } = useSession();
  const [form] = Form.useForm();
  const { formatNumber } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [poData, setPoData] = useState<any>(null);

  useEffect(() => {
    const fetchPODetail = async () => {
      if (!poId || !isOpen) return;
      setLoading(true);
      try {
        const res = await sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders/${poId}`,
          method: 'GET',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (res?.data) {
          setPoData(res.data);
          const items = res.data.items?.map((item: any) => ({
            productId: item.productId,
            sku: item.product?.sku,
            vietnameseName: item.product?.vietnameseName,
            orderedQuantity: item.quantity,
            quantityReceived: item.quantity, // Mặc định nhận đủ
            unit: item.unit,
          })) || [];
          form.setFieldsValue({ 
            items,
            receivedDate: dayjs(),
            note: ''
          });
        }
      } catch (error) {
        notification.error({ title: t('notifications.fetchPODetailError') });
      } finally {
        setLoading(false);
      }
    };

    fetchPODetail();
  }, [isOpen, poId, session, form]);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      if (!values.items || values.items.length === 0) {
        notification.warning({ 
          title: t('notifications.noItemsWarning'), 
          description: t('notifications.noItemsWarningDesc') 
        });
        return;
      }

      const payload = {
        purchaseOrderId: poId,
        receivedDate: values.receivedDate.format('YYYY-MM-DD'),
        note: values.note,
        items: values.items.map((item: any) => ({
          productId: item.productId,
          quantityReceived: Number(item.quantityReceived || 0),
          quantityOrdered: Number(item.orderedQuantity || 0),
          unit: item.unit,
        })),
      };

      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/goods-receipts`,
        method: 'POST',
        body: payload,
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res?.data) {
        notification.success({ 
          title: t('notifications.createSuccess'),
          description: t('notifications.grNumber', { grNumber: res.data.grnNumber })
        });
        setIsOpen(false);
        form.resetFields();
        fetchData();
      } else {
        notification.error({ 
          title: t('notifications.businessError'), 
          description: res?.message || t('notifications.businessErrorDesc') 
        });
      }
    } catch (error) {
      notification.error({ 
        title: t('notifications.systemError'), 
        description: t('notifications.systemErrorDesc') 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space size="middle">
          <div style={{ 
            width: 32, height: 32, borderRadius: 8, 
            background: 'linear-gradient(135deg, #08979c 0%, #00474f 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <BarcodeOutlined style={{ color: '#fff' }} />
          </div>
          <Text strong style={{ fontSize: 16 }}>
            {t('modal.titleCreate', { poNumber: poData?.poNumber ?? '...' })}
          </Text>
        </Space>
      }
      open={isOpen}
      onCancel={() => setIsOpen(false)}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={900}
      destroyOnHidden
      mask={{ closable: false }}
      okText={t('modal.okText')}
      cancelText={t('modal.cancelText')}
      style={{ top: 40 }}
      okButtonProps={{ size: 'large', style: { borderRadius: 8, fontWeight: 600 } }}
      cancelButtonProps={{ size: 'large', style: { borderRadius: 8 } }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        requiredMark="optional"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: 16, marginTop: 16 }}>
          <Form.Item 
            label={t('modal.form.receivedDate')} 
            name="receivedDate" 
            rules={[{ required: true, message: t('modal.form.receivedDateRequired') }]}
          >
            <DatePicker style={{ width: '100%', height: 40, borderRadius: 8 }} />
          </Form.Item>
          <Form.Item label={t('modal.form.note')} name="note">
            <Input placeholder={t('modal.form.notePlaceholder')} style={{ height: 40, borderRadius: 8 }} />
          </Form.Item>
        </div>

        <Divider titlePlacement="left" style={{ fontSize: 14, color: '#8c8c8c' }}>{t('modal.form.itemsDivider')}</Divider>

        <Form.List name="items">
          {(fields) => {
            const columns = [
              {
                title: t('modal.form.product'),
                key: 'product',
                render: (_: any, { name }: any) => {
                  const item = form.getFieldValue(['items', name]);
                  return (
                    <div style={{ padding: '4px 0' }}>
                      <Form.Item name={[name, 'productId']} hidden><Input /></Form.Item>
                      <Form.Item name={[name, 'unit']} hidden><Input /></Form.Item>
                      <Form.Item name={[name, 'orderedQuantity']} hidden><Input /></Form.Item>
                      <Text strong>{item?.vietnameseName}</Text>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>SKU: {item?.sku}</div>
                    </div>
                  );
                }
              },
              {
                title: t('modal.form.orderedQty'),
                key: 'orderedQuantity',
                width: 100,
                align: 'right' as const,
                render: (_: any, { name }: any) => {
                  const item = form.getFieldValue(['items', name]);
                  return <Text strong>{formatNumber(item?.orderedQuantity || 0)}</Text>;
                }
              },
              {
                title: t('modal.form.receivedQty'),
                key: 'quantityReceived',
                width: 180,
                render: (_: any, { key, name, ...restField }: any) => (
                  <Form.Item
                    key={key}
                    {...restField}
                    name={[name, 'quantityReceived']}
                    rules={[
                      { required: true, message: t('modal.form.qtyRequired') },
                      {
                        validator: (_: any, value: any) => {
                          const num = Number(value);
                          if (isNaN(num)) return Promise.reject(t('modal.form.qtyNumberError'));
                          if (!Number.isInteger(num)) return Promise.reject(t('modal.form.qtyIntegerError'));
                          const item = form.getFieldValue(['items', name]);
                          const max = Math.floor((item?.orderedQuantity || 0) * 1.2);
                          if (num > max) return Promise.reject(t('modal.form.qtyMaxError', { max }));
                          return Promise.resolve();
                        }
                      }
                    ]}
                  >
                    <InputNumber
                      min={0}
                      precision={0}
                      style={{ width: '100%', height: 40, borderRadius: 8 }}
                      placeholder={t('modal.form.qtyPlaceholder')}
                    />
                  </Form.Item>
                )
              },
              {
                title: t('modal.form.unit'),
                key: 'unitDisplay',
                width: 100,
                align: 'center' as const,
                render: (_: any, { name }: any) => {
                  const item = form.getFieldValue(['items', name]);
                  return <Tag style={{ borderRadius: 6 }}>{item?.unit}</Tag>;
                }
              }
            ];

            return (
              <Table
                dataSource={fields}
                columns={columns}
                pagination={false}
                size="middle"
                bordered
                rowKey="key"
                className="premium-table"
                style={{ marginBottom: 24 }}
              />
            );
          }}
        </Form.List>
      </Form>
    </Modal>
  );
};

export default GoodsReceiptModal;
