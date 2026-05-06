'use client';

import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Tag, 
  Space, 
  Button, 
  Input, 
  Card, 
  Typography, 
  Tooltip,
  Badge,
  Dropdown,
  MenuProps
} from 'antd';
import { 
  SearchOutlined, 
  PlusOutlined, 
  FilterOutlined, 
  EyeOutlined,
  EditOutlined,
  MoreOutlined,
  FileProtectOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { lcService } from '@/services/lc.service';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { useTheme } from '@/library/theme.context';
import { theme } from 'antd';
import LCModal from './lc.modal';

const { Text } = Typography;

const LCTable = () => {
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({
    current: 1,
    pageSize: 10,
    pages: 0,
    total: 0
  });
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLC, setSelectedLC] = useState<any>(null);

  const fetchData = async (current: number, pageSize: number, query = '') => {
    setLoading(true);
    const res = await lcService.findAll<any>({
        current,
        pageSize,
        ... (query ? { lcNumber: `/${query}/i` } : {})
    });
    
    setLoading(false);
    if (res?.data) {
      setData(res.data.results);
      setMeta(res.data.meta);
    }
  };

  useEffect(() => {
    fetchData(meta.current, meta.pageSize);
  }, []);

  const handleCreate = () => {
    setSelectedLC(null);
    setIsModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setSelectedLC(record);
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    fetchData(meta.current, meta.pageSize);
  };

  const getStatusTag = (status: string) => {
    const statusMap: any = {
      'DRAFT': { color: 'default', text: 'Nháp' },
      'RECEIVED': { color: 'processing', text: 'Đã nhận' },
      'DOCUMENTS_PRESENTED': { color: 'warning', text: 'Đã xuất trình' },
      'ACCEPTED': { color: 'success', text: 'Chấp nhận' },
      'PAID': { color: 'cyan', text: 'Đã thanh toán' },
      'EXPIRED': { color: 'error', text: 'Hết hạn' },
      'CANCELLED': { color: 'magenta', text: 'Đã hủy' },
    };
    const item = statusMap[status] || { color: 'default', text: status };
    return <Tag color={item.color} style={{ borderRadius: '12px' }}>{item.text}</Tag>;
  };

  const columns = [
    {
      title: 'Số L/C',
      dataIndex: 'lcNumber',
      key: 'lcNumber',
      render: (text: string) => <Text strong style={{ color: token.colorPrimary }}>{text}</Text>,
    },
    {
      title: 'Ngân hàng phát hành',
      dataIndex: 'issuingBank',
      key: 'issuingBank',
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: any) => (
        <Text strong>
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: record.currency }).format(amount)}
        </Text>
      ),
    },
    {
      title: 'Ngày hết hạn',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Tooltip title="Xem chi tiết">
            <Button type="text" icon={<EyeOutlined style={{ color: token.colorTextSecondary }} />} />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button 
              type="text" 
              icon={<EditOutlined style={{ color: token.colorPrimary }} />} 
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                { key: '1', label: 'Xuất trình chứng từ', icon: <FileProtectOutlined /> },
                { key: '2', label: 'Báo cáo sai sót', icon: <ExclamationCircleOutlined />, danger: true },
              ]
            }}
          >
            <Button type="text" icon={<MoreOutlined style={{ color: token.colorTextSecondary }} />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ 
      padding: '24px', 
      backgroundColor: isDark ? '#0f172a' : token.colorBgLayout, 
      minHeight: '100vh',
      transition: 'all 0.3s ease',
      color: isDark ? '#f8fafc' : token.colorText
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <PageHeader 
          title="Thư tín dụng (L/C)" 
          icon={<FileProtectOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />} 
          description="Quản lý và theo dõi các giao dịch Letter of Credit" 
        />
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          size="large"
          style={{ borderRadius: '8px' }}
          onClick={handleCreate}
        >
          Tạo L/C mới
        </Button>
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
        <div style={{ 
          padding: '20px 24px', 
          borderBottom: `1px solid ${isDark ? '#334155' : '#f0f0f0'}` 
        }}>
          <Space>
            <Input
              placeholder="Tìm theo số L/C..."
              prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
              size="large"
              style={{ width: 300 }}
              onPressEnter={(e: any) => fetchData(1, meta.pageSize, e.target.value)}
            />
            <Button icon={<FilterOutlined />} size="large">
              Lọc
            </Button>
          </Space>
        </div>

        <div className="premium-table">
          <Table 
            columns={columns} 
            dataSource={data} 
            loading={loading}
            rowKey="id"
            bordered={false}
            pagination={{
              ...meta,
              onChange: (page, size) => fetchData(page, size),
              showSizeChanger: true,
            }}
            scroll={{ x: 1000 }}
          />
        </div>
      </Card>

      <LCModal 
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        initialValues={selectedLC}
      />

      <style jsx global>{`
        .premium-table .ant-table {
          background: transparent !important;
        }
        .premium-table .ant-table-thead > tr > th {
          background: ${isDark ? 'rgba(30, 41, 59, 0.5)' : '#fafafa'} !important;
          color: ${isDark ? '#8c8c8c' : '#595959'} !important;
          font-weight: 600 !important;
          border-bottom: 1px solid ${isDark ? '#334155' : '#f0f0f0'} !important;
        }
        .premium-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${isDark ? '#334155' : '#f0f0f0'} !important;
        }
        .premium-table .ant-table-placeholder {
          background: transparent !important;
        }
      `}</style>
    </div>
  );
};

export default LCTable;
