'use client';

import React, { useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, notification, Alert } from 'antd';
import { sendRequest } from '@/lib/api-client';
import { useSession } from 'next-auth/react';
import { IProduct } from '@/types/product';
import { useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';
import { canReadCostFields, sanitizeCostPayload } from '@/lib/field-access';

interface IProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  product: IProduct | null;
  fetchData: () => void;
}

const AdjustmentModal = (props: IProps) => {
  const t = useTranslations('AdjustmentModal');
  const { isOpen, setIsOpen, product, fetchData } = props;
  const { data: session } = useSession();
  const canViewCost = canReadCostFields(session?.user);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    if (!product || !session) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/adjustment`,
        method: 'POST',
        body: sanitizeCostPayload({
          productId: product._id,
          adjustmentQuantity: values.quantity,
          reason: values.reason_custom || values.reason,
          lotNumber: values.lotNumber,
          unitPrice: values.unitPrice || 0
        }, canViewCost, ['unitPrice']),
        headers: { Authorization: `Bearer ${getAccessToken(session)}` },
      });

      if (res?.data) {
        notification.success({ title: t('notifications.success') });
        setIsOpen(false);
        form.resetFields();
        fetchData();
      }
    } catch (error: any) {
      notification.error({ title: t('notifications.error'), description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('title', { sku: product?.sku || '' })}
      open={isOpen}
      onCancel={() => setIsOpen(false)}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText={t('actions.confirm')}
      cancelText={t('actions.cancel')}
    >
      <Alert 
        title={t('currentStock', { count: product?.currentStock || 0 })} 
        type="info" 
        showIcon 
        style={{ marginBottom: 16 }} 
      />
      {!canViewCost && (
        <Alert
          title={t('fields.priceHidden')}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item 
          label={t('fields.quantity')} 
          name="quantity" 
          rules={[{ required: true, message: t('fields.quantityRequired') }]}
          help={t('fields.quantityHelp')}
        >
          <InputNumber style={{ width: '100%' }} placeholder="Ví dụ: -5 hoặc 10" />
        </Form.Item>

        <Form.Item 
          label={t('fields.reason')} 
          name="reason" 
          rules={[{ required: true, message: t('fields.reasonRequired') }]}
        >
          <Select placeholder={t('fields.reasonPlaceholder')}>
            <Select.Option value="Kiểm kê định kỳ">{t('reasons.cycle')}</Select.Option>
            <Select.Option value="Hàng hỏng/Hết hạn">{t('reasons.damaged')}</Select.Option>
            <Select.Option value="Sai sót nhập liệu">{t('reasons.error')}</Select.Option>
            <Select.Option value="Khác">{t('reasons.other')}</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label={t('fields.note')} name="reason_custom">
          <Input.TextArea placeholder={t('fields.notePlaceholder')} />
        </Form.Item>

        <Form.Item label={t('fields.lot')} name="lotNumber">
          <Input placeholder={t('fields.lotPlaceholder')} />
        </Form.Item>

        {canViewCost && (
          <Form.Item 
            label={t('fields.price')} 
            name="unitPrice"
            help={t('fields.priceHelp')}
          >
            <InputNumber 
              style={{ width: '100%' }} 
              placeholder={t('fields.pricePlaceholder')}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default AdjustmentModal;
