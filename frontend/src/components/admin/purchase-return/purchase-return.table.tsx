'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  EyeOutlined,
  PlusOutlined,
  RollbackOutlined,
  SendOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePurchaseReturns } from '@/hooks/usePurchaseReturns';
import { useTheme } from '@/context/theme.context';
import { formatDate } from '@/utils/format';
import { notification, modal } from '@/providers/antd-static';
import type { IPurchaseReturn, PurchaseReturnStatus } from '@/types/purchase-return';
import PurchaseReturnModal from './purchase-return.modal';

const { Text } = Typography;

const STATUS_COLOR: Record<PurchaseReturnStatus, string> = {
  DRAFT: 'default',
  PENDING_VENDOR: 'processing',
  SENT: 'blue',
  CREDITED: 'green',
  REPLACED: 'purple',
  CLOSED: 'green',
  CANCELLED: 'red',
};

const PurchaseReturnTable = () => {
  const t = useTranslations('PurchaseReturn');
  const { data, meta, loading, fetchReturns, runReturnAction } = usePurchaseReturns();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { token } = theme.useToken();
  const { isDark } = useTheme();

  const refreshData = useCallback(() => fetchReturns({ current, pageSize }), [
    current,
    fetchReturns,
    pageSize,
  ]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleAction = async (
    record: IPurchaseReturn,
    action: 'submit' | 'send' | 'resolve' | 'cancel',
    body: Record<string, unknown> = {},
    successMessage = 'Purchase return updated',
  ) => {
    const loadingKey = `${record._id}:${action}:${String(body.settlementType || '')}`;
    setActionLoading(loadingKey);
    try {
      await runReturnAction(record._id, action, body);
      notification.success({ title: successMessage });
      refreshData();
    } catch (error) {
      notification.error({
        title: error instanceof Error ? error.message : 'Action failed',
      });
      throw error;
    } finally {
      setActionLoading(null);
    }
  };

  const confirmCancel = (record: IPurchaseReturn) => {
    let reason = '';
    modal.confirm({
      title: t('notifications.cancelPrompt', { id: record.returnNumber }),
      content: (
        <Input.TextArea
          rows={3}
          placeholder={t('notifications.cancelReason')}
          onChange={(event) => {
            reason = event.target.value;
          }}
        />
      ),
      okText: t('table.tooltips.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!reason.trim()) {
          notification.error({ title: t('notifications.cancelReasonRequired') });
          return Promise.reject(new Error(t('notifications.cancelReasonRequired')));
        }
        await handleAction(
          record,
          'cancel',
          { reason: reason.trim() },
          t('notifications.cancelled'),
        );
      },
    });
  };

  const showDetail = (record: IPurchaseReturn) => {
    modal.info({
      title: record.returnNumber,
      width: 720,
      content: (
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <Text>{t('detail.status')}: {t(`status.${record.status}`)}</Text>
          <Text>{t('detail.po')}: {record.purchaseOrder?.poNumber || '-'}</Text>
          <Text>{t('detail.reason')}: {record.reason || '-'}</Text>
          <Table
            size="small"
            rowKey={(item) => item._id || item.productId}
            pagination={false}
            dataSource={record.items || []}
            columns={[
              {
                title: t('detail.product'),
                dataIndex: ['product', 'vietnameseName'],
                render: (value: string, item) => value || item.productId,
              },
              { title: t('detail.sku'), dataIndex: ['product', 'sku'] },
              { title: t('detail.qty'), dataIndex: 'quantity' },
              { title: t('detail.unit'), dataIndex: 'unit' },
            ]}
          />
          {record.settlementNote ? <Text type="secondary">{record.settlementNote}</Text> : null}
        </Space>
      ),
    });
  };

  const renderActions = (record: IPurchaseReturn) => {
    const status = record.status;
    const isLoading = (action: string, settlementType = '') =>
      actionLoading === `${record._id}:${action}:${settlementType}`;

    return (
      <Space size={4}>
        <Tooltip title={t('table.tooltips.viewDetail')}>
          <Button
            type="text"
            icon={<EyeOutlined style={{ color: token.colorError }} />}
            onClick={() => showDetail(record)}
          />
        </Tooltip>
        {status === 'DRAFT' ? (
          <Tooltip title={t('table.tooltips.submit')}>
            <Button
              type="text"
              icon={<CheckCircleOutlined />}
              loading={isLoading('submit')}
              onClick={() => handleAction(record, 'submit', {}, t('notifications.submitted'))}
            />
          </Tooltip>
        ) : null}
        {status === 'DRAFT' || status === 'PENDING_VENDOR' ? (
          <Tooltip title={t('table.tooltips.send')}>
            <Button
              type="text"
              icon={<SendOutlined />}
              loading={isLoading('send')}
              onClick={() => handleAction(record, 'send', {}, t('notifications.sent'))}
            />
          </Tooltip>
        ) : null}
        {status === 'SENT' ? (
          <>
            <Tooltip title={t('table.tooltips.credited')}>
              <Button
                type="text"
                icon={<DollarOutlined />}
                loading={isLoading('resolve', 'CREDITED')}
                onClick={() =>
                  handleAction(
                    record,
                    'resolve',
                    { settlementType: 'CREDITED' },
                    t('notifications.credited'),
                  )
                }
              />
            </Tooltip>
            <Tooltip title={t('table.tooltips.replaced')}>
              <Button
                type="text"
                icon={<SwapOutlined />}
                loading={isLoading('resolve', 'REPLACED')}
                onClick={() =>
                  handleAction(
                    record,
                    'resolve',
                    { settlementType: 'REPLACED' },
                    t('notifications.replaced'),
                  )
                }
              />
            </Tooltip>
            <Tooltip title={t('table.tooltips.close')}>
              <Button
                type="text"
                icon={<CheckCircleOutlined />}
                loading={isLoading('resolve', 'CLOSED')}
                onClick={() =>
                  handleAction(
                    record,
                    'resolve',
                    { settlementType: 'CLOSED' },
                    t('notifications.closed'),
                  )
                }
              />
            </Tooltip>
          </>
        ) : null}
        {status === 'DRAFT' || status === 'PENDING_VENDOR' ? (
          <Tooltip title={t('table.tooltips.cancel')}>
            <Button
              type="text"
              danger
              icon={<CloseCircleOutlined />}
              loading={isLoading('cancel')}
              onClick={() => confirmCancel(record)}
            />
          </Tooltip>
        ) : null}
      </Space>
    );
  };

  const columns: ColumnsType<IPurchaseReturn> = [
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
      render: (text: string) => (text ? <Tag color="blue">{text}</Tag> : '-'),
    },
    {
      title: t('table.columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: PurchaseReturnStatus) => (
        <Tag color={STATUS_COLOR[status] || 'default'}>{t(`status.${status}`)}</Tag>
      ),
    },
    {
      title: t('table.columns.reason'),
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (reason: string | null) => reason || '-',
    },
    {
      title: t('table.columns.actions'),
      key: 'action',
      width: 220,
      render: (_value, record) => renderActions(record),
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
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)',
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
              onChange: (page, size) => { setCurrent(page); setPageSize(size); },
            }}
          />
        </div>
      </Card>

      <PurchaseReturnModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        fetchData={refreshData}
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
