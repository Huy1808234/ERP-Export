'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  Button, Space, Table, Tag, Input, Typography, 
  Card, Tooltip, Badge, Row, Col, Statistic, Divider
} from 'antd';
import { 
  AuditOutlined, SearchOutlined, EyeOutlined, 
  PlusOutlined, CalendarOutlined,
  FileDoneOutlined, InfoCircleOutlined, NumberOutlined
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { debounce } from '@/utils/debounce';
import { useTheme } from '@/context/theme.context';

import { useVendorInvoices } from '@/hooks/useVendorInvoices';
import { IVendorInvoice, VendorInvoiceStatus } from '@/types/vendor-invoice';
import { formatVND, formatDate } from '@/utils/format';
import VendorInvoiceModal from './vendor-invoice.modal';
import VendorInvoiceDetailModal from './vendor-invoice.detail';
import POSelectForInvoiceModal from './po-select.modal';

const { Text, Title } = Typography;

const VendorInvoiceTable = () => {
  const t = useTranslations('VendorInvoice');
  const { isDark } = useTheme();
  const { data, meta, loading, fetchInvoices } = useVendorInvoices();
  
  // Modals state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPoSelectOpen, setIsPoSelectOpen] = useState(false);
  
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<IVendorInvoice | null>(null);

  const [queryParams, setQueryParams] = useState({
    current: 1,
    pageSize: 10,
    invoiceNumber: '',
  });

  useEffect(() => {
    fetchInvoices(queryParams);
  }, [queryParams, fetchInvoices]);

  const debouncedSearch = useMemo(
    () => debounce((value: string) => {
      setQueryParams(prev => ({ ...prev, invoiceNumber: value, current: 1 }));
    }, 500),
    []
  );

  const columns = useMemo(() => [
    {
      title: t('table.columns.invoiceNumber'),
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      render: (text: string) => (
        <Space>
           <div style={{ 
                width: 32, height: 32, borderRadius: 8, background: 'rgba(114, 46, 209, 0.1)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <FileDoneOutlined style={{ color: '#722ed1' }} />
            </div>
            <Text strong style={{ color: '#722ed1' }}>{text}</Text>
        </Space>
      ),
    },
    {
      title: t('table.columns.vendor'),
      dataIndex: ['vendor', 'name'],
      key: 'vendorName',
      render: (name: string) => <Text strong>{name}</Text>
    },
    {
      title: t('table.columns.poNumber'),
      dataIndex: ['purchaseOrder', 'poNumber'],
      key: 'poNumber',
      render: (text: string) => <Tag color="blue" icon={<NumberOutlined />}>{text}</Tag>,
    },
    {
      title: t('table.columns.totalAmount'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number) => <Text strong style={{ color: '#10b981' }}>{formatVND(amount)}</Text>,
      align: 'right' as const,
    },
    {
      title: t('table.columns.date'),
      dataIndex: 'invoiceDate',
      key: 'invoiceDate',
      render: (date: string) => (
        <Space size="small">
            <CalendarOutlined style={{ color: '#bfbfbf' }} />
            <Text type="secondary">{formatDate(date)}</Text>
        </Space>
      ),
    },
    {
      title: t('table.columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: VendorInvoiceStatus) => {
        const label = status === 'PAID' ? t('status.PAID') : status === 'CANCELLED' ? t('status.CANCELLED') : t('status.PENDING');
        return (
            <Badge status={status === 'PAID' ? 'success' : status === 'CANCELLED' ? 'error' : 'warning'} text={label} />
        );
      },
    },
    {
      title: t('table.columns.actions'),
      key: 'action',
      width: 100,
      render: (_: any, record: IVendorInvoice) => (
        <Space>
          <Tooltip title={t('tooltips.viewDetail')}>
            <Button 
              type="text" 
              icon={<EyeOutlined style={{ color: '#722ed1' }} />} 
              onClick={() => {
                setSelectedInvoice(record);
                setIsDetailModalOpen(true);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ], [t]);

  return (
    <Card 
        variant="borderless" 
        style={{ 
            borderRadius: 16, 
            boxShadow: 'none',
            background: 'transparent'
        }}
    >
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size="large">
          <PageHeader 
            title={t('title')} 
            icon={<AuditOutlined />} 
            description={t('description')} 
          />
          <Input
            placeholder={t('filters.searchPlaceholder')}
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            style={{ width: 320, borderRadius: 10, height: 40 }}
            allowClear
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </Space>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          size="large" 
          style={{ 
              backgroundColor: '#722ed1', 
              borderColor: '#722ed1', 
              borderRadius: 10,
              height: 45,
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(114, 46, 209, 0.2)'
          }}
          onClick={() => setIsPoSelectOpen(true)}
        >
          {t('createBtn')}
        </Button>
      </div>

      <Table<IVendorInvoice>
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="_id"
        expandable={{
            expandedRowRender: (record) => (
                <div style={{ 
                    padding: '24px', 
                    background: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc', 
                    borderRadius: 12, 
                    margin: '8px 16px',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                }}>
                    <Row gutter={24}>
                        <Col span={12}>
                            <Title level={5} style={{ marginBottom: 16 }}>
                                <InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                                Chi tiết thanh toán
                            </Title>
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <Statistic 
                                        title="Tiền trước thuế" 
                                        value={record.amount} 
                                        precision={0} 
                                        suffix="VND"
                                        styles={{ content: { fontSize: 18 } }}
                                        formatter={(val) => formatVND(val as number)}
                                    />
                                </Col>
                                <Col span={12}>
                                    <Statistic 
                                        title="Thuế GTGT" 
                                        value={record.taxAmount} 
                                        precision={0} 
                                        suffix="VND"
                                        styles={{ content: { fontSize: 18, color: '#fa8c16' } }}
                                        formatter={(val) => formatVND(val as number)}
                                    />
                                </Col>
                            </Row>
                            <Divider style={{ margin: '16px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text type="secondary">Hạn thanh toán:</Text>
                                <Text strong style={{ color: '#f5222d' }}>{record.dueDate ? formatDate(record.dueDate) : 'Chưa thiết lập'}</Text>
                            </div>
                        </Col>
                        <Col span={12} style={{ borderLeft: `1px dashed ${isDark ? '#434343' : '#d9d9d9'}`, paddingLeft: 32 }}>
                            <Title level={5} style={{ marginBottom: 16 }}>Ghi chú / Diễn giải</Title>
                            <div style={{ 
                                padding: 12, 
                                background: isDark ? '#1d1d1d' : '#fff', 
                                borderRadius: 8, 
                                border: `1px solid ${isDark ? '#434343' : '#f0f0f0'}`,
                                minHeight: 80
                            }}>
                                <Text>{record.note || 'Không có ghi chú'}</Text>
                            </div>
                        </Col>
                    </Row>
                </div>
            )
        }}
        pagination={{
          current: meta.current,
          pageSize: meta.pageSize,
          total: meta.total,
          showSizeChanger: true,
          placement: ['bottomEnd']
        }}
        onChange={(pagination) => {
          setQueryParams(prev => ({
            ...prev,
            current: pagination.current ?? 1,
            pageSize: pagination.pageSize ?? 10,
          }));
        }}
      />

      {/* Modal chọn PO để lập hóa đơn */}
      <POSelectForInvoiceModal 
        isOpen={isPoSelectOpen}
        onCancel={() => setIsPoSelectOpen(false)}
        onSelect={(poId) => {
          setSelectedPoId(poId);
          setIsPoSelectOpen(false);
          setIsInvoiceModalOpen(true);
        }}
      />

      {/* Modal ghi nhận hóa đơn */}
      <VendorInvoiceModal 
        open={isInvoiceModalOpen}
        onCancel={() => setIsInvoiceModalOpen(false)}
        onSuccess={() => fetchInvoices(queryParams)}
        purchaseOrderId={selectedPoId ?? undefined}
      />

      {/* Modal xem chi tiết */}
      <VendorInvoiceDetailModal 
        isOpen={isDetailModalOpen}
        setIsOpen={setIsDetailModalOpen}
        data={selectedInvoice}
      />
    </Card>
  );
};

export default VendorInvoiceTable;
