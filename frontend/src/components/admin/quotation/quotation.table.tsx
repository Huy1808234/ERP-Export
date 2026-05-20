'use client'

import { Button, Input, Popconfirm, Space, Table, Tag, Typography, Tooltip, Card, theme, App } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, ThunderboltOutlined, FileExcelOutlined, FileSearchOutlined, SendOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/context/theme.context';
import { sendRequest } from '@/lib/api-client';

import QuotationCreateModal from './quotation.create';
import PIFromQuotationModal from '../proforma-invoice/pi.from-quotation';
import QuotationDetailModal from './quotation.detail';

import { useQuotations } from '@/hooks/useQuotations';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { QUOTATION_STATUS_CONFIG } from '@/constants/o2c';
import type { IQuotation, QuotationStatus } from '@/types/o2c';
import { ExcelService } from '@/utils/excel';
import { getAccessToken } from '@/lib/auth-token';

import type { TablePaginationConfig, TableProps } from 'antd';

import { useTranslations } from 'next-intl';

const { Text } = Typography;

const DEFAULT_PAGE_SIZE = 10;

const QuotationTable = () => {
  const { data, meta, loading, fetchQuotations, deleteQuotation } = useQuotations();
  const { formatMoney } = useCurrency();
  const { notification } = App.useApp();
  const t = useTranslations('Quotation');
  const tCommon = useTranslations('Common');

  const [pagination, setPagination] = useState({ current: 1, pageSize: DEFAULT_PAGE_SIZE });
  const { current, pageSize } = pagination;
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 500);

  const [createOpen, setCreateOpen] = useState(false);
  const [editData, setEditData] = useState<IQuotation | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [fromPIOpen, setFromPIOpen] = useState(false);
  const [piQuotation, setPiQuotation] = useState<IQuotation | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [initialInquiryData, setInitialInquiryData] = useState<any>(null);

  useEffect(() => {
    fetchQuotations({
      current,
      pageSize,
      search: debouncedSearch || undefined,
    });

    // TECH LEAD: Handle auto-open for Inquiry conversion
    const pendingInquiry = sessionStorage.getItem('convert_inquiry');
    if (pendingInquiry) {
      try {
        const inquiryData = JSON.parse(pendingInquiry);
        setInitialInquiryData(inquiryData);
        setCreateOpen(true);
        sessionStorage.removeItem('convert_inquiry');
      } catch (e) {
        console.error("Failed to parse pending inquiry", e);
      }
    }
  }, [fetchQuotations, current, pageSize, debouncedSearch]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value);
    setPagination((prev) => (prev.current === 1 ? prev : { ...prev, current: 1 }));
  }, []);

  const handleTableChange = useCallback((page: TablePaginationConfig) => {
    setPagination((prev) => ({
      current: page.current ?? prev.current,
      pageSize: page.pageSize ?? prev.pageSize,
    }));
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteQuotation(id, () => {
      fetchQuotations({
        current,
        pageSize,
        search: debouncedSearch || undefined,
      });
    });
  }, [deleteQuotation, fetchQuotations, current, pageSize, debouncedSearch]);

  const handleStatusChange = useCallback(async (id: string, status: string) => {
    const currentSession = await sendRequest<any>({ url: '/api/auth/session', method: 'GET' });
    const accessToken = getAccessToken(currentSession);
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations/${id}/status`,
      method: 'PATCH',
      body: { status },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res?.data) {
      notification.success({ title: t('notifications.success'), description: t('notifications.statusUpdated') });
      fetchQuotations({
        current,
        pageSize,
        search: debouncedSearch || undefined,
      });
    } else {
      notification.error({ title: t('notifications.error'), description: res?.message });
    }
  }, [debouncedSearch, fetchQuotations, notification, current, pageSize, t]);

  const getStatusLabel = useCallback((value: QuotationStatus) => {
    const key = `status.${value}`;
    return t.has(key) ? t(key) : value;
  }, [t]);

  const columns = useMemo<TableProps<IQuotation>['columns']>(() => [
    {
      title: t('table.quotationNumber'),
      dataIndex: 'quotationNumber',
      key: 'quotationNumber',
      render: (value: string) => <Text strong style={{ color: '#1890ff' }}>{value}</Text>,
    },
    {
      title: t('table.customer'),
      dataIndex: ['customer', 'name'],
      key: 'customer',
      render: (value: string | undefined) => value ?? '-',
    },
    {
      title: t('table.incoterm'),
      dataIndex: 'incoterm',
      key: 'incoterm',
      render: (value: string) => <Tag color="geekblue">{value}</Tag>,
    },
    {
      title: t('table.total'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (value: number, record: IQuotation) => (
        <Text strong>{formatMoney(value, record.currency)}</Text>
      ),
    },
    {
      title: t('table.validUntil'),
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      render: (value: string | undefined) => formatDate(value),
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      key: 'status',
      render: (value: QuotationStatus) => {
        const config = QUOTATION_STATUS_CONFIG[value];
        return <Tag color={config?.color || 'default'}>{getStatusLabel(value)}</Tag>;
      },
    },
    {
      title: t('table.actions'),
      key: 'action',
      align: 'center' as const,
      render: (_value: unknown, record: IQuotation) => (
        <Space size="small">
          {['DRAFT', 'REJECTED'].includes(record.status) && (
            <Tooltip title={t('table.sendTooltip')}>
              <Button
                size="small"
                icon={<SendOutlined />}
                onClick={() => handleStatusChange(record._id, 'SENT')}
                style={{ color: '#52c41a', borderColor: '#52c41a' }}
              >
                {t('table.send')}
              </Button>
            </Tooltip>
          )}
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(record._id)}>
            {t('table.view')}
          </Button>
          <Button size="small" type="primary" icon={<EditOutlined />} onClick={() => setEditData(record)}>
            {t('table.edit')}
          </Button>
          <Tooltip title={record.status !== 'SENT' && record.status !== 'ACCEPTED' ? t('table.createPiDisabledHint') : t('table.createPiHint')}>
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              style={{
                borderColor: record.status !== 'SENT' && record.status !== 'ACCEPTED' ? '#d9d9d9' : '#722ed1',
                color: record.status !== 'SENT' && record.status !== 'ACCEPTED' ? 'rgba(0, 0, 0, 0.25)' : '#722ed1'
              }}
              disabled={record.status !== 'SENT' && record.status !== 'ACCEPTED'}
              onClick={() => {
                setPiQuotation(record);
                setFromPIOpen(true);
              }}
            >
              {t('table.createPi')}
            </Button>
          </Tooltip>
          <Popconfirm
            title={t('table.deleteConfirm')}
            onConfirm={() => handleDelete(record._id)}
            okText={tCommon('confirm')}
            cancelText={tCommon('cancel')}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              {t('table.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [formatMoney, getStatusLabel, handleDelete, handleStatusChange, t, tCommon]);

  const handleEditOpenChange = useCallback((open: boolean) => {
    if (!open) setEditData(null);
  }, []);

  const { token } = theme.useToken();
  const { isDark } = useTheme();

  return (
    <div style={{
      backgroundColor: 'transparent',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <PageHeader
            title={t('title')}
            icon={<FileSearchOutlined style={{ color: token.colorPrimary }} />}
            description={t('description')}
          />
        </div>
        <Space size="middle">
          <Input.Search
            placeholder={t('table.searchPlaceholder')}
            allowClear
            value={searchInput}
            onChange={handleSearchChange}
            style={{ width: 300 }}
            size="large"
          />
          <Button
            icon={<FileExcelOutlined />}
            onClick={() => ExcelService.exportQuotationTable(data, 'Bao_gia_xuat_khau')}
            style={{ borderColor: '#52c41a', color: '#52c41a', height: '40px' }}
          >
            {t('table.exportExcel')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} style={{ height: '40px' }}>
            {t('table.createNew')}
          </Button>
        </Space>
      </div>

      <Card
        variant="borderless"
        style={{
          borderRadius: '12px',
          background: isDark ? '#1e293b' : token.colorBgContainer,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)'
        }}
        styles={{ body: { padding: 0 } }}
      >
        {selectedRowKeys.length > 0 && (
          <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12, background: isDark ? '#2a1215' : '#fff2f0', borderBottom: `1px solid ${isDark ? '#5c2223' : '#ffccc7'}` }}>
            <Text>{t('table.selectedCount', { count: selectedRowKeys.length })}</Text>
            <Popconfirm
              title={t('table.bulkDeleteConfirm', { count: selectedRowKeys.length })}
              onConfirm={async () => {
                const res = await sendRequest<IBackendRes<any>>({
                  url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations/bulk-delete`,
                  method: 'POST',
                  body: { ids: selectedRowKeys },
                });
                if (res) {
                  notification.success({ title: t('notifications.success'), description: t('notifications.bulkDeleteSuccess') });
                  setSelectedRowKeys([]);
                  fetchQuotations({
                    current,
                    pageSize,
                    search: debouncedSearch || undefined,
                  });
                }
              }}
              okText={t('table.bulkDelete')}
              cancelText={tCommon('cancel')}
              okButtonProps={{ danger: true }}
            >
              <Button danger type="primary" size="small" icon={<DeleteOutlined />}>{t('table.bulkDelete')}</Button>
            </Popconfirm>
            <Button size="small" onClick={() => setSelectedRowKeys([])}>{t('table.cancelSelection')}</Button>
          </div>
        )}

        <div className="premium-table">
          <Table<IQuotation>
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            rowKey={(record: any) => record._id || record.quotationNumber}
            bordered={false}
            dataSource={data}
            columns={columns}
            loading={loading}
            onChange={handleTableChange}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              showSizeChanger: true,
              total: meta.total,
              showTotal: (total, range) => t('table.totalCount', { start: range[0], end: range[1], total }),
            }}
            size="middle"
          />
        </div>
      </Card>

      <QuotationCreateModal
        isCreateModalOpen={createOpen}
        setIsCreateModalOpen={(v) => {
          setCreateOpen(v);
          if (!v) setInitialInquiryData(null);
        }}
        fetchQuotations={() => fetchQuotations({
          current,
          pageSize,
          search: debouncedSearch || undefined,
        })}
        initialInquiryData={initialInquiryData}
      />

      <QuotationCreateModal
        isCreateModalOpen={!!editData}
        setIsCreateModalOpen={handleEditOpenChange}
        fetchQuotations={() => fetchQuotations({
          current,
          pageSize,
          search: debouncedSearch || undefined,
        })}
        editData={editData ?? undefined}
      />

      {piQuotation && (
        <PIFromQuotationModal
          open={fromPIOpen}
          setOpen={setFromPIOpen}
          quotation={piQuotation}
          onSuccess={() => fetchQuotations({
            current,
            pageSize,
            search: debouncedSearch || undefined,
          })}
        />
      )}

      {detailId && (
        <QuotationDetailModal
          quotationId={detailId}
          open={!!detailId}
          onClose={() => setDetailId(null)}
          onSuccess={() => fetchQuotations({
            current,
            pageSize,
            search: debouncedSearch || undefined,
          })}
        />
      )}

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
      `}</style>
    </div>
  );
};

export default QuotationTable;
