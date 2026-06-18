'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Button, Space, Table, Tag, Input, Select, Typography, Card, Tooltip, App } from 'antd';
import { ColumnsType } from 'antd/es/table';
import { FileSearchOutlined, SearchOutlined, CheckCircleOutlined, PlusOutlined, ShoppingCartOutlined, PullRequestOutlined, DeleteOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { debounce } from '@/utils/debounce';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { sendRequest } from '@/lib/api-client';
import { Avatar } from 'antd';

import { usePurchaseRequests } from '@/hooks/usePurchaseRequests';
import { PR_STATUS_CONFIG } from '@/constants/purchase-request';
import { IPurchaseRequest, PRStatus } from '@/types/purchase-request';
import { formatVND, formatDate } from '@/utils/format';
import PurchaseRequestModal from './purchase-request.modal';

import { useTheme } from '@/context/theme.context';
import { theme } from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

const PurchaseRequestTable: React.FC = () => {
  const { token } = theme.useToken();
  const t = useTranslations('PurchaseRequest');
  const locale = useLocale();
  const router = useRouter();
  const { isDark } = useTheme();
  const { modal, notification } = App.useApp();
  const { data: session } = useSession();
  const { data, meta, loading, fetchPRs } = usePurchaseRequests();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [queryParams, setQueryParams] = useState({
    current: 1,
    pageSize: 10,
    prNumber: '',
    status: '',
  });
  const [selectedPR, setSelectedPR] = useState<IPurchaseRequest | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');

  useEffect(() => {
    fetchPRs(queryParams);
  }, [queryParams, fetchPRs]);

  const debouncedSearch = useMemo(
    () => debounce((value: string) => {
      setQueryParams(prev => ({ ...prev, prNumber: value, current: 1 }));
    }, 500),
    []
  );

  const handleCreatePO = useCallback(async (id: string) => {
    const accessToken = getAccessToken(session);

    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders/from-pr`,
        method: 'POST',
        body: { purchaseRequestId: id },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        notification.success({ title: t('notifications.createPOSuccess') });
        fetchPRs(queryParams);
        router.push(`/${locale}/dashboard/purchase-orders`);
      } else {
        notification.error({
          title: t('notifications.createPOError'),
          description: res?.message,
        });
      }
    } catch {
      notification.error({ title: t('notifications.createPOError') });
    }
  }, [fetchPRs, locale, notification, queryParams, router, session, t]);

  const handleSubmitPR = useCallback(async (id: string) => {
    const accessToken = getAccessToken(session);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-requests/${id}/submit`,
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        notification.success({ title: t('notifications.submitSuccess') });
        fetchPRs(queryParams);
      } else {
        notification.error({
          title: t('notifications.submitError'),
          description: res?.message,
        });
      }
    } catch {
      notification.error({ title: t('notifications.submitError') });
    }
  }, [fetchPRs, notification, queryParams, session, t]);

  const handleDeletePR = useCallback(async (id: string) => {
    const accessToken = getAccessToken(session);
    modal.confirm({
      title: t('popconfirm.deleteTitle'),
      content: t('popconfirm.deleteContent'),
      okText: t('popconfirm.deleteOk'),
      okType: 'danger',
      cancelText: t('popconfirm.deleteCancel'),
      onOk: async () => {
        try {
          await sendRequest<IBackendRes<any>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-requests/${id}`,
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          notification.success({ title: t('notifications.deleteSuccess') });
          fetchPRs(queryParams);
        } catch {
          notification.error({ title: t('notifications.deleteError') });
        }
      }
    });
  }, [fetchPRs, modal, notification, queryParams, session, t]);

  const columns: ColumnsType<IPurchaseRequest> = useMemo(() => [
    {
      title: t('table.columns.prNumber'),
      dataIndex: 'prNumber',
      key: 'prNumber',
      render: (text: string) => <Text strong style={{ color: isDark ? '#38bdf8' : token.colorPrimary }}>{text}</Text>,
    },
    {
      title: t('table.columns.date'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => formatDate(date),
    },
    {
      title: t('table.columns.department'),
      dataIndex: 'department',
      key: 'department',
      render: (dept: string) => {
        const colors: Record<string, string> = {
          'KINHDOANH_XK': 'gold',
          'KHO': 'blue',
          'MUAHANG': 'green',
          'VANHANH': 'purple',
          'SANXUAT': 'green',
          'MARKETING': 'orange',
          'HANHCHINH': 'purple',
          'KETOAN': 'magenta',
          'KYTHUAT': 'cyan'
        };
        const label = dept && t.has(`departments.${dept}`) ? t(`departments.${dept}`) : dept || 'N/A';
        return <Tag color={colors[dept] || 'default'} style={{ borderRadius: '6px', fontWeight: 600 }}>{label}</Tag>;
      }
    },
    {
      title: t('table.columns.totalAmount'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (total: number, record: IPurchaseRequest) => {
        const amount = total || record.items?.reduce((sum, item) => sum + ((item.quantity || 0) * (item.estimatedPrice || 0)), 0) || 0;
        return <Text strong type="danger">{formatVND(amount)}</Text>;
      },
      align: 'right',
    },
    {
      title: t('table.columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: PRStatus) => {
        const config = (PR_STATUS_CONFIG as Record<string, { color: string, label: string }>)[status] || { color: 'default' };
        return <Tag color={config.color} style={{ borderRadius: '12px' }}>{status ? t(`status.${status}`) : 'N/A'}</Tag>;
      },
    },
    {
      title: t('table.columns.createdBy'),
      dataIndex: 'createdBy',
      key: 'createdBy',
      render: (user?: any) => (
        <Space size={8}>
          <Avatar size="small" style={{ backgroundColor: token.colorPrimary }}>{(user?.username || user?.name || 'U').charAt(0)}</Avatar>
          <Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined, fontSize: 13 }}>
            {user?.username || user?.name || 'system'}
          </Text>
        </Space>
      ),
    },
    {
      title: t('table.columns.actions'),
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('tooltips.viewDetail')}>
            <Button 
                type="text" 
                icon={<FileSearchOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />} 
                onClick={() => {
                    setSelectedPR(record);
                    setModalMode('view');
                    setIsModalOpen(true);
                }}
            />
          </Tooltip>
          {record.status === 'DRAFT' && (
            <>
                <Tooltip title={t('tooltips.submitApproval')}>
                    <Button type="text" icon={<PullRequestOutlined style={{ color: '#1890ff' }} />} onClick={() => handleSubmitPR(record._id)} />
                </Tooltip>
                <Tooltip title={t('tooltips.edit')}>
                    <Button 
                        type="text" 
                        icon={<CheckCircleOutlined style={{ color: '#faad14' }} />} 
                        onClick={() => {
                            setSelectedPR(record);
                            setModalMode('edit');
                            setIsModalOpen(true);
                        }}
                    />
                </Tooltip>
                <Tooltip title={t('tooltips.delete')}>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeletePR(record._id)} />
                </Tooltip>
            </>
          )}
          {record.status === 'APPROVED' && (
            <Tooltip title={t('tooltips.createPO')}>
              <Button 
                type="text" 
                icon={<ShoppingCartOutlined style={{ color: '#faad14' }} />} 
                onClick={() => handleCreatePO(record._id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ], [handleCreatePO, handleDeletePR, handleSubmitPR, isDark, token, t]);

  return (
    <div style={{ 
      backgroundColor: 'transparent',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <PageHeader 
          title={t('title')} 
          icon={<PullRequestOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />} 
          description={t('description')} 
        />
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          size="large" 
          style={{ borderRadius: 8 }}
          onClick={() => {
            setModalMode('create');
            setIsModalOpen(true);
          }}
        >
          {t('createBtn')}
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
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`, display: 'flex', gap: '16px' }}>
          <Input
            placeholder={t('filters.searchPlaceholder')}
            prefix={<SearchOutlined style={{ color: isDark ? '#64748b' : '#bfbfbf' }} />}
            style={{ width: 300 }}
            size="large"
            allowClear
            onChange={(e) => debouncedSearch(e.target.value)}
          />
          <Select
            placeholder={t('filters.statusPlaceholder')}
            style={{ width: 180 }}
            size="large"
            allowClear
            options={Object.keys(PR_STATUS_CONFIG).map(s => ({ value: s, label: s ? t(`status.${s}`) : 'N/A' }))}
            onChange={(val) => setQueryParams(prev => ({ ...prev, status: val || '', current: 1 }))}
          />
        </div>

        <div className="premium-table">
          <Table<IPurchaseRequest>
            columns={columns}
            dataSource={data}
            loading={loading}
            rowKey="_id"
            bordered={false}
            pagination={{
              current: meta.current,
              pageSize: meta.pageSize,
              total: meta.total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
            }}
            onChange={(pagination) => {
              setQueryParams(prev => ({
                ...prev,
                current: pagination.current ?? 1,
                pageSize: pagination.pageSize ?? 10,
              }));
            }}
            scroll={{ x: 1000 }}
          />
        </div>
      </Card>

      <PurchaseRequestModal 
        isOpen={isModalOpen}
        setIsOpen={(v) => {
            setIsModalOpen(v);
            if (!v) setSelectedPR(null);
        }}
        fetchData={() => fetchPRs(queryParams)}
        initialData={selectedPR}
        mode={modalMode}
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
          color: ${isDark ? '#e2e8f0' : 'inherit'} !important;
        }
        .premium-table .ant-table-placeholder {
          background: transparent !important;
        }
      `}</style>
    </div>
  );
};

export default PurchaseRequestTable;
