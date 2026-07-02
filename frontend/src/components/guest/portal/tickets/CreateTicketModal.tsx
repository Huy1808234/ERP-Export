import { useState } from 'react';
import { App, Modal, Form, Input, Select, Space } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { CreateTicketDto, Ticket } from '@/services/ticket.service';

interface CreateTicketModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (data: CreateTicketDto) => Promise<Ticket>;
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
}: CreateTicketModalProps) => {
  const { message } = App.useApp();
  const t = useTranslations('PortalSupport');
  const tCommon = useTranslations('SupportCommon');
  const [form] = Form.useForm<CreateTicketDto>();
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await onSubmit(values as CreateTicketDto);
      message.success(t('feedback.createOk'));
      form.resetFields();
      onCancel();
    } catch (error) {
      if (isFormValidationError(error)) {
        return;
      }
      message.error(t('feedback.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={<Space><SendOutlined style={{ color: '#1890ff' }} /> {t('form.title')}</Space>}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      okText={t('actions.submitTicket')}
      cancelText={t('actions.cancel')}
      width={600}
    >
      <div style={{ marginTop: 24 }}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label={t('form.subject')}
            rules={[{ required: true, message: t('form.subjectRequired') }]}
          >
            <Input placeholder={t('form.subjectPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="priority"
            label={t('form.priority')}
            initialValue="MEDIUM"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="LOW">{tCommon('priority.LOW')}</Select.Option>
              <Select.Option value="MEDIUM">{tCommon('priority.MEDIUM')}</Select.Option>
              <Select.Option value="HIGH">{tCommon('priority.HIGH')}</Select.Option>
              <Select.Option value="URGENT">{tCommon('priority.URGENT')}</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label={t('form.description')}
            rules={[{ required: true, message: t('form.descriptionRequired') }]}
          >
            <Input.TextArea rows={6} placeholder={t('form.descriptionPlaceholder')} />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};
