'use client';

import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Form, 
  Input, 
  InputNumber, 
  DatePicker, 
  Select, 
  Row, 
  Col, 
  message, 
  Divider,
  Typography
} from 'antd';
import { lcService } from '@/services/lc.service';
import { sendRequest } from '@/utils/api';
import { useSession } from 'next-auth/react';
import dayjs from 'dayjs';

const { Text } = Typography;

interface LCModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  initialValues?: any;
}

const LCModal: React.FC<LCModalProps> = ({ open, onCancel, onSuccess, initialValues }) => {
  const [form] = Form.useForm();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const accessToken = session?.access_token;

  useEffect(() => {
    if (open) {
      fetchContracts();
      if (initialValues) {
        form.setFieldsValue({
          ...initialValues,
          issueDate: initialValues.issueDate ? dayjs(initialValues.issueDate) : undefined,
          expiryDate: initialValues.expiryDate ? dayjs(initialValues.expiryDate) : undefined,
          latestShipmentDate: initialValues.latestShipmentDate ? dayjs(initialValues.latestShipmentDate) : undefined,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, initialValues]);

  const fetchContracts = async () => {
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      setContracts(res.data.results);
    }
  };

  const handleFinish = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        issueDate: values.issueDate?.toISOString(),
        expiryDate: values.expiryDate?.toISOString(),
        latestShipmentDate: values.latestShipmentDate?.toISOString(),
      };

      if (initialValues?.id) {
        await lcService.update(initialValues.id, payload);
        message.success('Cập nhật L/C thành công');
      } else {
        await lcService.create(payload);
        message.success('Tạo L/C mới thành công');
      }
      onSuccess();
    } catch (error: any) {
      message.error(error.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={initialValues ? "Chỉnh sửa Thư tín dụng" : "Mở Thư tín dụng mới (L/C)"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={800}
      style={{ top: 20 }}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ currency: 'USD', lcType: 'AT_SIGHT' }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Số L/C" name="lcNumber" rules={[{ required: true, message: 'Vui lòng nhập số L/C' }]}>
              <Input placeholder="Nhập mã hiệu L/C" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Hợp đồng liên quan (Sales Contract)" name="salesContractId" rules={[{ required: true }]}>
              <Select placeholder="Chọn hợp đồng">
                {contracts.map(c => (
                  <Select.Option key={c.id} value={c.id}>{c.contractNumber} - {c.buyer?.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Loại L/C" name="lcType" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="AT_SIGHT">Trả ngay (At Sight)</Select.Option>
                <Select.Option value="DEFERRED">Trả chậm (Deferred)</Select.Option>
                <Select.Option value="USANCE">Kỳ hạn (Usance)</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Số tiền" name="amount" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Tiền tệ" name="currency" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="USD">USD</Select.Option>
                <Select.Option value="EUR">EUR</Select.Option>
                <Select.Option value="VND">VND</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Divider>Thông tin Ngân hàng</Divider>
        
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Ngân hàng phát hành (Issuing Bank)" name="issuingBank" rules={[{ required: true }]}>
              <Input placeholder="Tên ngân hàng phía người mua" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Ngân hàng thông báo (Advising Bank)" name="advisingBank">
              <Input placeholder="Tên ngân hàng phía người bán" />
            </Form.Item>
          </Col>
        </Row>

        <Divider>Thời hạn & Chứng từ</Divider>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Ngày mở L/C" name="issueDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Ngày hết hạn" name="expiryDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Hạn giao hàng cuối" name="latestShipmentDate">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Mô tả hàng hóa (Description of Goods)" name="descriptionOfGoods">
          <Input.TextArea rows={3} placeholder="Mô tả chi tiết theo L/C..." />
        </Form.Item>

        <Form.Item label="Chứng từ yêu cầu (Documents Required)" name="documentsRequired">
          <Input.TextArea rows={3} placeholder="Vận đơn, Hóa đơn, C/O..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default LCModal;
