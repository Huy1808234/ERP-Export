'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Table, Tag, Space, Button, Card, Typography, 
  Row, Col, Statistic, theme, Badge, Tooltip, 
  Progress, Alert, Empty
} from 'antd';
import { useTranslations } from 'next-intl';
import { 
  AuditOutlined, CheckCircleOutlined, 
  WarningOutlined, CloseCircleOutlined,
  SyncOutlined, FileSearchOutlined,
  DollarOutlined, InboxOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/library/theme.context';
import { sendRequest } from '@/utils/api';

const { Text, Title } = Typography;

const ThreeWayMatchingPage = () => {
  const t = useTranslations('ThreeWayMatching');
  const { data: session } = useSession();
  const accessToken = (session as any)?.user?.access_token;
  const { token } = theme.useToken();
  const { isDark } = useTheme();

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPOs = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      // We fetch POs as the basis for matching
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 50 },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        // Ensure data is always an array to prevent crash
        const items = Array.isArray(res.data) ? res.data : (res.data.results || []);
        setData(items);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchPOs();
  }, [fetchPOs]);

  const columns = [
    {
      title: t('table.columns.po'),
      dataIndex: 'poNumber',
      key: 'poNumber',
      render: (text: string, record: any) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.vendor?.name}</Text>
        </Space>
      ),
    },
    {
      title: t('table.columns.poValue'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (val: number) => <Text strong>{val?.toLocaleString()} VND</Text>
    },
    {
      title: t('table.columns.matchingStatus'),
      key: 'matchingStatus',
      width: '35%',
      render: (_: any, record: any) => {
        // Logic check matching status based on PO status for now
        const isReceived = record.status === 'COMPLETED' || record.status === 'PARTIAL_RECEIPT';
        const isSent = record.status !== 'DRAFT';
        
        return (
          <div style={{ padding: '8px 0' }}>
            <Row gutter={8}>
              <Col span={8}>
                <Badge status={isSent ? "success" : "default"} text="PO" />
              </Col>
              <Col span={8}>
                <Badge status={isReceived ? "success" : "processing"} text="GRN" />
              </Col>
              <Col span={8}>
                <Badge status="warning" text="INV" />
              </Col>
            </Row>
            <Progress 
              percent={isReceived ? 66 : 33} 
              size="small" 
              showInfo={false}
              strokeColor={isReceived ? token.colorInfo : token.colorWarning}
              style={{ marginTop: 8 }}
            />
          </div>
        );
      }
    },
    {
      title: t('table.columns.actions'),
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Button 
          type="primary" 
          ghost 
          icon={<FileSearchOutlined />} 
          size="small"
          onClick={() => {
            // Show detail modal or expand
          }}
        >
          {t('table.actionBtn')}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', backgroundColor: token.colorBgLayout, minHeight: '100vh' }}>
      <PageHeader 
        title={t('title')} 
        icon={<AuditOutlined />} 
        description={t('description')} 
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic 
              title={t('stats.matchedPO')} 
              value={data?.filter(i => i.status === 'COMPLETED').length || 0} 
              styles={{ content: { color: token.colorSuccess } }}
              prefix={<CheckCircleOutlined />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic 
              title={t('stats.waitingInvoice')} 
              value={data?.length || 0} 
              styles={{ content: { color: token.colorWarning } }}
              prefix={<SyncOutlined spin={loading} />} 
            />
          </Card>
        </Col>
      </Row>

      <Alert
        title={t('ruleAlert.title')}
        description={t('ruleAlert.description')}
        type="info"
        showIcon
        style={{ marginBottom: 24, borderRadius: 12 }}
      />

      <Card variant="borderless" style={{ borderRadius: 16 }} styles={{ body: { padding: 0 } }}>
        <Table 
          columns={columns} 
          dataSource={data} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description={t('table.emptyText')} /> }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '20px 50px', background: isDark ? '#1d1d1d' : '#f8fafc', borderRadius: 8 }}>
                <Title level={5}>{t('expand.title', { poNumber: record.poNumber })}</Title>
                <Text type="secondary">{t('expand.loading')}</Text>
                {/* Here we would ideally call the matching API for this specific ID */}
                <div style={{ marginTop: 16 }}>
                  <Badge status="processing" text={t('expand.syncStatus')} />
                </div>
              </div>
            )
          }}
        />
      </Card>
    </div>
  );
};

export default ThreeWayMatchingPage;
