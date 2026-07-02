'use client';

import { Form, Input, Modal, Select, App } from 'antd';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth-token';
import { countryService } from '@/services/country.service';
import { loadCountries, buildRegionOptions } from '@/constants/geo';

interface QuickAddCountryModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (code: string) => void;
}

export const QuickAddCountryModal = ({ open, onCancel, onSuccess }: QuickAddCountryModalProps) => {
  const { data: session } = useSession();
  const { notification } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const tPartner = useTranslations('Partner');
  const tCountries = useTranslations('Countries');

  const regionOptions = useMemo(() => buildRegionOptions(tPartner), [tPartner]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const accessToken = getAccessToken(session);

      const codeUpper = values.code.trim().toUpperCase();
      const payload = {
        code: codeUpper,
        name: values.name.trim(),
        nameVi: values.nameVi.trim(),
        region: values.region || 'OTHER',
        isActive: true,
      };

      const res = await countryService.create(payload, accessToken);
      if (res.data) {
        notification.success({
          title: tCountries('messages.quickAddSuccess'),
          description: `${payload.nameVi} (${codeUpper})`
        });
        await loadCountries(accessToken, true);
        onSuccess(codeUpper);
        form.resetFields();
        onCancel();
      } else {
        notification.error({
          title: tCountries('messages.quickAddError'),
          description: res.message,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={tCountries('modal.createTitle')}
      open={open}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleSave}
      confirmLoading={loading}
      okText={tCountries('actions.create')}
      cancelText={tCountries('actions.cancel')}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="code"
          label={tCountries('form.code')}
          rules={[
            { required: true, message: tCountries('validation.codeRequired') },
            { len: 2, message: tCountries('validation.codeLength') },
            { pattern: /^[A-Z]{2}$/i, message: tCountries('validation.codeLetters') }
          ]}
        >
          <Input placeholder={tCountries('placeholders.code')} style={{ textTransform: 'uppercase' }} maxLength={2} />
        </Form.Item>
        <Form.Item
          name="name"
          label={tCountries('form.name')}
          rules={[{ required: true, message: tCountries('validation.nameRequired') }]}
        >
          <Input placeholder={tCountries('placeholders.name')} />
        </Form.Item>
        <Form.Item
          name="nameVi"
          label={tCountries('form.nameVi')}
          rules={[{ required: true, message: tCountries('validation.nameViRequired') }]}
        >
          <Input placeholder={tCountries('placeholders.nameVi')} />
        </Form.Item>
        <Form.Item
          name="region"
          label={tCountries('form.region')}
          initialValue="OTHER"
        >
          <Select options={regionOptions} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
