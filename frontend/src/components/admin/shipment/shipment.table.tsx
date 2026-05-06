'use client'

import { 
  Input, Popconfirm, Space, Table, Tag, theme, Typography, 
  Card, Row, Col, Statistic, Button, Badge, Drawer, Form, Select, Tooltip 
} from 'antd';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {DeleteTwoTone, EyeTwoTone, TruckOutlined, SearchOutlined, FilterOutlined, ReloadOutlined, DeploymentUnitOutlined, CalendarOutlined, CheckCircleOutlined, FilePdfOutlined} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';

import ShipmentDetailDrawer from './shipment.detail';
import ShipmentDocCenter from './shipment.doc-center';
import { useDebounce } from '@/utils/customHook';
import { useShipments } from '@/hooks/useShipments';
import { SHIPMENT_STATUS_CONFIG } from '@/constants/o2c';
import type { IShipment, ShipmentStatus } from '@/types/o2c';

import type { Session } from 'next-auth';
import type { TableProps } from 'antd';

const { Title, Text } = Typography;

interface IProps {
  session: Session | null;
}

const ShipmentTable = ({ session }: IProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = theme.useToken();
  const isDark = (session?.user as any)?.theme === 'dark';
  const tStatus = useTranslations('ShipmentStatus');
  const tTable = useTranslations('ShipmentTable');
  const tCommon = useTranslations('Common');

  // Pagination state derived from URL
  const current = searchParams.get('current') ?? '1';
  const pageSize = searchParams.get('pageSize') ?? '10';

  // Search state
  const [searchInput, setSearchInput] = useState<string>("");
  const debouncedSearchText = useDebounce(searchInput, 500);

  const { data, meta, stats, loading, fetchShipments, deleteShipment, issueStock } = useShipments(session);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [docCenterOpen, setDocCenterOpen] = useState(false);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<any>({});
  const [filterForm] = Form.useForm();

  useEffect(() => {
    fetchShipments({
      current: Number(current),
      pageSize: Number(pageSize),
      search: debouncedSearchText || undefined,
      sort: '-createdAt',
      ...filters
    });
  }, [fetchShipments, current, pageSize, debouncedSearchText, filters]);

  const handleDelete = useCallback((id: string) => {
    deleteShipment(id, () => {
      fetchShipments({
        current: Number(current),
        pageSize: Number(pageSize),
        search: debouncedSearchText || undefined,
        sort: '-createdAt',
      });
    });
  }, [deleteShipment, fetchShipments, current, pageSize, debouncedSearchText]);

  const columns = useMemo<TableProps<IShipment>['columns']>(() => [
    {
      title: 'Số Lô Hàng',
      dataIndex: 'shipmentNumber',
      key: 'shipmentNumber',
      render: (text: string) => <b style={{ color: token.colorPrimary }}>{text}</b>,
    },
    {
      title: 'Tham chiếu',
      key: 'reference',
      render: (_: any, record: IShipment) => (
        <Space orientation="vertical" size={0}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            PI: {record.proformaInvoice?.piNumber || record.salesContract?.proformaInvoice?.piNumber || '-'}
          </Text>
          <Text strong style={{ fontSize: '12px' }}>HĐ: {record.salesContract?.contractNumber || '-'}</Text>
        </Space>
      )
    },
    {
      title: 'Forwarder (Đơn vị vận tải)',
      dataIndex: ['logisticsPartner', 'name'],
      key: 'logisticsPartner',
      render: (name: string | undefined) => name || '-',
    },
    {
      title: 'Số Booking',
      dataIndex: 'bookingNumber',
      key: 'bookingNumber',
      render: (booking: string | undefined) => booking ? <Tag color="purple">{booking}</Tag> : '-',
    },
    {
      title: 'Cảng đi (POL)',
      dataIndex: 'pol',
      key: 'pol',
    },
    {
      title: 'Cảng đến (POD)',
      dataIndex: 'pod',
      key: 'pod',
    },
    {
      title: 'Ngày tàu chạy (ETD)',
      dataIndex: 'etd',
      key: 'etd',
      render: (date: string | undefined) => date ? new Date(date).toLocaleDateString('vi-VN') : '-',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: ShipmentStatus) => (
        <Tag color={SHIPMENT_STATUS_CONFIG[status].color}>
          {tStatus(status)}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 150,
      render: (_value: unknown, record: IShipment) => (
        <Space size="middle">
          {!record.isStockIssued ? (
            <Popconfirm
              title="Xác nhận xuất kho?"
              description="Hệ thống sẽ thực hiện trừ tồn kho thực tế."
              onConfirm={() => issueStock(record.id, () => fetchShipments({ current: 1, pageSize: 10 }))}
              okText="Xác nhận"
              cancelText="Hủy"
            >
              <Button 
                type="primary" 
                size="small" 
                icon={<CheckCircleOutlined />}
                style={{ background: '#10b981', borderColor: '#10b981' }}
              >
                XUẤT KHO
              </Button>
            </Popconfirm>
          ) : (
            <Tag color="success" icon={<CheckCircleOutlined />}>ĐÃ XUẤT</Tag>
          )}
          
          <Tooltip title="Xem chi tiết">
            <EyeTwoTone
              style={{ cursor: 'pointer', fontSize: 18 }}
              onClick={() => {
                setSelectedShipmentId(record.id);
                setDetailOpen(true);
              }}
            />
          </Tooltip>

          <Tooltip title="Bộ chứng từ (CI/PL)">
            <FilePdfOutlined 
              style={{ cursor: 'pointer', fontSize: 18, color: '#f5222d' }}
              onClick={() => {
                setSelectedShipmentId(record.id);
                setDocCenterOpen(true);
              }}
            />
          </Tooltip>

          <Popconfirm
            title="Xóa Lô Hàng"
            description="Bạn có chắc muốn xóa lô hàng này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Đồng ý"
            cancelText="Hủy"
          >
            <DeleteTwoTone twoToneColor="#eb2f96" style={{ cursor: 'pointer', fontSize: 18 }} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleDelete, issueStock, fetchShipments, token.colorPrimary, tStatus, isDark]);

  const onFilterFinish = (values: any) => {
    setFilters(values);
    setIsFilterOpen(false);
  };

  const handleResetFilters = () => {
    filterForm.resetFields();
    setFilters({});
    setIsFilterOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <PageHeader 
        title={tTable('title')} 
        icon={<TruckOutlined className="text-blue-500" />} 
        description={tTable('description')} 
      />

      {/* 2. Statistics Cards */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>TỔNG LÔ HÀNG</Text>}
              value={stats.total}
              styles={{ content: { color: isDark ? '#f8fafc' : '#1e293b', fontWeight: 900, fontSize: '24px' } }}
              prefix={<DeploymentUnitOutlined style={{ color: '#3b82f6', marginRight: '8px' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>ĐANG VẬN CHUYỂN</Text>}
              value={stats.inTransit}
              styles={{ content: { color: isDark ? '#f8fafc' : '#1e293b', fontWeight: 900, fontSize: '24px' } }}
              prefix={<CalendarOutlined style={{ color: '#f59e0b', marginRight: '8px' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>HOÀN TẤT</Text>}
              value={stats.closed}
              styles={{ content: { color: isDark ? '#f8fafc' : '#1e293b', fontWeight: 900, fontSize: '24px' } }}
              prefix={<CheckCircleOutlined style={{ color: '#10b981', marginRight: '8px' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 3. Integrated Table Section */}
      <Card
        variant="borderless"
        style={{
          borderRadius: '12px',
          background: isDark ? '#1e293b' : token.colorBgContainer,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)'
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size="large">
            <Input
              placeholder="Tìm số lô hàng hoặc booking..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              prefix={<SearchOutlined className="text-slate-400" />}
              className="rounded-xl border-slate-200"
              style={{ width: 320, height: 40 }}
              allowClear
            />
          </Space>
          <div className="flex items-center space-x-3">
            <Badge count={Object.keys(filters).filter(k => filters[k]).length} size="small" offset={[2, 0]}>
              <Button 
                icon={<FilterOutlined />} 
                className="rounded-xl h-10 border-slate-200 text-slate-500 hover:text-blue-500 hover:border-blue-500 transition-all"
                onClick={() => setIsFilterOpen(true)}
              >
                Bộ lọc nâng cao
              </Button>
            </Badge>
            <Button 
              icon={<ReloadOutlined />} 
              shape="circle" 
              className="border-slate-200 text-slate-400"
              onClick={() => fetchShipments({ current: 1, pageSize: 10 })}
            />
          </div>
        </div>

        <div className="premium-table">
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            bordered={false}
            pagination={{
              current: Number(meta.current),
              pageSize: Number(meta.pageSize),
              total: meta.total,
              showTotal: (total) => `Tổng cộng ${total} lô hàng`,
              className: "px-6 py-4 border-t border-slate-50"
            }}
            onChange={(pagination) => {
              const params = new URLSearchParams(searchParams.toString());
              if (pagination?.current) params.set('current', pagination.current.toString());
              if (pagination?.pageSize) params.set('pageSize', pagination.pageSize.toString());
              router.replace(`${pathname}?${params.toString()}`);
            }}
          />
        </div>
      </Card>

      {/* 4. Advanced Filter Drawer */}
      <Drawer
        title={
          <Space>
            <FilterOutlined />
            <span>BỘ LỌC LÔ HÀNG</span>
          </Space>
        }
        placement="right"
        onClose={() => setIsFilterOpen(false)}
        open={isFilterOpen}
        styles={{ wrapper: { width: 400 } }}
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
          <Form.Item label="Trạng thái" name="status">
            <Select placeholder="Tất cả trạng thái" allowClear>
              {Object.keys(SHIPMENT_STATUS_CONFIG).map(key => (
                <Select.Option key={key} value={key}>{tStatus(key as ShipmentStatus)}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Cảng đi (POL)" name="pol">
            <Input placeholder="VD: CAT LAI, HAIPHONG..." />
          </Form.Item>
          <Form.Item label="Cảng đến (POD)" name="pod">
            <Input placeholder="VD: HAMBURG, JEBEL ALI..." />
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
        onSuccess={() => fetchShipments({
          current: Number(current),
          pageSize: Number(pageSize),
          search: debouncedSearchText || undefined,
          sort: '-createdAt',
        })}
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
