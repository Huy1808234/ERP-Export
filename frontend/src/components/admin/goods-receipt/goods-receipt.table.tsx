'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Button, Space, Table, Tag, Input, Typography, Card, Tooltip, notification } from 'antd';
import { ContainerOutlined, SearchOutlined, EyeOutlined, PlusOutlined, LoginOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { debounce } from '@/utils/debounce';

import { useGoodsReceipts } from '@/hooks/useGoodsReceipts';
import { IGoodsReceipt, GRNStatus } from '@/types/goods-receipt';
import { formatDate } from '@/utils/format';
import GoodsReceiptModal from './goods-receipt.modal';
import GoodsReceiptDetailModal from './goods-receipt.detail';
import POSelectModal from './po-select.modal';

const { Text, Title } = Typography;

const GoodsReceiptTable = () => {
  const t = useTranslations('GoodsReceipt');
  const { data, meta, loading, fetchGRNs } = useGoodsReceipts();
  
  // Modals state
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPoSelectOpen, setIsPoSelectOpen] = useState(false);
  
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [selectedGrn, setSelectedGrn] = useState<IGoodsReceipt | null>(null);
  
  const [queryParams, setQueryParams] = useState({
    current: 1,
    pageSize: 10,
    grnNumber: '',
  });

  useEffect(() => {
    fetchGRNs(queryParams);
  }, [queryParams, fetchGRNs]);

  const debouncedSearch = useMemo(
    () => debounce((value: string) => {
      setQueryParams(prev => ({ ...prev, grnNumber: value, current: 1 }));
    }, 500),
    []
  );

  const columns = useMemo(() => [
    {
      title: t('table.columns.grNumber'),
      dataIndex: 'grNumber',
      key: 'grNumber',
      render: (text: string) => <Text strong style={{ color: '#08979c' }}>{text}</Text>,
    },
    {
      title: t('table.columns.poNumber'),
      dataIndex: ['purchaseOrder', 'poNumber'],
      key: 'poNumber',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: t('table.columns.date'),
      dataIndex: 'receivedDate',
      key: 'receivedDate',
      render: (date: string) => formatDate(date),
    },
    {
      title: t('table.columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: GRNStatus) => {
        const color = status === 'COMPLETED' ? 'green' : status === 'CANCELLED' ? 'red' : 'processing';
        return <Tag color={color}>{status ? t(`status.${status}`) : 'N/A'}</Tag>;
      },
    },
    {
      title: t('table.columns.receivedBy'),
      dataIndex: ['receivedBy', 'email'],
      key: 'receivedBy',
      render: (email: string) => <Text type="secondary">{email?.split('@')[0]}</Text>,
    },
    {
      title: t('table.columns.actions'),
      key: 'action',
      width: 100,
      render: (_: any, record: IGoodsReceipt) => (
        <Space>
          <Tooltip title={t('tooltips.viewDetail')}>
            <Button 
              type="text" 
              icon={<EyeOutlined style={{ color: '#08979c' }} />} 
              onClick={() => {
                setSelectedGrn(record);
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
            icon={<LoginOutlined />} 
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
          style={{ backgroundColor: '#08979c', borderColor: '#08979c', borderRadius: 8 }}
          onClick={() => setIsPoSelectOpen(true)}
        >
          {t('createBtn')}
        </Button>
      </div>

      <Table<IGoodsReceipt>
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

      {/* Modal chọn PO để tạo GRN mới */}
      <POSelectModal 
        isOpen={isPoSelectOpen}
        onCancel={() => setIsPoSelectOpen(false)}
        onSelect={(poId) => {
          setSelectedPoId(poId);
          setIsPoSelectOpen(false);
          setIsGrnModalOpen(true);
        }}
      />

      {/* Modal nhập kho (Form tạo mới) */}
      <GoodsReceiptModal 
        isOpen={isGrnModalOpen}
        setIsOpen={setIsGrnModalOpen}
        poId={selectedPoId}
        fetchData={() => fetchGRNs(queryParams)}
      />

      {/* Modal chi tiết (Chỉ xem) */}
      <GoodsReceiptDetailModal 
        isOpen={isDetailModalOpen}
        setIsOpen={setIsDetailModalOpen}
        data={selectedGrn}
      />
    </Card>
  );
};

export default GoodsReceiptTable;
