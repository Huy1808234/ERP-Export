import React from 'react';
import { Modal, Form, Input, Row, Col, Select, Button, FormInstance } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useLocale } from 'next-intl';
import { TicketFormValues } from '@/types/support.type';

interface CreateTicketModalProps {
  open: boolean;
  onClose: () => void;
  form: FormInstance<TicketFormValues>;
  onSubmit: (values: TicketFormValues) => void;
  submitting?: boolean;
}

export default function CreateTicketModal({
  open,
  onClose,
  form,
  onSubmit,
  submitting = false,
}: CreateTicketModalProps) {
  const locale = useLocale();
  const isVi = locale === 'vi';
  const copy = {
    title: isVi ? 'Tạo ticket hỗ trợ' : 'Create support ticket',
    subject: isVi ? 'Tiêu đề' : 'Subject',
    subjectPlaceholder: isVi ? 'Tóm tắt vấn đề cần hỗ trợ' : 'Short issue summary',
    subjectRequired: isVi ? 'Vui lòng nhập tiêu đề' : 'Please enter a subject',
    category: isVi ? 'Nhóm hỗ trợ' : 'Category',
    priority: isVi ? 'Mức ưu tiên' : 'Priority',
    message: isVi ? 'Nội dung' : 'Message',
    messagePlaceholder: isVi
      ? 'Mô tả vấn đề, mã chứng từ, bằng chứng hoặc câu hỏi cần đội vận hành xử lý...'
      : 'Describe the issue, claim evidence, or question...',
    messageRequired: isVi ? 'Vui lòng nhập nội dung' : 'Please enter a message',
    submit: isVi ? 'Gửi ticket' : 'Submit ticket',
  };

  const requiredTrimRule = (message: string) => ({
    validator: (_: unknown, value?: string) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        return Promise.resolve();
      }
      return Promise.reject(new Error(message));
    },
  });

  return (
    <Modal
      title={copy.title}
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
    >
      <Form<TicketFormValues>
        form={form}
        layout="vertical"
        initialValues={{ category: 'OTHER', priority: 'MEDIUM' }}
        onFinish={onSubmit}
      >
        <Form.Item name="shipmentId" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="subject" label={copy.subject} rules={[requiredTrimRule(copy.subjectRequired)]}>
          <Input placeholder={copy.subjectPlaceholder} maxLength={160} showCount />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="category" label={copy.category}>
              <Select
                options={[
                  { value: 'QUALITY', label: isVi ? 'Khiếu nại chất lượng' : 'Quality claim' },
                  { value: 'LOGISTICS', label: isVi ? 'Logistics' : 'Logistics' },
                  { value: 'FINANCE', label: isVi ? 'Tài chính' : 'Finance' },
                  { value: 'DOCUMENT', label: isVi ? 'Chứng từ' : 'Documents' },
                  { value: 'OTHER', label: isVi ? 'Khác' : 'Other' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="priority" label={copy.priority}>
              <Select
                options={[
                  { value: 'LOW', label: isVi ? 'Thấp' : 'Low' },
                  { value: 'MEDIUM', label: isVi ? 'Trung bình' : 'Medium' },
                  { value: 'HIGH', label: isVi ? 'Cao' : 'High' },
                  { value: 'URGENT', label: isVi ? 'Khẩn cấp' : 'Urgent' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="message" label={copy.message} rules={[requiredTrimRule(copy.messageRequired)]}>
          <Input.TextArea rows={6} placeholder={copy.messagePlaceholder} showCount maxLength={4000} />
        </Form.Item>
        <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting} block>
          {copy.submit}
        </Button>
      </Form>
    </Modal>
  );
}
