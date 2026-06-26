'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { App, Button, Space, Table, Tag, Input, Typography, Card, Tooltip, Select } from 'antd';
import { SearchOutlined, EyeOutlined, PlusOutlined, LoginOutlined, RollbackOutlined, ExperimentOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { debounce } from '@/utils/debounce';

import { useGoodsReceipts } from '@/hooks/useGoodsReceipts';
import { IGoodsReceipt, GRNStatus } from '@/types/goods-receipt';
import { formatDate } from '@/utils/format';
import GoodsReceiptModal from './goods-receipt.modal';
import GoodsReceiptDetailModal from './goods-receipt.detail';
import QcInspectionModal from './qc-inspection.modal';
import POSelectModal from './po-select.modal';
import { useSearchParams } from 'next/navigation';
import { sendRequest } from '@/lib/api-client';
import { useSession } from 'next-auth/react';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

const GoodsReceiptTable = () => {
  const t = useTranslations('GoodsReceipt');
  const { modal, notification } = App.useApp();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const { data, meta, loading, fetchGRNs, reverseGRN } = useGoodsReceipts();
  
  // Modals state
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPoSelectOpen, setIsPoSelectOpen] = useState(false);
  const [isQcModalOpen, setIsQcModalOpen] = useState(false);
  
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [selectedGrn, setSelectedGrn] = useState<IGoodsReceipt | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [queryParams, setQueryParams] = useState({
    current: 1,
    pageSize: 10,
    grnNumber: '',
    status: undefined as GRNStatus | undefined,
  });

  useEffect(() => {
    fetchGRNs(queryParams);
  }, [queryParams, fetchGRNs]);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      const fetchSingle = async () => {
        try {
          const res = await sendRequest<IBackendRes<IGoodsReceipt>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/goods-receipts/${id}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${getAccessToken(session)}` },
          });
          if (res?.data) {
            setSelectedGrn(res.data);
            setIsDetailModalOpen(true);
          }
        } catch (error) {
          console.error('Failed to fetch GRN details', error);
        }
      };
      fetchSingle();
    }
  }, [searchParams, session]);

  const debouncedSearch = useMemo(
    () => debounce((value: string) => {
      setQueryParams(prev => ({ ...prev, grnNumber: value, current: 1 }));
    }, 500),
    []
  );

  const hasPendingQc = (record: IGoodsReceipt): boolean => (
    record.status !== 'CANCELLED' &&
    (record.items ?? []).some((item) => (
      !item.hasActiveQualityCheck &&
      (
        Number(item.quantityRejected || 0) > 0 ||
        Boolean(item.qualityStatus && item.qualityStatus !== 'PASS')
      )
    ))
  );

  const getDisplayStatus = (record: IGoodsReceipt): GRNStatus => (
    hasPendingQc(record) ? 'PENDING_QC' : record.status
  );

  const getReverseErrorTitle = (error: unknown): string => {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('active vendor invoice')) {
      return t('notifications.reverseActiveVendorInvoiceError');
    }

    if (message.includes('Only completed GRNs')) {
      return t('notifications.reverseCompletedOnlyError');
    }

    return message || t('notifications.reverseFailed');
  };

  const confirmReverse = (record: IGoodsReceipt) => {
    let reason = '';
    const grnNumber = record.grNumber || record.grnNumber || record._id;

    modal.confirm({
      title: t('reverseModal.title', { grnNumber }),
      content: (
        <Input.TextArea
          rows={3}
          placeholder={t('reverseModal.reasonPlaceholder')}
          onChange={(event) => {
            reason = event.target.value;
          }}
        />
      ),
      okText: t('reverseModal.okText'),
      cancelText: t('reverseModal.cancelText'),
      okButtonProps: { danger: true },
      onOk: (close) => {
        if (!reason.trim()) {
          notification.error({ title: t('notifications.reverseReasonRequired') });
          return;
        }

        setActionLoading(record._id);
        void (async () => {
          try {
            await reverseGRN(record._id, reason.trim());
            notification.success({ title: t('notifications.reverseSuccess') });
            fetchGRNs(queryParams);
            close();
          } catch (error) {
            notification.error({
              title: getReverseErrorTitle(error),
            });
          } finally {
            setActionLoading(null);
          }
        })();
      },
    });
  };

  const columns: ColumnsType<IGoodsReceipt> = [
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
      render: (_status: GRNStatus, record: IGoodsReceipt) => {
        const status = getDisplayStatus(record);
        const color = status === 'COMPLETED' ? 'green' : status === 'CANCELLED' ? 'red' : status === 'PENDING_QC' ? 'orange' : 'processing';
        return <Tag color={color}>{status ? t(`status.${status}`) : 'N/A'}</Tag>;
      },
    },
    {
      title: t('table.columns.receivedBy'),
      dataIndex: ['receivedBy', 'username'],
      key: 'receivedBy',
      render: (username: string) => <Text type="secondary">{username || 'system'}</Text>,
    },
    {
      title: t('table.columns.actions'),
      key: 'action',
      width: 140,
      render: (_value: unknown, record: IGoodsReceipt) => (
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
          {record.status === 'COMPLETED' ? (
            <Tooltip title={t('tooltips.reverse')}>
              <Button
                type="text"
                danger
                icon={<RollbackOutlined />}
                loading={actionLoading === record._id}
                onClick={() => confirmReverse(record)}
              />
            </Tooltip>
          ) : null}
          {hasPendingQc(record) ? (
            <Tooltip title={t('tooltips.inspectQc')}>
              <Button
                type="text"
                icon={<ExperimentOutlined style={{ color: '#fa8c16' }} />}
                onClick={() => {
                  setSelectedGrn(record);
                  setIsQcModalOpen(true);
                }}
              />
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
  ];

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
          <Select<GRNStatus>
            placeholder={t('filters.statusPlaceholder')}
            allowClear
            style={{ width: 180 }}
            value={queryParams.status}
            options={[
              { value: 'PENDING_QC', label: t('status.PENDING_QC') },
              { value: 'COMPLETED', label: t('status.COMPLETED') },
              { value: 'CANCELLED', label: t('status.CANCELLED') },
            ]}
            onChange={(status) => {
              setQueryParams((prev) => ({ ...prev, status, current: 1 }));
            }}
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
        rowKey="_id"
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
      <QcInspectionModal
        isOpen={isQcModalOpen}
        setIsOpen={setIsQcModalOpen}
        goodsReceipt={selectedGrn}
        onSuccess={() => fetchGRNs(queryParams)}
      />
    </Card>
  );
};

export default GoodsReceiptTable;
