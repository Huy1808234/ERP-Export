'use client';

import React, { useEffect, useState } from 'react';
import { Table, Tag, Typography, Card, Space, Button, Tooltip, theme } from 'antd';
import { useTranslations } from 'next-intl';
import {EyeOutlined, PlusOutlined, RollbackOutlined} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePurchaseReturns } from '@/hooks/usePurchaseReturns';
import { useTheme } from '@/context/theme.context';
import { formatDate } from '@/utils/format';
import PurchaseReturnModal from './purchase-return.modal';

const { Text } = Typography;

const PurchaseReturnTable = () => {
  const t = useTranslations('PurchaseReturn');
  const { data, meta, loading, fetchReturns } = usePurchaseReturns();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { token } = theme.useToken();
  const { isDark } = useTheme();

  useEffect(() => {
    fetchReturns({ current, pageSize });
  }, [current, pageSize, fetchReturns]);

  const columns = [
    {
      title: t('table.columns.returnNumber'),
      dataIndex: 'returnNumber',
      key: 'returnNumber',
      render: (text: string) => <Text strong style={{ color: token.colorError }}>{text}</Text>,
    },
    {
      title: t('table.columns.returnDate'),
      dataIndex: 'returnDate',
      key: 'returnDate',
      render: (date: string) => formatDate(date),
    },
    {
      title: t('table.columns.poNumber'),
      dataIndex: ['purchaseOrder', 'poNumber'],
      key: 'poNumber',
      render: (text: string) => text ? <Tag color="blue">{text}</Tag> : '-',
    },
    {
      title: t('table.columns.reason'),
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: t('table.columns.actions'),
      key: 'action',
      width: 100,
      render: () => (
        <Space>
          <Tooltip title={t('table.tooltips.viewDetail')}>
            <Button type="text" icon={<EyeOutlined style={{ color: token.colorError }} />} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size="large">
          <PageHeader 
            title={t('title')} 
            icon={<RollbackOutlined style={{ color: token.colorError }} />} 
            description={t('description')} 
          />
        </Space>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          size="large" 
          danger
          style={{ borderRadius: 8 }}
          onClick={() => setIsModalOpen(true)}
        >
          {t('createBtn')}
        </Button>
      </div>

      <Card 
        variant="borderless" 
        style={{ 
          borderRadius: '12px', 
          background: token.colorBgContainer,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)' 
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div className="premium-table">
          <Table
            columns={columns}
            dataSource={data}
            loading={loading}
            rowKey="_id"
            bordered={false}
            pagination={{
              current: meta.current,
              pageSize: meta.pageSize,
              total: meta.total,
              onChange: (p, s) => { setCurrent(p); setPageSize(s); },
            }}
          />
        </div>
      </Card>

      <PurchaseReturnModal 
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        fetchData={() => fetchReturns({ current, pageSize })}
      />

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
    </>
  );
};

export default PurchaseReturnTable;
