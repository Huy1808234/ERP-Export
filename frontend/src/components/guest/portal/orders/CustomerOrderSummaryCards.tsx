'use client';

import { Card, Col, Row, Statistic } from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  ProfileOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { PortalOrderSummary } from '@/types/customer-portal';

type CustomerOrderSummaryCardsProps = {
  summary: PortalOrderSummary | null | undefined;
};

const cards = [
  {
    key: 'quotationCount',
    labelKey: 'quotations',
    icon: <FileTextOutlined />,
  },
  {
    key: 'contractCount',
    labelKey: 'contracts',
    icon: <AuditOutlined />,
  },
  {
    key: 'proformaInvoiceCount',
    labelKey: 'proformaInvoices',
    icon: <ProfileOutlined />,
  },
  {
    key: 'orderCount',
    labelKey: 'orders',
    icon: <ShoppingCartOutlined />,
  },
  {
    key: 'completedCount',
    labelKey: 'completedOrders',
    icon: <CheckCircleOutlined />,
  },
] as const;

export function CustomerOrderSummaryCards({
  summary,
}: CustomerOrderSummaryCardsProps) {
  const t = useTranslations('CustomerPortal');

  return (
    <Row gutter={[16, 16]}>
      {cards.map((card) => (
        <Col xs={12} sm={12} lg={8} xl={4} key={card.key}>
          <Card variant="borderless">
            <Statistic
              title={t(card.labelKey)}
              value={Number(summary?.[card.key] || 0)}
              prefix={card.icon}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
