'use client';

import { 
  Divider, Form, Input, InputNumber, Modal, Select, 
  Switch, App, Row, Col, Space, Typography, theme 
} from 'antd';
import { 
  UserOutlined, GlobalOutlined, BankOutlined, 
  CreditCardOutlined, MailOutlined, PhoneOutlined,
  InfoCircleOutlined, EditOutlined 
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';

const { Text } = Typography;

const PARTNER_TYPES = [
  { value: 'CUSTOMER', label: 'Khách hàng (Buyer)' },
  { value: 'SUPPLIER', label: 'Nhà cung cấp (Vendor)' },
  { value: 'LOGISTICS', label: 'Đơn vị vận chuyển' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'VND'].map(c => ({ value: c, label: c }));

const REGIONS = [
  { value: 'EU', label: 'Châu Âu (EU)' },
  { value: 'US', label: 'Hoa Kỳ (US)' },
  { value: 'ASEAN', label: 'Đông Nam Á (ASEAN)' },
  { value: 'APAC', label: 'Châu Á - Thái Bình Dương' },
  { value: 'OTHER', label: 'Khu vực khác' },
];

const PAYMENT_TERMS = [
  { value: 'T/T', label: 'Chuyển tiền điện tử (Telegraphic Transfer - T/T)' },
  { value: 'L/C', label: 'Tín dụng thư (Letter of Credit - L/C)' },
  { value: 'D/P', label: 'Nhờ thu kèm chứng từ (Documents against Payment - D/P)' },
  { value: 'D/A', label: 'Chấp nhận thanh toán chứng từ (Documents against Acceptance - D/A)' },
];

const VENDOR_PAYMENT_TERMS = [
  { value: 'NET_30', label: 'Net 30 (Thanh toán sau 30 ngày)' },
  { value: 'NET_60', label: 'Net 60 (Thanh toán sau 60 ngày)' },
  { value: 'COD', label: 'COD (Thanh toán khi nhận hàng)' },
  { value: 'PREPAID', label: 'Prepaid (Thanh toán trước 100%)' },
  { value: 'GỐI ĐẦU', label: 'Gối đầu (Thanh toán theo lô kế tiếp)' },
];

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

  const partnerType = Form.useWatch('partnerType', form);
  const defaultCurrency = Form.useWatch('defaultCurrency', form);

  useEffect(() => {
    if (dataUpdate && isUpdateModalOpen) {
      form.setFieldsValue({
        ...dataUpdate,
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
    const accessToken = session?.user?.access_token;
    if (!accessToken) return;

    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners/${dataUpdate?.id}`,
        method: 'PATCH',
        body: { ...values },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({ 
          title: 'Cập nhật thành công', 
          description: `Thông tin đối tác ${values.name} đã được thay đổi.` 
        });
        handleClose();
        fetchPartners();
      } else {
        notification.error({ title: 'Cập nhật thất bại', description: res.message });
      }
    } catch (error) {
      notification.error({ title: 'Lỗi hệ thống' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <EditOutlined style={{ color: token.colorPrimary }} />
          <span style={{ fontWeight: 700 }}>CẬP NHẬT THÔNG TIN ĐỐI TÁC</span>
        </Space>
      }
      open={isUpdateModalOpen}
      onOk={() => form.submit()}
      onCancel={handleClose}
      confirmLoading={loading}
      width={900}
      mask={{ closable: false }}
      destroyOnHidden
      okText="Lưu thay đổi"
      cancelText="Hủy"
      style={{ top: 20 }}
    >
      <Form 
        form={form} 
        onFinish={onFinish} 
        layout="vertical"
      >
        <Divider titlePlacement="left" plain>
          <Space><InfoCircleOutlined style={{ color: token.colorPrimary }} /> <Text strong>Thông tin định danh & Phân loại</Text></Space>
        </Divider>
        
        <Row gutter={16}>
          <Col span={10}>
            <Form.Item
              label="Tên đối tác thương mại"
              name="name"
              rules={[{ required: true, message: 'Tên đối tác không được bỏ trống!' }]}
            >
              <Input prefix={<UserOutlined />} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="Loại đối tác" name="partnerType" rules={[{ required: true }]}>
              <Select options={PARTNER_TYPES} />
            </Form.Item>
          </Col>
          {partnerType === 'CUSTOMER' && (
            <Col span={8}>
              <Form.Item label="Khu vực thương mại" name="region">
                <Select options={REGIONS} allowClear placeholder="Chọn khu vực (EU, US...)" />
              </Form.Item>
            </Col>
          )}
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Mã số thuế (Tax Code)" name="taxCode">
              <Input placeholder="MST doanh nghiệp" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Quốc gia" name="country">
              <Input prefix={<GlobalOutlined />} placeholder="Ví dụ: USA, Vietnam..." />
            </Form.Item>
          </Col>
          {partnerType === 'SUPPLIER' && (
            <Col span={8}>
              <Form.Item label="Ngành hàng" name="vendorCategory">
                <Input placeholder="VD: Nông sản, Dệt may..." />
              </Form.Item>
            </Col>
          )}
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Người liên hệ chính" name="contactName">
              <Input placeholder="Họ và tên" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item 
              label="Email liên hệ" 
              name="email"
              rules={[{ type: 'email', message: 'Email không đúng định dạng!' }]}
            >
              <Input prefix={<MailOutlined />} placeholder="email@partner.com" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Số điện thoại" name="phone">
              <Input prefix={<PhoneOutlined />} placeholder="+84 ..." />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Địa chỉ trụ sở" name="address">
          <Input.TextArea rows={1} placeholder="Số nhà, đường, quận/huyện, tỉnh/thành..." />
        </Form.Item>

        {partnerType !== 'LOGISTICS' && (
          <>
            <Divider titlePlacement="left" plain>
              <Space><CreditCardOutlined style={{ color: token.colorPrimary }} /> <Text strong>Điều khoản & Hạn mức thương mại</Text></Space>
            </Divider>

            <Row gutter={16}>
              {partnerType === 'CUSTOMER' ? (
                <Col span={10}>
                  <Form.Item label="Điều khoản thanh toán (Buyer)" name="defaultPaymentTerm">
                    <Select 
                      options={PAYMENT_TERMS} 
                      allowClear 
                      placeholder="Chọn ĐKTT" 
                    />
                  </Form.Item>
                </Col>
              ) : (
                <Col span={10}>
                  <Form.Item label="Điều khoản thanh toán (Vendor)" name="vendorPaymentTerm">
                    <Select options={VENDOR_PAYMENT_TERMS} allowClear placeholder="Chọn ĐKTT (Net 30, Net 60...)" />
                  </Form.Item>
                </Col>
              )}
              
              <Col span={6}>
                <Form.Item label="Tiền tệ giao dịch" name="defaultCurrency">
                  <Select options={CURRENCIES} />
                </Form.Item>
              </Col>

              {partnerType === 'CUSTOMER' && (
                <Col span={8}>
                  <Form.Item label="Hạn mức tín dụng">
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
                      <Form.Item label="Chất lượng" name="qualityScore">
                        <InputNumber min={0} max={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Giao hàng" name="deliveryScore">
                        <InputNumber min={0} max={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Giá cả" name="priceScore">
                        <InputNumber min={0} max={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Col>
              )}
              
              <Col span={partnerType === 'SUPPLIER' ? 6 : 24} style={{ textAlign: 'right' }}>
                <Space size="middle">
                   <Text type="secondary">Trạng thái:</Text>
                   <Form.Item name="isActive" valuePropName="checked" noStyle>
                    <Switch checkedChildren="ON" unCheckedChildren="OFF" />
                  </Form.Item>
                </Space>
              </Col>
            </Row>
          </>
        )}


        <Divider titlePlacement="left" plain>
          <Space><BankOutlined style={{ color: token.colorPrimary }} /> <Text strong>Thông tin tài khoản ngân hàng</Text></Space>
        </Divider>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Tên ngân hàng" name="bankName">
              <Input placeholder="Tên ngân hàng" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Chủ tài khoản" name="bankAccountName">
              <Input placeholder="Tên in trên thẻ" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Số tài khoản" name="bankAccountNumber">
              <Input placeholder="Nhập số tài khoản" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="SWIFT/BIC Code" name="bankSwiftCode">
              <Input />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item label="Địa chỉ ngân hàng" name="bankAddress">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Ghi chú & Đặc thù" name="note">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PartnerUpdateModal;
