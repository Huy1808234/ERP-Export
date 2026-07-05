import { Modal, Form, Input } from 'antd';
import { useTranslations } from 'next-intl';
import type { useContractSigning } from './useContractSigning';

type MissingSignerEmailModalProps = {
  hookParams: ReturnType<typeof useContractSigning>;
};

export const MissingSignerEmailModal = ({ hookParams }: MissingSignerEmailModalProps) => {
  const t = useTranslations('CustomerPortal');
  const {
    state: { missingEmailOpen, missingEmailForm, signing },
    actions: { setMissingEmailOpen, handleMissingEmailSubmit },
  } = hookParams;

  return (
    <Modal
      title={t('documentDetail.signing.updateContactEmail')}
      open={missingEmailOpen}
      onCancel={() => setMissingEmailOpen(false)}
      onOk={() => missingEmailForm.submit()}
      okText={t('documentDetail.signing.continue')}
      confirmLoading={signing}
      destroyOnHidden
    >
      <Form form={missingEmailForm} layout="vertical" onFinish={handleMissingEmailSubmit}>
        <Form.Item
          name="email"
          label={t('documentDetail.signing.email')}
          rules={[
            {
              required: true,
              message: t('documentDetail.signing.emailRequiredTitle'),
            },
            {
              type: 'email',
              message: t('documentDetail.signing.invalidEmail'),
            },
          ]}
        >
          <Input type="email" placeholder={t('documentDetail.signing.emailPlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
