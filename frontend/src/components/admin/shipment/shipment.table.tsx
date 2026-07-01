'use client'

import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  Pagination,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Space,
  Steps,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ContainerOutlined,
  DeleteTwoTone,
  DeploymentUnitOutlined,
  EnvironmentOutlined,
  EyeTwoTone,
  FilePdfOutlined,
  FileDoneOutlined,
  FilterOutlined,
  GlobalOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TruckOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { useTheme } from '@/context/theme.context';

import ShipmentDetailDrawer from './shipment.detail';
import ShipmentDocCenter from './shipment.doc-center';
import { useDebounce } from '@/hooks/useDebounce';
import { useShipments } from '@/hooks/useShipments';
import { SHIPMENT_STATUS_CONFIG, SHIPMENT_STATUS_KEYS } from '@/constants/o2c';
import type { IShipment, ShipmentStatus } from '@/types/o2c';

import type { Session } from 'next-auth';

const { Text, Title } = Typography;

interface IProps {
  session: Session | null;
}

type ShipmentFilters = {
  status?: ShipmentStatus;
  pol?: string;
  pod?: string;
};

type StepState = 'wait' | 'process' | 'finish';

const SHIPMENT_FLOW: ShipmentStatus[] = [
  'BOOKED',
  'LOADING',
  'CUSTOMS_CLEARED',
  'ON_BOARD',
  'ARRIVED',
  'CLOSED',
];

const DELAY_CHECK_STATUSES: ShipmentStatus[] = [
  'BOOKED',
  'LOADING',
  'CUSTOMS_CLEARED',
];

const STATUS_TONE: Record<ShipmentStatus, string> = {
  BOOKED: '#2563eb',
  LOADING: '#d97706',
  CUSTOMS_CLEARED: '#0f766e',
  ON_BOARD: '#4f46e5',
  ARRIVED: '#16a34a',
  CLOSED: '#64748b',
};

const normalizeFilters = (values: ShipmentFilters): ShipmentFilters => ({
  ...(values.status ? { status: values.status } : {}),
  ...(values.pol?.trim() ? { pol: values.pol.trim() } : {}),
  ...(values.pod?.trim() ? { pod: values.pod.trim() } : {}),
});

const getStepState = (status: ShipmentStatus, index: number): StepState => {
  const currentIndex = SHIPMENT_FLOW.indexOf(status);
  if (status === 'CLOSED' || index < currentIndex) return 'finish';
  if (index === currentIndex) return 'process';
  return 'wait';
};

const getShipmentProgress = (status: ShipmentStatus): number => {
  const currentIndex = SHIPMENT_FLOW.indexOf(status);
  if (currentIndex < 0) return 0;
  return Math.round((currentIndex / (SHIPMENT_FLOW.length - 1)) * 100);
};

const isShipmentMilestoneReached = (shipmentStatus: ShipmentStatus, milestoneStatus: ShipmentStatus): boolean => {
  return SHIPMENT_FLOW.indexOf(shipmentStatus) >= SHIPMENT_FLOW.indexOf(milestoneStatus);
};

const ShipmentTable = ({ session }: IProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const tStatus = useTranslations('ShipmentStatus');
  const tTable = useTranslations('ShipmentTable');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const dateLocale = locale === 'vi' ? 'vi-VN' : 'en-US';

  const current = Number(searchParams.get('current') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '10');
  const trackingShipmentId = searchParams.get('shipment_id');

  const [searchInput, setSearchInput] = useState<string>('');
  const debouncedSearchText = useDebounce(searchInput, 500);

  const { data, meta, stats, loading, error, fetchShipments, deleteShipment, issueStock } = useShipments();

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(null);
  const [docCenterOpen, setDocCenterOpen] = useState(false);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentTimeIso, setCurrentTimeIso] = useState<string | null>(null);
  const [filters, setFilters] = useState<ShipmentFilters>({});
  const [filterForm] = Form.useForm<ShipmentFilters>();

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const activeStatus = filters.status ?? 'ALL';

  const panelStyle = useMemo(() => ({
    background: isDark ? '#0f172a' : token.colorBgContainer,
    border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.24)' : token.colorBorderSecondary}`,
    boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.32)' : '0 10px 30px rgba(15,23,42,0.06)',
  }), [isDark, token.colorBgContainer, token.colorBorderSecondary]);

  const textColor = isDark ? '#e5e7eb' : token.colorText;
  const mutedTextColor = isDark ? '#cbd5e1' : token.colorTextSecondary;
  const cardHeaderBg = isDark ? 'rgba(15, 23, 42, 0.96)' : '#fff7ed';
  const cardBodyBg = isDark ? '#0f172a' : '#ffffff';
  const softPanelBg = isDark ? 'rgba(30, 41, 59, 0.76)' : '#fff7ed';
  const routePanelBg = isDark ? 'rgba(15, 23, 42, 0.9)' : '#fffaf5';
  const accentColor = '#ee4d2d';
  const compactRadius = 8;

  const statusCounts = stats.statusCounts;

  const shipmentOverview = useMemo(() => {
    return {
      activeShipments: Math.max(stats.total - stats.closed, 0),
    };
  }, [stats.closed, stats.total]);

  const activeShipment = useMemo(() => {
    if (!activeShipmentId) return data[0] ?? null;
    return data.find((shipment) => shipment._id === activeShipmentId) ?? data[0] ?? null;
  }, [activeShipmentId, data]);

  const bookingTiles = useMemo(() => ([
    {
      status: 'BOOKED' as const,
      value: statusCounts.BOOKED,
      icon: <PlusOutlined />,
      tone: STATUS_TONE.BOOKED,
    },
    {
      status: 'LOADING' as const,
      value: statusCounts.LOADING,
      icon: <FileDoneOutlined />,
      tone: STATUS_TONE.LOADING,
    },
    {
      status: 'CUSTOMS_CLEARED' as const,
      value: statusCounts.CUSTOMS_CLEARED,
      icon: <ClockCircleOutlined />,
      tone: STATUS_TONE.CUSTOMS_CLEARED,
    },
    {
      status: 'ON_BOARD' as const,
      value: statusCounts.ON_BOARD,
      icon: <CheckCircleOutlined />,
      tone: STATUS_TONE.ON_BOARD,
    },
    {
      status: 'ARRIVED' as const,
      value: statusCounts.ARRIVED,
      icon: <WarningOutlined />,
      tone: STATUS_TONE.ARRIVED,
    },
    {
      status: 'CLOSED' as const,
      value: statusCounts.CLOSED,
      icon: <TruckOutlined />,
      tone: STATUS_TONE.CLOSED,
    },
  ]), [statusCounts]);

  const bookingTotal = stats.total;

  const formatDate = useCallback((date?: string) => {
    return date ? new Date(date).toLocaleDateString(dateLocale) : '-';
  }, [dateLocale]);

  const replacePagination = useCallback((nextCurrent: number, nextPageSize = pageSize) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('current', String(nextCurrent));
    params.set('pageSize', String(nextPageSize));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pageSize, pathname, router, searchParams]);

  const replaceTrackingShipment = useCallback((shipmentId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (shipmentId) {
      params.set('shipment_id', shipmentId);
    } else {
      params.delete('shipment_id');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const reloadShipments = useCallback(() => {
    fetchShipments({
      current,
      pageSize,
      search: debouncedSearchText || undefined,
      sort: '-createdAt',
      ...filters,
    });
  }, [current, debouncedSearchText, fetchShipments, filters, pageSize]);

  useEffect(() => {
    setCurrentTimeIso(new Date().toISOString());
  }, []);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setSelectedShipmentId(id);
      setDetailOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (trackingShipmentId && trackingShipmentId !== activeShipmentId) {
      setActiveShipmentId(trackingShipmentId);
    }
  }, [activeShipmentId, trackingShipmentId]);

  useEffect(() => {
    reloadShipments();
  }, [reloadShipments]);

  useEffect(() => {
    if (loading) return;

    if (data.length === 0) {
      if (activeShipmentId !== null) {
        setActiveShipmentId(null);
      }
      if (trackingShipmentId) {
        replaceTrackingShipment(null);
      }
      return;
    }

    const preferredShipmentId = trackingShipmentId ?? activeShipmentId;
    const hasPreferredShipment = data.some((shipment) => shipment._id === preferredShipmentId);
    if (hasPreferredShipment && preferredShipmentId) {
      if (activeShipmentId !== preferredShipmentId) {
        setActiveShipmentId(preferredShipmentId);
      }
      return;
    }

    const nextShipmentId = data[0]._id;
    setActiveShipmentId(nextShipmentId);
    if (trackingShipmentId !== nextShipmentId) {
      replaceTrackingShipment(nextShipmentId);
    }
  }, [activeShipmentId, data, loading, replaceTrackingShipment, trackingShipmentId]);

  const handleDelete = useCallback((shipmentId: string) => {
    deleteShipment(shipmentId, reloadShipments);
  }, [deleteShipment, reloadShipments]);

  const handleIssueStock = useCallback((shipmentId: string) => {
    issueStock(shipmentId, reloadShipments);
  }, [issueStock, reloadShipments]);

  const handleStatusFilter = useCallback((status?: ShipmentStatus) => {
    const nextFilters = normalizeFilters({ ...filters, status });
    setFilters(nextFilters);
    filterForm.setFieldsValue({ status });
    replacePagination(1);
  }, [filterForm, filters, replacePagination]);

  const onFilterFinish = (values: ShipmentFilters) => {
    const nextFilters = normalizeFilters(values);
    setFilters(nextFilters);
    filterForm.setFieldsValue(nextFilters);
    setIsFilterOpen(false);
    replacePagination(1);
  };

  const handleResetFilters = () => {
    filterForm.resetFields();
    setFilters({});
    setIsFilterOpen(false);
    replacePagination(1);
  };

  const openDetail = (shipmentId: string) => {
    setSelectedShipmentId(shipmentId);
    setDetailOpen(true);
  };

  const selectShipmentForTracking = (shipmentId: string) => {
    setActiveShipmentId(shipmentId);
    replaceTrackingShipment(shipmentId);
  };

  const openDocCenter = (shipmentId: string) => {
    setSelectedShipmentId(shipmentId);
    setDocCenterOpen(true);
  };

  const getDelayDays = useCallback((shipment: IShipment): number => {
    if (!currentTimeIso || !shipment.etd || !DELAY_CHECK_STATUSES.includes(shipment.status)) {
      return 0;
    }

    const etdTime = new Date(shipment.etd).getTime();
    const currentTime = new Date(currentTimeIso).getTime();
    if (Number.isNaN(etdTime) || etdTime >= currentTime) return 0;

    return Math.max(1, Math.ceil((currentTime - etdTime) / 86_400_000));
  }, [currentTimeIso]);

  const getLoadingUnitLabel = useCallback((shipment: IShipment) => {
    const containers = shipment.containers ?? [];
    if (containers.length === 0) {
      return {
        label: tTable('loadingUnit.none'),
        color: 'warning',
      };
    }

    const hasOnlyLcl = containers.every((container) => container.type === 'LCL');
    if (hasOnlyLcl) {
      const totalCbm = containers.reduce((total, container) => total + (container.cbm ?? 0), 0);
      const totalWeight = containers.reduce((total, container) => total + (container.weightKg ?? 0), 0);
      return {
        label: tTable('loadingUnit.lcl', {
          cbm: Number(totalCbm.toFixed(2)),
          weight: Number(totalWeight.toFixed(2)),
        }),
        color: 'cyan',
      };
    }

    return {
      label: tTable('loadingUnit.containers', { count: containers.length }),
      color: 'blue',
    };
  }, [tTable]);

  const renderMetricCard = (
    title: string,
    value: number,
    helper: string,
    icon: ReactNode,
    tone: string,
  ) => (
    <Card
      variant="borderless"
      style={{ ...panelStyle, borderRadius: compactRadius, height: '100%' }}
      styles={{ body: { padding: 20 } }}
    >
      <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Text style={{ color: mutedTextColor, fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
            {title}
          </Text>
          <Title level={1} style={{ color: textColor, margin: '8px 0 2px', lineHeight: 1, fontSize: 38, fontWeight: 900 }}>
            {value}
          </Title>
          <Text style={{ color: mutedTextColor, fontSize: 13 }}>{helper}</Text>
        </div>
        <div style={{
          width: 46,
          height: 46,
          borderRadius: compactRadius,
          display: 'grid',
          placeItems: 'center',
          color: tone,
          background: isDark ? 'rgba(148, 163, 184, 0.12)' : `${tone}14`,
          fontSize: 19,
        }}>
          {icon}
        </div>
      </Space>
    </Card>
  );

  const renderDateUpdatesPanel = () => (
    <Card
      title={
        <Space>
          <CalendarOutlined />
          <span>{tTable('dashboard.dateUpdates')}</span>
        </Space>
      }
      variant="borderless"
      style={{ ...panelStyle, borderRadius: compactRadius, height: '100%' }}
      styles={{ header: { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.12)' : token.colorBorderSecondary } }}
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {[
          { label: tTable('dashboard.etaUpdates'), value: statusCounts.ON_BOARD + statusCounts.ARRIVED, icon: <ClockCircleOutlined />, tone: '#2563eb' },
          { label: tTable('dashboard.etdUpdates'), value: statusCounts.BOOKED + statusCounts.LOADING, icon: <DeploymentUnitOutlined />, tone: '#0f766e' },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: 16,
              borderRadius: compactRadius,
              background: isDark ? 'rgba(30, 41, 59, 0.72)' : '#f8fafc',
              border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.12)' : '#e2e8f0'}`,
            }}
          >
            <div style={{
              width: 44,
              height: 44,
              borderRadius: compactRadius,
              display: 'grid',
              placeItems: 'center',
              color: item.tone,
              background: isDark ? 'rgba(148, 163, 184, 0.12)' : `${item.tone}12`,
              fontSize: 18,
            }}>
              {item.icon}
            </div>
            <div>
              <Text style={{ color: mutedTextColor }}>{item.label}</Text>
              <Title level={2} style={{ color: textColor, margin: 0, fontWeight: 900 }}>{item.value}</Title>
            </div>
          </div>
        ))}
      </Space>
    </Card>
  );

  const renderBookingPanel = () => (
    <Card
      title={
        <Space>
          <FileDoneOutlined />
          <span>{tTable('dashboard.booking')}</span>
        </Space>
      }
      variant="borderless"
      style={{ ...panelStyle, borderRadius: compactRadius, height: '100%' }}
      styles={{ header: { borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.12)' : token.colorBorderSecondary } }}
    >
      <div style={{
        padding: 14,
        borderRadius: compactRadius,
        background: isDark ? 'rgba(15, 23, 42, 0.62)' : '#f8fafc',
        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.14)' : '#e2e8f0'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
          <div>
            <Text style={{ color: mutedTextColor, fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
              {tTable('dashboard.bookingSummary')}
            </Text>
            <Title level={2} style={{ color: textColor, margin: '4px 0 0', fontWeight: 900 }}>
              {bookingTotal}
            </Title>
          </div>
          <Tag color={bookingTotal > 0 ? 'processing' : 'default'} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
            {tTable('dashboard.totalBookingSignals', { count: bookingTotal })}
          </Tag>
        </div>

        <div style={{
          display: 'flex',
          height: 12,
          overflow: 'hidden',
          borderRadius: 999,
          background: isDark ? 'rgba(148, 163, 184, 0.16)' : '#e2e8f0',
        }}>
          {bookingTotal > 0 ? bookingTiles.filter((item) => item.value > 0).map((item) => (
            <div
              key={item.status}
              style={{
                width: `${Math.max((item.value / bookingTotal) * 100, 6)}%`,
                background: item.tone,
              }}
            />
          )) : (
            <div style={{ width: '100%', background: isDark ? 'rgba(148, 163, 184, 0.26)' : '#cbd5e1' }} />
          )}
        </div>
      </div>

      <Row gutter={[12, 10]} style={{ marginTop: 16 }}>
        {bookingTiles.map((item) => (
          <Col xs={24} md={12} key={item.status}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '18px minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.1)' : '#eef2f7'}`,
            }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.tone }} />
              <Space size={8}>
                <span style={{ color: item.tone, display: 'inline-flex' }}>{item.icon}</span>
                <Text style={{ color: textColor, fontWeight: 700 }}>
                  {tStatus(item.status)}
                </Text>
              </Space>
              <Text strong style={{ color: textColor, fontSize: 18 }}>{item.value}</Text>
            </div>
          </Col>
        ))}
      </Row>
    </Card>
  );

  const renderTrackingPanel = () => {
    if (loading) {
      return (
        <Card
          title={
            <Space>
              <GlobalOutlined />
              <span>{tTable('dashboard.activeShipments', { total: meta.total })}</span>
            </Space>
          }
          variant="borderless"
          style={{ ...panelStyle, borderRadius: compactRadius }}
          styles={{ body: { padding: 18 } }}
        >
          <Skeleton active paragraph={{ rows: 7 }} />
        </Card>
      );
    }

    if (!activeShipment) {
      return (
        <Card
          title={
            <Space>
              <GlobalOutlined />
              <span>{tTable('dashboard.activeShipments', { total: meta.total })}</span>
            </Space>
          }
          variant="borderless"
          style={{ ...panelStyle, borderRadius: compactRadius }}
          styles={{ body: { padding: 48 } }}
        >
          <Empty description={tTable('empty.noTrackedShipment')} />
        </Card>
      );
    }

    const progress = getShipmentProgress(activeShipment.status);
    const pol = activeShipment.pol || 'POL';
    const pod = activeShipment.pod || 'POD';
    const originReached = isShipmentMilestoneReached(activeShipment.status, 'ON_BOARD');
    const destinationReached = isShipmentMilestoneReached(activeShipment.status, 'ARRIVED');
    const statusTone = STATUS_TONE[activeShipment.status];
    const containerCount = activeShipment.containers?.length ?? 0;
    const checklistValues = Object.values(activeShipment.documentChecklist ?? {});
    const completedDocumentCount = checklistValues.filter((item) => item === 'DONE').length;
    const totalDocumentCount = checklistValues.length;
    const etaDate = activeShipment.eta ? new Date(activeShipment.eta) : null;
    const etaDaysLeft = etaDate && currentTimeIso
      ? Math.ceil((etaDate.getTime() - new Date(currentTimeIso).getTime()) / 86400000)
      : null;
    const etaLabel = etaDaysLeft === null
      ? '-'
      : etaDaysLeft < 0
        ? `${Math.abs(etaDaysLeft)}d late`
        : etaDaysLeft === 0
          ? 'Today'
          : `${etaDaysLeft}d left`;
    const routeProgressLeft = Math.min(82, Math.max(12, 12 + progress * 0.7));
    const metricItems: Array<{ label: string; value: ReactNode; icon: ReactNode; color: string }> = [
      {
        label: tTable('dashboard.metricStatus'),
        value: tStatus(activeShipment.status),
        icon: <CheckCircleOutlined />,
        color: statusTone,
      },
      {
        label: 'ETA',
        value: formatDate(activeShipment.eta),
        icon: <CalendarOutlined />,
        color: etaDaysLeft !== null && etaDaysLeft < 0 ? '#dc2626' : '#2563eb',
      },
      {
        label: tTable('dashboard.metricContainers'),
        value: containerCount,
        icon: <ContainerOutlined />,
        color: '#0f766e',
      },
      {
        label: tTable('dashboard.metricDocuments'),
        value: totalDocumentCount > 0 ? `${completedDocumentCount}/${totalDocumentCount}` : '-',
        icon: <FileDoneOutlined />,
        color: '#7c3aed',
      },
    ];

    return (
      <Card
        title={
          <Space size={10}>
            <span style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              display: 'inline-grid',
              placeItems: 'center',
              color: '#fff',
              background: 'linear-gradient(135deg, #2563eb 0%, #0f766e 100%)',
              boxShadow: '0 10px 24px rgba(37,99,235,.28)',
            }}>
              <GlobalOutlined />
            </span>
            <span style={{ fontWeight: 900 }}>{tTable('dashboard.activeShipments', { total: meta.total })}</span>
          </Space>
        }
        extra={(
          <Button type="link" onClick={() => openDetail(activeShipment._id)} style={{ paddingInline: 0, fontWeight: 900 }}>
            {activeShipment.shipmentNumber}
          </Button>
        )}
        variant="borderless"
        style={{
          ...panelStyle,
          borderRadius: compactRadius,
          overflow: 'hidden',
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{
          padding: 18,
          background: isDark
            ? 'linear-gradient(180deg, rgba(15,23,42,.96) 0%, rgba(15,23,42,.82) 100%)'
            : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        }}>
          <Row gutter={[12, 12]}>
            {metricItems.map((item) => (
              <Col xs={12} lg={6} key={item.label}>
                <div style={{
                  height: '100%',
                  minHeight: 82,
                  padding: 12,
                  borderRadius: compactRadius,
                  background: isDark ? 'rgba(15,23,42,.72)' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(148,163,184,.14)' : '#e2e8f0'}`,
                  boxShadow: isDark ? 'none' : '0 8px 22px rgba(15,23,42,.05)',
                }}>
                  <Space size={10} align="start">
                    <span style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      display: 'inline-grid',
                      placeItems: 'center',
                      color: item.color,
                      background: `${item.color}14`,
                    }}>
                      {item.icon}
                    </span>
                    <span>
                      <Text style={{ color: mutedTextColor, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                        {item.label}
                      </Text>
                      <div style={{ color: textColor, fontSize: 16, fontWeight: 900, lineHeight: 1.35 }}>
                        {item.value}
                      </div>
                    </span>
                  </Space>
                </div>
              </Col>
            ))}
          </Row>

          <div style={{
            position: 'relative',
            overflow: 'hidden',
            minHeight: 300,
            marginTop: 14,
            borderRadius: compactRadius,
            border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.18)' : '#bfdbfe'}`,
            background: isDark
              ? 'radial-gradient(circle at 86% 18%, rgba(14,165,233,.2), transparent 32%), linear-gradient(135deg, #0f172a 0%, #111827 54%, #082f49 100%)'
              : 'radial-gradient(circle at 86% 18%, rgba(14,165,233,.2), transparent 30%), linear-gradient(135deg, #eff6ff 0%, #ecfeff 48%, #ffffff 100%)',
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              opacity: isDark ? 0.2 : 0.5,
              backgroundImage: 'linear-gradient(rgba(37,99,235,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,.22) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }} />
            <div style={{
              position: 'absolute',
              inset: 18,
              borderRadius: compactRadius,
              border: `1px solid ${isDark ? 'rgba(255,255,255,.06)' : 'rgba(37,99,235,.08)'}`,
            }} />
            <div style={{
              position: 'absolute',
              left: 24,
              top: 22,
              right: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <Space size={8} wrap>
                <Tag color="processing" style={{ borderRadius: 999, fontWeight: 800, marginInlineEnd: 0 }}>
                  {progress}% route
                </Tag>
                <Tag color={etaDaysLeft !== null && etaDaysLeft < 0 ? 'error' : 'blue'} style={{ borderRadius: 999, fontWeight: 800, marginInlineEnd: 0 }}>
                  ETA {etaLabel}
                </Tag>
              </Space>
              <Text style={{ color: isDark ? '#bfdbfe' : '#1d4ed8', fontWeight: 900 }}>
                {activeShipment.bookingNumber || activeShipment.blNumber || activeShipment.shipmentNumber}
              </Text>
            </div>
            <div style={{
              position: 'absolute',
              left: '12%',
              right: '12%',
              top: '48%',
              height: 3,
              borderRadius: 999,
              background: isDark ? 'rgba(96,165,250,.24)' : 'rgba(37,99,235,.18)',
            }} />
            <div style={{
              position: 'absolute',
              left: '12%',
              top: '48%',
              width: `${Math.max(progress, 4) * 0.76}%`,
              maxWidth: '76%',
              height: 3,
              borderRadius: 999,
              background: `linear-gradient(90deg, #2563eb 0%, ${statusTone} 100%)`,
              boxShadow: '0 0 22px rgba(37,99,235,.32)',
            }} />
            <div style={{
              position: 'absolute',
              left: '12%',
              top: 'calc(48% - 8px)',
              width: 19,
              height: 19,
              borderRadius: '50%',
              background: originReached ? '#16a34a' : '#94a3b8',
              border: `4px solid ${isDark ? '#0f172a' : '#ffffff'}`,
              boxShadow: originReached ? '0 0 0 7px rgba(22,163,74,.16)' : '0 0 0 7px rgba(148,163,184,.16)',
            }} />
            <div style={{
              position: 'absolute',
              right: '12%',
              top: 'calc(48% - 8px)',
              width: 19,
              height: 19,
              borderRadius: '50%',
              background: destinationReached ? '#16a34a' : '#94a3b8',
              border: `4px solid ${isDark ? '#0f172a' : '#ffffff'}`,
              boxShadow: destinationReached ? '0 0 0 7px rgba(22,163,74,.16)' : '0 0 0 7px rgba(148,163,184,.16)',
            }} />
            <div style={{
              position: 'absolute',
              left: `${routeProgressLeft}%`,
              top: 'calc(48% - 25px)',
              width: 50,
              height: 50,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              transform: 'translateX(-50%)',
              background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${statusTone} 100%)`,
              color: '#fff',
              boxShadow: '0 18px 34px rgba(37,99,235,.32)',
              fontSize: 23,
            }}>
              <TruckOutlined />
            </div>
            <div style={{
              position: 'absolute',
              left: 24,
              bottom: 22,
              width: 'min(42%, 360px)',
              padding: 16,
              borderRadius: compactRadius,
              background: isDark ? 'rgba(15,23,42,.78)' : 'rgba(255,255,255,.86)',
              border: `1px solid ${isDark ? 'rgba(148,163,184,.16)' : 'rgba(37,99,235,.16)'}`,
              backdropFilter: 'blur(12px)',
              boxShadow: isDark ? 'none' : '0 16px 34px rgba(15,23,42,.08)',
            }}>
              <Text style={{ color: mutedTextColor, fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
                {tTable('dashboard.originPort')}
              </Text>
              <Title level={4} style={{ color: textColor, margin: '4px 0 6px', fontWeight: 900 }}>
                {pol}
              </Title>
              <Text style={{ color: mutedTextColor, fontSize: 12, fontWeight: 700 }}>
                ETD {formatDate(activeShipment.etd)}
              </Text>
            </div>
            <div style={{
              position: 'absolute',
              right: 24,
              bottom: 22,
              width: 'min(42%, 360px)',
              padding: 16,
              borderRadius: compactRadius,
              background: isDark ? 'rgba(15,23,42,.78)' : 'rgba(255,255,255,.86)',
              border: `1px solid ${isDark ? 'rgba(148,163,184,.16)' : 'rgba(37,99,235,.16)'}`,
              backdropFilter: 'blur(12px)',
              boxShadow: isDark ? 'none' : '0 16px 34px rgba(15,23,42,.08)',
              textAlign: 'right',
            }}>
              <Text style={{ color: mutedTextColor, fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
                {tTable('dashboard.destinationPort')}
              </Text>
              <Title level={4} style={{ color: textColor, margin: '4px 0 6px', fontWeight: 900 }}>
                {pod}
              </Title>
              <Text style={{ color: mutedTextColor, fontSize: 12, fontWeight: 700 }}>
                ETA {formatDate(activeShipment.eta)}
              </Text>
            </div>
          </div>

        <Row gutter={[12, 12]} style={{ marginTop: 14 }}>
          {SHIPMENT_FLOW.map((status) => {
            const reached = isShipmentMilestoneReached(activeShipment.status, status);
            const isCurrent = activeShipment.status === status;
            return (
            <Col xs={12} md={8} xl={4} key={status}>
              <div style={{
                minHeight: 92,
                padding: 12,
                borderRadius: compactRadius,
                background: reached
                  ? isDark ? 'rgba(37, 99, 235, 0.18)' : '#eff6ff'
                  : isDark ? 'rgba(30, 41, 59, 0.72)' : '#f8fafc',
                border: `1px solid ${isCurrent ? STATUS_TONE[status] : isDark ? 'rgba(148, 163, 184, 0.12)' : '#e2e8f0'}`,
                boxShadow: isCurrent ? `0 0 0 2px ${STATUS_TONE[status]}22` : 'none',
              }}>
                <Text style={{ color: reached ? textColor : mutedTextColor, fontSize: 12, fontWeight: reached ? 800 : 600 }}>
                  {tStatus(status)}
                </Text>
                <Title level={4} style={{ color: reached ? STATUS_TONE[status] : mutedTextColor, margin: '2px 0 0' }}>
                  {reached ? 1 : 0}
                </Title>
                {isCurrent ? (
                  <Text style={{ color: STATUS_TONE[status], fontSize: 11, fontWeight: 800 }}>
                    {tTable('dashboard.currentMilestone')}
                  </Text>
                ) : null}
              </div>
            </Col>
          )})}
        </Row>
        </div>
      </Card>
    );
  };

  const renderStatusFilter = () => {
    const options: Array<{ key: ShipmentStatus | 'ALL'; label: string }> = [
      { key: 'ALL', label: tTable('table.allStatus') },
      ...SHIPMENT_STATUS_KEYS.map((status) => ({ key: status, label: tStatus(status) })),
    ];

    return (
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {options.map((option) => {
          const selected = activeStatus === option.key;
          return (
            <Button
              key={option.key}
              type={selected ? 'primary' : 'default'}
              size="middle"
              onClick={() => handleStatusFilter(option.key === 'ALL' ? undefined : option.key)}
              style={{
                borderRadius: 999,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                borderColor: selected ? accentColor : isDark ? 'rgba(148, 163, 184, 0.22)' : '#fed7aa',
                background: selected ? accentColor : isDark ? 'rgba(15, 23, 42, 0.8)' : '#fff7ed',
                color: selected ? '#fff' : mutedTextColor,
              }}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    );
  };

  const renderShipmentTimeline = (shipment: IShipment) => {
    const currentIndex = Math.max(SHIPMENT_FLOW.indexOf(shipment.status), 0);

    return (
      <Steps
        responsive
        size="small"
        current={currentIndex}
        items={SHIPMENT_FLOW.map((status, index) => ({
          title: (
            <span style={{
              color: getStepState(shipment.status, index) === 'wait' ? mutedTextColor : textColor,
              fontWeight: getStepState(shipment.status, index) === 'process' ? 800 : 600,
              fontSize: 12,
            }}>
              {tStatus(status)}
            </span>
          ),
          content: index === currentIndex ? (
            <span style={{ color: token.colorPrimary, fontSize: 11 }}>
              {formatDate(status === 'ARRIVED' || status === 'CLOSED' ? shipment.eta : shipment.etd)}
            </span>
          ) : undefined,
          status: getStepState(shipment.status, index),
        }))}
      />
    );
  };

  const renderShipmentCard = (shipment: IShipment) => {
    const statusColor = SHIPMENT_STATUS_CONFIG[shipment.status].color;
    const progress = getShipmentProgress(shipment.status);
    const piNumber = shipment.proformaInvoice?.piNumber || shipment.salesContract?.proformaInvoice?.piNumber || '-';
    const contractNumber = shipment.salesContract?.contractNumber || '-';
    const loadingUnit = getLoadingUnitLabel(shipment);
    const delayDays = getDelayDays(shipment);
    const isActiveShipment = shipment._id === activeShipment?._id;

    return (
      <Card
        key={shipment._id}
        variant="borderless"
        style={{
          ...panelStyle,
          borderRadius: compactRadius,
          overflow: 'hidden',
          background: cardBodyBg,
          borderTop: `3px solid ${isActiveShipment ? token.colorPrimary : accentColor}`,
          boxShadow: isActiveShipment
            ? isDark ? '0 18px 44px rgba(37,99,235,0.24)' : '0 14px 36px rgba(37,99,235,0.16)'
            : panelStyle.boxShadow,
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 20px',
          borderBottom: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.12)' : token.colorBorderSecondary}`,
          background: cardHeaderBg,
        }}>
          <Space size={14} wrap>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: compactRadius,
              display: 'grid',
              placeItems: 'center',
              color: token.colorPrimary,
              background: isDark ? 'rgba(238, 77, 45, 0.16)' : '#ffedd5',
            }}>
              <TruckOutlined style={{ fontSize: 20, color: accentColor }} />
            </div>
            <div>
              <Text style={{ color: mutedTextColor, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                {tTable('table.shipmentNumber')}
              </Text>
              <div>
                <Button type="link" onClick={() => selectShipmentForTracking(shipment._id)} style={{ padding: 0, height: 'auto', fontWeight: 900 }}>
                  {shipment.shipmentNumber}
                </Button>
              </div>
            </div>
            {isActiveShipment ? (
              <Tag color="processing" style={{ borderRadius: 999, fontWeight: 700 }}>
                {tTable('table.trackingSelected')}
              </Tag>
            ) : null}
            <Tag color={statusColor} style={{ borderRadius: 999, fontWeight: 700, padding: '3px 10px' }}>
              {tStatus(shipment.status)}
            </Tag>
            {delayDays > 0 ? (
              <Tag color="error" icon={<WarningOutlined />} style={{ borderRadius: 999, fontWeight: 700 }}>
                {tTable('loadingUnit.delayed', { days: delayDays })}
              </Tag>
            ) : null}
            {shipment.isStockIssued ? (
              <Tag color="success" icon={<CheckCircleOutlined />} style={{ borderRadius: 999, fontWeight: 700 }}>
                {tTable('table.issued')}
              </Tag>
            ) : null}
          </Space>

          <Space size={10} wrap>
            {!isActiveShipment ? (
              <Tooltip title={tTable('table.trackShipment')}>
                <Button size="small" shape="circle" icon={<GlobalOutlined />} onClick={() => selectShipmentForTracking(shipment._id)} />
              </Tooltip>
            ) : null}
            {!shipment.isStockIssued ? (
              <Popconfirm
                title={tTable('table.issueTitle')}
                description={tTable('table.issueDesc')}
                onConfirm={() => handleIssueStock(shipment._id)}
                okText={tCommon('confirm')}
                cancelText={tCommon('cancel')}
              >
                <Button type="primary" size="small" icon={<CheckCircleOutlined />} style={{ borderRadius: 8 }}>
                  {tTable('table.issueStock')}
                </Button>
              </Popconfirm>
            ) : null}
            <Tooltip title={tTable('table.viewDetail')}>
              <Button size="small" shape="circle" icon={<EyeTwoTone />} onClick={() => openDetail(shipment._id)} />
            </Tooltip>
            <Tooltip title={tTable('table.docCenter')}>
              <Button size="small" shape="circle" icon={<FilePdfOutlined />} onClick={() => openDocCenter(shipment._id)} />
            </Tooltip>
            <Popconfirm
              title={tTable('table.deleteTitle')}
              description={tTable('table.deleteConfirm')}
              onConfirm={() => handleDelete(shipment._id)}
              okText={tCommon('confirm')}
              cancelText={tCommon('cancel')}
            >
              <Button size="small" shape="circle" icon={<DeleteTwoTone twoToneColor="#eb2f96" />} />
            </Popconfirm>
          </Space>
        </div>

        <div style={{ padding: 20, background: cardBodyBg }}>
          <Row gutter={[20, 20]} align="middle">
            <Col xs={24} xl={7}>
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <Text style={{ color: mutedTextColor, fontSize: 12, fontWeight: 700 }}>{tTable('table.reference')}</Text>
                  <div style={{ marginTop: 4 }}>
                    <Text style={{ color: mutedTextColor, fontSize: 12 }}>PI: {piNumber}</Text>
                    <br />
                    <Text strong style={{ color: textColor, fontSize: 13 }}>HD: {contractNumber}</Text>
                  </div>
                </div>
                <div>
                  <Text style={{ color: mutedTextColor, fontSize: 12, fontWeight: 700 }}>{tTable('table.forwarder')}</Text>
                  <div style={{ color: textColor, fontWeight: 700, marginTop: 4 }}>
                    {shipment.logisticsPartner?.name || '-'}
                  </div>
                </div>
              </Space>
            </Col>

            <Col xs={24} xl={7}>
              <div style={{
                borderRadius: compactRadius,
                padding: 16,
                background: routePanelBg,
                border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.12)' : token.colorBorderSecondary}`,
              }}>
                <Space align="start" size={12}>
                  <EnvironmentOutlined style={{ color: token.colorPrimary, fontSize: 18, marginTop: 3 }} />
                  <div>
                    <Text style={{ color: mutedTextColor, fontSize: 12, fontWeight: 700 }}>{tTable('table.pol')}</Text>
                    <div style={{ color: textColor, fontWeight: 800 }}>{shipment.pol || '-'}</div>
                    <div style={{ height: 20, borderLeft: `2px dashed ${token.colorPrimary}`, margin: '6px 0 6px 5px' }} />
                    <Text style={{ color: mutedTextColor, fontSize: 12, fontWeight: 700 }}>{tTable('table.pod')}</Text>
                    <div style={{ color: textColor, fontWeight: 800 }}>{shipment.pod || '-'}</div>
                  </div>
                </Space>
              </div>
            </Col>

            <Col xs={24} xl={10}>
              <Row gutter={[12, 12]}>
                <Col xs={12} md={6}>
                  <Text style={{ color: mutedTextColor, fontSize: 12 }}>{tTable('table.bookingNumber')}</Text>
                  <div><Tag color="purple">{shipment.bookingNumber || '-'}</Tag></div>
                </Col>
                <Col xs={12} md={6}>
                  <Text style={{ color: mutedTextColor, fontSize: 12 }}>Vessel</Text>
                  <div style={{ color: textColor, fontWeight: 700 }}>{shipment.vesselName || '-'}</div>
                </Col>
                <Col xs={12} md={6}>
                  <Text style={{ color: mutedTextColor, fontSize: 12 }}>{tTable('table.etd')}</Text>
                  <div style={{ color: textColor, fontWeight: 700 }}>{formatDate(shipment.etd)}</div>
                </Col>
                <Col xs={12} md={6}>
                  <Text style={{ color: mutedTextColor, fontSize: 12 }}>ETA</Text>
                  <div style={{ color: textColor, fontWeight: 700 }}>{formatDate(shipment.eta)}</div>
                </Col>
                <Col span={24}>
                  <Space size={8} wrap>
                    <Tag icon={<ContainerOutlined />} color={loadingUnit.color}>{loadingUnit.label}</Tag>
                    <Tag icon={<ClockCircleOutlined />} color={progress >= 100 ? 'success' : 'processing'}>{progress}%</Tag>
                  </Space>
                </Col>
              </Row>
            </Col>
          </Row>

          <div style={{
            marginTop: 20,
            padding: '18px 16px',
            borderRadius: compactRadius,
            background: softPanelBg,
            border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.12)' : token.colorBorderSecondary}`,
          }}>
            {renderShipmentTimeline(shipment)}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tTable('title')}
        icon={<TruckOutlined className="text-blue-500" />}
        description={tTable('description')}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          {renderMetricCard(
            tTable('stats.total'),
            stats.total,
            tTable('dashboard.activeOpen', { count: shipmentOverview.activeShipments }),
            <DeploymentUnitOutlined />,
            '#2563eb',
          )}
        </Col>
        <Col xs={24} md={12} xl={6}>
          {renderMetricCard(
            tTable('stats.inTransit'),
            stats.inTransit,
            tTable('dashboard.trackEtaEtd'),
            <CalendarOutlined />,
            '#d97706',
          )}
        </Col>
        <Col xs={24} md={12} xl={6}>
          {renderMetricCard(
            tTable('stats.delayed'),
            stats.delayed,
            tTable('dashboard.delayedHelper'),
            <WarningOutlined />,
            '#dc2626',
          )}
        </Col>
        <Col xs={24} md={12} xl={6}>
          {renderMetricCard(
            tTable('stats.closed'),
            stats.closed,
            tTable('dashboard.transportCompleted'),
            <CheckCircleOutlined />,
            '#16a34a',
          )}
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          {renderDateUpdatesPanel()}
        </Col>
        <Col xs={24} xl={14}>
          {renderBookingPanel()}
        </Col>
      </Row>

      {renderTrackingPanel()}

      {stats.delayed > 0 ? (
        <Alert
          type="error"
          showIcon
          title={tTable('dashboard.delayedAlertTitle', { count: stats.delayed })}
          description={tTable('dashboard.delayedAlertDescription')}
        />
      ) : null}

      <div style={{ ...panelStyle, borderRadius: compactRadius, padding: 18 }}>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} lg={12}>
            <Input
              placeholder={tTable('table.searchPlaceholder')}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              prefix={<SearchOutlined className="text-slate-400" />}
              style={{ maxWidth: 360, height: 40, borderRadius: compactRadius }}
              allowClear
            />
          </Col>
          <Col xs={24} lg={12}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }} wrap>
              <Badge count={activeFilterCount} size="small" offset={[2, 0]}>
                <Button icon={<FilterOutlined />} onClick={() => setIsFilterOpen(true)} style={{ borderRadius: compactRadius }}>
                  {tTable('table.advancedFilter')}
                </Button>
              </Badge>
              <Tooltip title={tTable('dashboard.refresh')}>
                <Button icon={<ReloadOutlined />} onClick={reloadShipments} style={{ borderRadius: compactRadius }} />
              </Tooltip>
            </Space>
          </Col>
          <Col span={24}>
            {renderStatusFilter()}
          </Col>
        </Row>
      </div>

      {error ? (
        <Alert type="error" showIcon title={error} />
      ) : null}

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {loading && data.length === 0 ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} variant="borderless" style={{ ...panelStyle, borderRadius: compactRadius }}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          ))
        ) : null}

        {!loading && data.length === 0 ? (
          <div style={{ ...panelStyle, borderRadius: compactRadius, padding: 48 }}>
            <Empty description={tTable('empty.noShipments')} />
          </div>
        ) : null}

        {data.map(renderShipmentCard)}
      </Space>

      <div style={{
        ...panelStyle,
        borderRadius: compactRadius,
        padding: '14px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <Text strong style={{ color: textColor }}>
          {tTable('table.totalCount', { total: meta.total })}
        </Text>
        <Pagination
          current={Number(meta.current)}
          pageSize={Number(meta.pageSize)}
          total={meta.total}
          showSizeChanger
          onChange={(nextCurrent, nextPageSize) => replacePagination(nextCurrent, nextPageSize)}
        />
      </div>

      <Drawer
        title={
          <Space>
            <FilterOutlined />
            <span>{tTable('table.filterTitle')}</span>
          </Space>
        }
        placement="right"
        onClose={() => setIsFilterOpen(false)}
        open={isFilterOpen}
        forceRender
        size={400}
        extra={
          <Space>
            <Button onClick={handleResetFilters}>{tTable('table.reset')}</Button>
            <Button type="primary" onClick={() => filterForm.submit()}>{tTable('table.apply')}</Button>
          </Space>
        }
      >
        <Form
          form={filterForm}
          layout="vertical"
          onFinish={onFilterFinish}
          initialValues={filters}
        >
          <Form.Item label={tTable('table.status')} name="status">
            <Select
              placeholder={tTable('table.allStatus')}
              allowClear
              options={SHIPMENT_STATUS_KEYS.map((status) => ({
                value: status,
                label: tStatus(status),
              }))}
            />
          </Form.Item>
          <Form.Item label={tTable('table.pol')} name="pol">
            <Input placeholder={tTable('table.polPlaceholder')} />
          </Form.Item>
          <Form.Item label={tTable('table.pod')} name="pod">
            <Input placeholder={tTable('table.podPlaceholder')} />
          </Form.Item>
        </Form>
      </Drawer>

      <ShipmentDetailDrawer
        open={detailOpen}
        shipmentId={selectedShipmentId}
        onClose={() => {
          setDetailOpen(false);
          setSelectedShipmentId(null);
        }}
        onSuccess={reloadShipments}
      />

      <ShipmentDocCenter
        open={docCenterOpen}
        shipmentId={selectedShipmentId}
        onClose={() => {
          setDocCenterOpen(false);
          setSelectedShipmentId(null);
        }}
        session={session}
      />
    </div>
  );
};

export default ShipmentTable;
