"use client";

import React, { useState } from "react";
import { Modal, Form, Input, InputNumber, Button, Typography, App } from "antd";
import { SendOutlined, UserOutlined, MailOutlined, PhoneOutlined, NumberOutlined } from "@ant-design/icons";
import { sendRequest } from "@/lib/api-client";
import type { PublicProduct } from "@/services/guest.service";

const { Title, Text } = Typography;

interface RequestQuoteModalProps {
  product: PublicProduct | null;
  open: boolean;
  onCancel: () => void;
}

interface QuoteFormValues {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  quantity: number;
  note?: string;
}

interface CreateInquiryResponse {
  _id: string;
}

export function RequestQuoteModal({ product, open, onCancel }: RequestQuoteModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<QuoteFormValues>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: QuoteFormValues): Promise<void> => {
    if (!product?._id) {
      message.error("Không tìm thấy sản phẩm để gửi yêu cầu báo giá.");
      return;
    }

    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<CreateInquiryResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inquiries`,
        method: "POST",
        body: {
          ...values,
          productId: product._id,
        },
      });

      if (res?.data) {
        message.success("Yêu cầu báo giá đã được gửi thành công! Chúng tôi sẽ liên hệ sớm.");
        form.resetFields();
        onCancel();
      } else {
        message.error(res?.message || "Gửi yêu cầu thất bại.");
      }
    } catch (error) {
      console.error("Failed to send inquiry", error);
      message.error("Có lỗi xảy ra, vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      title={null}
      width={500}
      centered
      style={{ borderRadius: '24px' }}
    >
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Title level={3}>Yêu cầu báo giá</Title>
        <Text type="secondary">Sản phẩm: </Text>
        <Text strong style={{ color: '#1890ff' }}>{product?.vietnameseName}</Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ quantity: 1 }}
      >
        <Form.Item
          name="customerName"
          label="Họ và tên"
          rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
        >
          <Input prefix={<UserOutlined />} placeholder="Nguyễn Văn A" size="large" />
        </Form.Item>

        <Form.Item
          name="customerEmail"
          label="Email"
          rules={[
            { required: true, message: "Vui lòng nhập email" },
            { type: "email", message: "Email không hợp lệ" }
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="example@gmail.com" size="large" />
        </Form.Item>

        <Form.Item
          name="customerPhone"
          label="Số điện thoại"
          rules={[{ required: true, message: "Vui lòng nhập số điện thoại" }]}
        >
          <Input prefix={<PhoneOutlined />} placeholder="0901234567" size="large" />
        </Form.Item>

        <Form.Item
          name="quantity"
          label="Số lượng cần mua"
          rules={[{ required: true, message: "Vui lòng nhập số lượng" }]}
        >
          <InputNumber 
            prefix={<NumberOutlined />} 
            style={{ width: '100%' }} 
            min={1} 
            size="large" 
            placeholder="Ví dụ: 1000"
          />
        </Form.Item>

        <Form.Item name="note" label="Ghi chú thêm">
          <Input.TextArea placeholder="Yêu cầu cụ thể về đóng gói, thời gian giao hàng..." rows={4} />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<SendOutlined />}
            size="large"
            block
            style={{ height: '52px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}
          >
            GỬI YÊU CẦU NGAY
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
