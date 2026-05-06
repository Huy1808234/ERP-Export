'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Typography, Card, Space, Input, DatePicker, Select, App } from 'antd';
import { HistoryOutlined, SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const InventoryLedgerTable = () => {
  const { data: session } = useSession();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ current: 1, pageSize: 15, total: 0 });
  
  // Filters
  const [referenceNumber, setReferenceNumber] = useState('');
  const [transactionType, setTransactionType] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const accessToken = session?.access_token;

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    
    const queryParams: any = {
      current: meta.current,
      pageSize: meta.pageSize,
    };

    if (referenceNumber) queryParams.referenceNumber = referenceNumber;
    if (transactionType) queryParams.transactionType = transactionType;
    if (dateRange) {
      queryParams.startDate = dateRange[0].startOf('day').toISOString();
      queryParams.endDate = dateRange[1].endOf('day').toISOString();
    }

    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/audit-trail`,
        method: 'GET',
        queryParams,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        setData(res.data.results);
        setMeta(prev => ({ ...prev, total: res.data.meta.total }));
      }
    } catch (error) {
      message.error('Lỗi tải dữ liệu nhật ký kho');
    } finally {
      setLoading(false);
    }
  }, [accessToken, meta.current, meta.pageSize, referenceNumber, transactionType, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      title: 'Ngày giờ',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{dayjs(v).format('DD/MM/YYYY')}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(v).format('HH:mm:ss')}</Text>
        </Space>
      ),
    },
    {
      title: 'Sản phẩm',
      dataIndex: 'product',
      render: (p: any) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{p?.sku}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{p?.vietnameseName}</Text>
        </Space>
      ),
    },
    {
      title: 'Số Lô',
      dataIndex: 'lotNumber',
      width: 130,
      render: (v: string) => v ? <Tag color="blue" className="rounded-md">{v}</Tag> : '-',
    },
    {
      title: 'Loại Giao Dịch',
      dataIndex: 'transactionType',
      width: 160,
      render: (v: string) => {
        const config: Record<string, { color: string, label: string }> = {
          'GOODS_RECEIPT': { color: 'green', label: 'Nhập kho (GRN)' },
          'SALES_DISPATCH': { color: 'blue', label: 'Xuất kho (Sales)' },
          'ADJUSTMENT': { color: 'orange', label: 'Điều chỉnh' },
          'RETURN': { color: 'red', label: 'Trả hàng' },
          'REJECTION': { color: 'volcano', label: 'Loại bỏ' },
          'RESERVE': { color: 'purple', label: 'Giữ hàng' },
          'RELEASE': { color: 'cyan', label: 'Giải phóng' },
        };
        const item = config[v] || { color: 'default', label: v };
        return <Tag color={item.color} className="rounded-md font-semibold">{item.label}</Tag>;
      },
    },
    {
      title: 'Tham chiếu',
      dataIndex: 'referenceNumber',
      width: 180,
      render: (v: string) => v ? <Text code className="font-mono bg-slate-100">{v}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantityChange',
      align: 'right' as const,
      width: 120,
      render: (v: number) => (
        <Text strong style={{ color: v > 0 ? '#10b981' : '#ef4444' }}>
          {v > 0 ? `+${v.toLocaleString()}` : v.toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Số dư sau',
      dataIndex: 'balanceAfter',
      align: 'right' as const,
      width: 120,
      render: (v: number) => <Text strong className="text-slate-700">{v?.toLocaleString()}</Text>,
    },
    {
      title: 'Ghi chú / Lý do',
      dataIndex: 'notes',
      render: (v: string) => <Text type="secondary" italic>{v || '-'}</Text>,
    },
  ];

  return (
    <div className="p-6 min-h-screen bg-slate-50/50">
      <PageHeader 
        title="Sổ Nhật Ký Kho" 
        icon={<HistoryOutlined />} 
        description="Truy xuất nguồn gốc mọi biến động tồn kho (Audit Trail)" 
      />

      <Card className="mt-6 shadow-sm border-slate-200/60 rounded-2xl overflow-hidden">
        <Space className="mb-6 w-full justify-between" size="large" wrap>
          <Space size="middle" wrap>
            <Input
              placeholder="Tìm theo số tham chiếu..."
              prefix={<SearchOutlined className="text-slate-400" />}
              onChange={(e) => setReferenceNumber(e.target.value)}
              style={{ width: 260 }}
              className="rounded-lg h-10"
              allowClear
            />
            <RangePicker 
              className="rounded-lg h-10" 
              onChange={(dates) => setDateRange(dates as any)}
            />
            <Select 
              placeholder="Loại giao dịch" 
              className="w-48 h-10" 
              allowClear
              onChange={setTransactionType}
              options={[
                { value: 'GOODS_RECEIPT', label: 'Nhập kho (GRN)' },
                { value: 'SALES_DISPATCH', label: 'Xuất kho (Sales)' },
                { value: 'ADJUSTMENT', label: 'Điều chỉnh' },
                { value: 'RETURN', label: 'Trả hàng' },
                { value: 'REJECTION', label: 'Loại bỏ' },
                { value: 'RESERVE', label: 'Giữ hàng' },
                { value: 'RELEASE', label: 'Giải phóng' },
              ]}
            />
          </Space>
          
          <Text type="secondary" className="hidden lg:block italic">
            Hiển thị {data.length} trên tổng số {meta.total} bản ghi
          </Text>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            ...meta,
            showSizeChanger: true,
            className: "px-4",
            onChange: (page, size) => setMeta({ ...meta, current: page, pageSize: size }),
          }}
          className="premium-table"
          size="middle"
        />
      </Card>
      
      <style jsx global>{`
        .premium-table .ant-table {
          background: transparent;
        }
        .premium-table .ant-table-thead > tr > th {
          background: #f8fafc;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
        }
        .premium-table .ant-table-row:hover > td {
          background: #f1f5f9 !important;
        }
      `}</style>
    </div>
  );
};

export default InventoryLedgerTable;
