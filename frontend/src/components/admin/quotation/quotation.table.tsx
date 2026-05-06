'use client'

import { Button, Input, Popconfirm, Space, Table, Tag, Typography, Tooltip, Card, theme, App } from 'antd';
import {DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, ThunderboltOutlined, FileExcelOutlined, FileSearchOutlined, SendOutlined} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/library/theme.context';
import { sendRequest } from '@/utils/api';

import QuotationCreateModal from './quotation.create';
import PIFromQuotationModal from '../proforma-invoice/pi.from-quotation';
import QuotationDetailModal from './quotation.detail';

import { useQuotations } from '@/hooks/useQuotations';
import { useDebounce } from '@/utils/customHook';
import { formatDate } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { QUOTATION_STATUS_CONFIG } from '@/constants/o2c';
import type { IQuotation, QuotationStatus } from '@/types/o2c';
import { ExcelService } from '@/utils/excel';

import type { TablePaginationConfig, TableProps } from 'antd';

const { Text } = Typography;

const DEFAULT_PAGE_SIZE = 10;

const QuotationTable = () => {
  const { data, meta, loading, fetchQuotations, deleteQuotation } = useQuotations();
  const { formatMoney } = useCurrency();
  const { notification } = App.useApp();

  const [pagination, setPagination] = useState({ current: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 500);

  const [createOpen, setCreateOpen] = useState(false);
  const [editData, setEditData] = useState<IQuotation | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [fromPIOpen, setFromPIOpen] = useState(false);
  const [piQuotation, setPiQuotation] = useState<IQuotation | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    fetchQuotations({
      current: pagination.current,
      pageSize: pagination.pageSize,
      search: debouncedSearch || undefined,
    });
  }, [fetchQuotations, pagination.current, pagination.pageSize, debouncedSearch]);

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
        current: pagination.current,
        pageSize: pagination.pageSize,
        search: debouncedSearch || undefined,
      });
    });
  }, [deleteQuotation, fetchQuotations, pagination.current, pagination.pageSize, debouncedSearch]);
  
  const handleStatusChange = async (id: string, status: string) => {
    const accessToken = (await sendRequest<any>({ url: '/api/auth/session', method: 'GET' }))?.user?.access_token;
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations/${id}/status`,
      method: 'PATCH',
      body: { status },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res?.data) {
      notification.success({ title: 'Thành công', description: 'Đã cập nhật trạng thái báo giá' });
      fetchQuotations({
        current: pagination.current,
        pageSize: pagination.pageSize,
        search: debouncedSearch || undefined,
      });
    } else {
      notification.error({ title: 'Lỗi', description: res?.message });
    }
  };

  const columns = useMemo<TableProps<IQuotation>['columns']>(() => [
    {
      title: 'Số BG',
      dataIndex: 'quotationNumber',
      key: 'quotationNumber',
      render: (value: string) => <Text strong style={{ color: '#1890ff' }}>{value}</Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: ['customer', 'name'],
      key: 'customer',
      render: (value: string | undefined) => value ?? '-',
    },
    {
      title: 'Incoterms',
      dataIndex: 'incoterm',
      key: 'incoterm',
      render: (value: string) => <Tag color="geekblue">{value}</Tag>,
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (value: number, record: IQuotation) => (
        <Text strong>{formatMoney(value, record.currency)}</Text>
      ),
    },
    {
      title: 'Hiệu lực đến',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      render: (value: string | undefined) => formatDate(value),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (value: QuotationStatus) => {
        const config = QUOTATION_STATUS_CONFIG[value];
        return <Tag color={config?.color || 'default'}>{config?.label || value}</Tag>;
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      align: 'center' as const,
      render: (_value: unknown, record: IQuotation) => (
        <Space size="small">
          {record.status === 'DRAFT' && (
            <Tooltip title="Gửi báo giá cho khách hàng">
              <Button 
                size="small" 
                icon={<SendOutlined />} 
                onClick={() => handleStatusChange(record.id, 'SENT')}
                style={{ color: '#52c41a', borderColor: '#52c41a' }}
              >
                Gửi
              </Button>
            </Tooltip>
          )}
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(record.id)}>
            Xem
          </Button>
          <Button size="small" type="primary" icon={<EditOutlined />} onClick={() => setEditData(record)}>
            Sửa
          </Button>
          <Tooltip title={record.status !== 'SENT' && record.status !== 'ACCEPTED' ? "Chỉ báo giá ở trạng thái ĐÃ GỬI hoặc CHẤP NHẬN mới có thể tạo PI" : "Chuyển đổi sang Hóa đơn chiếu lệ (PI)"}>
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
              Tạo PI
            </Button>
          </Tooltip>
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa không?"
            onConfirm={() => handleDelete(record.id)}
            okText="Có"
            cancelText="Hủy"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleDelete]);

  const handleEditOpenChange = useCallback((open: boolean) => {
    if (!open) setEditData(null);
  }, []);

  const { token } = theme.useToken();
  const { isDark } = useTheme();

  return (
    <div style={{ 
      padding: '24px', 
      backgroundColor: isDark ? '#0f172a' : token.colorBgLayout, 
      minHeight: '100vh',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <PageHeader 
            title="Báo Giá (Quotation)" 
            icon={<FileSearchOutlined style={{ color: token.colorPrimary }} />} 
            description="Tạo và quản lý các bản báo giá gửi khách hàng" 
          />
        </div>
        <Space size="middle">
          <Input.Search
            placeholder="Tìm theo số báo giá..."
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
            Xuất Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} style={{ height: '40px' }}>
            Tạo báo giá mới
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
            <Text>Đã chọn <b style={{ color: token.colorError }}>{selectedRowKeys.length}</b> báo giá</Text>
            <Popconfirm
              title={`Bạn có chắc chắn muốn xóa ${selectedRowKeys.length} báo giá đã chọn?`}
              onConfirm={async () => {
                const res = await sendRequest<IBackendRes<any>>({
                  url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations/bulk-delete`,
                  method: 'POST',
                  body: { ids: selectedRowKeys },
                });
                if (res) {
                  notification.success({ title: 'Thành công', description: 'Đã xóa hàng loạt báo giá' });
                  setSelectedRowKeys([]);
                  fetchQuotations({
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    search: debouncedSearch || undefined,
                  });
                }
              }}
              okText="Xóa tất cả"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button danger type="primary" size="small" icon={<DeleteOutlined />}>Xóa hàng loạt</Button>
            </Popconfirm>
            <Button size="small" onClick={() => setSelectedRowKeys([])}>Hủy chọn</Button>
          </div>
        )}

        <div className="premium-table">
          <Table<IQuotation>
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            rowKey="id"
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
              showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} báo giá`,
            }}
            size="middle"
          />
        </div>
      </Card>

      <QuotationCreateModal
        isCreateModalOpen={createOpen}
        setIsCreateModalOpen={setCreateOpen}
        fetchQuotations={() => fetchQuotations({
          current: pagination.current,
          pageSize: pagination.pageSize,
          search: debouncedSearch || undefined,
        })}
      />

      <QuotationCreateModal
        isCreateModalOpen={!!editData}
        setIsCreateModalOpen={handleEditOpenChange}
        fetchQuotations={() => fetchQuotations({
          current: pagination.current,
          pageSize: pagination.pageSize,
          search: debouncedSearch || undefined,
        })}
        editData={editData ?? undefined}
      />

      {piQuotation && (
        <PIFromQuotationModal
          open={fromPIOpen}
          setOpen={setFromPIOpen}
          quotation={piQuotation}
          fetchPIs={() => {}}
        />
      )}

      {detailId && (
        <QuotationDetailModal
          quotationId={detailId}
          open={!!detailId}
          onClose={() => setDetailId(null)}
          onSuccess={() => fetchQuotations({
            current: pagination.current,
            pageSize: pagination.pageSize,
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
