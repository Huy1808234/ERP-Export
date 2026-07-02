'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  DownloadOutlined,
  FileDoneOutlined,
  GlobalOutlined,
  ShoppingCartOutlined,
  SyncOutlined,
  TruckOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { useCustomerPortalOverview } from '@/hooks/useCustomerPortal';
import { PageState, PortalShell } from '@/components/admin/portal/_shared/PortalShell';
import { formatDate, formatMoney, statusColor } from '@/components/admin/portal/_shared/helpers';

const { Text, Title } = Typography;

export const OverviewPage = () => {
  const locale = useLocale();
  const t = useTranslations('CustomerPortal');
  const { data, loading, error, fetchOverview } = useCustomerPortalOverview();
  const [refreshing, setRefreshing] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOverview();
    setRefreshing(false);
  };

  if (!data) {
    return (
      <PortalShell title={t('overviewTitle')} subtitle={t('overviewSubtitle')} icon={<UserOutlined />}>
        <PageState loading={loading} error={error} empty={!data} onRetry={() => void fetchOverview()}>
          <></>
        </PageState>
      </PortalShell>
    );
  }

  const { profile, orders, shipments, statement } = data;
  const defaultCurrency = profile.finance.defaultCurrency || 'USD';

  // Financial summary data
  const financialData = [
    {
      label: t('totalOutstanding'),
      value: statement.summary.openForeign,
      color: '#ff4d4f',
      icon: <DollarOutlined />,
      prefix: defaultCurrency === 'VND' ? '' : '$',
    },
    {
      label: t('totalPaid'),
      value: statement.summary.paidForeign,
      color: '#52c41a',
      icon: <CheckCircleOutlined />,
      prefix: defaultCurrency === 'VND' ? '' : '$',
    },
    {
      label: t('openInvoices'),
      value: statement.summary.openInvoiceCount,
      color: '#faad14',
      icon: <FileDoneOutlined />,
      isCount: true,
    },
    {
      label: t('pendingSignature'),
      value: orders.summary.pendingSignatureCount,
      color: '#1890ff',
      icon: <UnorderedListOutlined />,
      isCount: true,
    },
  ];

  // Order summary data
  const orderSummaryData = [
    { label: t('quotations'), value: orders.summary.quotationCount, color: '#1890ff' },
    { label: t('contracts'), value: orders.summary.contractCount, color: '#52c41a' },
    { label: t('proformaInvoices'), value: orders.summary.proformaInvoiceCount, color: '#722ed1' },
    { label: t('shipments'), value: orders.summary.shippedCount, color: '#fa8c16' },
  ];

  // Open quotations count
  const openQuotations = orders.quotations?.filter(q => q.status === 'SENT' || q.status === 'PENDING') || [];
  const openQuotationsCount = openQuotations.length;
  
  // Recent shipments (latest 3)
  const recentShipments = shipments.slice(0, 3);

  return (
    <PortalShell
      title={t('dashboard')}
      subtitle={`${t('welcomeBack')}, ${profile.contact.contactName || profile.partner.name}`}
      icon={<UserOutlined />}
      extra={
        <Button icon={<SyncOutlined spin={refreshing} />} onClick={() => void handleRefresh()}>
          {t('refresh')}
        </Button>
      }
    >
      <Space orientation="vertical" size={20} style={{ width: '100%' }}>
        {/* Welcome Banner - Premium Hero Section */}
        <Card 
          variant="borderless" 
          styles={{ body: { padding: 0 } }}
          style={{ overflow: 'hidden', boxShadow: '0 4px 24px rgba(0, 21, 41, 0.08)' }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #001529 0%, #003a70 50%, #0050b3 100%)',
            borderRadius: 16,
            padding: '32px 40px',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Decorative circles */}
            <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
            <div style={{ position: 'absolute', bottom: -30, right: 100, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
            
            <Row gutter={48} align="middle">
              <Col flex="auto">
                <Space align="center" size={20}>
                  <div style={{
                    width: 72,
                    height: 72,
                    borderRadius: 16,
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                    fontWeight: 700,
                    border: '2px solid rgba(255,255,255,0.2)',
                  }}>
                    {profile.partner.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <Title level={2} style={{ color: '#fff', margin: 0, fontSize: 24 }}>
                      {profile.partner.name}
                    </Title>
                    <Space size={12} style={{ marginTop: 8 }}>
                      <Tag 
                        color={profile.finance.riskLevel === 'HIGH' ? 'red' : profile.finance.riskLevel === 'MEDIUM' ? 'orange' : 'gold'}
                        style={{ margin: 0, fontWeight: 500 }}
                      >
                        {profile.finance.riskLevel || 'NORMAL'} RISK
                      </Tag>
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
                        <GlobalOutlined style={{ marginRight: 6 }} />
                        {profile.partner.country || '-'} / {profile.partner.region || '-'}
                      </Text>
                    </Space>
                  </div>
                </Space>
              </Col>
              <Col>
                <Row gutter={[40, 16]} align="middle">
                  <Col>
                    <div style={{ textAlign: 'right' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 4, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {t('creditLimit')}
                      </Text>
                      <Text style={{ color: '#fff', fontSize: 20, fontWeight: 600 }}>
                        {formatMoney(profile.finance.creditLimit, defaultCurrency, locale)}
                      </Text>
                    </div>
                  </Col>
                  <Col>
                    <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.2)' }} />
                  </Col>
                  <Col>
                    <div style={{ textAlign: 'right' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 4, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {t('openBalance')}
                      </Text>
                      <Text style={{ color: '#ff7875', fontSize: 20, fontWeight: 700 }}>
                        {formatMoney(profile.finance.openBalanceForeign, defaultCurrency, locale)}
                      </Text>
                    </div>
                  </Col>
                </Row>
              </Col>
            </Row>
          </div>
        </Card>

        {/* Financial Overview Cards */}
        <Row gutter={[16, 16]}>
          {financialData.map((item, index) => (
            <Col xs={24} sm={12} xl={6} key={index}>
              <Card 
                variant="borderless" 
                styles={{ body: { padding: 24 } }}
                style={{ boxShadow: '0 2px 12px rgba(0, 21, 41, 0.06)', transition: 'all 0.3s ease', cursor: 'pointer' }}
                hoverable
              >
                <Row align="middle" gutter={16}>
                  <Col>
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      background: `linear-gradient(135deg, ${item.color}20, ${item.color}10)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: item.color,
                      fontSize: 22,
                    }}>
                      {item.icon}
                    </div>
                  </Col>
                  <Col flex="auto">
                    <Text type="secondary" style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>
                      {item.label}
                    </Text>
                    <Text strong style={{ fontSize: 26, display: 'block', marginTop: 4 }}>
                      {item.isCount ? item.value : formatMoney(item.value, defaultCurrency, locale)}
                    </Text>
                  </Col>
                </Row>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Order & Shipment Overview */}
        <Row gutter={[20, 20]} align="stretch">
          <Col xs={24} xl={14}>
            <Card
              variant="borderless"
              title={<Space><FileDoneOutlined style={{ color: '#1890ff' }} /><span style={{ fontWeight: 600 }}>{t('orderOverview')}</span></Space>}
              extra={<Button type="link" style={{ color: '#1890ff', fontWeight: 500 }} onClick={() => window.location.href = '/dashboard/portal/orders'}>{t('viewAllOrders')} →</Button>}
              styles={{ body: { padding: 24 } }}
              style={{ boxShadow: '0 2px 12px rgba(0, 21, 41, 0.06)', height: '100%' }}
            >
              <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                {orderSummaryData.map((item, index) => (
                  <Col xs={12} md={6} key={index}>
                    <div style={{
                      textAlign: 'center',
                      padding: '20px 12px',
                      background: `linear-gradient(135deg, ${item.color}08, ${item.color}05)`,
                      borderRadius: 12,
                      border: `1px solid ${item.color}20`,
                      transition: 'all 0.3s ease',
                    }}>
                      <div style={{ fontSize: 36, fontWeight: 700, color: item.color, lineHeight: 1.2 }}>
                        {item.value}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>{item.label}</Text>
                    </div>
                  </Col>
                ))}
              </Row>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>{t('quotations')}</Text>
                {orders.quotations && orders.quotations.length > 0 ? (
                  <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                    {orders.quotations.slice(0, 3).map((quotation) => (
                      <Card
                        key={quotation._id}
                        size="small"
                        styles={{ body: { padding: '14px 16px' } }}
                        style={{ borderRadius: 10, border: `1px solid ${token.colorBorderSecondary}`, transition: 'all 0.2s ease' }}
                        hoverable
                      >
                        <Row justify="space-between" align="middle">
                          <Col>
                            <Space>
                              <div style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: statusColor(quotation.status) === 'success' ? '#52c41a' : 
                                           statusColor(quotation.status) === 'error' ? '#ff4d4f' : 
                                           statusColor(quotation.status) === 'processing' ? '#1890ff' : '#faad14',
                              }} />
                              <Text strong style={{ fontSize: 14 }}>{quotation.quotationNumber || 'N/A'}</Text>
                            </Space>
                            <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
                              {formatDate(quotation.createdAt, locale)}
                            </Text>
                          </Col>
                          <Col>
                            <Space>
                              <Tag color={statusColor(quotation.status)} style={{ borderRadius: 6, fontWeight: 500 }}>
                                {quotation.status || 'N/A'}
                              </Tag>
                              <Text strong style={{ fontSize: 14 }}>
                                {formatMoney(quotation.totalAmount, quotation.currency, locale)}
                              </Text>
                            </Space>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </Space>
                ) : (
                  <Empty description={t('empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </div>
            </Card>
          </Col>

          <Col xs={24} xl={10}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
            {/* Recent Shipments */}
            <Card
              variant="borderless"
              title={<Space><TruckOutlined style={{ color: '#fa8c16' }} /><span style={{ fontWeight: 600 }}>{t('recentShipments')}</span></Space>}
              extra={<Button type="link" style={{ color: '#fa8c16', fontWeight: 500 }} onClick={() => window.location.href = '/dashboard/portal/shipments'}>{t('viewAllShipments')} →</Button>}
              styles={{ body: { padding: 24 } }}
              style={{ boxShadow: '0 2px 12px rgba(0, 21, 41, 0.06)', flex: 1 }}
            >
              {recentShipments.length > 0 ? (
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                  {recentShipments.map((shipment) => (
                    <Card
                      key={shipment._id}
                      size="small"
                      styles={{ body: { padding: '16px' } }}
                      style={{ borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}`, transition: 'all 0.2s ease' }}
                      hoverable
                    >
                      <Row gutter={12} align="middle">
                        <Col>
                          <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, #1890ff15, #1890ff08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <TruckOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                          </div>
                        </Col>
                        <Col flex="auto">
                          <Text strong style={{ display: 'block', fontSize: 14 }}>
                            {shipment.shipmentNumber || shipment._id}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {shipment.pol || '-'} → {shipment.pod || '-'}
                          </Text>
                        </Col>
                        <Col>
                          <Tag color={statusColor(shipment.status)} style={{ borderRadius: 6, fontWeight: 500 }}>
                            {shipment.status || 'N/A'}
                          </Tag>
                          {shipment.eta && (
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'right', marginTop: 4 }}>
                              ETA: {formatDate(shipment.eta, locale)}
                            </Text>
                          )}
                        </Col>
                      </Row>
                      {shipment.timeline && shipment.timeline.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <Row gutter={8}>
                            {shipment.timeline.slice(0, 4).map((item, i) => (
                              <Col key={i} flex="auto">
                                <div style={{
                                  height: 4,
                                  borderRadius: 2,
                                  background: item.state === 'finish' ? token.colorSuccess : 
                                             item.state === 'process' ? token.colorPrimary : token.colorFillSecondary,
                                }} />
                              </Col>
                            ))}
                          </Row>
                        </div>
                      )}
                    </Card>
                  ))}
                </Space>
              ) : (
                <Empty description={t('noRecentShipments')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>

            {/* Action Required */}
            <Card
              variant="borderless"
              title={<Space><ClockCircleOutlined style={{ color: '#ff4d4f' }} /><span style={{ fontWeight: 600 }}>{t('actionRequired')}</span></Space>}
              styles={{ body: { padding: 24 } }}
              style={{ boxShadow: '0 2px 12px rgba(0, 21, 41, 0.06)', flex: 1 }}
            >
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                {statement.summary.openInvoiceCount > 0 && (
                  <Card
                    size="small"
                    styles={{ body: { padding: '14px 16px' } }}
                    style={{ borderRadius: 10, borderLeft: `4px solid ${token.colorError}`, background: token.colorErrorBg }}
                  >
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Space>
                          <ClockCircleOutlined style={{ color: '#ff4d4f' }} />
                          <Text strong style={{ fontSize: 14 }}>{t('overdueInvoices')}</Text>
                        </Space>
                        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                          {statement.summary.openInvoiceCount} {t('invoicesOverdueDesc')}
                        </Text>
                      </Col>
                      <Col>
                        <Text strong style={{ color: '#ff4d4f', fontSize: 16 }}>
                          {formatMoney(statement.summary.openForeign, defaultCurrency, locale)}
                        </Text>
                      </Col>
                    </Row>
                  </Card>
                )}

                {orders.summary.pendingSignatureCount > 0 && (
                  <Card
                    size="small"
                    styles={{ body: { padding: '14px 16px' } }}
                    style={{ borderRadius: 10, borderLeft: `4px solid ${token.colorWarning}`, background: token.colorWarningBg }}
                  >
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Space>
                          <FileDoneOutlined style={{ color: '#faad14' }} />
                          <Text strong style={{ fontSize: 14 }}>{t('pendingSignature')}</Text>
                        </Space>
                        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                          {orders.summary.pendingSignatureCount} {t('contractsAwaitingSignature')}
                        </Text>
                      </Col>
                      <Col>
                        <Button type="primary" size="small" onClick={() => window.location.href = '/dashboard/portal/orders'}>
                          {t('reviewNow')}
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                )}

                {openQuotationsCount > 0 && (
                  <Card
                    size="small"
                    styles={{ body: { padding: '14px 16px' } }}
                    style={{ borderRadius: 10, borderLeft: `4px solid ${token.colorInfo}`, background: token.colorInfoBg }}
                  >
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Space>
                          <UnorderedListOutlined style={{ color: '#1890ff' }} />
                          <Text strong style={{ fontSize: 14 }}>{t('openQuotations')}</Text>
                        </Space>
                        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                          {openQuotationsCount} {t('quotationsAwaitingReview')}
                        </Text>
                      </Col>
                      <Col>
                        <Button type="primary" size="small" onClick={() => window.location.href = '/dashboard/portal/orders'}>
                          {t('viewAllOrders')}
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                )}

                {statement.summary.openInvoiceCount === 0 && 
                 orders.summary.pendingSignatureCount === 0 && 
                 openQuotationsCount === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', background: token.colorSuccessBg, borderRadius: 10 }}>
                    <CheckCircleOutlined style={{ fontSize: 48, color: token.colorSuccess, marginBottom: 12 }} />
                    <Text style={{ display: 'block', fontSize: 14 }}>{t('noActionRequired')}</Text>
                  </div>
                )}
              </Space>
            </Card>
            </div>
          </Col>
        </Row>

        {/* Quick Actions */}
        <Card 
          variant="borderless" 
          title={<Space><UnorderedListOutlined style={{ color: '#722ed1' }} /><span style={{ fontWeight: 600 }}>{t('quickActions')}</span></Space>}
          styles={{ body: { padding: 24 } }}
          style={{ boxShadow: '0 2px 12px rgba(0, 21, 41, 0.06)' }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Button
                block
                size="large"
                icon={<ShoppingCartOutlined style={{ fontSize: 20 }} />}
                onClick={() => window.location.href = '/dashboard/portal/products'}
                style={{ height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: 12, fontWeight: 500 }}
              >
                {t('browseProducts')}
              </Button>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Button
                block
                size="large"
                icon={<FileDoneOutlined style={{ fontSize: 20 }} />}
                onClick={() => window.location.href = '/dashboard/portal/orders'}
                style={{ height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: 12, fontWeight: 500 }}
              >
                {t('viewOrders')}
              </Button>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Button
                block
                size="large"
                icon={<TruckOutlined style={{ fontSize: 20 }} />}
                onClick={() => window.location.href = '/dashboard/portal/shipments'}
                style={{ height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: 12, fontWeight: 500 }}
              >
                {t('viewShipments')}
              </Button>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Button
                block
                size="large"
                icon={<DownloadOutlined style={{ fontSize: 20 }} />}
                onClick={() => window.location.href = '/dashboard/portal/finance'}
                style={{ height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: 12, fontWeight: 500 }}
              >
                {t('downloadReport')}
              </Button>
            </Col>
          </Row>
        </Card>
      </Space>
    </PortalShell>
  );
};