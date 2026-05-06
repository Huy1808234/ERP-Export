'use client'

import {
  Button,
  Form,
  InputNumber,
  Modal,
  Select,
  Input,
  App,
  Typography,
  Tag,
  DatePicker,
  theme,
  Space,
} from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { useCurrency } from '@/hooks/useCurrency';
import { getCurrencyConfig } from '@/constants/currency.config';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface IProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  pi: any; // Proforma Invoice data
}

const POFromPIModal = ({ open, setOpen, pi }: IProps) => {
  const { notification } = App.useApp();
  const t = useTranslations('PurchaseOrder');
  const { data: session } = useSession();
  const { formatMoney } = useCurrency();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const { token } = theme.useToken();

  useEffect(() => {
    const fetchSuppliers = async () => {
      const accessToken = session?.access_token;
      if (!accessToken) return;

      const res = await sendRequest<IBackendRes<IModelPaginate<any>>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 100, partnerType: 'SUPPLIER' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        setSuppliers(res.data.results ?? []);
      }
    };
    if (open && session) fetchSuppliers();
  }, [open, session]);

  const [piDetail, setPiDetail] = useState<any>(null);

  useEffect(() => {
    const fetchPIDetail = async () => {
      const accessToken = session?.access_token;
      if (!accessToken || !pi?.id) return;

      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/proforma-invoices/${pi.id}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        setPiDetail(res.data);
      }
    };
    if (open && pi?.id && !pi.items) {
      fetchPIDetail();
    } else if (open && pi) {
      setPiDetail(pi);
    }
  }, [open, pi, session]);

  useEffect(() => {
    const initializeForm = async () => {
      if (open && piDetail && session?.access_token) {
        const targetCurrency = piDetail.currency || 'VND';
        
        let rate = 1;
        if (targetCurrency !== 'VND') {
          try {
            const rateRes = await sendRequest<IBackendRes<any>>({
              url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies/cross-rate`,
              method: 'GET',
              queryParams: { from: 'VND', to: targetCurrency },
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (rateRes?.data?.rate) {
              rate = rateRes.data.rate;
            }
          } catch (e) {
            console.error("Failed to fetch initial rate", e);
          }
        }

        const items = piDetail.items?.map((l: any) => ({
          productId: l.product?.id,
          productName: l.product?.vietnameseName || l.product?.name,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.product?.purchasePriceVnd ? (l.product.purchasePriceVnd * rate).toFixed(targetCurrency === 'VND' ? 0 : 4) : 0,
          basePriceVnd: l.product?.purchasePriceVnd || 0,
        })) || [];

        form.setFieldsValue({
          lines: items,
          currency: targetCurrency,
          advancePaymentPercent: 50,
        });
      }
    };
    initializeForm();
  }, [open, piDetail, form, session]);

  // Handle cross-rate conversion when currency changes
  const handleCurrencyChange = async (newCurrency: string) => {
    if (!session?.access_token) return;
    
    const currentLines = form.getFieldValue('lines') || [];
    if (currentLines.length === 0) return;

    if (newCurrency === 'VND') {
      const updatedLines = currentLines.map((l: any) => ({
        ...l,
        unitPrice: l.basePriceVnd || 0,
      }));
      form.setFieldsValue({ lines: updatedLines });
      return;
    }

    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies/cross-rate`,
        method: 'GET',
        queryParams: { from: 'VND', to: newCurrency },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res?.data?.rate) {
        const rate = res.data.rate;
        const updatedLines = currentLines.map((l: any) => ({
          ...l,
          unitPrice: l.basePriceVnd ? (l.basePriceVnd * rate).toFixed(newCurrency === 'VND' ? 0 : 4) : 0,
        }));
        form.setFieldsValue({ lines: updatedLines });
      }
    } catch (error) {
      notification.error({ title: t('createFromPI.notifications.rateError') });
    }
  };

  const handleClose = () => {
    form.resetFields();
    setOpen(false);
  };

  const onFinish = async (values: any) => {
    setSubmitting(true);
    const accessToken = session?.access_token;

    const formattedLines = values.lines.map((l: any) => ({
      productId: l.productId,
      // InputNumber returns a number directly, but could be string with commas if manually edited
      quantity: typeof l.quantity === 'number' ? l.quantity : parseFloat(String(l.quantity).replace(/,/g, '')) || 0,
      unit: l.unit,
      unitPrice: typeof l.unitPrice === 'number' ? l.unitPrice : parseFloat(String(l.unitPrice).replace(/,/g, '')) || 0,
    }));
    
    console.log('Formatted lines to send:', JSON.stringify(formattedLines));

    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders`,
      method: 'POST',
      body: {
        vendorId: values.supplierId,
        proformaInvoiceId: pi?.id,
        advancePaymentPercent: values.advancePaymentPercent,
        orderDate: new Date().toISOString(), // Use current date for orderDate
        expectedDeliveryDate: values.deliveryDate ? values.deliveryDate.format('YYYY-MM-DD') : undefined,
        note: values.notes,
        currency: values.currency,
        items: formattedLines,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    setSubmitting(false);

    if (res?.data) {
      handleClose();
      notification.success({ 
        title: t('createFromPI.notifications.createSuccess'),
        description: t('createFromPI.notifications.poNumber', { poNumber: res.data.poNumber }),
      });
    } else {
      notification.error({ title: t('createFromPI.notifications.errorTitle'), description: res?.message });
    }
  };

  if (!pi) return null;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingCartOutlined style={{ color: '#13c2c2' }} />
          <span>{t('createFromPI.modalTitle')}</span>
        </div>
      }
      open={open}
      onOk={() => form.submit()}
      onCancel={handleClose}
      mask={{ closable: false }}
      width={850}
      confirmLoading={submitting}
      okText={t('createFromPI.okText')}
      cancelText={t('createFromPI.cancelText')}
      okButtonProps={{ style: { background: '#13c2c2', borderColor: '#13c2c2' } }}
      destroyOnHidden
    >
      <div style={{
        background: '#e6fffb',
        border: '1px solid #87e8de',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 20,
      }}>
        <Text strong style={{ display: 'block', marginBottom: 4 }}>
          {t('createFromPI.piInfoTitle')} <span style={{ color: '#13c2c2' }}>{pi.piNumber}</span>
        </Text>
        <Text type="secondary">{t('createFromPI.customerLabel')} </Text>
        <Text strong>{pi.customer?.name}</Text>
        <div style={{ marginTop: 4 }}>
          <Tag color="cyan">{t('createFromPI.totalPiLabel')} {formatMoney(pi.totalAmount, pi.currency)}</Tag>
          <Tag color="orange">{t('createFromPI.depositCollectedLabel')} {pi.depositPercent}%</Tag>
        </div>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ currency: 'VND', advancePaymentPercent: 50 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16 }}>
          <Form.Item
            label={t('createFromPI.form.supplierLabel')}
            name="supplierId"
            rules={[{ required: true, message: t('createFromPI.form.supplierRequired') }]}
          >
            <Select
              placeholder={t('createFromPI.form.supplierPlaceholder')}
              options={suppliers.map(s => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>

          <Form.Item label={t('createFromPI.form.currencyLabel')} name="currency" rules={[{ required: true }]}>
            <Select
              onChange={handleCurrencyChange}
              options={[
                { value: 'VND', label: 'VNĐ (₫)' },
                { value: 'USD', label: 'USD ($)' },
                { value: 'EUR', label: 'EUR (€)' },
                { value: 'CNY', label: 'CNY (¥)' },
              ]}
            />
          </Form.Item>

          <Form.Item label={t('createFromPI.form.depositPercentLabel')} name="advancePaymentPercent">
            <InputNumber min={0} max={100} suffix="%" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label={t('createFromPI.form.deliveryDateLabel')} name="deliveryDate">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>

        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.currency !== curr.currency}>
          {({ getFieldValue }) => {
            const currency = getFieldValue('currency');
            const currencySymbol = getCurrencyConfig(currency).symbol;
            
            return (
              <>
                <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 12 }}>
                  {t('createFromPI.form.itemsDetailTitle', { currency })}
                </Text>

                <Form.List name="lines">
                  {(fields) => (
                    <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 16, background: '#fafafa' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 2fr', gap: 16, marginBottom: 8, fontWeight: 500 }}>
                        <div>{t('createFromPI.form.columnProduct')}</div>
                        <div>{t('createFromPI.form.columnQty')}</div>
                        <div>{t('createFromPI.form.columnUnit')}</div>
                        <div>{t('createFromPI.form.columnPurchasePrice', { currency })}</div>
                      </div>

                      {fields.map(({ key, name, ...restField }) => {
                        const productName = form.getFieldValue(['lines', name, 'productName']);
                        return (
                          <div key={key} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 2fr', gap: 16, marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <Text strong>{productName}</Text>
                              <Form.Item {...restField} name={[name, 'productId']} style={{ display: 'none' }}>
                                <Input />
                              </Form.Item>
                            </div>

                            <Form.Item {...restField} name={[name, 'quantity']} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                              <InputNumber min={1} style={{ width: '100%' }} disabled />
                            </Form.Item>

                            <Form.Item {...restField} name={[name, 'unit']} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                              <Input style={{ width: '100%' }} disabled />
                            </Form.Item>

                            <Form.Item {...restField} name={[name, 'unitPrice']} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                              <Space.Compact style={{ width: '100%' }}>
                                <InputNumber
                                  min={0}
                                  style={{ width: '100%' }}
                                  precision={2}
                                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                  parser={(value) => {
                                    const parsed = parseFloat((value || '').replace(/,/g, ''));
                                    return isNaN(parsed) ? 0 : parsed as any;
                                  }}
                                />
                                <span style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  padding: '0 12px', 
                                  background: token.colorFillAlter,
                                  border: `1px solid ${token.colorBorder}`,
                                  borderLeft: 'none',
                                  borderRadius: `0 ${token.borderRadius}px ${token.borderRadius}px 0`,
                                  color: token.colorTextSecondary,
                                  fontWeight: 600,
                                  minWidth: 45,
                                  justifyContent: 'center'
                                }}>
                                  {currencySymbol}
                                </span>
                              </Space.Compact>
                            </Form.Item>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Form.List>
              </>
            );
          }}
        </Form.Item>

        <Form.Item label={t('createFromPI.form.notesLabel')} name="notes" style={{ marginTop: 20 }}>
          <Input.TextArea rows={2} placeholder={t('createFromPI.form.notesPlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default POFromPIModal;
