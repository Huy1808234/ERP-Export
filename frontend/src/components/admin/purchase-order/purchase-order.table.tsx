'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Button, Popconfirm, Space, Table, Tag, Input, Select, Typography, Card, Tooltip } from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  ShoppingCartOutlined,
  SearchOutlined,
  BarcodeOutlined,
  FileDoneOutlined,
  AuditOutlined,
  CarryOutOutlined,
  TransactionOutlined,
  HistoryOutlined,
  SendOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { Row, Col, Statistic, Divider, theme } from 'antd';
import { debounce } from '@/utils/debounce';
import { useTheme } from '@/library/theme.context';
import { useTranslations } from 'next-intl';

import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { PO_STATUS_CONFIG, PO_STATUS_OPTIONS } from '@/constants/purchase-order';
import { IPurchaseOrder, POStatus } from '@/types/purchase-order';
import { formatDate } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import GoodsReceiptModal from '../goods-receipt/goods-receipt.modal';
import VendorInvoiceModal from '../vendor-invoice/vendor-invoice.modal';
import PurchaseOrderDetailModal from './purchase-order.detail';

const { Text, Title } = Typography;

const PurchaseOrderTable: React.FC = () => {
  const { data, meta, loading, fetchPOs, deletePO, stats, fetchStats, sendPO } = usePurchaseOrders();
  const t = useTranslations('PurchaseOrder');
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const { formatMoney, formatVND } = useCurrency();

  const [filters, setFilters] = useState({
    searchText: '',
    status: undefined as string | undefined,
  });
  
  const localizedStatusOptions = useMemo(() => 
    Object.keys(PO_STATUS_CONFIG).map(status => ({
      value: status,
      label: status ? t(`status.${status}`) : 'N/A'
    })), [t]);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isGrnOpen, setIsGrnOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    fetchPOs({
      current: meta.current,
      pageSize: meta.pageSize,
      poNumber: filters.searchText,
      status: filters.status,
    });
    fetchStats();
  }, [meta.current, meta.pageSize, filters.searchText, filters.status, fetchPOs, fetchStats]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTableChange = useCallback((page: number, pageSize: number) => {
    fetchPOs({
      current: page,
      pageSize,
      poNumber: filters.searchText,
      status: filters.status
    });
  }, [filters, fetchPOs]);

  const onSearch = useMemo(
    () => debounce((value: string) => {
      setFilters(prev => ({ ...prev, searchText: value }));
    }, 500),
    []
  );

  const handleOpenDetail = useCallback((id: string) => {
    setSelectedPoId(id);
    setIsDetailOpen(true);
  }, []);

  const handleSend = useCallback(async (id: string) => {
    await sendPO(id, () => loadData());
  }, [sendPO, loadData]);

  const handleDelete = useCallback(async (id: string) => {
    await deletePO(id, () => loadData());
  }, [deletePO, loadData]);

  const columns = useMemo(() => [
    {
      title: t('table.columns.poNumber'),
      dataIndex: 'poNumber',
      key: 'poNumber',
      width: 150,
      render: (text: string) => (
        <Text strong style={{ color: '#1677ff' }}>{text}</Text>
      ),
    },
    {
      title: t('table.columns.vendor'),
      dataIndex: ['vendor', 'name'],
      key: 'vendor',
      ellipsis: true,
      render: (name?: string) => name || <Text type="secondary">N/A</Text>,
    },
    {
      title: t('table.columns.orderDate'),
      dataIndex: 'orderDate',
      key: 'orderDate',
      width: 140,
      render: (date: string) => formatDate(date),
    },
    {
      title: t('table.columns.expectedDelivery'),
      dataIndex: 'expectedDeliveryDate',
      key: 'expectedDeliveryDate',
      width: 140,
      render: (date?: string) => date ? formatDate(date) : '-',
    },
    {
      title: t('table.columns.totalAmount'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      width: 170,
      render: (amount: number, record: IPurchaseOrder) => (
        <Text strong type="danger">
          {formatMoney(amount, record.currency)}
        </Text>
      ),
    },
    {
      title: t('table.columns.status'),
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: POStatus) => {
        const config = (PO_STATUS_CONFIG as any)[status] || { color: 'default' };
        return <Tag color={config.color} style={{ borderRadius: 4 }}>{status ? t(`status.${status}`) : 'N/A'}</Tag>;
      },
    },
    {
      title: t('table.columns.actions'),
      key: 'action',
      align: 'center' as const,
      width: 180,
      render: (_: any, record: IPurchaseOrder) => (
        // stopPropagation ở wrapper Space: mọi click trong cột Thao tác
        // (kể cả nút "Xóa" bên trong Popconfirm overlay) đều không bubble
        // lên onRow.onClick → tránh mở modal chi tiết khi xóa
        <Space size="middle" onClick={(e) => e.stopPropagation()}>
          <Tooltip title={t('tooltips.viewDetail')}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ color: '#1677ff', fontSize: 16 }} />}
              onClick={() => handleOpenDetail(record.id)}
            />
          </Tooltip>
          {record.status === 'DRAFT' && (
             <Tooltip title={t('tooltips.sendOrder')}>
              <Button
                type="text"
                size="small"
                icon={<SendOutlined style={{ color: '#fa8c16', fontSize: 16 }} />}
                onClick={() => handleSend(record.id)}
              />
            </Tooltip>
          )}
          {record.status === 'SENT' && (
            <>
              <Tooltip title={t('tooltips.goodsReceipt')}>
                <Button
                  type="text"
                  size="small"
                  icon={<BarcodeOutlined style={{ color: '#08979c' }} />}
                  onClick={() => {
                    setSelectedPoId(record.id);
                    setIsGrnOpen(true);
                  }}
                />
              </Tooltip>
              <Tooltip title={t('tooltips.createInvoice')}>
                <Button
                  type="text"
                  size="small"
                  icon={<FileDoneOutlined style={{ color: '#722ed1' }} />}
                  onClick={() => {
                    setSelectedPoId(record.id);
                    setIsInvoiceOpen(true);
                  }}
                />
              </Tooltip>
            </>
          )}
          {record.status !== 'DRAFT' && (
            <Tooltip title={t('tooltips.threeWayMatching')}>
              <Button
                type="text"
                size="small"
                icon={<SafetyCertificateOutlined style={{ color: '#52c41a', fontSize: 16 }} />}
                onClick={() => {
                  setSelectedPoId(record.id);
                  handleOpenDetail(record.id);
                }}
              />
            </Tooltip>
          )}
          <Popconfirm
            title={t('popconfirm.deleteTitle')}
            description={t('popconfirm.deleteDesc')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('popconfirm.okText')}
            cancelText={t('popconfirm.cancelText')}
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleDelete, handleOpenDetail]);

  const summary = useMemo(() => ({
    total: stats?.total || 0,
    pending: stats?.pending || 0,
    value: stats?.value || 0,
  }), [stats]);

  return (
    <div style={{ 
      padding: '24px', 
      backgroundColor: isDark ? '#0f172a' : token.colorBgLayout, 
      minHeight: '100vh',
      transition: 'all 0.3s ease'
    }}>
      <PageHeader 
        title={t('title')} 
        icon={<ShoppingCartOutlined style={{ color: '#08979c' }} />} 
        description={t('description')} 
      />
      
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 4, height: 16, background: '#08979c', borderRadius: 2 }} />
        <Text strong style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#595959', textTransform: 'uppercase', letterSpacing: 1 }}>{t('isoStandard')}</Text>
      </div>

      {/* Summary Statistics - Premium Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            variant="borderless" 
            hoverable 
            style={{ 
              borderRadius: '16px', 
              background: isDark ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              border: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`
            }}
          >
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>{t('stats.totalOrders')}</Text>} 
              value={summary.total} 
              prefix={<AuditOutlined style={{ color: '#08979c', marginRight: 8 }} />} 
              styles={{ content: { fontWeight: 800, color: isDark ? '#f8fafc' : '#1f2937' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            variant="borderless" 
            hoverable 
            style={{ 
              borderRadius: '16px', 
              background: isDark ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              border: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`
            }}
          >
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>{t('stats.pendingReceipt')}</Text>} 
              value={summary.pending} 
              styles={{ content: { fontWeight: 800, color: '#fa8c16' } }}
              prefix={<CarryOutOutlined style={{ marginRight: 8 }} />} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            variant="borderless" 
            hoverable 
            style={{ 
              borderRadius: '16px', 
              background: isDark ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              border: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`
            }}
          >
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>{t('stats.totalValue')}</Text>} 
              value={formatVND(summary.value)}
              formatter={(v) => v as string}
              styles={{ content: { fontWeight: 800, color: '#52c41a' } }}
              prefix={<TransactionOutlined style={{ marginRight: 8 }} />} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            variant="borderless" 
            hoverable 
            style={{ 
              borderRadius: '16px', 
              background: isDark ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              border: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`
            }}
          >
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>{t('stats.completionRate')}</Text>} 
              value={summary.total > 0 ? ((summary.total - summary.pending) / summary.total) * 100 : 0} 
              precision={1}
              styles={{ content: { fontWeight: 800, color: '#722ed1' } }}
              prefix={<HistoryOutlined style={{ marginRight: 8 }} />} 
              suffix={<span style={{ fontSize: 16 }}>%</span>}
            />
          </Card>
        </Col>
      </Row>

      <Card 
        variant="borderless" 
        style={{ 
          borderRadius: '12px', 
          background: isDark ? '#1e293b' : token.colorBgContainer,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)' 
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${isDark ? '#334155' : '#f0f0f0'}` }}>
          <Space size="large">
            <Input
              placeholder={t('filters.searchPlaceholder')}
              prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
              allowClear
              onChange={(e) => onSearch(e.target.value)}
              style={{ width: 400 }}
              size="large"
            />
            <Select
              allowClear
              placeholder={t('filters.statusPlaceholder')}
              style={{ width: 220 }}
              size="large"
              onChange={(val) => setFilters(prev => ({ ...prev, status: val }))}
              options={localizedStatusOptions}
            />
          </Space>
          <Button icon={<SearchOutlined />} type="primary" size="large" onClick={loadData} style={{ borderRadius: '8px' }}>
            {t('filters.refresh')}
          </Button>
        </div>

        <div className="premium-table">
          <Table<IPurchaseOrder>
            columns={columns}
            dataSource={data}
            rowKey={(record) => record.id || record.poNumber || Math.random()}
            loading={loading}
            bordered={false}
            size="middle"
            pagination={{
              current: meta.current,
              pageSize: meta.pageSize,
              total: meta.total,
              showSizeChanger: true,
              showTotal: (total) => t('table.totalCount', { total }),
              onChange: handleTableChange,
            }}
            rowClassName="hover:bg-slate-900/40 transition-colors"
            onRow={(record) => ({
              style: { cursor: 'pointer' },
              onClick: () => handleOpenDetail(record.id),
            })}
          />
        </div>
      </Card>
      
      <style jsx global>{`
        .premium-table .ant-table {
          background: transparent !important;
        }
        .premium-table .ant-table-thead > tr > th {
          background: ${isDark ? 'rgba(30, 41, 59, 0.5)' : '#fafafa'} !important;
          color: ${isDark ? '#8c8c8c' : '#595959'} !important;
          font-weight: 600 !important;
          border-bottom: 1px solid ${isDark ? '#303030' : '#f0f0f0'} !important;
        }
        .premium-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${isDark ? '#303030' : '#f0f0f0'} !important;
        }
        .premium-table .ant-table-placeholder {
          background: transparent !important;
        }
        .premium-table .ant-table-placeholder .ant-empty-description {
            color: #595959 !important;
        }
      `}</style>

      <PurchaseOrderDetailModal
        poId={selectedPoId || ''}
        open={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onSuccess={loadData}
      />

      <GoodsReceiptModal
        isOpen={isGrnOpen}
        setIsOpen={setIsGrnOpen}
        poId={selectedPoId}
        fetchData={loadData}
      />

      <VendorInvoiceModal
        isOpen={isInvoiceOpen}
        setIsOpen={setIsInvoiceOpen}
        poId={selectedPoId}
        fetchData={loadData}
      />
    </div>
  );
};

export default PurchaseOrderTable;
