'use client';

import React, { useEffect, useState } from 'react';
import { Table, Tag, Card, Button, Space, Typography, Tooltip, Badge, Popconfirm, App, Skeleton, Select, Row, Col, Drawer, Form, Input, Divider, theme, Statistic } from 'antd';
import {
  CheckCircleOutlined,
  SendOutlined,
  RocketOutlined,
  DollarOutlined,
  EyeOutlined,
  FilePdfOutlined,
  PlusOutlined,
  SearchOutlined,
  FilterOutlined, FileProtectOutlined, ReloadOutlined, TruckOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { getSession, useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { useCurrency } from '@/hooks/useCurrency';
import { GLOBAL_EXCHANGE_RATE } from '@/constants/currency.config';
import SalesContractDetailModal from './sales-contract.detail';
import useDebounce from '../../../hooks/useDebounce';
import dayjs from 'dayjs';
import SalesContractModal from './sales-contract.modal';
import ShipmentFromPIModal from '../shipment/shipment.from-pi';
import { useTranslations } from 'next-intl';

const { Title, Text } = Typography;


const getStatusConfig = (t: any): Record<string, { color: string; icon: React.ReactNode; label: string }> => ({
  DRAFT: { color: 'cyan', icon: <SendOutlined />, label: t('status.DRAFT') },
  CONFIRMED: { color: 'blue', icon: <CheckCircleOutlined />, label: t('status.CONFIRMED') },
  SHIPPED: { color: 'orange', icon: <RocketOutlined />, label: t('status.SHIPPED') },
  PAID: { color: 'green', icon: <DollarOutlined />, label: t('status.PAID') },
  CANCELLED: { color: 'red', icon: <CheckCircleOutlined />, label: t('status.CANCELLED') },
});

const SalesContractTable = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [partners, setPartners] = useState<any[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState<any>({
    buyerId: undefined,
    incoterm: undefined,
    paymentTerms: undefined,
  });
  const [filterForm] = Form.useForm();
  const debouncedSearch = useDebounce(searchText, 500);

  const { data: session } = useSession();
  const { message, notification } = App.useApp();
  const t = useTranslations('SalesContract');
  const { formatMoney, formatVND } = useCurrency();
  const { token } = theme.useToken();
  const isDark = (session?.user as any)?.theme === 'dark';

  const canWrite = (session?.user?.role as any)?.name === 'ADMIN' ||
    (session?.user?.role as any)?.permissions?.some((p: any) => p.name === 'write:sales_contract' || p.name === 'read:all');


  const fetchData = async (current = 1, pageSize = 10, search = debouncedSearch) => {
    setLoading(true);
    try {
      const queryParams: any = { current, pageSize };
      if (search) queryParams.contractNumber = `/${search}/i`;
      if (statusFilter) queryParams.status = statusFilter;
      
      // Merge advanced filters
      if (advancedFilters.buyerId) queryParams.buyerId = advancedFilters.buyerId;
      if (advancedFilters.incoterm) queryParams.incoterm = advancedFilters.incoterm;
      if (advancedFilters.paymentTerms) queryParams.paymentTerms = `/${advancedFilters.paymentTerms}/i`;

      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts`,
        method: 'GET',
        queryParams,
        headers: { Authorization: `Bearer ${session?.user?.access_token}` }
      });

      if (res?.data) {
        setData(res.data.results);
        setMeta(res.data.meta);
      }
    } catch (error) {
      message.error(t('messages.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1, meta.pageSize, debouncedSearch);
  }, [debouncedSearch, statusFilter, advancedFilters]);

  useEffect(() => {
    const fetchPartners = async () => {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 100 },
        headers: { Authorization: `Bearer ${session?.user?.access_token}` }
      });
      if (res?.data) setPartners(res.data.results);
    };
    if (session) fetchPartners();
  }, [session]);

  const handleApplyFilters = (values: any) => {
    setAdvancedFilters(values);
    setIsFilterOpen(false);
  };

  const handleResetFilters = () => {
    filterForm.resetFields();
    setAdvancedFilters({});
    setStatusFilter(null);
    setIsFilterOpen(false);
  };

  const activeFilterCount = Object.values(advancedFilters).filter(v => v !== undefined && v !== '').length;

  const handleAction = async (id: string, action: 'confirm' | 'ship') => {
    try {
      const session = await getSession();
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/${id}/${action}`,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session?.user?.access_token}` }
      });

      if (res?.data) {
        message.success(action === 'confirm' ? t('messages.confirmSuccess') : t('messages.shipSuccess'));
        fetchData(meta.current, meta.pageSize);
      } else {
        message.error(res?.message || t('messages.actionFailed'));
      }
    } catch (error) {
      message.error(t('messages.actionFailed'));
    }
  };

  const columns = [
    {
      title: t('table.columns.contract'),
      dataIndex: 'contractNumber',
      key: 'contractNumber',
      render: (text: string, record: any) => (
        <div className="flex flex-col">
          <Text strong className="text-slate-800 dark:text-slate-200 text-sm m-0">{text}</Text>
          <Text className="text-gray-400 text-[10px]">{dayjs(record.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
        </div>
      ),
    },
    {
      title: t('table.columns.buyer'),
      dataIndex: 'buyer',
      key: 'buyer',
      render: (buyer: any) => (
        <Space size="middle">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
            {buyer?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col">
            <Text strong className="text-slate-200">{buyer?.name || 'Unknown'}</Text>
            <Text className="text-gray-500 text-xs">{buyer?.country || 'N/A'}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: t('table.columns.value'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (val: number, record: any) => (
        <div className="flex flex-col items-end">
          <Text className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {formatMoney(val, record.currencyCode)}
          </Text>
          <div className="flex items-center gap-2 mt-1">
            {record.currencyCode !== 'VND' && (
              <Text type="secondary" className="text-[10px] italic">
                (~ {formatVND(record.totalAmountVnd)})
              </Text>
            )}
            <Tag color="magenta" className="m-0 border-none font-bold px-3 py-0.5 rounded-full">
              {record.incoterm || 'FOB'}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: t('table.columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = getStatusConfig(t)[status] || getStatusConfig(t).DRAFT;
        return (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            key={status}
          >
            <Tag
              icon={config.icon}
              color={config.color}
              className="font-bold px-4 py-1 rounded-lg border-none shadow-sm uppercase tracking-wider"
            >
              {config.label}
            </Tag>
          </motion.div>
        );
      },
    },
    {
      title: t('table.columns.actions'),
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          {record.status === 'DRAFT' && canWrite && (
            <Popconfirm
              title={t('messages.confirmTitle')}
              onConfirm={() => handleAction(record.id, 'confirm')}
              okText={t('messages.confirmOk')}
              cancelText={t('messages.cancel')}
            >
              <Button
                type="primary"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-none h-10 px-6 rounded-xl font-bold shadow-lg shadow-blue-500/30"
                icon={<CheckCircleOutlined />}
              >
                {t('actions.confirm')}
              </Button>
            </Popconfirm>
          )}

          {record.status === 'CONFIRMED' && canWrite && (
            <Button
              type="primary"
              className="bg-gradient-to-r from-blue-500 to-indigo-600 border-none h-10 px-6 rounded-xl font-bold shadow-lg shadow-blue-500/30"
              icon={<TruckOutlined />}
              onClick={() => { setSelectedRecord(record); setIsShipmentModalOpen(true); }}
            >
              LẬP LÔ HÀNG
            </Button>
          )}

          <Tooltip title={t('actions.view')}>
            <Button
              onClick={() => { setSelectedRecord(record); setIsDetailOpen(true); }}
              shape="circle"
              className="bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-white"
              icon={<EyeOutlined />}
            />
          </Tooltip>
          <Tooltip title={t('actions.pdf')}>
            <Button
              onClick={() => message.info("Đang tạo tệp PDF...")}
              shape="circle"
              className="bg-slate-800 border-slate-700 text-red-400 hover:text-red-300 hover:border-red-300"
              icon={<FilePdfOutlined />}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Restored Header Section */}
      <div className="flex justify-between items-center mb-2">
        <PageHeader
          title={t('title').replace('(O2C)', '').trim()}
          icon={<FileProtectOutlined className="text-blue-500" />}
          description={t('description')}
        />
        <div className="flex space-x-3">
          <Button
            icon={<FilePdfOutlined />}
            className="flex items-center rounded-xl h-10 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900/50 hover:border-blue-500 hover:text-blue-500 transition-all"
            onClick={() => message.info("Đang chuẩn bị tệp PDF...")}
          >
            Xuất PDF
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="bg-blue-600 hover:bg-blue-500 h-10 px-6 rounded-xl font-bold shadow-md shadow-blue-500/20 border-none flex items-center transition-all"
            onClick={() => canWrite && setIsModalOpen(true)}
            disabled={!canWrite}
          >
            THÊM HỢP ĐỒNG
          </Button>
        </div>
      </div>

      {/* 2. Synchronized Statistics Cards */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>TỔNG TRỊ GIÁ (QUY ĐỔI USD)</Text>}
              value={data.reduce((sum, item) => sum + Number(item.totalAmountVnd || 0), 0) / GLOBAL_EXCHANGE_RATE}
              formatter={(val) => formatMoney(Number(val), 'USD')}
              styles={{ content: { color: isDark ? '#f8fafc' : '#1e293b', fontWeight: 900, fontSize: '24px' } }}
              prefix={<DollarOutlined style={{ color: '#3b82f6', marginRight: '8px' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>HỢP ĐỒNG CHỜ DUYỆT</Text>}
              value={data.filter(item => item.status === 'DRAFT').length}
              styles={{ content: { color: isDark ? '#f8fafc' : '#1e293b', fontWeight: 900, fontSize: '24px' } }}
              prefix={<SendOutlined style={{ color: '#f59e0b', marginRight: '8px' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>ĐÃ GIAO HÀNG</Text>}
              value={data.filter(item => item.status === 'SHIPPED' || item.status === 'PAID').length}
              styles={{ content: { color: isDark ? '#f8fafc' : '#1e293b', fontWeight: 900, fontSize: '24px' } }}
              prefix={<RocketOutlined style={{ color: '#10b981', marginRight: '8px' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 3. Main Data Section (Integrated Toolbar + Table) */}
      <Card
        variant="borderless"
        style={{
          borderRadius: '12px',
          background: isDark ? '#1e293b' : token.colorBgContainer,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)',
          marginTop: '20px'
        }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Toolbar inside Card */}
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size="large">
            <Input
              placeholder="Tìm số hợp đồng..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined className="text-slate-400" />}
              className="rounded-xl border-slate-200"
              style={{ width: 320, height: 40 }}
              allowClear
            />
            <Select
              placeholder="Tất cả trạng thái"
              allowClear
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              style={{ width: 180, height: 40 }}
              className="rounded-xl"
              options={[
                { value: 'DRAFT', label: 'Nháp (Draft)' },
                { value: 'CONFIRMED', label: 'Đã xác nhận' },
                { value: 'SHIPPED', label: 'Đã giao hàng' },
                { value: 'PAID', label: 'Đã thanh toán' },
              ]}
            />
          </Space>
          <div className="flex items-center space-x-3">
            <Badge count={activeFilterCount} size="small" offset={[2, 0]}>
              <Button 
                icon={<FilterOutlined />} 
                className={`rounded-xl h-10 transition-all ${activeFilterCount > 0 ? 'border-blue-500 text-blue-500 bg-blue-50' : 'border-slate-200 text-slate-500 bg-transparent hover:border-blue-500 hover:text-blue-500'}`}
                onClick={() => setIsFilterOpen(true)}
              >
                Bộ lọc nâng cao
              </Button>
            </Badge>
            <Button 
              icon={<ReloadOutlined />} 
              shape="circle" 
              className="border-slate-200 text-slate-400"
              onClick={() => fetchData(meta.current, meta.pageSize)}
            />
          </div>
        </div>

        {/* Table Section */}
        <div className="premium-table">
          {loading ? (
            <div className="p-12"><Skeleton active paragraph={{ rows: 8 }} /></div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={searchText + (statusFilter || '')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Table
                  columns={columns}
                  dataSource={data}
                  pagination={{
                    ...meta,
                    showSizeChanger: true,
                    className: "px-6 py-4 border-t border-slate-50",
                    showTotal: (total) => `Tổng cộng ${total} hợp đồng`
                  }}
                  onChange={(pagination) => fetchData(pagination.current, pagination.pageSize)}
                  rowKey="id"
                  bordered={false}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </Card>
      <style jsx global>{`
        .premium-table .ant-table {
          background: transparent !important;
        }
        .premium-table .ant-table-thead > tr > th {
          background: transparent !important;
          color: #64748b !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          font-size: 11px !important;
          letter-spacing: 0.05em !important;
          border-bottom: 1px solid rgba(226, 232, 240, 0.1) !important;
          padding: 16px 24px !important;
        }
        .premium-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid rgba(226, 232, 240, 0.05) !important;
          padding: 20px 24px !important;
        }
        .premium-table .ant-pagination-item-active {
            background: #2563eb !important;
            border-color: #2563eb !important;
        }
        .premium-table .ant-pagination-item-active a {
            color: white !important;
        }
        .premium-select-dynamic .ant-select-selector {
            background-color: rgba(248, 250, 252, 0.05) !important;
            border-color: rgba(226, 232, 240, 0.1) !important;
            border-radius: 12px !important;
            height: 42px !important;
            display: flex !important;
            align-items: center !important;
            color: inherit !important;
        }
      `}</style>
      <SalesContractModal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchData(1, meta.pageSize);
        }}
      />
      <SalesContractDetailModal
        open={isDetailOpen}
        onCancel={() => setIsDetailOpen(false)}
        data={selectedRecord}
      />

      {selectedRecord && (
        <ShipmentFromPIModal
          open={isShipmentModalOpen}
          setOpen={setIsShipmentModalOpen}
          pi={{
            ...selectedRecord,
            piNumber: selectedRecord.contractNumber, 
            id: undefined, 
            salesContractId: selectedRecord.id,
            customer: selectedRecord.buyer // Map buyer to customer for modal display
          }}
        />
      )}

      <Drawer
        title={
          <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-100">
            <FilterOutlined className="text-blue-500" />
            <span className="font-bold">Bộ lọc nâng cao</span>
          </div>
        }
        placement="right"
        onClose={() => setIsFilterOpen(false)}
        open={isFilterOpen}
        styles={{ 
          wrapper: { width: 400 },
          body: { padding: '24px' } 
        }}
        extra={
          <Button type="link" onClick={handleResetFilters} className="text-slate-400 hover:text-blue-500">
            Làm mới
          </Button>
        }
        footer={
          <div className="flex space-x-3 p-2">
            <Button className="flex-1 rounded-xl h-11 border-slate-200" onClick={() => setIsFilterOpen(false)}>
              Hủy
            </Button>
            <Button type="primary" className="flex-1 rounded-xl h-11 bg-blue-600" onClick={() => filterForm.submit()}>
              Áp dụng
            </Button>
          </div>
        }
        className="dark:bg-slate-900"
      >
        <Form
          form={filterForm}
          layout="vertical"
          onFinish={handleApplyFilters}
          initialValues={advancedFilters}
          className="premium-form"
        >
          <Form.Item label="Khách hàng (Buyer)" name="buyerId">
            <Select
              placeholder="Chọn khách hàng"
              showSearch
              allowClear
              optionFilterProp="label"
              options={partners.map(p => ({ value: p.id, label: p.name }))}
              className="premium-select-dynamic"
            />
          </Form.Item>

          <Form.Item label="Điều kiện thương mại" name="incoterm">
            <Select
              placeholder="Chọn Incoterm"
              allowClear
              options={[
                { value: 'EXW', label: 'EXW - Ex Works' },
                { value: 'FOB', label: 'FOB - Free On Board' },
                { value: 'CIF', label: 'CIF - Cost, Insurance and Freight' },
                { value: 'CFR', label: 'CFR - Cost and Freight' },
                { value: 'DDP', label: 'DDP - Delivered Duty Paid' },
              ]}
              className="premium-select-dynamic"
            />
          </Form.Item>

          <Form.Item label="Trạng thái hợp đồng" name="status">
            <Select
              placeholder="Tất cả trạng thái"
              allowClear
              options={[
                { value: 'DRAFT', label: 'Nháp (Draft)' },
                { value: 'CONFIRMED', label: 'Đã xác nhận' },
                { value: 'SHIPPED', label: 'Đã giao hàng' },
                { value: 'PAID', label: 'Đã thanh toán' },
              ]}
              className="premium-select-dynamic"
            />
          </Form.Item>

          <Form.Item label="Phương thức thanh toán" name="paymentTerms">
            <Input placeholder="Ví dụ: T/T, L/C..." className="rounded-xl h-10 border-slate-200" />
          </Form.Item>
          
          <Divider className="my-6 border-slate-100 dark:border-slate-800" />
          
          <div className="bg-blue-50/50 dark:bg-blue-500/5 p-4 rounded-2xl border border-blue-100 dark:border-blue-500/10">
            <Text className="text-[11px] text-blue-600/70 uppercase font-bold tracking-widest block mb-2">Thông tin</Text>
            <Text className="text-slate-500 text-xs leading-relaxed">
              Sử dụng bộ lọc nâng cao để tìm kiếm hợp đồng chính xác hơn theo khách hàng và điều khoản thương mại.
            </Text>
          </div>
        </Form>
      </Drawer>
    </div>
  );
};

export default SalesContractTable;
