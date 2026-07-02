'use client';

import { Card, Col, Row, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { PortalStatement } from '@/types/customer-portal';

const { Text } = Typography;

type AgingSummaryCardsProps = {
  summary: PortalStatement['summary'];
  defaultCurrency: string;
  locale: string;
};

const formatMoney = (
  value: number | string | null | undefined,
  currency: string | null | undefined,
  locale: string,
): string => {
  const amount = Number(value ?? 0);
  const displayCurrency = currency || 'USD';
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: displayCurrency,
    maximumFractionDigits: displayCurrency === 'VND' ? 0 : 2,
  }).format(Number.isFinite(amount) ? amount : 0);
};

const agingConfig = [
  {
    key: 'agingCurrent',
    color: '#52c41a',
    bgColor: 'linear-gradient(135deg, #52c41a15, #52c41a05)',
    borderColor: '#52c41a20',
    icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  },
  {
    key: 'agingDue1to30',
    color: '#faad14',
    bgColor: 'linear-gradient(135deg, #faad1415, #faad1405)',
    borderColor: '#faad1420',
    icon: <ClockCircleOutlined style={{ color: '#faad14' }} />,
  },
  {
    key: 'agingDue31to60',
    color: '#fa8c16',
    bgColor: 'linear-gradient(135deg, #fa8c1615, #fa8c1605)',
    borderColor: '#fa8c1620',
    icon: <WarningOutlined style={{ color: '#fa8c16' }} />,
  },
  {
    key: 'agingOverdue90',
    color: '#ff4b4a',
    bgColor: 'linear-gradient(135deg, #ff4b4a15, #ff4b4a05)',
    borderColor: '#ff4b4a20',
    icon: <CloseCircleOutlined style={{ color: '#ff4b4a' }} />,
  },
] as const;

export const AgingSummaryCards = ({
  summary,
  defaultCurrency,
  locale,
}: AgingSummaryCardsProps) => {
  const t = useTranslations('CustomerPortal');
  const hasData = agingConfig.some(
    (item) => (summary[item.key] ?? 0) > 0,
  );

  if (!hasData) {
    return null;
  }

  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      {agingConfig.map((item) => {
        const value = summary[item.key] ?? 0;
        if (value === 0) return null;

        return (
          <Col xs={12} sm={8} md={6} xl={4} xxl={4} key={item.key}>
            <Card
              variant="borderless"
              styles={{ body: { padding: 16 } }}
              style={{
                background: item.bgColor,
                border: `1px solid ${item.borderColor}`,
                borderRadius: 12,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: `${item.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px',
                    fontSize: 18,
                  }}
                >
                  {item.icon}
                </div>
                <Text
                  type="secondary"
                  style={{ display: 'block', fontSize: 12, marginBottom: 4 }}
                >
                  {t(`agingBuckets.${item.key}`)}
                </Text>
                <Text
                  strong
                  style={{
                    fontSize: 16,
                    color: item.color,
                    display: 'block',
                  }}
                >
                  {formatMoney(value, defaultCurrency, locale)}
                </Text>
              </div>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
};

export default AgingSummaryCards;
