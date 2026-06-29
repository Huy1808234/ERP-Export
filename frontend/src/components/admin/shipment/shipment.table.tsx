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
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined,
  TruckOutlined,
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

  const [searchInput, setSearchInput] = useState<string>('');
  const debouncedSearchText = useDebounce(searchInput, 500);

  const { data, meta, stats, loading, error, fetchShipments, deleteShipment, issueStock } = useShipments();

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [docCenterOpen, setDocCenterOpen] = useState(false);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ShipmentFilters>({});
  const [filterForm] = Form.useForm<ShipmentFilters>();

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const activeStatus = filters.status ?? 'ALL';

  const panelStyle = useMemo(() => ({
    background: isDark ? '#0f172a' : token.colorBgContainer,
    border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.16)' : token.colorBorderSecondary}`,
    boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.28)' : '0 10px 30px rgba(15,23,42,0.06)',
  }), [isDark, token.colorBgContainer, token.colorBorderSecondary]);

  const textColor = isDark ? '#e5e7eb' : token.colorText;
  const mutedTextColor = isDark ? '#94a3b8' : token.colorTextSecondary;
  const cardHeaderBg = isDark ? 'rgba(15, 23, 42, 0.96)' : '#fff7ed';
  const cardBodyBg = isDark ? '#0f172a' : '#ffffff';
  const softPanelBg = isDark ? 'rgba(30, 41, 59, 0.62)' : '#fff7ed';
  const routePanelBg = isDark ? 'rgba(15, 23, 42, 0.78)' : '#fffaf5';
  const accentColor = '#ee4d2d';

  const formatDate = useCallback((date?: string) => {
    return date ? new Date(date).toLocaleDateString(dateLocale) : '-';
  }, [dateLocale]);

  const replacePagination = useCallback((nextCurrent: number, nextPageSize = pageSize) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('current', String(nextCurrent));
    params.set('pageSize', String(nextPageSize));
    router.replace(`${pathname}?${params.toString()}`);
  }, [pageSize, pathname, router, searchParams]);

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
    const id = searchParams.get('id');
    if (id) {
      setSelectedShipmentId(id);
      setDetailOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    reloadShipments();
  }, [reloadShipments]);

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

  const openDocCenter = (shipmentId: string) => {
    setSelectedShipmentId(shipmentId);
    setDocCenterOpen(true);
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
    const containerCount = shipment.containers?.length ?? 0;

    return (
      <Card
        key={shipment._id}
        variant="borderless"
        style={{
          ...panelStyle,
          borderRadius: 14,
          overflow: 'hidden',
          background: cardBodyBg,
          borderTop: `3px solid ${accentColor}`,
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
              borderRadius: 12,
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
                <Button type="link" onClick={() => openDetail(shipment._id)} style={{ padding: 0, height: 'auto', fontWeight: 900 }}>
                  {shipment.shipmentNumber}
                </Button>
              </div>
            </div>
            <Tag color={statusColor} style={{ borderRadius: 999, fontWeight: 700, padding: '3px 10px' }}>
              {tStatus(shipment.status)}
            </Tag>
            {shipment.isStockIssued ? (
              <Tag color="success" icon={<CheckCircleOutlined />} style={{ borderRadius: 999, fontWeight: 700 }}>
                {tTable('table.issued')}
              </Tag>
            ) : null}
          </Space>

          <Space size={10} wrap>
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
                borderRadius: 14,
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
                    <Tag icon={<ContainerOutlined />} color="blue">{containerCount} containers</Tag>
                    <Tag icon={<ClockCircleOutlined />} color={progress >= 100 ? 'success' : 'processing'}>{progress}%</Tag>
                  </Space>
                </Col>
              </Row>
            </Col>
          </Row>

          <div style={{
            marginTop: 20,
            padding: '18px 16px',
            borderRadius: 14,
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
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" style={{ ...panelStyle, borderRadius: 14 }}>
            <Space size={14}>
              <DeploymentUnitOutlined style={{ color: '#3b82f6', fontSize: 24 }} />
              <div>
                <Text style={{ color: mutedTextColor, fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
                  {tTable('stats.total')}
                </Text>
                <Title level={3} style={{ color: textColor, margin: 0 }}>{stats.total}</Title>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" style={{ ...panelStyle, borderRadius: 14 }}>
            <Space size={14}>
              <CalendarOutlined style={{ color: '#f59e0b', fontSize: 24 }} />
              <div>
                <Text style={{ color: mutedTextColor, fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
                  {tTable('stats.inTransit')}
                </Text>
                <Title level={3} style={{ color: textColor, margin: 0 }}>{stats.inTransit}</Title>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" style={{ ...panelStyle, borderRadius: 14 }}>
            <Space size={14}>
              <CheckCircleOutlined style={{ color: '#10b981', fontSize: 24 }} />
              <div>
                <Text style={{ color: mutedTextColor, fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
                  {tTable('stats.closed')}
                </Text>
                <Title level={3} style={{ color: textColor, margin: 0 }}>{stats.closed}</Title>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <div style={{ ...panelStyle, borderRadius: 14, padding: 18 }}>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} lg={12}>
            <Input
              placeholder={tTable('table.searchPlaceholder')}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              prefix={<SearchOutlined className="text-slate-400" />}
              style={{ maxWidth: 360, height: 40, borderRadius: 10 }}
              allowClear
            />
          </Col>
          <Col xs={24} lg={12}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }} wrap>
              <Badge count={activeFilterCount} size="small" offset={[2, 0]}>
                <Button icon={<FilterOutlined />} onClick={() => setIsFilterOpen(true)} style={{ borderRadius: 10 }}>
                  {tTable('table.advancedFilter')}
                </Button>
              </Badge>
              <Tooltip title="Refresh">
                <Button icon={<ReloadOutlined />} onClick={reloadShipments} style={{ borderRadius: 10 }} />
              </Tooltip>
            </Space>
          </Col>
          <Col span={24}>
            {renderStatusFilter()}
          </Col>
        </Row>
      </div>

      {error ? (
        <Alert type="error" showIcon message={error} />
      ) : null}

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {loading && data.length === 0 ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} variant="borderless" style={{ ...panelStyle, borderRadius: 14 }}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          ))
        ) : null}

        {!loading && data.length === 0 ? (
          <div style={{ ...panelStyle, borderRadius: 14, padding: 48 }}>
            <Empty />
          </div>
        ) : null}

        {data.map(renderShipmentCard)}
      </Space>

      <div style={{
        ...panelStyle,
        borderRadius: 14,
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
