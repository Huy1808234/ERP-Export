'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Select, InputNumber, Button, Space, Typography, Divider } from 'antd';
import { useTranslations } from 'next-intl';
import { notification } from '@/providers/antd-static';
import { PlusOutlined, DeleteOutlined, RollbackOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import dayjs from 'dayjs';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

interface IProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  fetchData: () => void;
}

const PurchaseReturnModal = (props: IProps) => {
  const t = useTranslations('PurchaseReturn');
  const { isOpen, setIsOpen, fetchData } = props;
  const { data: session } = useSession();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products?pageSize=100`,
        method: 'GET',
        headers: { Authorization: `Bearer ${getAccessToken(session)}` },
      });
      if (res?.data) setProducts(res.data.results || []);
    };
    if (isOpen) fetchProducts();
  }, [isOpen, session]);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        returnDate: values.returnDate.format('YYYY-MM-DD'),
      };

      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-returns`,
        method: 'POST',
        body: payload,
        headers: { Authorization: `Bearer ${getAccessToken(session)}` },
      });

      if (res?.data) {
        notification.success({ title: t('notifications.createSuccess') });
        setIsOpen(false);
        form.resetFields();
        fetchData();
      }
    } catch (error) {
      notification.error({ title: t('notifications.createError') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={<Space><RollbackOutlined /> <Text strong>{t('modal.titleCreate')}</Text></Space>}
      open={isOpen}
      onCancel={() => setIsOpen(false)}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={700}
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              {fields.map(({ key, name, ...restField }) => (
                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                  <Form.Item
                    {...restField}
                    name={[name, 'productId']}
                    rules={[{ required: true, message: t('modal.rules.productRequired') }]}
                    style={{ width: 300 }}
                  >
                    <Select
                      showSearch
                      placeholder={t('modal.form.productPlaceholder')}
                      options={products.map(p => ({ label: `[${p.sku}] ${p.vietnameseName}`, value: p._id }))}
                    />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'quantity']}
                    rules={[{ required: true, message: t('modal.rules.qtyRequired') }]}
                  >
                    <InputNumber min={1} placeholder={t('modal.form.quantity')} style={{ width: 100 }} />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'unit']}
                    rules={[{ required: true, message: t('modal.rules.unitRequired') }]}
                  >
                    <Input placeholder={t('modal.form.unit')} style={{ width: 80 }} />
                  </Form.Item>
                  <Button type="text" danger onClick={() => remove(name)} icon={<DeleteOutlined />} />
                </Space>
              ))}
              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
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
