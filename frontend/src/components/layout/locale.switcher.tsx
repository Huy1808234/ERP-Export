'use client';

import { GlobalOutlined } from '@ant-design/icons';
import { Select, Space, Typography } from 'antd';
import { useLocale } from 'next-intl';
import { useParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/routing';

const { Text } = Typography;

export default function LocaleSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams();

    function onSelectChange(value: string) {
        router.replace(
            // @ts-expect-error -- pathname and params are type-safe
            { pathname, params },
            { locale: value }
        );
    }

    return (
        <Space size={8}>
            <GlobalOutlined style={{ color: '#64748b' }} />
            <Select
                value={locale}
                style={{ width: 120 }}
                onChange={onSelectChange}
                variant="borderless"
                options={[
                    { value: 'vi', label: <Text strong>Tiếng Việt</Text> },
                    { value: 'en', label: <Text strong>English</Text> },
                ]}
            />
        </Space>
    );
}
