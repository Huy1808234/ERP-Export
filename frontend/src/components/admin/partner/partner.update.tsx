'use client';

import { 
  Divider, Form, Input, InputNumber, Modal, Select, 
  Switch, App, Row, Col, Space, Typography, theme, Button 
} from 'antd';
import { 
  UserOutlined, BankOutlined, 
  CreditCardOutlined, MailOutlined, PhoneOutlined,
  InfoCircleOutlined, EditOutlined, PlusOutlined
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { getAccessToken } from '@/lib/auth-token';
import { useCountries, buildRegionOptions, getCountryRegion, normalizeCountryCode, getCountryDisplayName, loadCountries } from '@/constants/geo';
import { countryService } from '@/services/country.service';
import { QuickAddCountryModal } from '@/components/admin/country/country.quick-add';

const { Text } = Typography;



interface IProps {
  isUpdateModalOpen: boolean;
  setIsUpdateModalOpen: (v: boolean) => void;
  fetchPartners: () => void;
  dataUpdate: any;
  setDataUpdate: (v: any) => void;
}

const PartnerUpdateModal = (props: IProps) => {
  const { isUpdateModalOpen, setIsUpdateModalOpen, fetchPartners, dataUpdate, setDataUpdate } = props;
  const { notification } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();
  const { token } = theme.useToken();

  const tPartner = useTranslations('Partner');
  const tCommon = useTranslations('Common');
  const locale = useLocale();

  const partnerType = Form.useWatch('partnerType', form);
  const defaultCurrency = Form.useWatch('defaultCurrency', form);

  const partnerTypeOptions = useMemo(() => [
    { value: 'CUSTOMER', label: tPartner('types.CUSTOMER') },
    { value: 'SUPPLIER', label: tPartner('types.SUPPLIER') },
    { value: 'LOGISTICS', label: tPartner('types.LOGISTICS') },
  ], [tPartner]);

  const currencyOptions = useMemo(() => 
    ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'VND'].map(c => ({ value: c, label: c })), 
  []);

  const regionOptions = useMemo(() => buildRegionOptions(tPartner), [tPartner]);
  const { options: countryOptions } = useCountries(locale);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const customerPaymentOptions = useMemo(() => [
    { value: 'T/T', label: tPartner('paymentTerms.TT') },
    { value: 'L/C', label: tPartner('paymentTerms.LC') },
    { value: 'D/P', label: tPartner('paymentTerms.DP') },
    { value: 'D/A', label: tPartner('paymentTerms.DA') },
  ], [tPartner]);

  const vendorPaymentOptions = useMemo(() => [
    { value: 'NET_30', label: tPartner('paymentTerms.NET_30') },
    { value: 'NET_60', label: tPartner('paymentTerms.NET_60') },
    { value: 'COD', label: tPartner('paymentTerms.COD') },
    { value: 'PREPAID', label: tPartner('paymentTerms.PREPAID') },
    { value: 'GỐI ĐẦU', label: tPartner('paymentTerms.GỐI ĐẦU') },
  ], [tPartner]);

  useEffect(() => {
    if (dataUpdate && isUpdateModalOpen) {
      const normalizedCountry = normalizeCountryCode(dataUpdate.countryCode || dataUpdate.country);
      form.setFieldsValue({
        ...dataUpdate,
        countryCode: normalizedCountry ?? dataUpdate.countryCode,
        country: dataUpdate.country,
        region: dataUpdate.region || getCountryRegion(normalizedCountry),
        creditLimit: dataUpdate.creditLimit ? Number(dataUpdate.creditLimit) : 0,
      });
    }
  }, [dataUpdate, isUpdateModalOpen, form]);

  const handleClose = () => {
    form.resetFields();
    setDataUpdate(null);
    setIsUpdateModalOpen(false);
  };

  const onFinish = async (values: any) => {
    const accessToken = getAccessToken(session);
    if (!accessToken) return;

    const normalizedCountry = normalizeCountryCode(values.countryCode);
    const normalizedValues = {
      ...values,
      countryCode: normalizedCountry ?? values.countryCode,
      country: values.country,
      region: partnerType === 'CUSTOMER'
        ? values.region || getCountryRegion(normalizedCountry)
        : values.region,
    };

    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners/${dataUpdate?._id}`,
        method: 'PATCH',
        body: normalizedValues,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({ 
          title: tCommon('success'), 
          description: `${tCommon('success')}: ${normalizedValues.name}` 
        });
        handleClose();
        fetchPartners();
      } else {
        notification.error({ title: tPartner('notifications.errorTitle'), description: res.message });
      }
    } catch (error) {
      notification.error({ title: tPartner('notifications.connectionError') });
    } finally {
      setLoading(false);
    }
  };

  if (!isClient) return null;

  return (
    <Modal
      title={
        <Space>
          <EditOutlined style={{ color: token.colorPrimary }} />
          <span style={{ fontWeight: 700 }}>{tPartner('form.titleUpdate') || 'UPDATE PARTNER'}</span>
        </Space>
      }
      open={isUpdateModalOpen}
      onOk={() => form.submit()}
      onCancel={handleClose}
      confirmLoading={loading}
      width={900}
      mask={{ closable: false }}
      destroyOnHidden
      forceRender
      okText={tCommon('save')}
      cancelText={tCommon('cancel')}
      style={{ top: 20 }}
    >
      <Form 
        form={form} 
        onFinish={onFinish} 
        layout="vertical"
      >
        <Divider titlePlacement="left" plain>
          <Space><InfoCircleOutlined style={{ color: token.colorPrimary }} /> <Text strong>{tPartner('form.basicInfo')}</Text></Space>
        </Divider>
        
        <Row gutter={16}>
          <Col span={10}>
            <Form.Item
              label={tPartner('form.fields.name')}
              name="name"
              rules={[{ required: true, message: tCommon('error') }]}
            >
              <Input prefix={<UserOutlined />} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label={tPartner('form.fields.partnerType')} name="partnerType" rules={[{ required: true }]}>
              <Select options={partnerTypeOptions} />
            </Form.Item>
          </Col>
          {partnerType === 'CUSTOMER' && (
            <Col span={8}>
              <Form.Item label={tPartner('form.fields.region')} name="region">
                <Select options={regionOptions} allowClear placeholder={tPartner('form.fields.region')} />
              </Form.Item>
            </Col>
          )}
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label={tPartner('form.fields.taxCode')} name="taxCode">
              <Input placeholder={tPartner('form.fields.taxCode')} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={tPartner('table.countryCode') || 'Mã quốc gia'} name="countryCode">
              <Space.Compact style={{ width: '100%' }}>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={countryOptions}
                  placeholder={tPartner('form.placeholders.country') || 'Chọn mã quốc gia'}
                  onChange={(value?: string) => {
                    const countryName = value ? (getCountryDisplayName(value, locale) || value) : undefined;
                    form.setFieldsValue({
                      country: countryName,
                    });
                    if (partnerType === 'CUSTOMER') {
                      form.setFieldValue('region', getCountryRegion(value));
                    }
                  }}
                  style={{ width: 'calc(100% - 40px)' }}
                />
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => setIsQuickAddOpen(true)}
                  style={{ width: 40 }}
                />
              </Space.Compact>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={tPartner('table.country')} name="country">
              <Input disabled placeholder={tPartner('form.placeholders.country')} />
            </Form.Item>
          </Col>
          {partnerType === 'SUPPLIER' && (
            <Col span={8}>
              <Form.Item label={tPartner('risk.industry')} name="vendorCategory">
                <Input placeholder={tPartner('form.placeholders.industry')} />
              </Form.Item>
            </Col>
          )}
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label={tPartner('form.fields.contactName')} name="contactName">
              <Input placeholder={tPartner('form.fields.contactName')} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item 
              label={tPartner('form.fields.email')} 
              name="email"
              rules={[{ type: 'email', message: tCommon('error') }]}
            >
              <Input prefix={<MailOutlined />} placeholder="email@partner.com" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={tPartner('form.fields.phone')} name="phone">
              <Input prefix={<PhoneOutlined />} placeholder="+84 ..." />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label={tPartner('form.fields.address')} name="address">
          <Input.TextArea rows={1} placeholder={tPartner('form.fields.address')} />
        </Form.Item>

        {partnerType !== 'LOGISTICS' && (
          <>
            <Divider titlePlacement="left" plain>
              <Space><CreditCardOutlined style={{ color: token.colorPrimary }} /> <Text strong>{tPartner('form.financeInfo')}</Text></Space>
            </Divider>

            <Row gutter={16}>
              {partnerType === 'CUSTOMER' ? (
                <Col span={10}>
                  <Form.Item label={tPartner('form.fields.defaultPaymentTerm')} name="defaultPaymentTerm">
                    <Select options={customerPaymentOptions} allowClear placeholder={tPartner('form.fields.defaultPaymentTerm')} />
                  </Form.Item>
                </Col>
              ) : (
                <Col span={10}>
                  <Form.Item label={tPartner('form.fields.defaultPaymentTerm')} name="vendorPaymentTerm">
                    <Select options={vendorPaymentOptions} allowClear placeholder={tPartner('form.fields.defaultPaymentTerm')} />
                  </Form.Item>
                </Col>
              )}
              
              <Col span={6}>
                <Form.Item label={tPartner('form.fields.defaultCurrency')} name="defaultCurrency">
                  <Select options={currencyOptions} />
                </Form.Item>
              </Col>

              {partnerType === 'CUSTOMER' && (
                <Col span={8}>
                  <Form.Item label={`${tPartner('form.fields.creditLimit')} (Credit Limit)`}>
                    <Space.Compact style={{ width: '100%' }}>
                      <Form.Item name="creditLimit" noStyle>
                        <InputNumber
                          style={{ width: '100%' }}
                          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, '')) as any}
                          min={0}
                        />
                      </Form.Item>
                      <div style={{ 
                        padding: '0 12px', 
                        background: token.colorFillAlter, 
                        border: `1px solid ${token.colorBorder}`,
                        borderLeft: 0,
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '0 6px 6px 0'
                      }}>
                        {defaultCurrency || 'USD'}
                      </div>
                    </Space.Compact>
                  </Form.Item>
                </Col>
              )}
            </Row>

            <Row gutter={16} align="middle">
              {partnerType === 'SUPPLIER' && (
                <Col span={18}>
                  <Row gutter={8}>
                    <Col span={8}>
                      <Form.Item label={tPartner('risk.quality')} name="qualityScore">
                        <InputNumber min={0} max={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label={tPartner('risk.delivery')} name="deliveryScore">
                        <InputNumber min={0} max={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label={tPartner('risk.price')} name="priceScore">
                        <InputNumber min={0} max={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Col>
              )}
              
              <Col span={partnerType === 'SUPPLIER' ? 6 : 24} style={{ textAlign: 'right' }}>
                <Space size="middle">
                   <Text type="secondary">{tPartner('table.status')}:</Text>
                   <Form.Item name="isActive" valuePropName="checked" noStyle>
                    <Switch checkedChildren={tPartner('status.active')} unCheckedChildren={tPartner('status.inactive')} />
                  </Form.Item>
                </Space>
              </Col>
            </Row>
          </>
        )}


        <Divider titlePlacement="left" plain>
          <Space><BankOutlined style={{ color: token.colorPrimary }} /> <Text strong>{tPartner('form.bankingInfo')}</Text></Space>
        </Divider>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label={tPartner('form.fields.bankName')} name="bankName">
              <Input placeholder={tPartner('form.placeholders.bankName')} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={tPartner('form.fields.bankAccountName')} name="bankAccountName">
              <Input placeholder={tPartner('form.placeholders.bankAccountName')} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={tPartner('form.fields.bankAccountNumber')} name="bankAccountNumber">
              <Input placeholder={tPartner('form.placeholders.bankAccountNumber')} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label={tPartner('form.fields.bankSwiftCode')} name="bankSwiftCode">
              <Input placeholder={tPartner('form.placeholders.swift')} />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item label={tPartner('form.fields.bankAddress')} name="bankAddress">
              <Input placeholder={tPartner('form.placeholders.bankAddress')} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label={tPartner('form.fields.note')} name="note">
          <Input.TextArea rows={2} placeholder={tPartner('form.placeholders.note')} />
        </Form.Item>
      </Form>
      <QuickAddCountryModal
        open={isQuickAddOpen}
        onCancel={() => setIsQuickAddOpen(false)}
        onSuccess={(code) => {
          form.setFieldsValue({
            countryCode: code,
            country: getCountryDisplayName(code, locale) || code,
          });
          if (partnerType === 'CUSTOMER') {
            form.setFieldValue('region', getCountryRegion(code));
          }
        }}
      />
    </Modal>
  );
};

export default PartnerUpdateModal;
