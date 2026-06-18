'use client';

import { Form, Input, Modal, Select, App } from 'antd';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
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
  const locale = useLocale();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const tPartner = useTranslations('Partner');

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
          title: locale === 'vi' ? 'Thêm quốc gia thành công' : 'Country added successfully',
          description: `${payload.nameVi} (${codeUpper})`
        });
        await loadCountries(accessToken, true);
        onSuccess(codeUpper);
        form.resetFields();
        onCancel();
      } else {
        notification.error({
          title: locale === 'vi' ? 'Không thể thêm quốc gia' : 'Failed to add country',
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
      title={locale === 'vi' ? 'Thêm Quốc Gia Mới' : 'Add New Country'}
      open={open}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleSave}
      confirmLoading={loading}
      okText={locale === 'vi' ? 'Thêm' : 'Add'}
      cancelText={locale === 'vi' ? 'Hủy' : 'Cancel'}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="code"
          label={locale === 'vi' ? 'Mã quốc gia (2 ký tự)' : 'Country Code (2 chars)'}
          rules={[
            { required: true, message: locale === 'vi' ? 'Nhập mã quốc gia' : 'Enter country code' },
            { len: 2, message: locale === 'vi' ? 'Mã quốc gia cần chính xác 2 ký tự' : 'Code must be exactly 2 characters' },
            { pattern: /^[A-Z]{2}$/i, message: locale === 'vi' ? 'Mã quốc gia chỉ gồm chữ cái' : 'Code must be letters only' }
          ]}
        >
          <Input placeholder="VD: RU, CA, SG" style={{ textTransform: 'uppercase' }} maxLength={2} />
        </Form.Item>
        <Form.Item
          name="name"
          label={locale === 'vi' ? 'Tên tiếng Anh / tên chuẩn' : 'English Name'}
          rules={[{ required: true, message: locale === 'vi' ? 'Nhập tên tiếng Anh' : 'Enter English name' }]}
        >
          <Input placeholder="VD: Russian Federation" />
        </Form.Item>
        <Form.Item
          name="nameVi"
          label={locale === 'vi' ? 'Tên tiếng Việt' : 'Vietnamese Name'}
          rules={[{ required: true, message: locale === 'vi' ? 'Nhập tên tiếng Việt' : 'Enter Vietnamese name' }]}
        >
          <Input placeholder="VD: Liên Bang Nga" />
        </Form.Item>
        <Form.Item
          name="region"
          label={locale === 'vi' ? 'Vùng thị trường' : 'Market Region'}
          initialValue="OTHER"
        >
          <Select options={regionOptions} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
