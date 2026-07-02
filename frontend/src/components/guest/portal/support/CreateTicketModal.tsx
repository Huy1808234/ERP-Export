import React from 'react';
import { Modal, Form, Input, Row, Col, Select, Button, FormInstance } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { TicketFormValues } from '@/types/support.type';

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
  const t = useTranslations('PortalSupport');
  const tCommon = useTranslations('SupportCommon');

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
      title={t('form.title')}
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
        <Form.Item name="subject" label={t('form.subject')} rules={[requiredTrimRule(t('form.subjectRequired'))]}>
          <Input placeholder={t('form.subjectPlaceholder')} maxLength={160} showCount />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="category" label={t('form.category')}>
              <Select
                options={[
                  { value: 'QUALITY', label: tCommon('category.QUALITY') },
                  { value: 'LOGISTICS', label: tCommon('category.LOGISTICS') },
                  { value: 'FINANCE', label: tCommon('category.FINANCE') },
                  { value: 'DOCUMENT', label: tCommon('category.DOCUMENT') },
                  { value: 'OTHER', label: tCommon('category.OTHER') },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="priority" label={t('form.priority')}>
              <Select
                options={[
                  { value: 'LOW', label: tCommon('priority.LOW') },
                  { value: 'MEDIUM', label: tCommon('priority.MEDIUM') },
                  { value: 'HIGH', label: tCommon('priority.HIGH') },
                  { value: 'URGENT', label: tCommon('priority.URGENT') },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="message" label={t('form.message')} rules={[requiredTrimRule(t('form.messageRequired'))]}>
          <Input.TextArea rows={6} placeholder={t('form.messagePlaceholder')} showCount maxLength={4000} />
        </Form.Item>
        <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting} block>
          {t('actions.submitTicket')}
        </Button>
      </Form>
    </Modal>
  );
}
