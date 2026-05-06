'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { Select } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';

export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (value: string) => {
    router.replace(pathname, { locale: value });
  };

  return (
    <Select
      value={locale}
      onChange={handleChange}
      variant="borderless"
      style={{ width: 110 }}
      suffixIcon={<GlobalOutlined />}
      options={[
        { value: 'vi', label: 'Tiếng Việt' },
        { value: 'en', label: 'English' }
      ]}
    />
  );
}
