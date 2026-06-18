'use client';

import React, { useState } from 'react';
import { Button, Col, DatePicker, Row, Space } from 'antd';
import { PieChartOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import AccountingReports from '@/components/admin/accounting/AccountingReports';
import { getAccessToken } from '@/lib/auth-token';
import { canReadCostFields } from '@/lib/field-access';

const AccountingReportsPage = () => {
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const canViewCost = canReadCostFields(session?.user);
  const t = useTranslations('Accounting');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AdminPageScroll>
      <Row justify="space-between" align="bottom" style={{ marginBottom: 24 }}>
        <Col>
          <PageHeader
            title={t('tabs.reports')}
            icon={<PieChartOutlined />}
            description={t('reports.sections.financialTrendDescription')}
          />
        </Col>
        <Col>
          <Space orientation="horizontal">
            <DatePicker.RangePicker
              style={{ height: 40, borderRadius: 8 }}
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
            />
            <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey((value) => value + 1)} size="large">
              {t('actions.refresh')}
            </Button>
          </Space>
        </Col>
      </Row>

      <AccountingReports
        key={refreshKey}
        accessToken={accessToken ?? ''}
        dateRange={dateRange}
        canViewCost={canViewCost}
      />
    </AdminPageScroll>
  );
};

export default AccountingReportsPage;
