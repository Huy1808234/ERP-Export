'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, InputNumber, Space, Typography, Divider, Select, App } from 'antd';
import { FileDoneOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { sendRequest } from '@/utils/api';
import dayjs from 'dayjs';

const { Text } = Typography;

interface IProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  poId: string | null;
  fetchData: () => void;
}

const VendorInvoiceModal = (props: IProps) => {
  const t = useTranslations('VendorInvoice');
  const { notification } = App.useApp();
  const { isOpen, setIsOpen, poId, fetchData } = props;
  const { data: session } = useSession();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [poData, setPoData] = useState<any>(null);

  useEffect(() => {
    const fetchPODetail = async () => {
      if (!poId) return;
      setLoading(true);
      try {
        const res = await sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders/${poId}`,
          method: 'GET',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (res?.data) {
          setPoData(res.data);
          form.setFieldsValue({
            totalAmount: res.data.totalAmount,
            taxAmount: (res.data.totalAmount || 0) * 0.1, // Default 10% VAT
            currency: 'VND',
          });
        }
      } catch (error) {
        notification.error({ title: t('notifications.fetchPODetailError') });
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && poId) {
      fetchPODetail();
    }
  }, [isOpen, poId, session, form]);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const amountBeforeTax = Number(values.totalAmount || 0);
      const taxAmount = Number(values.taxAmount || 0);
      const totalAmountAfterTax = amountBeforeTax + taxAmount;

      const payload = {
        purchaseOrderId: poId,
        vendorId: poData?.vendorId,
        invoiceNumber: values.invoiceNumber,
        invoiceDate: values.invoiceDate.format('YYYY-MM-DD'),
        dueDate: values.dueDate?.format('YYYY-MM-DD'),
        amount: amountBeforeTax,
        taxAmount: taxAmount,
        totalAmount: totalAmountAfterTax,
        currency: values.currency,
        note: values.note,
      };

      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/vendor-invoices`,
        method: 'POST',
        body: payload,
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res?.data) {
        notification.success({ title: t('notifications.createSuccess') });
        setIsOpen(false);
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
      title={<Space><FileDoneOutlined /> <Text strong>{t('modal.titleCreate', { poNumber: poData?.poNumber })}</Text></Space>}
      open={isOpen}
      onCancel={() => setIsOpen(false)}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={600}
      destroyOnHidden
      mask={{ closable: false }}
      okText={t('modal.okText')}
      style={{ top: 40 }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ invoiceDate: dayjs(), currency: 'VND' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Form.Item label={t('modal.form.invoiceNumber')} name="invoiceNumber" rules={[{ required: true }]}>
            <Input placeholder={t('modal.form.invoiceNumberPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('modal.form.invoiceDate')} name="invoiceDate" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Form.Item label={t('modal.form.totalAmount')} name="totalAmount" rules={[{ required: true }]}>
            <InputNumber
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => Number(value!.replace(/\$\s?|(,*)/g, ''))}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label={t('modal.form.taxAmount')} name="taxAmount">
            <InputNumber
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => Number(value!.replace(/\$\s?|(,*)/g, ''))}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </div>

        <Form.Item label={t('modal.form.dueDate')} name="dueDate">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label={t('modal.form.note')} name="note">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default VendorInvoiceModal;
