'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Button, Space, Table, Tag, Input, Typography, Card, Tooltip } from 'antd';
import { AuditOutlined, SearchOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { debounce } from '@/utils/debounce';

import { useVendorInvoices } from '@/hooks/useVendorInvoices';
import { IVendorInvoice, VendorInvoiceStatus } from '@/types/vendor-invoice';
import { formatVND, formatDate } from '@/utils/format';
import VendorInvoiceModal from './vendor-invoice.modal';
import VendorInvoiceDetailModal from './vendor-invoice.detail';
import POSelectForInvoiceModal from './po-select.modal';

const { Text, Title } = Typography;

const VendorInvoiceTable = () => {
  const t = useTranslations('VendorInvoice');
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
      render: (text: string) => <Text strong style={{ color: '#722ed1' }}>{text}</Text>,
    },
    {
      title: t('table.columns.vendor'),
      dataIndex: ['vendor', 'name'],
      key: 'vendorName',
    },
    {
      title: t('table.columns.poNumber'),
      dataIndex: ['purchaseOrder', 'poNumber'],
      key: 'poNumber',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: t('table.columns.totalAmount'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number) => <Text strong type="danger">{formatVND(amount)}</Text>,
      align: 'right' as const,
    },
    {
      title: t('table.columns.date'),
      dataIndex: 'invoiceDate',
      key: 'invoiceDate',
      render: (date: string) => formatDate(date),
    },
    {
      title: t('table.columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: VendorInvoiceStatus) => {
        const color = status === 'PAID' ? 'green' : status === 'CANCELLED' ? 'red' : 'orange';
        const label = status === 'PAID' ? t('status.PAID') : status === 'CANCELLED' ? t('status.CANCELLED') : t('status.PENDING');
        return <Tag color={color}>{label}</Tag>;
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
  ], []);

  return (
    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size="large">
          <PageHeader 
            title={t('title')} 
            icon={<AuditOutlined />} 
            description={t('description')} 
          />
          <Input
            placeholder={t('filters.searchPlaceholder')}
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            style={{ width: 300 }}
            allowClear
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </Space>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          size="large" 
          style={{ backgroundColor: '#722ed1', borderColor: '#722ed1', borderRadius: 8 }}
          onClick={() => setIsPoSelectOpen(true)}
        >
          {t('createBtn')}
        </Button>
      </div>

      <Table<IVendorInvoice>
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{
          current: meta.current,
          pageSize: meta.pageSize,
          total: meta.total,
          showSizeChanger: true,
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
        isOpen={isInvoiceModalOpen}
        setIsOpen={setIsInvoiceModalOpen}
        poId={selectedPoId}
        fetchData={() => fetchInvoices(queryParams)}
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
