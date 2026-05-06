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
import { useTheme } from '@/library/theme.context';
import { sendRequest } from '@/utils/api';
import { GLOBAL_EXCHANGE_RATE } from '@/constants/currency.config';
import { useCurrency } from '@/hooks/useCurrency';
import PartnerCreateModal from './partner.create';
import PartnerUpdateModal from './partner.update';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

// --- 1. Định nghĩa Interfaces chuẩn ---
interface IPartner {
  id: string;
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

const PartnerTable = () => {
  const { data: session } = useSession();
  const [api, contextHolder] = notification.useNotification();
  const accessToken = session?.user?.access_token;

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
  const [filters, setFilters] = useState<any>({});
  const [sortConfig, setSortConfig] = useState<any>({ field: 'updatedAt', order: 'descend' });

  // --- 2. Logic Fetch Dữ liệu (useCallback để tối ưu) ---
  const { formatMoney, formatVND } = useCurrency();
  
  const fetchPartners = useCallback(async () => {
    if (!accessToken) return;
    setIsFetching(true);
    try {
      // Build sort string for backend (e.g., "name,asc" or "-currentDebt")
      let sortStr = sortConfig.field;
      if (sortConfig.order === 'descend') sortStr = `-${sortStr}`;

      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
        method: 'GET',
        queryParams: {
          current: meta.current,
          pageSize: meta.pageSize,
          sort: sortStr,
          ...(debouncedSearchText ? { name: `/${debouncedSearchText}/i` } : {}),
          ...filters
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
      notification.success({ title: 'Xóa đối tác thành công' });
      fetchPartners();
    } else {
      notification.error({ title: 'Lỗi', description: res?.message });
    }
  };

  const openHistory = async (record: IPartner) => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners/${record.id}/history`,
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

  const onFilterFinish = (values: any) => {
    setFilters(values);
    setMeta(prev => ({ ...prev, current: 1 }));
    setIsFilterOpen(false);
  };

  const handleExport = async () => {
    if (!accessToken) return;

    try {
      api.info({ title: 'Đang chuẩn bị file Excel...', placement: 'topRight' });

      const queryParams = new URLSearchParams({
        ...(debouncedSearchText ? { name: `/${debouncedSearchText}/i` } : {}),
        ...filters
      });

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
        a.download = `DS_Doi_Tac_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
        api.success({ title: 'Xuất Excel thành công', placement: 'topRight' });
      } else {
        const errorData = await response.json();
        api.error({
          title: 'Lỗi khi xuất Excel',
          description: errorData?.message || 'Không thể tải file',
          placement: 'topRight'
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      api.error({ title: 'Lỗi kết nối server', placement: 'topRight' });
    }
  };

  // --- 4. Cấu hình Columns (AntD 5 chuẩn chỉnh) ---
  const columns: ColumnsType<IPartner> = useMemo(() => [
    {
      title: 'ĐỐI TÁC',
      dataIndex: 'name',
      fixed: 'left',
      width: 280,
      sorter: true,
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
              <GlobalOutlined /> {record.country || 'Việt Nam'}
              {record.region ? ` (${record.region})` : ''}
              {record.taxCode ? ` | MST: ${record.taxCode}` : ''}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'PHÂN LOẠI',
      dataIndex: 'partnerType',
      width: 150,
      sorter: true,
      render: (type: string) => {
        let color = 'processing';
        let label = 'Khách hàng';

        if (type === 'SUPPLIER') {
          color = 'warning';
          label = 'Nhà cung cấp';
        } else if (type === 'LOGISTICS') {
          color = 'geekblue';
          label = 'Đơn vị vận chuyển';
        }

        return (
          <Tag color={color} style={{ borderRadius: '20px', padding: '0 12px' }}>
            {label}
          </Tag>
        );
      },
    },
    {
      title: 'TÀI CHÍNH (DEBT)',
      key: 'debt',
      width: 240,
      sorter: (a, b) => (a.currentDebt || 0) - (b.currentDebt || 0),
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

        const balanceLabel = isBuyer ? 'Dư nợ (Phải thu):' : 'Công nợ (Phải trả):';

        // Traffic Light System (Hệ thống đèn tín hiệu rủi ro)
        let statusColor = token.colorSuccess;
        let statusText = 'An toàn';
        if (isOverLimit) {
          statusColor = token.colorError;
          statusText = 'VƯỢT HẠN MỨC';
        } else if (usagePercent > 90) {
          statusColor = token.colorError;
          statusText = 'Báo động';
        } else if (usagePercent > 60) {
          statusColor = token.colorWarning;
          statusText = 'Cần chú ý';
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
                    <div>Hạn mức: <b>{formatMoney(limit, currency)}</b></div>
                    <div>Đã dùng: <b>{formatMoney(primaryBalance, currency)}</b></div>
                    <Divider style={{ margin: '4px 0', borderColor: 'rgba(255,255,255,0.2)' }} />
                    <div>Khả dụng: <b style={{ color: '#52c41a' }}>{formatMoney(availableCredit, currency)}</b></div>
                  </div>
                }>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                     <Space size={4}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor }} />
                        <span style={{ fontSize: '10px', color: '#8c8c8c' }}>Sử dụng:</span>
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
                        Còn: {formatMoney(availableCredit, currency)}
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
      title: 'ĐÁNH GIÁ RỦI RO / NĂNG LỰC',
      key: 'risk',
      width: 220,
      render: (_: any, record: IPartner) => {
        if (record.partnerType === 'CUSTOMER') {
          const riskConfig = {
            LOW: { color: 'success', text: 'Rủi ro: Thấp' },
            MEDIUM: { color: 'warning', text: 'Rủi ro: Trung bình' },
            HIGH: { color: 'error', text: 'Rủi ro: Cao' }
          };
          const config = riskConfig[record.riskLevel] || riskConfig.LOW;
          return (
            <Space>
              <Tag color={config.color} style={{ borderRadius: '4px' }}>
                {config.text}
              </Tag>
              {record.isManualRisk && (
                <Tooltip title="Rủi ro được chỉ định thủ công (Bởi Quản lý)">
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
              <Tooltip title={`Chất lượng: ${record.qualityScore} | Giao hàng: ${record.deliveryScore} | Giá: ${record.priceScore}`}>
                <Tag color="cyan" style={{ width: 'fit-content' }}>
                  Điểm năng lực: {avgScore.toFixed(1)}
                </Tag>
              </Tooltip>
              {record.vendorCategory && <Text type="secondary" style={{ fontSize: 11 }}>Ngành: {record.vendorCategory}</Text>}
            </div>
          );
        }

        return <Text type="secondary" italic style={{ fontSize: 12 }}>Chưa có đánh giá</Text>;
      }
    },
    {
      title: 'TRẠNG THÁI',
      dataIndex: 'isActive',
      width: 120,
      render: (active: boolean) => (
        <Badge status={active ? 'success' : 'default'} text={active ? 'Hoạt động' : 'Đang khóa'} />
      )
    },
    {
      title: 'THAO TÁC',
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_: any, record: IPartner) => (
        <Space size="small">
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#1890ff' }} />}
              onClick={() => { setDataUpdate(record); setIsUpdateModalOpen(true); }}
            />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                { key: '1', icon: <HistoryOutlined />, label: 'Xem lịch sử', onClick: () => openHistory(record) },
                {
                  key: '2',
                  icon: <DeleteOutlined />,
                  label: (
                    <Popconfirm
                      title="Xóa đối tác này?"
                      onConfirm={() => confirmDelete(record.id)}
                      okText="Xóa" cancelText="Hủy"
                    >
                      <span>Xóa đối tác</span>
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
  ], [accessToken]);

  const { token } = theme.useToken();
  const { isDark } = useTheme();

  return (
    <div style={{
      padding: '24px',
      backgroundColor: isDark ? '#0f172a' : token.colorBgLayout,
      minHeight: '100vh',
      transition: 'all 0.3s ease'
    }}>
      {contextHolder}

      {/* 1. Header Section */}
      <Row justify="space-between" align="bottom" style={{ marginBottom: '24px' }}>
        <Col>
          <PageHeader
            title="Quản Lý Đối Tác"
            icon={<TeamOutlined />}
            description="Quản lý thông tin nhà cung cấp và khách hàng"
          />
          <Text type="secondary">Hệ thống quản lý Buyer (Quốc tế) và Vendor (Nội địa)</Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ExportOutlined />}
              size="large"
              style={{ borderRadius: '8px' }}
              onClick={handleExport}
            >
              Xuất Excel
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => setIsCreateModalOpen(true)}
              style={{ borderRadius: '8px', height: '40px' }}
            >
              Thêm đối tác
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 2. Dashboard Stats Cards */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>Tổng Đối Tác</Text>}
              value={meta.total}
              prefix={<TeamOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />}
              styles={{ content: { color: isDark ? '#f8fafc' : undefined } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>Tổng Phải Thu (Quy đổi VND)</Text>}
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
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>Tổng Phải Trả (Quy đổi VND)</Text>}
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
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>Cảnh Báo Rủi Ro</Text>}
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
              placeholder="Tìm tên, mã số thuế, quốc gia..."
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
              type={Object.keys(filters).length > 0 ? "primary" : "default"}
            >
              Bộ lọc nâng cao {Object.keys(filters).length > 0 && `(${Object.keys(filters).length})`}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              size="large"
              onClick={fetchPartners}
            />
          </Space>

          {selectedRowKeys.length > 0 && (
            <Space>
              <span style={{ color: token.colorTextSecondary }}>Đã chọn <b>{selectedRowKeys.length}</b> đối tác</span>
              <Popconfirm
                title={`Bạn có chắc chắn muốn xóa ${selectedRowKeys.length} đối tác đã chọn?`}
                onConfirm={async () => {
                  const res = await sendRequest<IBackendRes<any>>({
                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners/bulk-delete`,
                    method: 'POST',
                    body: { ids: selectedRowKeys },
                    headers: { Authorization: `Bearer ${accessToken}` },
                  });
                  if (res?.data) {
                    api.success({ title: 'Thao tác thành công', description: res.message });
                    setSelectedRowKeys([]);
                    fetchPartners();
                  }
                }}
                okText="Xóa tất cả"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button danger type="primary" icon={<DeleteOutlined />}>Xóa hàng loạt</Button>
              </Popconfirm>
            </Space>
          )}
        </div>

        <div className="premium-table">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={partners}
            loading={isFetching}
            scroll={{ x: 1300 }}
            bordered={false}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            onChange={(pagination, filters, sorter: any) => {
              setMeta(prev => ({
                ...prev,
                current: pagination.current || 1,
                pageSize: pagination.pageSize || 10
              }));

              if (sorter.field) {
                setSortConfig({
                  field: sorter.field,
                  order: sorter.order
                });
              }
            }}
            pagination={{
              current: meta.current,
              pageSize: meta.pageSize,
              total: meta.total,
              showSizeChanger: true,
              showTotal: (total) => `Tổng cộng ${total} đối tác`,
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
            <span>BỘ LỌC NÂNG CAO</span>
          </Space>
        }
        placement="right"
        onClose={() => setIsFilterOpen(false)}
        open={isFilterOpen}
        size="default"
        extra={
          <Space>
            <Button onClick={handleResetFilters}>Đặt lại</Button>
            <Button type="primary" onClick={() => filterForm.submit()}>Áp dụng</Button>
          </Space>
        }
      >
        <Form
          form={filterForm}
          layout="vertical"
          onFinish={onFilterFinish}
          initialValues={filters}
        >
          <Form.Item label="Loại đối tác" name="partnerType">
            <Select
              allowClear
              placeholder="Tất cả loại đối tác"
              options={[
                { value: 'CUSTOMER', label: 'Khách hàng (Buyer)' },
                { value: 'SUPPLIER', label: 'Nhà cung cấp (Vendor)' },
                { value: 'LOGISTICS', label: 'Đơn vị vận chuyển' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Khu vực thương mại" name="region">
            <Select
              allowClear
              placeholder="Chọn khu vực"
              options={[
                { value: 'EU', label: 'Châu Âu (EU)' },
                { value: 'US', label: 'Hoa Kỳ (US)' },
                { value: 'ASEAN', label: 'Đông Nam Á (ASEAN)' },
                { value: 'APAC', label: 'Châu Á - Thái Bình Dương' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Mức độ rủi ro (Buyer)" name="riskLevel">
            <Select
              allowClear
              placeholder="Chọn mức rủi ro"
              options={[
                { value: 'LOW', label: 'Thấp' },
                { value: 'MEDIUM', label: 'Trung bình' },
                { value: 'HIGH', label: 'Cao' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Trạng thái hoạt động" name="isActive">
            <Select
              allowClear
              placeholder="Tất cả trạng thái"
              options={[
                { value: true, label: 'Đang hoạt động' },
                { value: false, label: 'Đang khóa' },
              ]}
            />
          </Form.Item>

          <Divider />

          <Form.Item label="Quốc gia" name="country">
            <Input placeholder="Ví dụ: Vietnam, USA..." allowClear />
          </Form.Item>

          <Form.Item label="Mã số thuế" name="taxCode">
            <Input placeholder="Nhập MST" allowClear />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={<Space><HistoryOutlined /> Chi tiết lịch sử giao dịch</Space>}
        size="default"
        onClose={() => setHistoryOpen(false)}
        open={historyOpen}
        destroyOnHidden
      >
        {historyLoading ? <div style={{ textAlign: 'center', padding: 50 }}>Đang tải...</div> : (
          <>
            <Title level={4}>{historyData?.partner?.name}</Title>
            <Divider />
            <Tabs items={
              historyData?.partner?.partnerType === 'LOGISTICS' ? [
                {
                  key: '1', label: 'Lô hàng đã đi',
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
                            <div key={item.id} style={{
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
                                  B/L: {item.blNumber || 'Chưa có'}
                                </Text>
                              </div>
                            </div>
                          );
                        })
                      ) : <Empty description="Chưa có dữ liệu vận tải" />}
                    </div>
                  )
                },
                {
                  key: '2', label: 'Công nợ phải trả',
                  children: (
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                       <Statistic 
                          title="Tổng công nợ phải trả (AP)" 
                          value={historyData?.partner?.apBalance || 0} 
                          suffix={historyData?.partner?.defaultCurrency || 'USD'}
                          valueStyle={{ color: '#cf1322' }}
                       />
                       <Divider />
                       <Text type="secondary">Chi tiết các hóa đơn vận tải đang được cập nhật...</Text>
                    </div>
                  )
                }
              ] : [
                {
                  key: '1', label: 'Báo giá',
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
                            <div key={item.id} style={{
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
                      ) : <Empty description="Chưa có dữ liệu báo giá" />}
                    </div>
                  )
                },
                {
                  key: '2', label: 'Hóa đơn PI',
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(historyData?.proformaInvoices?.items || []).length > 0 ? (
                        (historyData?.proformaInvoices?.items || []).map((item: any) => (
                          <div key={item.id} style={{
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
                      ) : <Empty description="Chưa có dữ liệu hóa đơn PI" />}
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
