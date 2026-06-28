import { useState } from 'react';
import { Modal, Form, Input, Select, Space, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import type { CreateTicketDto, Ticket } from '@/services/ticket.service';

interface CreateTicketModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (data: CreateTicketDto) => Promise<Ticket>;
  locale: string;
}

const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } => {
  return typeof error === 'object'
    && error !== null
    && 'errorFields' in error
    && Array.isArray((error as { errorFields?: unknown }).errorFields);
};

export const CreateTicketModal = ({
  open,
  onCancel,
  onSubmit,
  locale
}: CreateTicketModalProps) => {
  const [form] = Form.useForm<CreateTicketDto>();
  const [loading, setLoading] = useState(false);
  const isVi = locale === 'vi';

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await onSubmit(values as CreateTicketDto);
      message.success(isVi ? 'Đã gửi yêu cầu hỗ trợ thành công!' : 'Support ticket submitted successfully!');
      form.resetFields();
      onCancel();
    } catch (error) {
      if (isFormValidationError(error)) {
        return;
      }
      message.error(isVi ? 'Không thể gửi yêu cầu hỗ trợ. Vui lòng thử lại.' : 'Failed to submit ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={<Space><SendOutlined style={{ color: '#1890ff' }} /> {isVi ? 'Gửi Yêu Cầu Hỗ Trợ (Ticket)' : 'Submit Support Ticket'}</Space>}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      okText={isVi ? 'Gửi Yêu Cầu' : 'Submit Ticket'}
      cancelText={isVi ? 'Hủy' : 'Cancel'}
      width={600}
    >
      <div style={{ marginTop: 24 }}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label={isVi ? 'Tiêu đề' : 'Subject'}
            rules={[{ required: true, message: isVi ? 'Vui lòng nhập tiêu đề' : 'Please enter a subject' }]}
          >
            <Input placeholder={isVi ? 'Ví dụ: Cần đổi địa chỉ giao hàng cho PO-2023' : 'e.g., Need to change delivery address for PO-2023'} />
          </Form.Item>

          <Form.Item
            name="priority"
            label={isVi ? 'Mức độ ưu tiên' : 'Priority'}
            initialValue="MEDIUM"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="LOW">{isVi ? 'Thấp' : 'Low'}</Select.Option>
              <Select.Option value="MEDIUM">{isVi ? 'Trung bình' : 'Medium'}</Select.Option>
              <Select.Option value="HIGH">{isVi ? 'Cao' : 'High'}</Select.Option>
              <Select.Option value="URGENT">{isVi ? 'Khẩn cấp' : 'Urgent'}</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label={isVi ? 'Mô tả chi tiết' : 'Detailed Description'}
            rules={[{ required: true, message: isVi ? 'Vui lòng mô tả chi tiết' : 'Please provide details' }]}
          >
            <Input.TextArea rows={6} placeholder={isVi ? 'Vui lòng mô tả chi tiết vấn đề bạn đang gặp phải...' : 'Please describe the issue in detail...'} />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};
