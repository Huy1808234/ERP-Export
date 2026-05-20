'use client'

import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Row,
  Col,
  Divider,
  Card,
  theme,
} from 'antd';
import { useTheme } from '@/context/theme.context';
import { 
  DeleteOutlined, 
  PlusOutlined, 
  EditOutlined,
  InfoCircleOutlined, 
  ShoppingCartOutlined,
  CalculatorOutlined,
  FileTextOutlined,
  TruckOutlined,
  SafetyCertificateOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import dayjs from 'dayjs';
import { IProduct } from '@/types/product';
import { IQuotation } from '@/types/o2c';
import { INCOTERMS_KEYS, PAYMENT_TERM_KEYS, SELLER_LED_INCOTERMS, IncotermKey } from '@/constants/o2c';
import { useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';

const { Text, Title } = Typography;

interface IProps {
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (v: boolean) => void;
  fetchQuotations: () => void;
  editData?: IQuotation;
  initialInquiryData?: any;
}

// Removed local INCOTERMS_OPTIONS

const CURRENCY_OPTIONS = [
  { value: 'USD', label: '🇺🇸 USD' },
  { value: 'EUR', label: '🇪🇺 EUR' },
  { value: 'VND', label: '🇻🇳 VND' },
  { value: 'CNY', label: '🇨🇳 CNY' },
];
// UNIT_OPTIONS moved inside component with i18n

const QuotationCreateModal = (props: IProps) => {
  const { isCreateModalOpen, setIsCreateModalOpen, editData, initialInquiryData } = props;
  const isEditMode = !!editData;
  const { token } = theme.useToken();
  const tQ = useTranslations('Quotation');
  const [submitting, setSubmitting] = useState(false);

  // TECH LEAD: Using a key to force re-mounting and cleanup of form state
  const modalKey = useMemo(() => isEditMode ? `edit-${editData?._id}` : (initialInquiryData ? `inquiry-${initialInquiryData._id}` : 'create'), [isEditMode, editData?._id, initialInquiryData]);

  const handleClose = () => {
    setIsCreateModalOpen(false);
  };

  return (
    <Modal
      key={modalKey}
      title={
        <Space>
          <FileTextOutlined style={{ color: token.colorPrimary }} />
          <span style={{ fontWeight: 700 }}>{isEditMode ? tQ('create.editTitle') : tQ('create.modalTitle')}</span>
        </Space>
      }
      open={isCreateModalOpen}
      onOk={() => {
        // We will trigger a custom event or use a ref, but let's use the simplest way:
        // Pass a 'submitTrigger' or similar, or just find the form.
        // Actually, since we want to keep it simple, we'll keep the Form outside but lazy render the content.
        // BUT to fix the warning, the useForm() must be inside the same level as <Form>.
      }}
      // Actually, the easiest fix for "not connected" is to move useForm and Form into a separate component
      // and only render it when open.
      footer={null} // We will use custom buttons inside the lazy-loaded content or handle it via a Ref.
      onCancel={handleClose}
      mask={{ closable: false }}
      width={1100}
      style={{ top: 20 }}
      destroyOnHidden
    >
      {isCreateModalOpen && (
        <QuotationFormInner 
          {...props} 
          handleClose={handleClose} 
          setSubmitting={setSubmitting}
          submitting={submitting}
        />
      )}
    </Modal>
  );
};

interface InnerProps extends IProps {
    handleClose: () => void;
    setSubmitting: (v: boolean) => void;
    submitting: boolean;
}

const QuotationFormInner = (props: InnerProps) => {
  const { handleClose, fetchQuotations, editData, initialInquiryData, setSubmitting, submitting } = props;
  const isEditMode = !!editData;
  const { notification } = App.useApp();
  const { data: session } = useSession();
  const tQ = useTranslations('Quotation');
  const tInc = useTranslations('Incoterms');
  const tPayment = useTranslations('PaymentTerms');
  const tUom = useTranslations('UOM');

  const incotermOptions = useMemo(() => {
    return INCOTERMS_KEYS.map(key => ({
      value: key,
      label: tInc(key)
    }));
  }, [tInc]);

  const paymentTermsOptions = useMemo(() => {
    return PAYMENT_TERM_KEYS.map(key => ({
      value: key,
      label: tPayment(key)
    }));
  }, [tPayment]);

  const unitOptions = useMemo(() => {
    return [
      { value: 'PCS', label: tUom('PCS') },
      { value: 'SETS', label: tUom('SETS') },
      { value: 'CARTONS', label: tUom('CARTONS') },
      { value: 'TONS', label: tUom('TONS') },
      { value: 'KGS', label: tUom('KGS') },
    ];
  }, [tUom]);

  const [form] = Form.useForm();
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<IProduct[]>([]);
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({});

  // Watch for dynamic calculation
  const watchedItems = Form.useWatch('items', form);
  const watchedCurrency = Form.useWatch('currency', form) || 'USD';
  const watchedIncoterm = Form.useWatch('incoterm', form);

  // TECH LEAD LOGIC: Reset fees when switching to Buyer-Led Incoterms
  useEffect(() => {
    if (watchedIncoterm && !SELLER_LED_INCOTERMS.includes(watchedIncoterm as any)) {
      form.setFieldsValue({
        seaFreight: 0,
        insuranceCost: 0,
        domesticTransportCost: 0,
        portCharges: 0,
        logisticsFee: 0
      });
    }
  }, [watchedIncoterm, form]);

  const fetchDropdowns = useCallback(async () => {
    const accessToken = getAccessToken(session);
    if (!accessToken) return;

    const headers = { Authorization: `Bearer ${accessToken}` };

    const [partnersRes, productsRes, curRes] = await Promise.all([
      sendRequest<IBackendRes<IModelPaginate<any>>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 500, partnerType: 'CUSTOMER' },
        headers,
      }),
      sendRequest<IBackendRes<IModelPaginate<IProduct>>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 500, isActive: true },
        headers,
      }),
      sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies`,
        method: 'GET',
        headers,
      }),
    ]);

    if (partnersRes?.data) {
      const fetchedCustomers = partnersRes.data.results || [];
      // TECH LEAD: Ensure initial customer from inquiry is in the list to avoid UUID display issue
      if (initialInquiryData?.customerId && !fetchedCustomers.find((c: any) => c._id === initialInquiryData.customerId)) {
        fetchedCustomers.unshift({
          id: initialInquiryData.customerId,
          name: initialInquiryData.customerName,
          defaultCurrency: 'USD',
        });
      }
      setCustomers(fetchedCustomers);
    }
    if (productsRes?.data) {
      setProducts(productsRes.data.results || []);
    }

    const nextRates: Record<string, number> = {};
    if (curRes?.data) {
      for (const c of curRes.data) {
        const code = c?.code;
        if (!code) continue;
        const list = Array.isArray(c.exchangeRates) ? c.exchangeRates : [];
        const normalized = (r: any) => (r?.rateType || 'TRANSFER') as string;
        const latest =
          list.find((r: any) => r?.isActive && normalized(r) === 'TRANSFER')?.rate ??
          list.find((r: any) => normalized(r) === 'TRANSFER')?.rate;
        if (latest) nextRates[code] = Number(latest);
      }
    }
    setCurrencyRates(nextRates);
  }, [session, initialInquiryData]);

  useEffect(() => {
    fetchDropdowns();
    if (editData) {
      form.setFieldsValue({
        customerId: editData.customer?._id,
        incoterm: editData.incoterm,
        currency: editData.currency,
        portOfLoading: editData.portOfLoading,
        portOfDischarge: editData.portOfDischarge,
        paymentTerms: editData.paymentTerms ? editData.paymentTerms.split(', ') : [],
        note: editData.note,
        issueDate: (editData as any).issueDate ? dayjs((editData as any).issueDate) : dayjs(),
        expiryDate: editData.expiryDate ? dayjs(editData.expiryDate) : null,
        items: (editData.items || []).map((l: any) => ({
          productId: l.product?._id || l.productId,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
        })),
        logisticsFee: editData.logisticsFee || 0,
        otherFee: editData.otherFee || 0,
        domesticTransportCost: editData.domesticTransportCost || 0,
        portCharges: editData.portCharges || 0,
        seaFreight: editData.seaFreight || 0,
        insuranceCost: editData.insuranceCost || 0,
        bankInfo: editData.bankInfo,
      });
    } else if (initialInquiryData) {
      // TECH LEAD: Auto-fill from Inquiry (I2Q Workflow)
      form.setFieldsValue({
        customerId: initialInquiryData.customerId || undefined, // Nếu có mapping khách hàng
        currency: 'USD',
        incoterm: 'FOB',
        logisticsFee: 0,
        otherFee: 0,
        domesticTransportCost: 0,
        portCharges: 0,
        seaFreight: 0,
        insuranceCost: 0,
        issueDate: dayjs(),
        items: [{
          productId: initialInquiryData.productId,
          quantity: initialInquiryData.quantity,
          unit: initialInquiryData.product?.unitOfMeasure || 'CARTONS',
          unitPrice: initialInquiryData.product?.defaultExportPrice || 0,
        }],
        note: `Được tạo từ Yêu cầu báo giá của: ${initialInquiryData.customerName}\n${initialInquiryData.note || ''}`,
      });
    } else {
      form.setFieldsValue({ 
        currency: 'USD', 
        incoterm: 'FOB',
        logisticsFee: 0,
        otherFee: 0,
        domesticTransportCost: 0,
        portCharges: 0,
        seaFreight: 0,
        insuranceCost: 0,
        issueDate: dayjs(),
        items: [{ quantity: 1, unit: 'CARTONS', unitPrice: 0 }] 
      });

      // Fetch default bank info for new quotation
      const fetchDefaultBank = async () => {
        const accessToken = getAccessToken(session);
        if (accessToken) {
           const bankSetting = await sendRequest<IBackendRes<any>>({
              url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/settings/COMPANY_BANK_INFO`,
              method: 'GET',
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (bankSetting?.data?.value) {
              form.setFieldValue('bankInfo', bankSetting.data.value);
            }
        }
      };
      fetchDefaultBank();
    }
  }, [editData, form, fetchDropdowns, initialInquiryData, session]);

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find(c => c._id === customerId);
    if (customer) {
      form.setFieldsValue({
        currency: customer.defaultCurrency || 'USD',
        paymentTerms: customer.defaultPaymentTerm ? [customer.defaultPaymentTerm] : [],
      });
    }
  };

  const handleProductChange = (productId: string, index: number) => {
    const product = products.find(p => p._id === productId);
    const currency = form.getFieldValue('currency') || 'USD';
    
    if (product) {
      let price = product.defaultExportPrice || 0;
      
      // Auto convert if current currency is VND and price is USD
      if (currency === 'VND' && currencyRates['USD']) {
        price = Math.round(price * currencyRates['USD']);
      }

      const currentItems = form.getFieldValue('items');
      currentItems[index] = {
        ...currentItems[index],
        unit: product.unitOfMeasure || 'CARTONS',
        unitPrice: price,
      };
      form.setFieldsValue({ items: currentItems });
    }
  };

  const watchedLogisticsFee = Form.useWatch('logisticsFee', form) || 0;
  const watchedOtherFee = Form.useWatch('otherFee', form) || 0;
  const watchedDomesticTransport = Form.useWatch('domesticTransportCost', form) || 0;
  const watchedPortCharges = Form.useWatch('portCharges', form) || 0;
  const watchedSeaFreight = Form.useWatch('seaFreight', form) || 0;
  const watchedInsurance = Form.useWatch('insuranceCost', form) || 0;

  const grandTotal = useMemo(() => {
    if (!watchedItems) return 0;
    const itemsTotal = watchedItems.reduce((acc: number, curr: any) => {
      const q = curr?.quantity || 0;
      const p = curr?.unitPrice || 0;
      return acc + (q * p);
    }, 0);
    return itemsTotal + 
           (watchedLogisticsFee || 0) + 
           (watchedOtherFee || 0) + 
           (watchedDomesticTransport || 0) + 
           (watchedPortCharges || 0) + 
           (watchedSeaFreight || 0) + 
           (watchedInsurance || 0);
  }, [watchedItems, watchedLogisticsFee, watchedOtherFee, watchedDomesticTransport, watchedPortCharges, watchedSeaFreight, watchedInsurance]);

  const onFinish = async (values: any) => {
    if (!values.items || values.items.length === 0) {
      notification.warning({ title: tQ('create.notifications.atLeastOneItem') });
      return;
    }

    const incoterm = values.incoterm as IncotermKey;
    const seaFreight = Number(values.seaFreight || 0);
    const insurance = Number(values.insuranceCost || 0);

    // TECH LEAD VALIDATION: Incoterm-Specific Fee Guardrail
    if (incoterm === 'CIF') {
      if (seaFreight <= 0 || insurance <= 0) {
        notification.error({ title: tQ('create.notifications.cifError'), description: tQ('create.notifications.cifDetail') });
        return;
      }
    } else if (incoterm === 'CFR') {
      if (seaFreight <= 0) {
        notification.error({ title: tQ('create.notifications.cfrError'), description: tQ('create.notifications.cfrDetail') });
        return;
      }
    } else if (['DDP', 'DAP'].includes(incoterm)) {
      const domestic = Number(values.domesticTransportCost || 0);
      if (seaFreight <= 0 || domestic <= 0) {
        notification.error({ title: tQ('create.notifications.doorError', { incoterm }), description: tQ('create.notifications.doorDetail', { incoterm }) });
        return;
      }
    } else if (SELLER_LED_INCOTERMS.includes(incoterm)) {
      // Các trường hợp Seller-led khác (như CIP, CPT) ít nhất phải có cước vận chuyển
      if (seaFreight <= 0) {
        notification.error({ title: tQ('create.notifications.error'), description: tQ('create.notifications.cfrDetail') });
        return;
      }
    }

    setSubmitting(true);
    const accessToken = getAccessToken(session);

    const payload = {
      ...values,
      issueDate: values.issueDate ? values.issueDate.format('YYYY-MM-DD') : undefined,
      expiryDate: values.expiryDate ? values.expiryDate.format('YYYY-MM-DD') : undefined,
      paymentTerms: Array.isArray(values.paymentTerms) ? values.paymentTerms.join(', ') : values.paymentTerms,
      items: values.items.map((l: any) => ({
        ...l,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      })),
    };

    const res = await sendRequest<IBackendRes<any>>({
      url: isEditMode
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations/${editData._id}`
        : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations`,
      method: isEditMode ? 'PATCH' : 'POST',
      body: payload,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    setSubmitting(false);

    if (res?.data) {
      handleClose();
      fetchQuotations();
      notification.success({
        title: isEditMode ? tQ('create.notifications.updateSuccess') : tQ('create.notifications.success'),
        description: tQ('create.notifications.numberLabel', { number: res.data.quotationNumber }),
      });

      // TECH LEAD: If this was from an inquiry, mark it as PROCESSED
      if (initialInquiryData?._id) {
        try {
          await sendRequest({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inquiries/${initialInquiryData._id}/status`,
            method: 'PATCH',
            body: { status: 'PROCESSED' },
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        } catch (e) {
          console.error("Failed to update inquiry status", e);
        }
      }
    } else {
      notification.error({ title: tQ('create.notifications.error'), description: res?.message });
    }
  };

  const { token } = theme.useToken();
  const { isDark } = useTheme();

  return (
      <Form form={form} onFinish={onFinish} layout="vertical">
        {/* --- PHẦN 1: THÔNG TIN CHUNG --- */}
        <Divider titlePlacement="left" plain>
          <Space><InfoCircleOutlined /> <Text strong>{tQ('create.sections.customerInfo').toUpperCase()}</Text></Space>
        </Divider>
        
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label={tQ('create.form.customer')}
              name="customerId"
              rules={[{ required: true, message: tQ('create.form.customerRequired') }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={tQ('create.form.customerPlaceholder')}
                options={customers.map(c => ({ value: c._id, label: c.name }))}
                onChange={handleCustomerChange}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label={tQ('create.form.incoterm')}
              name="incoterm"
              rules={[{ required: true }]}
              extra={
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {watchedIncoterm && (SELLER_LED_INCOTERMS.includes(watchedIncoterm as any) 
                    ? tQ('create.form.incotermHintSeller') 
                    : tQ('create.form.incotermHintBuyer'))}
                </Text>
              }
            >
              <Select options={incotermOptions} />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item label={tQ('create.form.currency')} name="currency" rules={[{ required: true }]}>
              <Select options={CURRENCY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item label={tQ('create.form.issueDate')} name="issueDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item label={tQ('create.form.expiryDate')} name="expiryDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder={tQ('create.form.expiryPlaceholder')} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item label={tQ('create.form.pol')} name="portOfLoading">
              <Input placeholder={tQ('create.form.polPlaceholder')} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label={tQ('create.form.pod')} name="portOfDischarge">
              <Input placeholder={tQ('create.form.podPlaceholder')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={tQ('create.form.paymentTerms')} name="paymentTerms">
              <Select 
                mode="tags" 
                placeholder={tQ('create.form.paymentTermsPlaceholder')}
                options={paymentTermsOptions}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* --- PHẦN 2: CHI TIẾT HÀNG HÓA --- */}
        <Divider titlePlacement="left" plain>
          <Space><ShoppingCartOutlined /> <Text strong>{tQ('create.sections.items').toUpperCase()}</Text></Space>
        </Divider>

        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
                <Table
                  dataSource={fields}
                  pagination={false}
                  bordered
                  size="small"
                  columns={[
                    {
                      title: tQ('table.stt'),
                      width: 50,
                      align: 'center',
                      render: (_, __, index) => index + 1,
                    },
                    {
                      title: tQ('table.product'),
                      dataIndex: 'productId',
                      render: (_, { key, name, ...restField }) => (
                        <Form.Item
                          {...restField}
                          key={key}
                          name={[name, 'productId']}
                          rules={[{ required: true, message: tQ('table.required') }]}
                          noStyle
                        >
                          <Select
                            showSearch
                            style={{ width: '100%' }}
                            placeholder={tQ('table.productPlaceholder')}
                            optionFilterProp="label"
                            onChange={(val) => handleProductChange(val, name)}
                            options={products.map(p => ({ 
                            value: p._id, 
                            label: `[${p.sku}] ${p.vietnameseName}` 
                          }))}
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: tQ('table.quantity'),
                      dataIndex: 'quantity',
                      width: 120,
                      render: (_, { key, name, ...restField }) => (
                        <Form.Item
                          {...restField}
                          key={key}
                          name={[name, 'quantity']}
                          rules={[{ required: true }]}
                          noStyle
                        >
                          <InputNumber min={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                      ),
                    },
                    {
                      title: tQ('table.unit'),
                      dataIndex: 'unit',
                      width: 100,
                      render: (_, { key, name, ...restField }) => (
                        <Form.Item
                          {...restField}
                          key={key}
                          name={[name, 'unit']}
                          noStyle
                        >
                          <Select
                            options={unitOptions}
                            placeholder={tQ('table.unit')}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: tQ('table.price', { currency: watchedCurrency }),
                      dataIndex: 'unitPrice',
                      width: 150,
                      render: (_, { key, name, ...restField }) => (
                        <Form.Item
                          {...restField}
                          key={key}
                          name={[name, 'unitPrice']}
                          rules={[{ required: true }]}
                          noStyle
                        >
                          <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={v => Number(v!.replace(/\$\s?|(,*)/g, '')) as any}
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: tQ('table.total'),
                      width: 150,
                      align: 'right',
                      render: (_, { name }) => {
                        const q = form.getFieldValue(['items', name, 'quantity']) || 0;
                        const p = form.getFieldValue(['items', name, 'unitPrice']) || 0;
                        return (
                          <Text strong style={{ color: token.colorPrimary }}>
                            {(q * p).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </Text>
                        );
                      },
                    },
                    {
                      title: '',
                      width: 50,
                      align: 'center',
                      render: (_, { name }) => (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(name)}
                        />
                      ),
                    },
                  ]}
                />
              </div>
              <Button
                type="dashed"
                onClick={() => add({ quantity: 1, unit: 'CTN', unitPrice: 0 })}
                block
                icon={<PlusOutlined />}
              >
                {tQ('create.form.addBtn')}
              </Button>
            </>
          )}
        </Form.List>

        {/* --- PHẦN 3: TỔNG HỢP & GHI CHÚ --- */}
        <Row gutter={24} style={{ marginTop: 24 }}>
          <Col span={14}>
            <Form.Item label={tQ('create.form.note')} name="note">
              <Input.TextArea rows={4} placeholder={tQ('create.form.notePlaceholder')} />
            </Form.Item>
            <Form.Item 
                label={<Space><SafetyCertificateOutlined /> <Text>{tQ('create.form.bankInfo')}</Text></Space>} 
                name="bankInfo"
            >
                <Input.TextArea rows={4} placeholder={tQ('create.form.bankInfoPlaceholder')} />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Card 
              size="small" 
              style={{ 
                background: isDark ? token.colorBgContainer : token.colorPrimaryBg, 
                border: `1px solid ${isDark ? token.colorBorder : token.colorPrimaryBorder}`,
                borderRadius: 12,
                boxShadow: token.boxShadowSecondary
              }}
            >
              <div style={{ padding: '12px' }}>
                <Row justify="space-between" style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 14, color: token.colorTextHeading, fontWeight: 500 }}>{tQ('create.form.subtotal')}:</Text>
                  <Text strong style={{ fontSize: 15 }}>{watchedCurrency} {(grandTotal - watchedLogisticsFee - watchedOtherFee - watchedSeaFreight - watchedInsurance - watchedDomesticTransport - watchedPortCharges).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                </Row>

                <Divider style={{ margin: '8px 0 16px 0', borderTop: `1px solid ${token.colorBorderSecondary}` }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Title level={5} style={{ margin: 0, color: token.colorTextHeading, fontSize: 15 }}>
                    <DashboardOutlined /> {tQ('create.sections.logistics')}
                  </Title>
                  {watchedIncoterm && !SELLER_LED_INCOTERMS.includes(watchedIncoterm as any) && (
                    <Tag color="blue" style={{ borderRadius: 4, margin: 0 }}>
                      {tQ('create.logistics.buyerCollect')}
                    </Tag>
                  )}
                </div>
                
                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                  <Space>
                    <TruckOutlined style={{ color: token.colorPrimary }} />
                    <Text style={{ fontSize: 13, color: token.colorTextDescription }}>{tQ('create.logistics.seaFreight')}:</Text>
                  </Space>
                  <Form.Item 
                    name="seaFreight" 
                    noStyle
                    rules={[{ 
                      validator: (_, value) => {
                        if (SELLER_LED_INCOTERMS.includes(watchedIncoterm as any) && (!value || value <= 0)) {
                          return Promise.reject(tQ('create.logistics.required'));
                        }
                        return Promise.resolve();
                      }
                    }]}
                  >
                    <InputNumber 
                      size="small" 
                      min={0} 
                      disabled={!SELLER_LED_INCOTERMS.includes(watchedIncoterm as any)}
                      status={SELLER_LED_INCOTERMS.includes(watchedIncoterm as any) && (!watchedSeaFreight || watchedSeaFreight <= 0) ? 'error' : ''}
                      style={{ width: 130, borderRadius: 6, fontWeight: 'bold' }} 
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => Number(v!.replace(/\$\s?|(,*)/g, '')) as any}
                    />
                  </Form.Item>
                </Row>

                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                  <Space>
                    <SafetyCertificateOutlined style={{ color: token.colorSuccess }} />
                    <Text style={{ fontSize: 13, color: token.colorTextDescription }}>{tQ('create.logistics.insurance')}:</Text>
                  </Space>
                  <Form.Item 
                    name="insuranceCost" 
                    noStyle
                    rules={[{ 
                      validator: (_, value) => {
                        if (watchedIncoterm === 'CIF' && (!value || value <= 0)) {
                          return Promise.reject(tQ('create.logistics.required'));
                        }
                        return Promise.resolve();
                      }
                    }]}
                  >
                    <InputNumber 
                      size="small" 
                      min={0} 
                      disabled={watchedIncoterm !== 'CIF'}
                      status={watchedIncoterm === 'CIF' && (!watchedInsurance || watchedInsurance <= 0) ? 'error' : ''}
                      style={{ width: 130, borderRadius: 6, fontWeight: 'bold' }} 
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => Number(v!.replace(/\$\s?|(,*)/g, '')) as any}
                    />
                  </Form.Item>
                </Row>

                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                  <Space>
                    <TruckOutlined style={{ color: token.colorWarning }} />
                    <Text style={{ fontSize: 13, color: token.colorTextDescription }}>Vận chuyển nội địa:</Text>
                  </Space>
                  <Form.Item 
                    name="domesticTransportCost" 
                    noStyle
                    rules={[{ 
                      validator: (_, value) => {
                        if (['DDP', 'DAP'].includes(watchedIncoterm as any) && (!value || value <= 0)) {
                          return Promise.reject('Bắt buộc!');
                        }
                        return Promise.resolve();
                      }
                    }]}
                  >
                    <InputNumber 
                      size="small" 
                      min={0} 
                      disabled={!SELLER_LED_INCOTERMS.includes(watchedIncoterm as any)}
                      status={['DDP', 'DAP'].includes(watchedIncoterm as any) && (!watchedDomesticTransport || watchedDomesticTransport <= 0) ? 'error' : ''}
                      style={{ width: 130, borderRadius: 6, fontWeight: 'bold' }} 
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => Number(v!.replace(/\$\s?|(,*)/g, '')) as any}
                    />
                  </Form.Item>
                </Row>

                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                  <Space>
                    <CalculatorOutlined style={{ color: token.colorInfo }} />
                    <Text style={{ fontSize: 13, color: token.colorTextDescription }}>Phí cảng (Port Charges):</Text>
                  </Space>
                  <Form.Item name="portCharges" noStyle>
                    <InputNumber 
                      size="small" 
                      min={0} 
                      disabled={!SELLER_LED_INCOTERMS.includes(watchedIncoterm as any)}
                      style={{ width: 130, borderRadius: 6, fontWeight: 'bold' }} 
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => Number(v!.replace(/\$\s?|(,*)/g, '')) as any}
                    />
                  </Form.Item>
                </Row>

                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                  <Space>
                    <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                    <Text style={{ fontSize: 13, color: token.colorTextDescription }}>Phí khác (Other):</Text>
                  </Space>
                  <Form.Item name="otherFee" noStyle>
                    <InputNumber 
                      size="small" 
                      min={0} 
                      style={{ width: 130, borderRadius: 6, fontWeight: 'bold' }} 
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => Number(v!.replace(/\$\s?|(,*)/g, '')) as any}
                    />
                  </Form.Item>
                </Row>

                <Divider style={{ margin: '14px 0', borderTop: `2px dashed ${token.colorBorderSecondary}` }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Title level={5} style={{ margin: 0, color: token.colorTextHeading, letterSpacing: 0.5 }}>
                    <CalculatorOutlined /> TỔNG CỘNG:
                  </Title>
                  <div style={{ textAlign: 'right' }}>
                    <Text strong style={{ color: token.colorError, fontSize: 13, display: 'block', lineHeight: 1 }}>{watchedCurrency}</Text>
                    <Text strong style={{ color: token.colorError, fontSize: 24, fontWeight: 900 }}>
                      {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
        <Divider style={{ marginTop: 32 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={handleClose}>
            Đóng
          </Button>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={submitting}
            icon={isEditMode ? <EditOutlined /> : <PlusOutlined />}
            style={{ minWidth: 160 }}
          >
            {isEditMode ? 'Lưu thay đổi' : 'Phát hành báo giá'}
          </Button>
        </div>
      </Form>
  );
};

export default QuotationCreateModal;
