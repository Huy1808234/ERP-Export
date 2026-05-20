'use client';

import { 
  Divider, Form, Input, InputNumber, Modal, Select, 
  Switch, App, Row, Col, Space, Typography, theme 
} from 'antd';
import { 
  UserOutlined, GlobalOutlined, BankOutlined, 
  CreditCardOutlined, MailOutlined, PhoneOutlined,
  InfoCircleOutlined, PlusOutlined, SafetyCertificateOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

// Options moved inside component with useMemo

interface IProps {
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (v: boolean) => void;
  fetchPartners: () => void;
}

const PartnerCreateModal = ({ isCreateModalOpen, setIsCreateModalOpen, fetchPartners }: IProps) => {
  const { notification } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();
  const { token } = theme.useToken();

  const tPartner = useTranslations('Partner');
  const tCommon = useTranslations('Common');
  const partnerType = Form.useWatch('partnerType', form);
  const defaultCurrency = Form.useWatch('defaultCurrency', form);

  const partnerTypeOptions = useMemo(() => [
    { value: 'CUSTOMER', label: tPartner('types.CUSTOMER') },
    { value: 'SUPPLIER', label: tPartner('types.SUPPLIER') },
    { value: 'LOGISTICS', label: tPartner('types.LOGISTICS') },
  ], [tPartner]);

  const regionOptions = useMemo(() => [
    { value: 'EU', label: tPartner('regions.EU') },
    { value: 'US', label: tPartner('regions.US') },
    { value: 'ASEAN', label: tPartner('regions.ASEAN') },
    { value: 'APAC', label: tPartner('regions.APAC') },
    { value: 'MIDDLE_EAST', label: tPartner('regions.MIDDLE_EAST') },
    { value: 'OTHER', label: tPartner('regions.OTHER') },
  ], [tPartner]);

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

  const riskLevelOptions = useMemo(() => [
    { value: 'LOW', label: tPartner('riskLevels.LOW') },
    { value: 'MEDIUM', label: tPartner('riskLevels.MEDIUM') },
    { value: 'HIGH', label: tPartner('riskLevels.HIGH') },
  ], [tPartner]);

  const currencyOptions = useMemo(() => 
    ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'VND'].map(c => ({ value: c, label: c })), 
  []);

  const handleClose = () => {
    form.resetFields();
    setIsCreateModalOpen(false);
  };

  const onFinish = async (values: any) => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      notification.error({ 
        title: tPartner('notifications.errorTitle') || 'Lỗi xác thực', 
        description: tCommon('error') 
      });
      return;
    }

    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
        method: 'POST',
        body: { ...values },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({ 
          title: tCommon('success'),
          description: `${tCommon('success')}: ${values.name}` 
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

  return (
    <Modal
      title={
        <Space>
          <PlusOutlined style={{ color: token.colorPrimary }} />
          <span style={{ fontWeight: 700 }}>{tPartner('form.title')}</span>
        </Space>
      }
      open={isCreateModalOpen}
      onOk={() => form.submit()}
      onCancel={handleClose}
      confirmLoading={loading}
      width={950}
      mask={{ closable: false }}
      destroyOnHidden
      okText={tCommon('save')}
      cancelText={tCommon('cancel')}
      style={{ top: 20 }}
    >
      <Form 
        form={form} 
        onFinish={onFinish} 
        layout="vertical" 
        initialValues={{ 
          isActive: true, 
          defaultCurrency: 'USD', 
          partnerType: 'CUSTOMER',
          riskLevel: 'LOW' 
        }}
      >
        {/* --- SECTION 1: IDENTITY & CLASSIFICATION --- */}
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
              <Input prefix={<UserOutlined />} placeholder={tPartner('form.fields.name')} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label={tPartner('form.fields.partnerType')} name="partnerType" rules={[{ required: true, message: tCommon('error') }]}>
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
            <Form.Item label={tPartner('table.country')} name="country">
              <Input prefix={<GlobalOutlined />} placeholder={tPartner('form.placeholders.country')} />
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

        {/* --- SECTION 2: TRADE TERMS & CREDIT --- */}
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
                          placeholder={tPartner('form.fields.creditLimit')}
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
              {partnerType === 'CUSTOMER' && (
                <Col span={8}>
                  <Form.Item label={tPartner('form.fields.riskLevel')} name="riskLevel">
                    <Select options={riskLevelOptions} />
                  </Form.Item>
                </Col>
              )}

              {partnerType === 'SUPPLIER' && (
                <Col span={12}>
                  <Row gutter={8}>
                    <Col span={8}>
                      <Form.Item label={tPartner('risk.quality')} name="qualityScore">
                        <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0-100" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label={tPartner('risk.delivery')} name="deliveryScore">
                        <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0-100" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label={tPartner('risk.price')} name="priceScore">
                        <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0-100" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Col>
              )}

              <Col span={partnerType === 'SUPPLIER' ? 12 : 16} style={{ textAlign: 'right' }}>
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

        {/* --- SECTION 3: BANKING DETAILS (Show for all) --- */}
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

        <Form.Item label={<Space><SafetyCertificateOutlined /> {tPartner('form.fields.note')}</Space>} name="note">
          <Input.TextArea rows={3} placeholder={tPartner('form.placeholders.note')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PartnerCreateModal;
