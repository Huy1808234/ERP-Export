'use client';

import { Button, Result, Space, Typography } from 'antd';
import { useParams, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { getDashboardAccessLabel, normalizeDashboardPath } from '@/lib/access-control';

const { Text } = Typography;

export default function AccessDeniedPage() {
  const params = useParams<{ locale?: string }>();
  const searchParams = useSearchParams();
  const locale = params?.locale || 'vi';
  const from = searchParams.get('from') || '/dashboard';
  const fromWithoutLocale = normalizeDashboardPath(from.replace(`/${locale}`, '') || from);
  const moduleLabel = getDashboardAccessLabel(fromWithoutLocale);

  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <Result
        status="403"
        title="Không có quyền truy cập"
        subTitle={(
          <Space orientation="vertical" size={4}>
            <Text>Tài khoản của bạn chưa được cấp quyền vào {moduleLabel.toLowerCase()}.</Text>
            <Text type="secondary">
              Vui lòng liên hệ quản trị viên hoặc đăng nhập bằng tài khoản có vai trò phù hợp.
            </Text>
          </Space>
        )}
        extra={(
          <Space>
            <Link href="/dashboard">
              <Button type="primary">Về tổng quan</Button>
            </Link>
            <Link href="/auth/login">
              <Button>Đổi tài khoản</Button>
            </Link>
          </Space>
        )}
      />
    </div>
  );
}
