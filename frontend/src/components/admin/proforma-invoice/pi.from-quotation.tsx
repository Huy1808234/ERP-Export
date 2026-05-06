'use client'

import {
  Button,
  Form,
  InputNumber,
  Modal,
  Select,
  Input,
  Typography,
  Divider,
  Tag,
  App,
  Row,
  Col,
  Space,
  Card,
  theme,
} from 'antd';
import { 
  ThunderboltOutlined, 
  InfoCircleOutlined, 
  BankOutlined, 
  ClockCircleOutlined, 
  CreditCardOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { getSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { useTranslations } from 'next-intl';

const { Text, Title } = Typography;

interface IProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  quotation: any;
  fetchPIs: () => void;
}

/**
 * Senior Thought:
 * 1. Separation of concerns: Logic calculations are separated from JSX.
 * 2. Pre-validation: Using useMemo to provide real-time financial feedback.
 * 3. UX: Grouping related fields and providing clear hierarchy.
 */
const PIFromQuotationModal = ({ open, setOpen, quotation, fetchPIs }: IProps) => {
  const { notification } = App.useApp();
  const tInc = useTranslations('Incoterms');
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchBankInfo = async () => {
      const currentSession = await getSession();
      const accessToken = currentSession?.user?.access_token;
      if (accessToken && open && quotation && !form.getFieldValue('bankInfo')) {
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

    if (open && quotation) {
      form.setFieldsValue({
        depositPercent: 30,
        paymentTerms: quotation.paymentTerms ?? '30% T/T deposit, 70% balance before shipment',
        deliveryTime: quotation.deliveryTime ?? '30-45 working days after receiving deposit',
        logisticsFee: quotation.logisticsFee || 0,
        otherFee: quotation.otherFee || 0,
        bankInfo: quotation.bankInfo,
      });
      fetchBankInfo();
    }
  }, [open, quotation, form]);

  const handleClose = () => {
    form.resetFields();
    setOpen(false);
  };

  // Watch form values for real-time calculations
  const depositPercent = Form.useWatch('depositPercent', form) ?? 30;
  const watchedLogisticsFee = Form.useWatch('logisticsFee', form) ?? 0;
  const watchedOtherFee = Form.useWatch('otherFee', form) ?? 0;

  // Real-time financial calculations
  const financialSummary = useMemo(() => {
    if (!quotation) return { subTotal: 0, currentTotal: 0, depositAmount: 0 };
    
    const subTotal = parseFloat(quotation.totalAmount ?? 0) - (quotation.logisticsFee || 0) - (quotation.otherFee || 0);
    const currentTotal = subTotal + watchedLogisticsFee + watchedOtherFee;
    const depositAmount = (currentTotal * depositPercent) / 100;
    
    return { subTotal, currentTotal, depositAmount };
  }, [quotation, depositPercent, watchedLogisticsFee, watchedOtherFee]);

  const onFinish = async (values: any) => {
    setSubmitting(true);
    try {
      const currentSession = await getSession();
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/proforma-invoices/from-quotation`,
        method: 'POST',
        body: {
          quotationId: quotation.id,
          ...values,
          depositAmount: financialSummary.depositAmount
        },
        headers: { Authorization: `Bearer ${(currentSession as any)?.user?.access_token}` },
      });

      if (res?.data) {
        notification.success({ 
          title: 'Chuyển đổi PI thành công',
          description: `Hóa đơn ${res.data.piNumber} đã được khởi tạo từ báo giá ${quotation.quotationNumber}.`,
          placement: 'topRight'
        });
        handleClose();
        fetchPIs();
      } else {
        notification.error({ 
          title: 'Lỗi chuyển đổi', 
          description: res?.message || 'Không thể tạo PI từ báo giá này.' 
        });
      }
    } catch (error) {
      notification.error({ title: 'Lỗi hệ thống', description: 'Vui lòng kiểm tra lại kết nối.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!quotation) return null;

  return (
    <Modal
      title={
        <Space size="middle">
          <div style={{ 
            width: 32, height: 32, borderRadius: 8, 
            background: 'linear-gradient(135deg, #722ed1 0%, #391085 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ThunderboltOutlined style={{ color: '#fff' }} />
          </div>
          <Title level={4} style={{ margin: 0 }}>Chuyển đổi Báo giá sang PI</Title>
        </Space>
      }
      open={open}
      onOk={() => form.submit()}
      onCancel={handleClose}
      centered
      mask={{ closable: false }}
      destroyOnHidden
      width={720}
      confirmLoading={submitting}
      okText="Xác nhận & Tạo PI"
      cancelText="Hủy bỏ"
      okButtonProps={{ 
        size: 'large', 
        style: { borderRadius: 8, fontWeight: 600, height: 45, padding: '0 32px' } 
      }}
      cancelButtonProps={{ 
        size: 'large', 
        style: { borderRadius: 8, height: 45 } 
      }}
    >
      <div style={{ marginTop: 16 }}>
        {/* Quotation Reference Header */}
        <Card 
          size="small" 
          style={{ 
            background: 'rgba(114, 46, 209, 0.04)', 
            border: '1px dashed #d3adf7',
            borderRadius: 12,
            marginBottom: 24
          }}
        >
          <Row justify="space-between" align="middle">
            <Col>
              <Space orientation="vertical" size={0}>
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Báo giá gốc</Text>
                <Text strong style={{ fontSize: 16 }}>{quotation.quotationNumber}</Text>
              </Space>
            </Col>
            <Col>
              <Space orientation="vertical" size={0} align="end">
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Khách hàng</Text>
                <Text strong>{quotation.customer?.name}</Text>
              </Space>
            </Col>
            <Col>
              <Tag color="purple" style={{ borderRadius: 6, fontWeight: 700, padding: '2px 10px' }}>{quotation.incoterm ? tInc(quotation.incoterm) : '-'}</Tag>
            </Col>
          </Row>
        </Card>

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark="optional">
          <Row gutter={24}>
            {/* Financial Adjustments */}
            <Col span={24}>
              <Divider titlePlacement="left" style={{ margin: '0 0 20px 0' }}>
                <Space><DollarOutlined style={{ color: token.colorPrimary }} /> <Text strong>Điều chỉnh tài chính</Text></Space>
              </Divider>
            </Col>
            
            <Col span={12}>
              <Form.Item
                label="Tỷ lệ tiền cọc (%)"
                name="depositPercent"
                rules={[{ required: true, message: 'Vui lòng nhập % cọc' }]}
              >
                <InputNumber
                  min={0}
                  max={100}
                  suffix="%"
                  style={{ width: '100%', height: 40, borderRadius: 8 }}
                  placeholder="30"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <div style={{ 
                padding: '12px 16px', 
                background: '#fffbe6', 
                border: '1px solid #ffe58f', 
                borderRadius: 8,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 29
              }}>
                <Text type="secondary">Số tiền cọc:</Text>
                <Text strong style={{ color: '#fa8c16' }}>
                  {quotation.currency} {financialSummary.depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </div>
            </Col>

            <Col span={12}>
              <Form.Item label="Phí Logistics (Cập nhật)" name="logisticsFee">
                <InputNumber 
                  min={0} 
                  style={{ width: '100%', height: 40, borderRadius: 8 }} 
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => Number(v?.replace(/\$\s?|(,*)/g, '')) as any}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Phí khác (Cập nhật)" name="otherFee">
                <InputNumber 
                  min={0} 
                  style={{ width: '100%', height: 40, borderRadius: 8 }} 
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => Number(v?.replace(/\$\s?|(,*)/g, '')) as any}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <div style={{ 
                textAlign: 'right', 
                padding: '16px 24px', 
                background: '#fff1f0', 
                border: '1px solid #ffa39e', 
                borderRadius: 12,
                marginBottom: 24
              }}>
                <Text style={{ fontSize: 14 }}>TỔNG GIÁ TRỊ PI DỰ KIẾN:</Text>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#f5222d' }}>
                  {quotation.currency} {financialSummary.currentTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </Col>

            {/* Terms & Info */}
            <Col span={24}>
              <Divider titlePlacement="left" style={{ margin: '0 0 20px 0' }}>
                <Space><CreditCardOutlined style={{ color: token.colorPrimary }} /> <Text strong>Điều khoản & Thông tin</Text></Space>
              </Divider>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Điều khoản thanh toán"
                name="paymentTerms"
                rules={[{ required: true, message: 'Vui lòng nhập điều khoản' }]}
              >
                <Input 
                  prefix={<CreditCardOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder="VD: 30% T/T deposit..." 
                  style={{ height: 40, borderRadius: 8 }}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Thời gian giao hàng" name="deliveryTime">
                <Input 
                  prefix={<ClockCircleOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder="VD: 30-45 working days..." 
                  style={{ height: 40, borderRadius: 8 }}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item 
                label={
                  <Space><BankOutlined /> <Text>Thông tin tài khoản thụ hưởng (Swift/Bank)</Text></Space>
                } 
                name="bankInfo"
              >
                <Input.TextArea
                  rows={4}
                  style={{ borderRadius: 8 }}
                  placeholder="Nhập thông tin tài khoản ngân hàng..."
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item 
                label={
                  <Space><InfoCircleOutlined /> <Text>Ghi chú bổ sung</Text></Space>
                } 
                name="notes"
              >
                <Input.TextArea rows={2} style={{ borderRadius: 8 }} placeholder="Các lưu ý đặc biệt dành cho lô hàng này..." />
              </Form.Item>
            </Col>
            </Row>
          </Form>
        </div>
      </Modal>
  );
};

export default PIFromQuotationModal;
