'use client';

import React, { useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, notification, Alert } from 'antd';
import { sendRequest } from '@/utils/api';
import { useSession } from 'next-auth/react';
import { IProduct } from '@/types/product';

interface IProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  product: IProduct | null;
  fetchData: () => void;
}

const AdjustmentModal = (props: IProps) => {
  const { isOpen, setIsOpen, product, fetchData } = props;
  const { data: session } = useSession();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    if (!product || !session) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/adjustment`,
        method: 'POST',
        body: {
          productId: product.id,
          adjustmentQuantity: values.quantity,
          reason: values.reason_custom || values.reason,
          lotNumber: values.lotNumber,
          unitPrice: values.unitPrice || 0
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res?.data) {
        notification.success({ title: 'Điều chỉnh tồn kho thành công' });
        setIsOpen(false);
        form.resetFields();
        fetchData();
      }
    } catch (error: any) {
      notification.error({ title: 'Lỗi', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Điều chỉnh tồn kho: ${product?.sku}`}
      open={isOpen}
      onCancel={() => setIsOpen(false)}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="Xác nhận"
      cancelText="Hủy"
    >
      <Alert 
        message={`Tồn kho hiện tại: ${product?.currentStock || 0}`} 
        type="info" 
        showIcon 
        style={{ marginBottom: 16 }} 
      />
      
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item 
          label="Số lượng điều chỉnh" 
          name="quantity" 
          rules={[{ required: true, message: 'Vui lòng nhập số lượng' }]}
          help="Số dương để tăng, số âm để giảm tồn kho"
        >
          <InputNumber style={{ width: '100%' }} placeholder="Ví dụ: -5 hoặc 10" />
        </Form.Item>

        <Form.Item 
          label="Lý do điều chỉnh" 
          name="reason" 
          rules={[{ required: true, message: 'Vui lòng nhập lý do' }]}
        >
          <Select placeholder="Chọn lý do">
            <Select.Option value="Kiểm kê định kỳ">Kiểm kê định kỳ</Select.Option>
            <Select.Option value="Hàng hỏng/Hết hạn">Hàng hỏng/Hết hạn</Select.Option>
            <Select.Option value="Sai sót nhập liệu">Sai sót nhập liệu</Select.Option>
            <Select.Option value="Khác">Khác</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="Ghi chú thêm (Lý do khác)" name="reason_custom">
          <Input.TextArea placeholder="Nhập chi tiết lý do..." />
        </Form.Item>

        <Form.Item label="Số Lô (Tùy chọn)" name="lotNumber">
          <Input placeholder="Nhập số lô nếu cần chỉ định" />
        </Form.Item>

        <Form.Item 
          label="Đơn giá (Nếu nhập kho mới)" 
          name="unitPrice"
          help="Để trống nếu chỉ điều chỉnh số lượng hoặc xuất kho"
        >
          <InputNumber 
            style={{ width: '100%' }} 
            placeholder="Đơn giá nhập kho"
            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AdjustmentModal;
