'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Table, Tag, Space, Button, Input, Card, Badge,
  Typography, Divider, Tooltip, Row, Col, Statistic,
  Dropdown, Drawer, Avatar, notification, Popconfirm, Tabs, theme, Select, Form, Switch, Empty
} from 'antd';
import {
  PlusOutlined, SearchOutlined, FilterOutlined,
  ExportOutlined, HistoryOutlined, EditOutlined,
  DeleteOutlined, MoreOutlined, GlobalOutlined,
  DollarCircleOutlined, TeamOutlined, WarningOutlined,
  ReloadOutlined, CloseOutlined, CheckOutlined,
  ArrowUpOutlined, ArrowDownOutlined, LockOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { Progress } from 'antd'; // Add Progress component
import { useSession } from 'next-auth/react';
import { useTheme } from '@/context/theme.context';
import { sendRequest } from '@/lib/api-client';
import { GLOBAL_EXCHANGE_RATE } from '@/constants/currency.config';
import { useTranslations, useLocale } from 'next-intl';
import { useCurrency } from '@/hooks/useCurrency';
import PartnerCreateModal from './partner.create';
import PartnerUpdateModal from './partner.update';
import type { ColumnsType } from 'antd/es/table';
import { getAccessToken } from '@/lib/auth-token';

const { Title, Text } = Typography;

// --- 1. Định nghĩa Interfaces chuẩn ---
interface IPartner {
  _id: string;
  name: string;
  partnerType: 'CUSTOMER' | 'SUPPLIER' | 'LOGISTICS';
  country: string;
  region: string;
  taxCode: string;
  defaultPaymentTerm: string;
  defaultCurrency: string;
  creditLimit: number;
  currentDebt: number; // Accounts Receivable (Khách nợ mình)
  apBalance?: number;   // Accounts Payable (Mình nợ NCC)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  isActive: boolean;
  creditCurrency?: string;
  // NCC/Logistics Scores
  qualityScore?: number;
  deliveryScore?: number;
  priceScore?: number;
  vendorCategory?: string;
  isManualRisk?: boolean;
  manualRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface IMeta {
  current: number;
  pageSize: number;
  total: number;
}

type PartnerFilters = Partial<Pick<IPartner, 'country' | 'isActive' | 'partnerType' | 'region' | 'riskLevel'>>;
type PartnerSortField = 'balance' | 'name' | 'partnerType' | 'updatedAt';
type PartnerSortOrder = 'ascend' | 'descend';
type PartnerSortConfig = {
  field: PartnerSortField;
  order: PartnerSortOrder;
};

const DEFAULT_PARTNER_SORT: PartnerSortConfig = {
  field: 'updatedAt',
  order: 'descend',
};

const cleanPartnerFilters = (values: PartnerFilters): PartnerFilters => {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as PartnerFilters;
};

const toPartnerSortField = (value: unknown): PartnerSortField | null => {
  if (value === 'balance' || value === 'name' || value === 'partnerType' || value === 'updatedAt') {
    return value;
  }

  return null;
};

const toPartnerSortConfig = (sorter: unknown): PartnerSortConfig => {
  if (!sorter || Array.isArray(sorter)) return DEFAULT_PARTNER_SORT;

  const sortRecord = sorter as { columnKey?: unknown; field?: unknown; order?: unknown };
  if (sortRecord.order !== 'ascend' && sortRecord.order !== 'descend') {
    return DEFAULT_PARTNER_SORT;
  }

  const field = toPartnerSortField(sortRecord.columnKey) ?? toPartnerSortField(sortRecord.field);
  if (!field) return DEFAULT_PARTNER_SORT;

  return {
    field,
    order: sortRecord.order,
  };
};

const PartnerTable = () => {
  const { data: session } = useSession();
  const [api, contextHolder] = notification.useNotification();
  const accessToken = getAccessToken(session);
  const t = useTranslations('Partner');
  const tCommon = useTranslations('Common');
  const locale = useLocale();

  // --- States ---
  const [partners, setPartners] = useState<IPartner[]>([]);
  const [meta, setMeta] = useState<IMeta>({ current: 1, pageSize: 10, total: 0 });
  const [isFetching, setIsFetching] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
      setMeta(prev => ({ ...prev, current: 1 }));
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [searchText]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [dataUpdate, setDataUpdate] = useState<IPartner | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<any>(null);

  // --- Advanced Filter States ---
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterForm] = Form.useForm();
  const [filters, setFilters] = useState<PartnerFilters>({});
  const activeFilterCount = Object.keys(filters).length;
  const [sortConfig, setSortConfig] = useState<PartnerSortConfig>(DEFAULT_PARTNER_SORT);

  // --- 2. Logic Fetch Dữ liệu (useCallback để tối ưu) ---
  const { formatMoney, formatVND } = useCurrency();
  
  const fetchPartners = useCallback(async () => {
    if (!accessToken) return;
    setIsFetching(true);
    try {
      // Build sort string for backend (e.g., "name,asc" or "-currentDebt")
      let sortStr: string = sortConfig.field;
      if (sortConfig.order === 'descend') sortStr = `-${sortStr}`;
      const activeFilters = cleanPartnerFilters(filters);

      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
        method: 'GET',
        queryParams: {
          current: meta.current,
          pageSize: meta.pageSize,
          sort: sortStr,
          ...(debouncedSearchText ? { search: debouncedSearchText } : {}),
          ...activeFilters
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        setPartners(res.data.results);
        setMeta(prev => ({ ...prev, total: res.data.totalItems }));
      }
    } finally {
      setIsFetching(false);
    }
  }, [meta.current, meta.pageSize, debouncedSearchText, filters, sortConfig, accessToken]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  // --- 3. Hành động (Actions) ---
  const confirmDelete = async (id: string) => {
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners/${id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res?.data) {
      notification.success({ title: t('notifications.deleteSuccess') });
      fetchPartners();
    } else {
      notification.error({ title: t('notifications.errorTitle'), description: res?.message });
    }
  };

  const openHistory = async (record: IPartner) => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners/${record._id}/history`,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) setHistoryData(res.data);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleResetFilters = () => {
    filterForm.resetFields();
    setFilters({});
    setMeta(prev => ({ ...prev, current: 1 }));
    setIsFilterOpen(false);
  };

  const onFilterFinish = (values: PartnerFilters) => {
    setFilters(cleanPartnerFilters(values));
    setMeta(prev => ({ ...prev, current: 1 }));
    setIsFilterOpen(false);
  };

  const handleExport = async () => {
    if (!accessToken) return;

    try {
      api.info({ title: t('notifications.preparingExcel'), placement: 'topRight' });

      const exportParams = {
        sort: sortConfig.order === 'descend' ? `-${sortConfig.field}` : sortConfig.field,
        ...(debouncedSearchText ? { search: debouncedSearchText } : {}),
        ...cleanPartnerFilters(filters)
      };
      const queryParams = new URLSearchParams(
        Object.entries(exportParams).map(([key, value]) => [key, String(value)]),
      );

      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners/export?${queryParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        const filename = locale === 'vi' ? 'DS_Doi_Tac' : 'Partner_List';
        a.download = `${filename}_${new Date().toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US').replace(/\//g, '-')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
        api.success({ title: t('notifications.exportSuccess'), placement: 'topRight' });
      } else {
        const errorData = await response.json();
        api.error({
          title: t('notifications.exportError'),
          description: errorData?.message || (locale === 'vi' ? 'Không thể tải file' : 'Could not download file'),
          placement: 'topRight'
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      api.error({ title: t('notifications.connectionError'), placement: 'topRight' });
    }
  };

  // --- 4. Cấu hình Columns (AntD 5 chuẩn chỉnh) ---
  const getSortOrder = (field: PartnerSortField) => (
    sortConfig.field === field ? sortConfig.order : null
  );

  const columns: ColumnsType<IPartner> = useMemo(() => [
    {
      title: t('table.partner'),
      dataIndex: 'name',
      fixed: 'left',
      width: 280,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      sortOrder: getSortOrder('name'),
      render: (text: string, record: IPartner) => (
        <Space size="middle">
          <Avatar
            shape="square" size={42}
            style={{ backgroundColor: '#e6f7ff', color: '#1890ff', borderRadius: '8px', fontWeight: 'bold' }}
          >
            {text.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text strong style={{ fontSize: '14px' }}>{text}</Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              <GlobalOutlined /> {record.country || (locale === 'vi' ? 'Việt Nam' : 'Vietnam')}
              {record.region ? ` (${record.region})` : ''}
              {record.taxCode ? ` | ${t('table.taxCode')}: ${record.taxCode}` : ''}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: t('table.type'),
      dataIndex: 'partnerType',
      width: 150,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      sortOrder: getSortOrder('partnerType'),
      render: (type: string) => {
        let color = 'processing';
        let label = t('types.customer');

        if (type === 'SUPPLIER') {
          color = 'warning';
          label = t('types.supplier');
        } else if (type === 'LOGISTICS') {
          color = 'geekblue';
          label = t('types.logistics');
        }

        return (
          <Tag color={color} style={{ borderRadius: '20px', padding: '0 12px' }}>
            {label}
          </Tag>
        );
      },
    },
    {
      title: t('table.debt'),
      key: 'balance',
      width: 240,
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder: getSortOrder('balance'),
      render: (_: any, record: IPartner) => {
        const isBuyer = record.partnerType === 'CUSTOMER';
        const currency = record.defaultCurrency || 'USD';

        const isVnd = currency === 'VND';
        
        // Trust the API: Debt values are already converted to Partner's Currency by Backend
        const primaryBalance = isBuyer ? (record.currentDebt || 0) : (record.apBalance || 0); 
        const balanceVnd = isVnd ? primaryBalance : (primaryBalance * GLOBAL_EXCHANGE_RATE);
        
        const limit = record.creditLimit || 0;
        
        // Available Credit (Hạn mức còn lại)
        const availableCredit = limit > 0 ? Math.max(limit - primaryBalance, 0) : 0;
        const isOverLimit = limit > 0 && primaryBalance > limit;

        // Usage calculation (Both are in the same currency now)
        const rawUsage = limit > 0 ? (primaryBalance / limit) * 100 : 0;
        const usagePercent = Math.min(rawUsage, 100);
        
        // Professional Formatting: show < 0.01% for micro-debts
        let displayUsage: string;
        if (rawUsage > 0 && rawUsage < 0.01) {
          displayUsage = '< 0.01';
        } else if (rawUsage > 0 && rawUsage < 1) {
          displayUsage = rawUsage.toFixed(2);
        } else {
          displayUsage = Math.round(usagePercent).toString();
        }

        const balanceLabel = isBuyer ? t('debt.receivable') : t('debt.payable');

        // Traffic Light System (Hệ thống đèn tín hiệu rủi ro)
        let statusColor = token.colorSuccess;
        let statusText = t('debt.safe');
        if (isOverLimit) {
          statusColor = token.colorError;
          statusText = t('debt.overLimit');
        } else if (usagePercent > 90) {
          statusColor = token.colorError;
          statusText = t('debt.alarm');
        } else if (usagePercent > 60) {
          statusColor = token.colorWarning;
          statusText = t('debt.attention');
        }

        return (
          <div style={{ padding: '4px 0' }}>
            {/* 1. Debt Display */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <Text type="secondary" style={{ fontSize: '11px' }}>{balanceLabel}</Text>
              <Text strong style={{ fontSize: '13px', color: isOverLimit ? token.colorError : token.colorInfo }}>
                {formatMoney(primaryBalance, currency)}
              </Text>
            </div>

            {/* 2. Currency Conversion Hint (Only if primary is not VND) */}
            {!isVnd && primaryBalance > 0 && (
              <div style={{ textAlign: 'right', marginTop: -2 }}>
                <Text type="secondary" style={{ fontSize: '10px', fontStyle: 'italic' }}>
                  (~ {formatVND(balanceVnd)})
                </Text>
              </div>
            )}

            {/* 3. Credit Limit Logic (Buyer Only) */}
            {isBuyer && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px dashed ${isDark ? '#334155' : '#f0f0f0'}` }}>
                <Tooltip title={
                  <div style={{ padding: '4px' }}>
                    <div>{t('debt.limit')}: <b>{formatMoney(limit, currency)}</b></div>
                    <div>{t('debt.used')}: <b>{formatMoney(primaryBalance, currency)}</b></div>
                    <Divider style={{ margin: '4px 0', borderColor: 'rgba(255,255,255,0.2)' }} />
                    <div>{t('debt.available')}: <b style={{ color: '#52c41a' }}>{formatMoney(availableCredit, currency)}</b></div>
                  </div>
                }>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                     <Space size={4}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor }} />
                        <span style={{ fontSize: '10px', color: '#8c8c8c' }}>{t('debt.usage')}:</span>
                     </Space>
                     <Text strong style={{ fontSize: '11px', color: usagePercent > 90 ? token.colorError : undefined }}>
                        {displayUsage}%
                     </Text>
                  </div>
                  
                  <Progress
                    percent={usagePercent}
                    size={[100, 4] as any} // Narrower height for professional look
                    showInfo={false}
                    strokeColor={statusColor}
                    railColor={isDark ? '#303030' : '#f0f0f0'}
                  />

                  {limit > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                      <Text type="secondary" style={{ fontSize: '9px', textTransform: 'uppercase' }}>{statusText}</Text>
                      <Text style={{ fontSize: '9px', color: token.colorSuccess }}>
                        {t('debt.remaining')}: {formatMoney(availableCredit, currency)}
                      </Text>
                    </div>
                  )}
                </Tooltip>
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: t('table.risk'),
      key: 'risk',
      width: 220,
      render: (_: any, record: IPartner) => {
        if (record.partnerType === 'CUSTOMER') {
          const riskConfig = {
            LOW: { color: 'success', text: t('risk.low') },
            MEDIUM: { color: 'warning', text: t('risk.medium') },
            HIGH: { color: 'error', text: t('risk.high') }
          };
          const config = riskConfig[record.riskLevel] || riskConfig.LOW;
          return (
            <Space>
              <Tag color={config.color} style={{ borderRadius: '4px' }}>
                {config.text}
              </Tag>
              {record.isManualRisk && (
                <Tooltip title={t('risk.manualHint')}>
                  <LockOutlined style={{ color: token.colorTextDescription, fontSize: '12px' }} />
                </Tooltip>
              )}
            </Space>
          );
        }

        const scores = [record.qualityScore || 0, record.deliveryScore || 0, record.priceScore || 0];
        const hasScore = scores.some(s => s > 0);
        const avgScore = hasScore ? (scores.reduce((a, b) => a + b, 0) / 3) : 0;

        if (hasScore) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Tooltip title={`${t('risk.capacityScore')}: ${record.qualityScore} | ${t('risk.delivery')}: ${record.deliveryScore} | ${t('risk.price')}: ${record.priceScore}`}>
                <Tag color="cyan" style={{ width: 'fit-content' }}>
                  {t('risk.capacityScore')}: {avgScore.toFixed(1)}
                </Tag>
              </Tooltip>
              {record.vendorCategory && <Text type="secondary" style={{ fontSize: 11 }}>{t('risk.industry')}: {record.vendorCategory}</Text>}
            </div>
          );
        }

        return <Text type="secondary" italic style={{ fontSize: 12 }}>{t('risk.noAssessment')}</Text>;
      }
    },
    {
      title: t('table.status'),
      dataIndex: 'isActive',
      width: 120,
      render: (active: boolean) => (
        <Badge status={active ? 'success' : 'default'} text={active ? t('status.active') : t('status.inactive')} />
      )
    },
    {
      title: t('table.actions'),
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_: any, record: IPartner) => (
        <Space size="small">
          <Tooltip title={tCommon('edit')}>
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#1890ff' }} />}
              onClick={() => { setDataUpdate(record); setIsUpdateModalOpen(true); }}
            />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                { key: '1', icon: <HistoryOutlined />, label: t('table.history'), onClick: () => openHistory(record) },
                {
                  key: '2',
                  icon: <DeleteOutlined />,
                  label: (
                    <Popconfirm
                      title={t('notifications.confirmDelete')}
                      onConfirm={() => confirmDelete(record._id)}
                      okText={tCommon('delete')}
                      cancelText={tCommon('cancel')}
                      okButtonProps={{ danger: true }}
                    >
                      <span style={{ color: token.colorError }}>{tCommon('delete')}</span>
                    </Popconfirm>
                  ),
                  danger: true
                },
              ]
            }}
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ], [accessToken, sortConfig]);

  const { token } = theme.useToken();
  const { isDark } = useTheme();

  return (
    <div style={{
      backgroundColor: 'transparent',
      transition: 'all 0.3s ease'
    }}>
      {contextHolder}

      {/* 1. Header Section */}
      <Row justify="space-between" align="bottom" style={{ marginBottom: '24px' }}>
        <Col>
          <PageHeader
            title={t('title')}
            icon={<TeamOutlined />}
            description={t('subtitle')}
          />
          <Text type="secondary">{t('systemDescription')}</Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ExportOutlined />}
              size="large"
              style={{ borderRadius: '8px' }}
              onClick={handleExport}
            >
              {t('exportExcel')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => setIsCreateModalOpen(true)}
              style={{ borderRadius: '8px', height: '40px' }}
            >
              {t('addPartner')}
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 2. Dashboard Stats Cards */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>{t('stats.totalPartners')}</Text>}
              value={meta.total}
              prefix={<TeamOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />}
              styles={{ content: { color: isDark ? '#f8fafc' : undefined } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>{t('stats.receivable')}</Text>}
              value={partners.filter(p => p.partnerType === 'CUSTOMER').reduce((sum, p) => {
                const currency = p.defaultCurrency || 'USD';
                const amount = p.currentDebt || 0;
                const amountVnd = currency === 'VND' ? amount : (amount * GLOBAL_EXCHANGE_RATE);
                return sum + amountVnd;
              }, 0)}
              formatter={(val) => new Intl.NumberFormat('vi-VN').format(Number(val))}
              styles={{ content: { color: '#52c41a', fontSize: '20px' } }}
              prefix={<ArrowDownOutlined style={{ color: '#52c41a' }} />}
              suffix={<Text type="secondary" style={{ fontSize: 12, marginLeft: 4, color: isDark ? '#64748b' : undefined }}>₫</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>{t('stats.payable')}</Text>}
              value={partners.filter(p => p.partnerType !== 'CUSTOMER').reduce((sum, p) => {
                const currency = p.defaultCurrency || 'SUPPLIER' ? 'USD' : 'VND'; // Fallback logic
                const actualCurrency = p.defaultCurrency || (p.partnerType === 'SUPPLIER' ? 'USD' : 'VND');
                const amount = p.apBalance || 0;
                const amountVnd = actualCurrency === 'VND' ? amount : (amount * GLOBAL_EXCHANGE_RATE);
                return sum + amountVnd;
              }, 0)}
              formatter={(val) => new Intl.NumberFormat('vi-VN').format(Number(val))}
              styles={{ content: { color: '#fa8c16', fontSize: '20px' } }}
              prefix={<ArrowUpOutlined style={{ color: '#fa8c16' }} />}
              suffix={<Text type="secondary" style={{ fontSize: 12, marginLeft: 4, color: isDark ? '#64748b' : undefined }}>₫</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>{t('stats.riskWarning')}</Text>}
              value={partners.filter(p => p.riskLevel === 'HIGH').length}
              styles={{ content: { color: '#cf1322' } }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 3. Main Data Section */}
      <Card
        variant="borderless"
        style={{
          borderRadius: '12px',
          background: isDark ? '#1e293b' : token.colorBgContainer,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)'
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between' }}>
          <Space size="large">
            <Input
              placeholder={t('table.searchPlaceholder')}
              prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setMeta(prev => ({ ...prev, current: 1 }));
              }}
              style={{ width: 400 }}
              size="large"
              allowClear
            />
            <Button
              icon={<FilterOutlined />}
              size="large"
              onClick={() => setIsFilterOpen(true)}
              type={activeFilterCount > 0 ? "primary" : "default"}
            >
              {t('table.advancedFilter')} {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              size="large"
              onClick={fetchPartners}
            />
          </Space>

          {selectedRowKeys.length > 0 && (
            <Space>
              <span style={{ color: token.colorTextSecondary }}>{t('table.selectedCount', { count: selectedRowKeys.length })}</span>
              <Popconfirm
                title={t('table.confirmBulkDelete', { count: selectedRowKeys.length })}
                onConfirm={async () => {
                  const res = await sendRequest<IBackendRes<any>>({
                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners/bulk-delete`,
                    method: 'POST',
                    body: { ids: selectedRowKeys },
                    headers: { Authorization: `Bearer ${accessToken}` },
                  });
                  if (res?.data) {
                    api.success({ title: tCommon('success'), description: res.message });
                    setSelectedRowKeys([]);
                    fetchPartners();
                  }
                }}
                okText={t('table.bulkDelete')}
                cancelText={t('table.reset')}
                okButtonProps={{ danger: true }}
              >
                <Button danger type="primary" icon={<DeleteOutlined />}>{t('table.bulkDelete')}</Button>
              </Popconfirm>
            </Space>
          )}
        </div>

        <div className="premium-table">
          <Table
            rowKey={(record: any) => record._id || record.code || record.taxCode}
            columns={columns}
            dataSource={partners}
            loading={isFetching}
            scroll={{ x: 1300 }}
            bordered={false}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            onChange={(pagination, _tableFilters, sorter, extra) => {
              const nextSortConfig = toPartnerSortConfig(sorter);

              setMeta(prev => ({
                ...prev,
                current: extra.action === 'sort' ? 1 : pagination.current || 1,
                pageSize: pagination.pageSize || 10
              }));

              setSortConfig(nextSortConfig);
            }}
            pagination={{
              current: meta.current,
              pageSize: meta.pageSize,
              total: meta.total,
              showSizeChanger: true,
              showTotal: (total) => t('table.totalCount', { total }),
            }}
          />
        </div>
      </Card>

      {/* 4. Modals & Drawer */}
      <PartnerCreateModal
        isCreateModalOpen={isCreateModalOpen}
        setIsCreateModalOpen={setIsCreateModalOpen}
        fetchPartners={fetchPartners}
      />

      {dataUpdate && (
        <PartnerUpdateModal
          isUpdateModalOpen={isUpdateModalOpen}
          setIsUpdateModalOpen={setIsUpdateModalOpen}
          fetchPartners={fetchPartners}
          dataUpdate={dataUpdate}
          setDataUpdate={setDataUpdate}
        />
      )}

      <Drawer
        title={
          <Space>
            <FilterOutlined />
            <span>{t('table.advancedFilter').toUpperCase()}</span>
          </Space>
        }
        placement="right"
        onClose={() => setIsFilterOpen(false)}
        open={isFilterOpen}
        size="default"
        extra={
          <Space>
            <Button onClick={handleResetFilters}>{t('table.reset')}</Button>
            <Button type="primary" onClick={() => filterForm.submit()}>{t('table.apply')}</Button>
          </Space>
        }
      >
        <Form
          form={filterForm}
          layout="vertical"
          onFinish={onFilterFinish}
          initialValues={filters}
        >
          <Form.Item label={t('table.partnerType')} name="partnerType">
            <Select
              allowClear
              placeholder={t('table.allTypes')}
              options={[
                { value: 'CUSTOMER', label: `${t('types.customer')} (Buyer)` },
                { value: 'SUPPLIER', label: `${t('types.supplier')} (Vendor)` },
                { value: 'LOGISTICS', label: t('types.logistics') },
              ]}
            />
          </Form.Item>

          <Form.Item label={t('table.region')} name="region">
            <Select
              allowClear
              placeholder={t('table.allRegions')}
              options={[
                { value: 'EU', label: t('regions.EU') },
                { value: 'US', label: t('regions.US') },
                { value: 'ASEAN', label: t('regions.ASEAN') },
                { value: 'APAC', label: t('regions.APAC') },
              ]}
            />
          </Form.Item>

          <Form.Item label={t('table.riskLevel')} name="riskLevel">
            <Select
              allowClear
              placeholder={t('table.allRisks')}
              options={[
                { value: 'LOW', label: t('risk.low') },
                { value: 'MEDIUM', label: t('risk.medium') },
                { value: 'HIGH', label: t('risk.high') },
              ]}
            />
          </Form.Item>

          <Form.Item label={t('table.activeStatus')} name="isActive">
            <Select
              allowClear
              placeholder={t('table.allStatus')}
              options={[
                { value: true, label: t('status.active') },
                { value: false, label: t('status.inactive') },
              ]}
            />
          </Form.Item>

          <Divider />

          <Form.Item label={t('table.country')} name="country">
            <Input placeholder={t('form.placeholders.country')} allowClear />
          </Form.Item>

        </Form>
      </Drawer>

      <Drawer
        title={<Space><HistoryOutlined /> {t('table.historyTitle')}</Space>}
        size="default"
        onClose={() => setHistoryOpen(false)}
        open={historyOpen}
        destroyOnHidden
      >
        {historyLoading ? <div style={{ textAlign: 'center', padding: 50 }}>{tCommon('loading')}</div> : (
          <>
            <Title level={4}>{historyData?.partner?.name}</Title>
            <Divider />
            <Tabs items={
              historyData?.partner?.partnerType === 'SUPPLIER' ? [
                {
                  key: '1', label: t('history.purchaseOrders'),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(historyData?.purchaseOrders?.items || []).length > 0 ? (
                        (historyData?.purchaseOrders?.items || []).map((item: any) => (
                          <div key={item._id} style={{
                            padding: '16px',
                            background: isDark ? '#1e293b' : '#f8f9fa',
                            borderRadius: '12px',
                            border: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <Text strong style={{ fontSize: 14 }}>{item.poNumber}</Text>
                                <Tag color={item.status === 'COMPLETED' ? 'green' : item.status === 'CANCELLED' ? 'red' : 'blue'} style={{ borderRadius: 4, fontSize: 10 }}>
                                  {item.status}
                                </Tag>
                              </div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {item.orderDate ? new Date(item.orderDate).toLocaleDateString('vi-VN') : tCommon('noData')}
                              </Text>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <Text strong style={{ color: token.colorSuccess, fontSize: 15 }}>
                                {formatMoney(Number(item.totalAmount || 0), item.currency || 'VND')}
                              </Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {(item.items || []).length} {t('history.items')}
                              </Text>
                            </div>
                          </div>
                        ))
                      ) : <Empty description={t('history.noPurchaseOrders')} />}
                    </div>
                  )
                },
                {
                  key: '2', label: t('history.vendorInvoices'),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(historyData?.vendorInvoices?.items || []).length > 0 ? (
                        (historyData?.vendorInvoices?.items || []).map((item: any) => (
                          <div key={item._id} style={{
                            padding: '16px',
                            background: isDark ? '#1e293b' : '#f8f9fa',
                            borderRadius: '12px',
                            border: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <Text strong>{item.invoiceNumber}</Text>
                                <Tag color={item.status === 'PAID' ? 'green' : item.status === 'CANCELLED' ? 'red' : 'orange'}>{item.status}</Tag>
                              </div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                PO: {item.purchaseOrder?.poNumber || item.purchaseOrderId}
                              </Text>
                            </div>
                            <Text strong style={{ color: '#1890ff' }}>
                              {formatMoney(Number(item.totalAmount || 0), item.currency || 'VND')}
                            </Text>
                          </div>
                        ))
                      ) : <Empty description={t('history.noVendorInvoices')} />}
                    </div>
                  )
                },
                {
                  key: '3', label: t('history.payables'),
                  children: (
                    <div>
                      <Row gutter={12} style={{ marginBottom: 16 }}>
                        <Col span={12}>
                          <Statistic title={t('history.remaining')} value={historyData?.payables?.summary?.remainingAmount || 0} formatter={(value) => formatMoney(Number(value), historyData?.partner?.defaultCurrency || 'VND')} />
                        </Col>
                        <Col span={12}>
                          <Statistic title={t('history.overdue')} value={historyData?.payables?.summary?.overdueCount || 0} styles={{ content: { color: token.colorError } }} />
                        </Col>
                      </Row>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(historyData?.payables?.items || []).length > 0 ? (
                          (historyData?.payables?.items || []).map((item: any) => {
                            const remaining = Math.max(Number(item.amount || 0) - Number(item.paidAmount || 0), 0);
                            return (
                              <div key={item._id} style={{
                                padding: '16px',
                                background: isDark ? '#1e293b' : '#f8f9fa',
                                borderRadius: '12px',
                                border: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <div>
                                  <Text strong>{item.invoiceNumber || item._id}</Text>
                                  <br />
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {t('history.dueDate')}: {item.dueDate ? new Date(item.dueDate).toLocaleDateString('vi-VN') : tCommon('noData')}
                                  </Text>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <Tag color={item.status === 'PAID' ? 'green' : item.status === 'PARTIAL' ? 'blue' : 'orange'}>{item.status}</Tag>
                                  <br />
                                  <Text strong style={{ color: token.colorError }}>
                                    {formatMoney(remaining, item.currency || 'VND')}
                                  </Text>
                                </div>
                              </div>
                            );
                          })
                        ) : <Empty description={t('history.noPayables')} />}
                      </div>
                    </div>
                  )
                }
              ] :
              historyData?.partner?.partnerType === 'LOGISTICS' ? [
                {
                  key: '1', label: t('history.shipments'),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(historyData?.shipments?.items || []).length > 0 ? (
                        (historyData?.shipments?.items || []).map((item: any) => {
                          const statusColors: any = {
                            BOOKED: 'default',
                            LOADING: 'orange',
                            CUSTOMS_CLEARED: 'blue',
                            ON_BOARD: 'processing',
                            ARRIVED: 'success',
                            CLOSED: 'purple'
                          };
                          return (
                            <div key={item._id} style={{
                              padding: '16px',
                              background: isDark ? '#1e293b' : '#f8f9fa',
                              borderRadius: '12px',
                              border: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <Text strong style={{ fontSize: 14 }}>{item.shipmentNumber}</Text>
                                  <Tag color={statusColors[item.status] || 'default'} style={{ borderRadius: 4, fontSize: 10 }}>
                                    {item.status}
                                  </Tag>
                                </div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  ETD: {item.etd ? new Date(item.etd).toLocaleDateString('vi-VN') : 'N/A'}
                                </Text>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <Text strong style={{ fontSize: 13 }}>
                                  B/L: {item.blNumber || tCommon('noData')}
                                </Text>
                              </div>
                            </div>
                          );
                        })
                      ) : <Empty description={t('history.noShipments')} />}
                    </div>
                  )
                },
                {
                  key: '2', label: t('history.payables'),
                  children: (
                    <div>
                       <Statistic
                          title={t('history.totalPayables')}
                          value={historyData?.payables?.summary?.remainingAmount || historyData?.partner?.apBalance || 0}
                          formatter={(value) => formatMoney(Number(value), historyData?.partner?.defaultCurrency || 'VND')}
                          styles={{ content: { color: '#cf1322' } }}
                       />
                       <Divider />
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                         {(historyData?.payables?.items || []).length > 0 ? (
                           (historyData?.payables?.items || []).map((item: any) => {
                             const remaining = Math.max(Number(item.amount || 0) - Number(item.paidAmount || 0), 0);
                             return (
                               <div key={item._id} style={{
                                 padding: '16px',
                                 background: isDark ? '#1e293b' : '#f8f9fa',
                                 borderRadius: '12px',
                                 border: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`,
                                 display: 'flex',
                                 justifyContent: 'space-between',
                                 alignItems: 'center'
                               }}>
                                 <div>
                                   <Text strong>{item.invoiceNumber || item._id}</Text>
                                   <br />
                                   <Text type="secondary" style={{ fontSize: 12 }}>
                                     {t('history.dueDate')}: {item.dueDate ? new Date(item.dueDate).toLocaleDateString('vi-VN') : tCommon('noData')}
                                   </Text>
                                 </div>
                                 <div style={{ textAlign: 'right' }}>
                                   <Tag color={item.status === 'PAID' ? 'green' : item.status === 'PARTIAL' ? 'blue' : 'orange'}>{item.status}</Tag>
                                   <br />
                                   <Text strong style={{ color: token.colorError }}>
                                     {formatMoney(remaining, item.currency || 'VND')}
                                   </Text>
                                 </div>
                               </div>
                             );
                           })
                         ) : <Empty description={t('history.noPayables')} />}
                       </div>
                    </div>
                  )
                }
              ] : [
                {
                  key: '1', label: t('history.quotations'),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(historyData?.quotations?.items || []).length > 0 ? (
                        (historyData?.quotations?.items || []).map((item: any) => {
                          const statusColors: any = {
                            DRAFT: 'default',
                            PENDING_APPROVAL: 'orange',
                            SENT: 'blue',
                            ACCEPTED: 'green',
                            REJECTED: 'red',
                            EXPIRED: 'volcano'
                          };
                          return (
                            <div key={item._id} style={{
                              padding: '16px',
                              background: isDark ? '#1e293b' : '#f8f9fa',
                              borderRadius: '12px',
                              border: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <Text strong style={{ fontSize: 14 }}>{item.quotationNumber}</Text>
                                  <Tag color={statusColors[item.status] || 'default'} style={{ borderRadius: 4, fontSize: 10 }}>
                                    {item.status}
                                  </Tag>
                                </div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {new Date(item.updatedAt).toLocaleDateString('vi-VN')}
                                </Text>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <Text strong style={{ color: token.colorSuccess, fontSize: 15 }}>
                                  {Number(item.totalAmount).toLocaleString()} {item.currency}
                                </Text>
                              </div>
                            </div>
                          );
                        })
                      ) : <Empty description={t('history.noQuotations')} />}
                    </div>
                  )
                },
                {
                  key: '2', label: t('history.piInvoices'),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(historyData?.proformaInvoices?.items || []).length > 0 ? (
                        (historyData?.proformaInvoices?.items || []).map((item: any) => (
                          <div key={item._id} style={{
                            padding: '16px',
                            background: isDark ? '#1e293b' : '#f8f9fa',
                            borderRadius: '12px',
                            border: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                               <Text strong>{item.piNumber}</Text>
                               <br />
                               <Text type="secondary" style={{ fontSize: 12 }}>
                                 {new Date(item.updatedAt).toLocaleDateString('vi-VN')}
                               </Text>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <Text strong style={{ color: '#1890ff' }}>
                                {Number(item.totalAmount).toLocaleString()} {item.currency}
                              </Text>
                            </div>
                          </div>
                        ))
                      ) : <Empty description={t('history.noPI')} />}
                    </div>
                  )
                },
              ]
            } />
          </>
        )}
      </Drawer>
      <style jsx global>{`
        .premium-table .ant-table {
          background: transparent !important;
        }
        .premium-table .ant-table-thead > tr > th {
          background: ${isDark ? 'rgba(30, 41, 59, 0.5)' : '#fafafa'} !important;
          color: ${isDark ? '#8c8c8c' : '#595959'} !important;
          font-weight: 600 !important;
          border-bottom: 1px solid ${isDark ? '#334155' : '#f0f0f0'} !important;
        }
        .premium-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${isDark ? '#334155' : '#f0f0f0'} !important;
          color: ${isDark ? '#e2e8f0' : 'inherit'} !important;
        }
        .premium-table .ant-table-placeholder {
          background: transparent !important;
        }
      `}</style>
    </div>
  );
};

export default PartnerTable;
