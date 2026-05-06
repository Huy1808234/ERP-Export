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
  Typography,
  Row,
  Col,
  Divider,
  Card,
} from 'antd';
import { 
  DeleteOutlined, 
  PlusOutlined, 
  InfoCircleOutlined, 
  ShoppingCartOutlined,
  CalculatorOutlined,
  FileTextOutlined,
  TruckOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import dayjs from 'dayjs';
import { IProduct } from '@/types/product';
import { IQuotation } from '@/types/o2c';
import { INCOTERMS_KEYS, PAYMENT_TERM_KEYS } from '@/constants/o2c';
import { useTranslations } from 'next-intl';

const { Text, Title } = Typography;

interface IProps {
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (v: boolean) => void;
  fetchQuotations: () => void;
  editData?: IQuotation;
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
  const { isCreateModalOpen, setIsCreateModalOpen, fetchQuotations, editData } = props;
  const isEditMode = !!editData;
  const { notification } = App.useApp();
  const { data: session } = useSession();
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
  const [submitting, setSubmitting] = useState(false);

  // Watch for dynamic calculation
  const watchedItems = Form.useWatch('items', form);
  const watchedCurrency = Form.useWatch('currency', form) || 'USD';

  const fetchDropdowns = useCallback(async () => {
    const accessToken = session?.user?.access_token;
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
      setCustomers(partnersRes.data.results || []);
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
  }, [session]);

  useEffect(() => {
    if (isCreateModalOpen) {
      fetchDropdowns();
      if (editData) {
        form.setFieldsValue({
          customerId: editData.customer?.id,
          incoterm: editData.incoterm,
          currency: editData.currency,
          portOfLoading: editData.portOfLoading,
          portOfDischarge: editData.portOfDischarge,
          paymentTerms: editData.paymentTerms ? [editData.paymentTerms] : [],
          note: editData.note,
          issueDate: (editData as any).issueDate ? dayjs((editData as any).issueDate) : dayjs(),
          expiryDate: editData.expiryDate ? dayjs(editData.expiryDate) : null,
          items: (editData.items || []).map((l: any) => ({
            productId: l.product?.id || l.productId,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
          })),
          logisticsFee: editData.logisticsFee || 0,
          otherFee: editData.otherFee || 0,
          bankInfo: editData.bankInfo,
        });
      } else {
        form.setFieldsValue({ 
          currency: 'USD', 
          incoterm: 'FOB',
          logisticsFee: 0,
          otherFee: 0,
          issueDate: dayjs(),
          items: [{ quantity: 1, unit: 'CARTONS', unitPrice: 0 }] 
        });

        // Fetch default bank info for new quotation
        const fetchDefaultBank = async () => {
          const accessToken = session?.user?.access_token;
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
    }
  }, [isCreateModalOpen, editData, form, fetchDropdowns]);

  const handleClose = () => {
    form.resetFields();
    setIsCreateModalOpen(false);
  };

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      form.setFieldsValue({
        currency: customer.defaultCurrency || 'USD',
        paymentTerms: customer.defaultPaymentTerm ? [customer.defaultPaymentTerm] : [],
      });
    }
  };

  const handleProductChange = (productId: string, index: number) => {
    const product = products.find(p => p.id === productId);
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

  const grandTotal = useMemo(() => {
    if (!watchedItems) return 0;
    const itemsTotal = watchedItems.reduce((acc: number, curr: any) => {
      const q = curr?.quantity || 0;
      const p = curr?.unitPrice || 0;
      return acc + (q * p);
    }, 0);
    return itemsTotal + (watchedLogisticsFee || 0) + (watchedOtherFee || 0);
  }, [watchedItems, watchedLogisticsFee, watchedOtherFee]);

  const onFinish = async (values: any) => {
    if (!values.items || values.items.length === 0) {
      notification.warning({ title: 'Vui lòng thêm ít nhất 1 dòng sản phẩm' });
      return;
    }

    setSubmitting(true);
    const accessToken = session?.access_token;

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
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations/${editData.id}`
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
        title: isEditMode ? 'Cập nhật thành công!' : 'Tạo báo giá thành công!',
        description: `Số báo giá: ${res.data.quotationNumber}`,
      });
    } else {
      notification.error({ title: 'Lỗi', description: res?.message });
    }
  };

  return (
    <Modal
      title={
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontWeight: 700 }}>{isEditMode ? 'CẬP NHẬT BÁO GIÁ' : 'TẠO BÁO GIÁ XUẤT KHẨU'}</span>
        </Space>
      }
      open={isCreateModalOpen}
      onOk={() => form.submit()}
      onCancel={handleClose}
      mask={{ closable: false }}
      width={1100}
      confirmLoading={submitting}
      okText={isEditMode ? 'Lưu thay đổi' : 'Phát hành báo giá'}
      cancelText="Đóng"
      style={{ top: 20 }}
      destroyOnHidden
    >
      <Form form={form} onFinish={onFinish} layout="vertical">
        {/* --- PHẦN 1: THÔNG TIN CHUNG --- */}
        <Divider titlePlacement="left" plain>
          <Space><InfoCircleOutlined /> <Text strong>{'Thông tin khách hàng & Điều khoản'.toUpperCase()}</Text></Space>
        </Divider>
        
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="Khách hàng mục tiêu"
              name="customerId"
              rules={[{ required: true, message: 'Bắt buộc chọn khách hàng' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Tìm kiếm khách hàng..."
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                onChange={handleCustomerChange}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label="Incoterms"
              name="incoterm"
              rules={[{ required: true }]}
            >
              <Select options={incotermOptions} />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item label="Tiền tệ" name="currency" rules={[{ required: true }]}>
              <Select options={CURRENCY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item label="Ngày báo giá" name="issueDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item label="Hiệu lực đến" name="expiryDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Đến ngày" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item label="Cảng đi (POL)" name="portOfLoading">
              <Input placeholder="VD: Cat Lai, Hai Phong..." />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="Cảng đến (POD)" name="portOfDischarge">
              <Input placeholder="VD: Long Beach, Hamburg..." />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Điều khoản thanh toán" name="paymentTerms">
              <Select 
                mode="tags" 
                placeholder="Chọn hoặc nhập điều khoản (VD: 30% Deposit...)"
                options={paymentTermsOptions}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* --- PHẦN 2: CHI TIẾT HÀNG HÓA --- */}
        <Divider titlePlacement="left" plain>
          <Space><ShoppingCartOutlined /> <Text strong>{'Danh sách sản phẩm & Đơn giá'.toUpperCase()}</Text></Space>
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
                      title: 'STT',
                      width: 50,
                      align: 'center',
                      render: (_, __, index) => index + 1,
                    },
                    {
                      title: 'Sản phẩm',
                      dataIndex: 'productId',
                      render: (_, { key, name, ...restField }) => (
                        <Form.Item
                          {...restField}
                          key={key}
                          name={[name, 'productId']}
                          rules={[{ required: true, message: 'Bắt buộc' }]}
                          noStyle
                        >
                          <Select
                            showSearch
                            style={{ width: '100%' }}
                            placeholder="Chọn SKU..."
                            optionFilterProp="label"
                            onChange={(val) => handleProductChange(val, name)}
                            options={products.map(p => ({ 
                            value: p.id, 
                            label: `[${p.sku}] ${p.vietnameseName}` 
                          }))}
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: 'Số lượng',
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
                      title: 'Đơn vị',
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
                            placeholder="ĐV"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: `Đơn giá (${watchedCurrency})`,
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
                      title: 'Thành tiền',
                      width: 150,
                      align: 'right',
                      render: (_, { name }) => {
                        const q = form.getFieldValue(['items', name, 'quantity']) || 0;
                        const p = form.getFieldValue(['items', name, 'unitPrice']) || 0;
                        return (
                          <Text strong style={{ color: '#1890ff' }}>
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
                Thêm dòng hàng mới
              </Button>
            </>
          )}
        </Form.List>

        {/* --- PHẦN 3: TỔNG HỢP & GHI CHÚ --- */}
        <Row gutter={24} style={{ marginTop: 24 }}>
          <Col span={14}>
            <Form.Item label="Ghi chú nội bộ / Điều khoản bổ sung" name="note">
              <Input.TextArea rows={4} placeholder="Nhập các thỏa thuận riêng hoặc ghi chú kỹ thuật..." />
            </Form.Item>
            <Form.Item 
                label={<Space><SafetyCertificateOutlined /> <Text>Thông tin tài khoản thụ hưởng (Swift/Bank)</Text></Space>} 
                name="bankInfo"
            >
                <Input.TextArea rows={4} placeholder="Thông tin ngân hàng..." />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Card 
              size="small" 
              style={{ 
                background: '#f0f5ff', 
                border: '2px solid #adc6ff',
                borderRadius: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
              }}
            >
              <div style={{ padding: '12px' }}>
                <Row justify="space-between" style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 14, color: '#1d39c4', fontWeight: 500 }}>Tạm tính (Subtotal):</Text>
                  <Text strong style={{ fontSize: 15 }}>{watchedCurrency} {(grandTotal - watchedLogisticsFee - watchedOtherFee).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                </Row>
                
                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                  <Space>
                    <TruckOutlined style={{ color: '#096dd9' }} />
                    <Text style={{ fontSize: 14, color: '#1d39c4' }}>Phí Logistics:</Text>
                  </Space>
                  <Form.Item name="logisticsFee" noStyle>
                    <InputNumber 
                      size="middle" 
                      min={0} 
                      style={{ width: 150, borderRadius: 6, fontWeight: 'bold' }} 
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => Number(v!.replace(/\$\s?|(,*)/g, '')) as any}
                    />
                  </Form.Item>
                </Row>
                
                <Row justify="space-between" align="middle" style={{ marginBottom: 14 }}>
                  <Space>
                    <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
                    <Text style={{ fontSize: 14, color: '#1d39c4' }}>Phí chứng từ/Khác:</Text>
                  </Space>
                  <Form.Item name="otherFee" noStyle>
                    <InputNumber 
                      size="middle" 
                      min={0} 
                      style={{ width: 150, borderRadius: 6, fontWeight: 'bold' }} 
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => Number(v!.replace(/\$\s?|(,*)/g, '')) as any}
                    />
                  </Form.Item>
                </Row>

                <Divider style={{ margin: '14px 0', borderTop: '2px dashed #adc6ff' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Title level={4} style={{ margin: 0, color: '#1d39c4', letterSpacing: 0.5 }}>
                    <CalculatorOutlined /> TỔNG CỘNG:
                  </Title>
                  <div style={{ textAlign: 'right' }}>
                    <Text strong style={{ color: '#f5222d', fontSize: 14, display: 'block', lineHeight: 1 }}>{watchedCurrency}</Text>
                    <Text strong style={{ color: '#f5222d', fontSize: 28, fontWeight: 900 }}>
                      {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default QuotationCreateModal;
