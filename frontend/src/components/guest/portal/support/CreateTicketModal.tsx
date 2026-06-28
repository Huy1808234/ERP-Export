import React from 'react';
import { Modal, Form, Input, Row, Col, Select, Button, FormInstance } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { TicketFormValues } from '@/types/support.type';

interface CreateTicketModalProps {
  open: boolean;
  onClose: () => void;
  form: FormInstance<TicketFormValues>;
  onSubmit: (values: TicketFormValues) => void;
}

export default function CreateTicketModal({ open, onClose, form, onSubmit }: CreateTicketModalProps) {
  return (
    <Modal
      title="Create support ticket"
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
        <Form.Item name="subject" label="Subject" rules={[{ required: true }]}>
          <Input placeholder="Short issue summary" />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="category" label="Category">
              <Select
                options={[
                  { value: 'QUALITY', label: 'Quality claim' },
                  { value: 'LOGISTICS', label: 'Logistics' },
                  { value: 'FINANCE', label: 'Finance' },
                  { value: 'DOCUMENT', label: 'Documents' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="priority" label="Priority">
              <Select
                options={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                  { value: 'URGENT', label: 'Urgent' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="message" label="Message" rules={[{ required: true }]}>
          <Input.TextArea rows={5} placeholder="Describe the issue, claim evidence, or question..." />
        </Form.Item>
        <Button type="primary" htmlType="submit" icon={<SendOutlined />} block>
          Submit ticket
        </Button>
      </Form>
    </Modal>
  );
}
