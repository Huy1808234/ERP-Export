'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Pagination,
  Row,
  Skeleton,
  Space,
  Steps,
  Tag,
  Timeline,
  Typography,
  theme,
} from 'antd';
import {
  ClockCircleOutlined,
  ContainerOutlined,
  CustomerServiceOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  ShopOutlined,
  TruckOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { useCustomerPortalShipments } from '@/hooks/useCustomerPortal';
import type { PortalShipment, PortalShipmentTimelineItem } from '@/types/customer-portal';

const { Text, Title } = Typography;

type ShipmentFilterKey = 'all' | 'booking' | 'shipping' | 'receiving' | 'completed';

type ShipmentLabels = {
  filterAll: string;
  filterBooking: string;
  filterShipping: string;
  filterReceiving: string;
  filterCompleted: string;
  statusBooked: string;
  statusLoading: string;
  statusCustomsCleared: string;
  statusOnBoard: string;
  statusArrived: string;
  statusClosed: string;
  milestoneBooked: string;
  milestoneLoading: string;
  milestoneCustomsCleared: string;
  milestoneOnBoard: string;
  milestoneArrived: string;
  milestoneClosed: string;
};

const buildShipmentFilters = (l: ShipmentLabels): Array<{
  key: ShipmentFilterKey;
  label: string;
  statuses: string[];
}> => [
  { key: 'all', label: l.filterAll, statuses: [] },
  { key: 'booking', label: l.filterBooking, statuses: ['BOOKED'] },
  { key: 'shipping', label: l.filterShipping, statuses: ['LOADING', 'CUSTOMS_CLEARED', 'ON_BOARD'] },
  { key: 'receiving', label: l.filterReceiving, statuses: ['ARRIVED'] },
  { key: 'completed', label: l.filterCompleted, statuses: ['CLOSED'] },
];

const buildStatusMeta = (l: ShipmentLabels): Record<string, { label: string; color: string; tone: string }> => ({
  BOOKED: { label: l.statusBooked, color: 'blue', tone: '#2563eb' },
  LOADING: { label: l.statusLoading, color: 'processing', tone: '#0ea5e9' },
  CUSTOMS_CLEARED: { label: l.statusCustomsCleared, color: 'purple', tone: '#7c3aed' },
  ON_BOARD: { label: l.statusOnBoard, color: 'cyan', tone: '#0891b2' },
  ARRIVED: { label: l.statusArrived, color: 'orange', tone: '#f97316' },
  CLOSED: { label: l.statusClosed, color: 'green', tone: '#16a34a' },
});

const buildDefaultTimeline = (l: ShipmentLabels): PortalShipmentTimelineItem[] => [
  { status: 'BOOKED', label: l.milestoneBooked, state: 'finish' },
  { status: 'LOADING', label: l.milestoneLoading, state: 'wait' },
  { status: 'CUSTOMS_CLEARED', label: l.milestoneCustomsCleared, state: 'wait' },
  { status: 'ON_BOARD', label: l.milestoneOnBoard, state: 'wait' },
  { status: 'ARRIVED', label: l.milestoneArrived, state: 'wait' },
  { status: 'CLOSED', label: l.milestoneClosed, state: 'wait' },
];

const normalizeStatus = (status?: string | null): string => status || 'BOOKED';

const formatDate = (value?: string | null): string => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('vi-VN');
};

const getShipmentNumber = (shipment: PortalShipment): string => shipment.shipmentNumber || shipment._id;

const getTimeline = (shipment: PortalShipment, defaultTimeline: PortalShipmentTimelineItem[]): PortalShipmentTimelineItem[] => {
  if (shipment.timeline?.length) {
    return shipment.timeline.map((item) => ({
      ...item,
      // Backend may store raw English label; prefer localized label from defaultTimeline
      label: defaultTimeline.find((entry) => entry.status === item.status)?.label ?? item.label,
    }));
  }

  const currentStatus = normalizeStatus(shipment.status);
  const currentIndex = defaultTimeline.findIndex((item) => item.status === currentStatus);

  return defaultTimeline.map((item, index) => ({
    ...item,
    state: index < currentIndex ? 'finish' : index === currentIndex ? 'process' : 'wait',
  }));
};

const getCurrentStep = (timeline: PortalShipmentTimelineItem[]): number => {
  const processIndex = timeline.findIndex((item) => item.state === 'process');
  if (processIndex >= 0) return processIndex;

  const lastFinishedIndex = timeline.map((item) => item.state).lastIndexOf('finish');
  return Math.max(lastFinishedIndex, 0);
};

const getLatestEvent = (timeline: PortalShipmentTimelineItem[]): PortalShipmentTimelineItem | undefined => {
  return [...timeline].reverse().find((item) => item.state === 'process' || item.state === 'finish');
};

const getLogisticsProvider = (shipment: PortalShipment, t: ReturnType<typeof useTranslations<'ShipmentTracking'>>): string => (
  shipment.shippingLine || shipment.carrier || t('logisticsProviderNone')
);

const getEtaDelayDays = (shipment: PortalShipment): number => {
  const status = normalizeStatus(shipment.status);
  if (!shipment.eta || ['ARRIVED', 'CLOSED'].includes(status)) return 0;

  const eta = new Date(shipment.eta);
  if (Number.isNaN(eta.getTime())) return 0;

  eta.setHours(23, 59, 59, 999);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (eta.getTime() >= today.getTime()) return 0;
  return Math.ceil((today.getTime() - eta.getTime()) / (1000 * 60 * 60 * 24));
};

function ShipmentStatusTag({ status, statusMeta }: { status?: string | null; statusMeta: Record<string, { label: string; color: string; tone: string }> }) {
  const normalizedStatus = normalizeStatus(status);
  const meta = statusMeta[normalizedStatus] || { label: normalizedStatus, color: 'default', tone: '#64748b' };

  return (
    <Tag color={meta.color} style={{ borderRadius: 999, marginInlineEnd: 0, fontWeight: 700 }}>
      {meta.label}
    </Tag>
  );
}

function ShipmentOrderCard({
  shipment,
  selected,
  onSelect,
  t,
  statusMeta,
  defaultTimeline,
  amitLogistics,
}: {
  shipment: PortalShipment;
  selected: boolean;
  onSelect: (shipment: PortalShipment) => void;
  t: ReturnType<typeof useTranslations<'ShipmentTracking'>>;
  statusMeta: Record<string, { label: string; color: string; tone: string }>;
  defaultTimeline: PortalShipmentTimelineItem[];
  amitLogistics: string;
}) {
  const { token } = theme.useToken();
  const timeline = getTimeline(shipment, defaultTimeline);
  const latestEvent = getLatestEvent(timeline);
  const shipmentNumber = getShipmentNumber(shipment);
  const status = normalizeStatus(shipment.status);
  const meta = statusMeta[status] || statusMeta.BOOKED;
  const etaDelayDays = getEtaDelayDays(shipment);

  return (
    <Card
      hoverable
      onClick={() => onSelect(shipment)}
      variant="outlined"
      style={{
        borderRadius: 8,
        borderColor: selected ? token.colorPrimary : token.colorBorderSecondary,
        boxShadow: selected ? `0 0 0 2px ${token.colorPrimaryBg}` : token.boxShadowTertiary,
      }}
      styles={{
        body: { padding: 0 },
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          padding: '12px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
        }}
      >
        <Space size={8} wrap>
          <ShopOutlined style={{ color: token.colorPrimary }} />
          <Text strong>{amitLogistics}</Text>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>{t('erpExport')}</Tag>
        </Space>
        <Space size={8} wrap>
          <Text type="secondary">{shipment.salesContract?.contractNumber || t('noContract')}</Text>
          <ShipmentStatusTag status={shipment.status} statusMeta={statusMeta} />
        </Space>
      </div>

      <div style={{ padding: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} lg={15}>
            <Space align="start" size={14}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  display: 'grid',
                  placeItems: 'center',
                  color: token.colorPrimary,
                  background: token.colorPrimaryBg,
                  border: `1px solid ${token.colorPrimaryBorder}`,
                  flexShrink: 0,
                }}
              >
                <ContainerOutlined style={{ fontSize: 28 }} />
              </div>
              <Space orientation="vertical" size={4}>
                <Text strong style={{ fontSize: 15 }}>{shipmentNumber}</Text>
                <Text type="secondary">
                  {shipment.pol || '?'} <SendOutlined /> {shipment.pod || '?'}
                </Text>
                <Space size={8} wrap>
                  <Text type="secondary">B/L: {shipment.blNumber || '-'}</Text>
                  <Text type="secondary">Booking: {shipment.bookingNumber || '-'}</Text>
                </Space>
                <Text type="secondary">{t('logisticsProvider', { name: getLogisticsProvider(shipment, t) })}</Text>
              </Space>
            </Space>
          </Col>
          <Col xs={24} lg={5}>
            <Space orientation="vertical" size={2}>
              <Text type="secondary">{t('etaExpected')}</Text>
              <Text strong>{formatDate(shipment.eta)}</Text>
              {etaDelayDays > 0 ? (
                <Tag color="error" style={{ marginInlineEnd: 0 }}>
                  {t('lateDays', { n: etaDelayDays })}
                </Tag>
              ) : null}
            </Space>
          </Col>
          <Col xs={24} lg={4} style={{ textAlign: 'right' }}>
            <Text strong style={{ color: meta.tone }}>{meta.label}</Text>
          </Col>
        </Row>

        <div
          style={{
            marginTop: 16,
            padding: '10px 12px',
            borderRadius: 8,
            background: token.colorSuccessBg,
            border: `1px solid ${token.colorSuccessBorder}`,
          }}
        >
          <Space size={8} wrap>
            <TruckOutlined style={{ color: token.colorSuccess }} />
            <Text strong>{latestEvent?.label || t('updatingBill')}</Text>
            <Text type="secondary">{latestEvent?.date ? formatDate(latestEvent.date) : t('noRecordTime')}</Text>
          </Space>
        </div>
      </div>
    </Card>
  );
}

function ShipmentDetailPanel({
  shipment,
  onCreateTicket,
  t,
  statusMeta,
  defaultTimeline,
}: {
  shipment: PortalShipment;
  onCreateTicket: (shipment: PortalShipment) => void;
  t: ReturnType<typeof useTranslations<'ShipmentTracking'>>;
  statusMeta: Record<string, { label: string; color: string; tone: string }>;
  defaultTimeline: PortalShipmentTimelineItem[];
}) {
  const { token } = theme.useToken();
  const timeline = getTimeline(shipment, defaultTimeline);
  const latestEvent = getLatestEvent(timeline);
  const shipmentNumber = getShipmentNumber(shipment);
  const status = normalizeStatus(shipment.status);
  const meta = statusMeta[status] || statusMeta.BOOKED;
  const containers = shipment.containers || [];
  const etaDelayDays = getEtaDelayDays(shipment);
  const handleDocumentDownload = (url?: string | null): void => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card
      variant="outlined"
      style={{ borderRadius: 8, boxShadow: token.boxShadowTertiary }}
      styles={{ body: { padding: 0 } }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 24px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Space orientation="vertical" size={2}>
          <Text type="secondary">{t('shipmentNumber')}</Text>
          <Title level={5} style={{ margin: 0 }}>{shipmentNumber}</Title>
        </Space>
        <Space size={12} wrap>
          <Text strong style={{ color: meta.tone }}>{meta.label}</Text>
          <ShipmentStatusTag status={shipment.status} statusMeta={statusMeta} />
          <Button size="small" icon={<CustomerServiceOutlined />} onClick={() => onCreateTicket(shipment)}>
            {t('createTicket')}
          </Button>
        </Space>
      </div>

      {etaDelayDays > 0 ? (
        <div style={{ padding: '16px 24px 0' }}>
          <Alert
            showIcon
            type="warning"
            icon={<WarningOutlined />}
            title={t('etaDelayedTitle', { n: etaDelayDays })}
            description={t('etaDelayedDesc')}
            action={(
              <Button size="small" type="primary" icon={<CustomerServiceOutlined />} onClick={() => onCreateTicket(shipment)}>
                {t('createTicket')}
              </Button>
            )}
          />
        </div>
      ) : null}

      <div style={{ padding: '26px 24px 18px' }}>
        <Steps
          current={getCurrentStep(timeline)}
          responsive
          items={timeline.map((item) => ({
            title: item.label,
            content: item.date ? formatDate(item.date) : item.status,
            status: item.state,
          }))}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          padding: '16px 24px',
          background: token.colorFillQuaternary,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Space orientation="vertical" size={2}>
          <Text type="secondary">{t('latestUpdate')}</Text>
          <Text strong>{latestEvent?.label || t('syncingStatus')}</Text>
        </Space>
        <Space orientation="vertical" size={2} style={{ textAlign: 'right' }}>
          <Text type="secondary">{t('expectedReceiveDate')}</Text>
          <Text strong>{formatDate(shipment.eta)}</Text>
        </Space>
      </div>

      <Row gutter={[24, 24]} style={{ padding: 24 }}>
        <Col xs={24} xl={10}>
          <Card
            size="small"
            title={<Space><EnvironmentOutlined />{t('routeCard')}</Space>}
            variant="outlined"
            style={{ borderRadius: 8, height: '100%' }}
          >
            <Space orientation="vertical" size={14} style={{ width: '100%' }}>
              <div>
                <Text type="secondary">{t('polPod')}</Text>
                <div style={{ fontWeight: 700 }}>{shipment.pol || '?'} → {shipment.pod || '?'}</div>
              </div>
              <div>
                <Text type="secondary">{t('carrier')}</Text>
                <div style={{ fontWeight: 700 }}>{shipment.shippingLine || shipment.carrier || '-'}</div>
              </div>
              <div>
                <Text type="secondary">{t('vesselVoyage')}</Text>
                <div style={{ fontWeight: 700 }}>{shipment.vesselName || '-'} {shipment.voyageNumber || ''}</div>
              </div>
              <div>
                <Text type="secondary">{t('etdEta')}</Text>
                <div style={{ fontWeight: 700 }}>{formatDate(shipment.etd)} / {formatDate(shipment.eta)}</div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card
            size="small"
            title={<Space><ClockCircleOutlined />{t('historyCard')}</Space>}
            variant="outlined"
            style={{ borderRadius: 8, height: '100%' }}
          >
            <Timeline
              items={timeline.map((item) => ({
                color: item.state === 'finish' ? 'green' : item.state === 'process' ? 'blue' : 'gray',
                icon: item.state === 'process' ? <TruckOutlined /> : undefined,
                content: (
                  <Space orientation="vertical" size={2}>
                    <Text strong>{item.label}</Text>
                    <Text type="secondary">{item.date ? formatDate(item.date) : item.status}</Text>
                  </Space>
                ),
              }))}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            size="small"
            title={<Space><FileTextOutlined />{t('containerDocsCard')}</Space>}
            variant="outlined"
            style={{ borderRadius: 8 }}
          >
            <Space size={8} wrap style={{ marginBottom: 16 }}>
              <Button
                icon={<DownloadOutlined />}
                disabled={!shipment.blFileUrl}
                onClick={() => handleDocumentDownload(shipment.blFileUrl)}
              >
                {t('downloadBl')}
              </Button>
              <Button
                icon={<DownloadOutlined />}
                disabled={!shipment.packingListFileUrl}
                onClick={() => handleDocumentDownload(shipment.packingListFileUrl)}
              >
                {t('downloadPackingList')}
              </Button>
              <Text type="secondary">
                {shipment.blNumber ? `B/L: ${shipment.blNumber}` : t('blNotIssued')}
              </Text>
            </Space>
            {containers.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noContainers')} />
            ) : (
              <Row gutter={[12, 12]}>
                {containers.map((container) => (
                  <Col xs={24} md={12} xl={8} key={container._id}>
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        background: token.colorFillQuaternary,
                      }}
                    >
                      <Space orientation="vertical" size={4}>
                        <Text strong>{container.containerNumber || container.type || t('container')}</Text>
                        <Text type="secondary">{t('seal')}: {container.sealNumber || '-'}</Text>
                        <Text type="secondary">
                          {container.type || '-'} · {Number(container.cbm || 0).toLocaleString('vi-VN')} {t('cbm')}
                        </Text>
                      </Space>
                    </div>
                  </Col>
                ))}
              </Row>
            )}
          </Card>
        </Col>
      </Row>
    </Card>
  );
}

export default function ShipmentTrackingPageContent() {
  const { token } = theme.useToken();
  const t = useTranslations('ShipmentTracking');
  const locale = useLocale();
  const router = useRouter();
  const { shipments, meta, summary, loading, error, fetchShipments } = useCustomerPortalShipments();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ShipmentFilterKey>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedShipment_id, setSelectedShipment_id] = useState<string | null>(null);

  const shipmentLabels = useMemo<ShipmentLabels>(() => ({
    filterAll: t('filterAll'),
    filterBooking: t('filterBooking'),
    filterShipping: t('filterShipping'),
    filterReceiving: t('filterReceiving'),
    filterCompleted: t('filterCompleted'),
    statusBooked: t('statusBooked'),
    statusLoading: t('statusLoading'),
    statusCustomsCleared: t('statusCustomsCleared'),
    statusOnBoard: t('statusOnBoard'),
    statusArrived: t('statusArrived'),
    statusClosed: t('statusClosed'),
    milestoneBooked: t('milestoneBooked'),
    milestoneLoading: t('milestoneLoading'),
    milestoneCustomsCleared: t('milestoneCustomsCleared'),
    milestoneOnBoard: t('milestoneOnBoard'),
    milestoneArrived: t('milestoneArrived'),
    milestoneClosed: t('milestoneClosed'),
  }), [t]);

  const shipmentFilters = useMemo(() => buildShipmentFilters(shipmentLabels), [shipmentLabels]);
  const statusMeta = useMemo(() => buildStatusMeta(shipmentLabels), [shipmentLabels]);
  const defaultTimeline = useMemo(() => buildDefaultTimeline(shipmentLabels), [shipmentLabels]);
  const amitLogistics = t('amitLogistics');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setCurrentPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  const shipmentQuery = useMemo(() => {
    const filter = shipmentFilters.find((item) => item.key === activeFilter);
    const status = filter?.statuses.length ? filter.statuses.join(',') : undefined;

    return {
      current: currentPage,
      pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status ? { status } : {}),
    };
  }, [activeFilter, currentPage, debouncedSearch, pageSize, shipmentFilters]);

  useEffect(() => {
    fetchShipments(shipmentQuery);
  }, [fetchShipments, shipmentQuery]);

  useEffect(() => {
    if (shipments.length === 0) {
      setSelectedShipment_id(null);
      return;
    }

    // Only auto-select first shipment when current selection is invalid
    // This prevents unnecessary re-renders when selectedShipment_id changes
    if (!selectedShipment_id || !shipments.some((shipment) => shipment._id === selectedShipment_id)) {
      setSelectedShipment_id(shipments[0]._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipments.length]); // Only depend on length to avoid infinite loop

  const selectedShipment = useMemo(() => {
    return shipments.find((shipment) => shipment._id === selectedShipment_id) || null;
  }, [shipments, selectedShipment_id]);

  const handleFilterChange = (filterKey: ShipmentFilterKey) => {
    setActiveFilter(filterKey);
    setCurrentPage(1);
    setSelectedShipment_id(null);
  };

  const handleRefresh = () => {
    fetchShipments(shipmentQuery);
  };

  const handlePageChange = (nextPage: number, nextPageSize: number) => {
    setCurrentPage(nextPage);
    setPageSize(nextPageSize);
    setSelectedShipment_id(null);
  };

  const handleCreateTicket = (shipment: PortalShipment): void => {
    const shipmentNumber = getShipmentNumber(shipment);
    const params = new URLSearchParams({
      category: 'LOGISTICS',
      priority: getEtaDelayDays(shipment) > 0 ? 'HIGH' : 'MEDIUM',
      shipmentId: shipment._id,
      subject: t('ticketSubject', { number: shipmentNumber }),
      message: [
        t('ticketMessageShipment', { number: shipmentNumber }),
        t('ticketMessageContract', { value: shipment.salesContract?.contractNumber || '-' }),
        t('ticketMessageRoute', { pol: shipment.pol || '-', pod: shipment.pod || '-' }),
        t('ticketMessageLogistics', { name: getLogisticsProvider(shipment, t) }),
        t('ticketMessageBooking', { value: shipment.bookingNumber || '-' }),
        t('ticketMessageBl', { value: shipment.blNumber || '-' }),
        t('ticketMessageEtdEta', { etd: formatDate(shipment.etd), eta: formatDate(shipment.eta) }),
        '',
        t('ticketMessageAsk'),
      ].join('\n'),
    });

    router.push(`/${locale}/dashboard/portal/tickets?${params.toString()}`);
  };

  const resultSummary = useMemo(() => {
    if (meta.total === 0) return t('noResults');

    const start = (meta.current - 1) * meta.pageSize + 1;
    const end = Math.min(meta.current * meta.pageSize, meta.total);
    return t('showRange', { start, end, total: meta.total });
  }, [meta, t]);

  const getFilterCount = (filter: { key: ShipmentFilterKey; statuses: string[] }) => {
    if (filter.key === 'all') return summary.total;

    return filter.statuses.reduce((sum, status) => sum + (summary.statusCounts[status] || 0), 0);
  };

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('headerTitle')}
        icon={<TruckOutlined />}
        description={t('headerDesc')}
        extra={(
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            {t('refresh')}
          </Button>
        )}
      />

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {error && (
          <Alert
            showIcon
            type="error"
            title={t('errorTitle')}
            description={error}
            action={<Button size="small" onClick={handleRefresh}>{t('retry')}</Button>}
          />
        )}

        <Card
          variant="borderless"
          style={{ borderRadius: 8, boxShadow: token.boxShadowTertiary }}
          styles={{ body: { padding: 0 } }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '14px 18px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Space size={10} wrap>
              <Badge status="processing" />
              <Text strong>{t('trackingChannel')}</Text>
              <Text type="secondary">{resultSummary}</Text>
            </Space>
            <Input
              allowClear
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              prefix={<SearchOutlined />}
              placeholder={t('searchPlaceholder')}
              style={{ width: 420, maxWidth: '100%' }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
            className="shipment-tracking-tabs"
          >
            {shipmentFilters.map((filter) => {
              const active = activeFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => handleFilterChange(filter.key)}
                  className="shipment-tracking-tab"
                  style={{
                    minHeight: 54,
                    padding: '8px 6px',
                    border: 0,
                    borderRight: `1px solid ${token.colorBorderSecondary}`,
                    borderBottom: active ? `3px solid ${token.colorPrimary}` : '3px solid transparent',
                    color: active ? token.colorPrimary : token.colorText,
                    background: active ? token.colorPrimaryBg : token.colorBgContainer,
                    cursor: 'pointer',
                    fontWeight: active ? 700 : 500,
                    fontSize: 13,
                    lineHeight: 1.3,
                    textAlign: 'center',
                    whiteSpace: 'normal',
                    overflowWrap: 'break-word',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {filter.label} ({getFilterCount(filter)})
                </button>
              );
            })}
          </div>
        </Card>

        {loading ? (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            {[1, 2, 3].map((item) => (
              <Card key={item} variant="borderless" style={{ borderRadius: 8 }}>
                <Skeleton active paragraph={{ rows: 3 }} />
              </Card>
            ))}
          </Space>
        ) : shipments.length === 0 ? (
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={(
                <Space orientation="vertical" size={4}>
                  <Text strong>{t('emptyTitle')}</Text>
                  <Text type="secondary">{t('emptyDesc')}</Text>
                </Space>
              )}
            />
          </Card>
        ) : (
          <Row gutter={[16, 16]} align="stretch">
            <Col xs={24} xl={8} style={{ display: 'flex', flexDirection: 'column' }}>
              <Space orientation="vertical" size={12} style={{ width: '100%', height: '100%', overflowY: 'auto' }}>
                {shipments.map((shipment) => (
                  <ShipmentOrderCard
                    key={shipment._id}
                    shipment={shipment}
                    selected={shipment._id === selectedShipment_id}
                    onSelect={(record) => setSelectedShipment_id(record._id)}
                    t={t}
                    statusMeta={statusMeta}
                    defaultTimeline={defaultTimeline}
                    amitLogistics={amitLogistics}
                  />
                ))}
              </Space>
            </Col>
            <Col xs={24} xl={16} style={{ display: 'flex', flexDirection: 'column' }}>
              {selectedShipment ? (
                <div style={{ height: '100%' }}>
                  <ShipmentDetailPanel
                    shipment={selectedShipment}
                    onCreateTicket={handleCreateTicket}
                    t={t}
                    statusMeta={statusMeta}
                    defaultTimeline={defaultTimeline}
                  />
                </div>
              ) : (
                <Card variant="borderless" style={{ borderRadius: 8, height: '100%' }}>
                  <Empty description={t('selectDetail')} />
                </Card>
              )}
            </Col>
          </Row>
        )}

        {!loading && meta.total > 0 && (
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Pagination
                current={meta.current}
                pageSize={meta.pageSize}
                total={meta.total}
                showSizeChanger
                pageSizeOptions={[10, 20, 50]}
                showTotal={(total) => t('paginationTotal', { total })}
                onChange={handlePageChange}
              />
            </div>
          </Card>
        )}
      </Space>
    </AdminPageScroll>
  );
}
