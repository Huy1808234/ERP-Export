'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, InputNumber, Button, Divider, Space, Row, Col, Typography, App } from 'antd';
import { PlusOutlined, DeleteOutlined, CalculatorOutlined } from '@ant-design/icons';
import { sendRequest } from '@/utils/api';
import { getSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { INCOTERMS_KEYS } from '@/constants/o2c';
import { useMemo } from 'react';

const { Title, Text } = Typography;
const { Option } = Select;

interface Props {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const SalesContractModal: React.FC<Props> = ({ open, onCancel, onSuccess }) => {
  const t = useTranslations('SalesContract');
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([{}]); // Danh sách sản phẩm trong HĐ
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({});
  const [proformaInvoices, setProformaInvoices] = useState<any[]>([]);
  
  const tInc = useTranslations('Incoterms');
  const incotermOptions = useMemo(() => {
    return INCOTERMS_KEYS.map(key => ({
      value: key,
      label: tInc(key)
    }));
  }, [tInc]);

  const watchedCurrency = Form.useWatch('currencyCode', form) || 'USD';

  useEffect(() => {
    if (open) {
      fetchMasterData();
      form.resetFields();
      setItems([{}]);
    }
  }, [open]);

  const fetchMasterData = async () => {
    try {
      const currentSession = await getSession();
      const token = currentSession?.user?.access_token;
      
      const [prodRes, partRes, curRes, piRes] = await Promise.all([
        sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products`,
          method: 'GET',
          queryParams: { pageSize: 200, isActive: true },
          headers: { Authorization: `Bearer ${token}` }
        }),
        sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
          method: 'GET',
          queryParams: { pageSize: 200 }, // Fetch all to filter later or fetch twice
          headers: { Authorization: `Bearer ${token}` }
        }),
        sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies`,
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        }),
        sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/proforma-invoices`,
          method: 'GET',
          queryParams: { status: 'ACCEPTED', pageSize: 100 },
          headers: { Authorization: `Bearer ${token}` }
        }),
      ]);

      if (prodRes?.data?.results) setProducts(prodRes.data.results);
      if (partRes?.data?.results) setPartners(partRes.data.results);
      if (piRes?.data?.results) setProformaInvoices(piRes.data.results);

      const nextRates: Record<string, number> = {};
      for (const c of curRes?.data ?? []) {
        const code = c?.code;
        if (!code) continue;
        const list = Array.isArray(c.exchangeRates) ? c.exchangeRates : [];
        const normalized = (r: any) => (r?.rateType || 'TRANSFER') as string;
        const latest =
          list.find((r: any) => r?.isActive && normalized(r) === 'TRANSFER')?.rate ??
          list.find((r: any) => normalized(r) === 'TRANSFER')?.rate;
        if (latest) nextRates[code] = Number(latest);
      }
      setCurrencyRates(nextRates);
    } catch (error) {
      console.error('Lỗi tải Master Data', error);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (watchedCurrency === 'VND') {
      form.setFieldValue('exchangeRate', 1);
      return;
    }

    // Auto set rate from master data if available
    if (currencyRates[watchedCurrency]) {
      form.setFieldValue('exchangeRate', currencyRates[watchedCurrency]);
    }
  }, [watchedCurrency, currencyRates]);

  const handlePIChange = (piId: string) => {
    const selected = proformaInvoices.find(p => p.id === piId);
    if (!selected) return;

    form.setFieldsValue({
      buyerId: selected.customerId,
      incoterm: selected.incoterm,
      currencyCode: selected.currency,
      exchangeRate: selected.exchangeRate,
      domesticTransportCost: selected.logisticsFee || 0,
      notes: selected.note,
    });

    if (selected.items && selected.items.length > 0) {
      setItems(selected.items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })));
    }
  };

  const handleCalculateIncoterm = async () => {
    const values = form.getFieldsValue();
    const validItems = items.filter(i => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      message.warning(t('modal.noValidItems') || 'Vui lòng chọn ít nhất một sản phẩm hợp lệ');
      return;
    }

    const payload = {
      ...values,
      items: validItems.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice || 0,
        totalPrice: (i.quantity || 0) * (i.unitPrice || 0)
      }))
    };

    try {
      const currentSession = await getSession();
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/calculate`,
        method: 'POST',
        body: payload,
        headers: { Authorization: `Bearer ${currentSession?.user?.access_token}` }
      });

      if (res?.data) {
        const { totalAmount } = res.data;
        message.info({
          content: `${t('modal.preview')}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: values.currencyCode || 'USD' }).format(totalAmount)}`,
          key: 'incoterm_preview'
        });
      }
    } catch (error) {
      message.error(t('modal.calculateError') || 'Lỗi tính toán');
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    // Filter and validate items
    const validItems = items.filter(i => i.productId && i.quantity > 0);
    
    if (validItems.length === 0) {
      message.error(t('modal.noValidItems') || 'Danh sách sản phẩm không hợp lệ hoặc bị trống');
      setLoading(false);
      return;
    }

    try {
      const currentSession = await getSession();
      const payload = {
        ...values,
        items: validItems.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice || 0,
          totalPrice: (i.quantity || 0) * (i.unitPrice || 0)
        }))
      };

      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts`,
        method: 'POST',
        body: payload,
        headers: { Authorization: `Bearer ${currentSession?.user?.access_token}` }
      });

      if (res?.data) {
        message.success(t('modal.success'));
        onSuccess();
      } else {
        message.error(res?.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      message.error('Lưu thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={<Title level={4} className="text-slate-800 m-0">{t('modal.title')}</Title>}
      open={open}
      onCancel={onCancel}
      width={900}
      footer={null}
      className="premium-modal"
    >
      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ incoterm: 'FOB', currencyCode: 'USD' }}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="proformaInvoiceId" label="Tham chiếu từ PI">
              <Select 
                allowClear 
                placeholder="Chọn PI đã duyệt"
                onChange={handlePIChange}
                options={proformaInvoices.map(p => ({ value: p.id, label: `${p.piNumber} (${p.customer?.name})` }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="contractNumber" label={t('modal.contractNumber')} rules={[{ required: true }]}>
              <Input placeholder="SC-2026-..." className="rounded-lg" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="buyerId" label={t('modal.buyer')} rules={[{ required: true }]}>
              <Select 
                placeholder={t('modal.buyer')} 
                className="rounded-lg" 
                showSearch 
                optionFilterProp="label"
                options={partners.filter(p => p.partnerType === 'CUSTOMER').map(p => ({ value: p.id, label: p.name }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="incoterm" label={t('modal.incoterm')}>
              <Select options={incotermOptions} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="currencyCode" label={t('modal.currency')}>
              <Select>
                <Option value="USD">USD</Option>
                <Option value="EUR">EUR</Option>
                <Option value="VND">VND</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="exchangeRate" label={t('modal.rate')}>
              <InputNumber style={{ width: '100%' }} formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
          </Col>
        </Row>

        <Divider titlePlacement="left"><Text className="text-slate-500 uppercase text-xs font-bold">{t('modal.logisticsDivider')}</Text></Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="logisticsPartnerId" label="Đơn vị vận tải (Forwarder)">
              <Select 
                placeholder="Chọn đơn vị vận chuyển"
                allowClear
                showSearch
                optionFilterProp="label"
                options={partners.filter(p => p.partnerType === 'LOGISTICS' || p.partnerType === 'SUPPLIER').map(p => ({ value: p.id, label: p.name }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="bookingNumber" label="Số Booking">
              <Input placeholder="Nhập số booking nếu có" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
             <Form.Item name="domesticTransportCost" label={t('modal.transport')}>
               <InputNumber 
                style={{ width: '100%' }} 
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                prefix={watchedCurrency}
               />
             </Form.Item>
          </Col>
          <Col span={6}>
             <Form.Item name="portCharges" label={t('modal.port')}>
               <InputNumber 
                style={{ width: '100%' }} 
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                prefix={watchedCurrency}
               />
             </Form.Item>
          </Col>
          <Col span={6}>
             <Form.Item name="seaFreight" label={t('modal.freight')}>
               <InputNumber 
                style={{ width: '100%' }} 
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                prefix={watchedCurrency}
               />
             </Form.Item>
          </Col>
          <Col span={6}>
             <Form.Item name="insuranceCost" label={t('modal.insurance')}>
               <InputNumber 
                style={{ width: '100%' }} 
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                prefix={watchedCurrency}
               />
             </Form.Item>
          </Col>
        </Row>

        <Divider titlePlacement="left"><Text className="text-slate-500 uppercase text-xs font-bold">{t('modal.itemsDivider')}</Text></Divider>
        {items.map((item, index) => (
          <Row gutter={16} key={index} className="mb-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
            <Col span={10}>
              <Select 
                style={{ width: '100%' }} 
                placeholder={t('modal.product')}
                value={item.productId}
                showSearch
                optionFilterProp="label"
                options={products.map(p => ({ 
                  value: p.id, 
                  label: p.sku ? `[${p.sku}] ${p.vietnameseName}` : p.vietnameseName 
                }))}
                onChange={(val) => {
                  const newItems = [...items];
                  newItems[index].productId = val;
                  const prod = products.find(p => p.id === val);
                  if (prod) {
                    newItems[index].unitPrice = prod.defaultExportPrice || 0;
                  }
                  setItems(newItems);
                }}
              />
            </Col>
            <Col span={6}>
              <InputNumber 
                placeholder={t('modal.quantity')} 
                style={{ width: '100%' }} 
                value={item.quantity}
                onChange={(val) => {
                  const newItems = [...items];
                  newItems[index].quantity = val;
                  setItems(newItems);
                }}
              />
            </Col>
            <Col span={6}>
              <InputNumber 
                placeholder={t('modal.price')} 
                style={{ width: '100%' }} 
                value={item.unitPrice}
                onChange={(val) => {
                  const newItems = [...items];
                  newItems[index].unitPrice = val;
                  setItems(newItems);
                }}
              />
            </Col>
            <Col span={2}>
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setItems(items.filter((_, i) => i !== index))} />
            </Col>
          </Row>
        ))}
        <Button type="dashed" block icon={<PlusOutlined />} onClick={() => setItems([...items, {}])} className="mt-2">
          {t('modal.addBtn')}
        </Button>

        <div className="flex justify-between items-center mt-8">
          <Button icon={<CalculatorOutlined />} onClick={handleCalculateIncoterm} className="text-indigo-600 border-indigo-200 bg-indigo-50 font-semibold rounded-lg">
            {t('modal.preview')}
          </Button>
          <Space>
            <Button onClick={onCancel} className="rounded-lg font-semibold">{t('messages.cancel')}</Button>
            <Button type="primary" htmlType="submit" loading={loading} className="bg-slate-900 rounded-lg font-bold">
              {t('modal.save')}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default SalesContractModal;
