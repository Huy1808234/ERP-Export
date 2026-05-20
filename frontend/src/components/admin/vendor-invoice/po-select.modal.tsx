'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Table, Tag, Typography, Button, Space, Input } from 'antd';
import { ShoppingCartOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { sendRequest } from '@/lib/api-client';
import { useSession } from 'next-auth/react';
import { formatDate } from '@/utils/format';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;
const INVOICE_ELIGIBLE_PO_STATUSES = 'PARTIAL_RECEIPT,RECEIVED';

interface IProps {
  isOpen: boolean;
  onCancel: () => void;
  onSelect: (poId: string) => void;
}

const POSelectForInvoiceModal = (props: IProps) => {
  const t = useTranslations('VendorInvoice');
  const { isOpen, onCancel, onSelect } = props;
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && getAccessToken(session)) {
      fetchPOs();
    }
  }, [isOpen, session]);

  const fetchPOs = async (search?: string) => {
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders`,
        method: 'GET',
        queryParams: { 
          pageSize: 50,
          status: INVOICE_ELIGIBLE_PO_STATUSES,
          ...(search ? { poNumber: `/${search}/i` } : {})
        },
        headers: { Authorization: `Bearer ${getAccessToken(session)}` },
      });
      if (res?.data) {
        const list = res.data.results || res.data.result || [];
        setPos(list);
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t('poSelect.columns.poNumber'),
      dataIndex: 'poNumber',
      key: 'poNumber',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t('poSelect.columns.vendor'),
      dataIndex: ['vendor', 'name'],
      key: 'vendor',
    },
    {
      title: t('poSelect.columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color="blue">{status}</Tag>
    },
    {
      title: t('poSelect.columns.actions'),
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="primary" size="small" onClick={() => onSelect(record._id)}>
          {t('poSelect.selectBtn')}
        </Button>
      ),
    },
  ];

  return (
    <Modal
      title={<Space><ShoppingCartOutlined /> {t('poSelect.modalTitle')}</Space>}
      open={isOpen}
      onCancel={onCancel}
      footer={null}
      width={700}
    >
      <Input
        placeholder={t('poSelect.searchPlaceholder')}
        prefix={<SearchOutlined />}
        style={{ marginBottom: 16 }}
        allowClear
        onChange={(e) => fetchPOs(e.target.value)}
      />
      <Table 
        dataSource={pos} 
        columns={columns} 
        loading={loading} 
        rowKey="_id" 
        size="small"
        pagination={{ pageSize: 5 }}
      />
    </Modal>
  );
};

export default POSelectForInvoiceModal;
