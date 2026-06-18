'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Table, Tag, Typography, Button, Space, Input, DatePicker } from 'antd';
import { ShoppingCartOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { sendRequest } from '@/lib/api-client';
import { useSession } from 'next-auth/react';
import { formatDate } from '@/utils/format';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const INVOICE_ELIGIBLE_PO_STATUSES = 'PARTIAL_RECEIPT,RECEIVED';

interface IPurchaseOrderListItem {
  _id: string;
  poNumber?: string;
  orderDate?: string;
  status?: string;
  vendor?: {
    name?: string;
  };
}

type PurchaseOrderListResponse = IModelPaginate<IPurchaseOrderListItem> & {
  result?: IPurchaseOrderListItem[];
};

type DateRangeValue = [Dayjs | null, Dayjs | null] | null;

interface IProps {
  isOpen: boolean;
  onCancel: () => void;
  onSelect: (poId: string) => void;
}

const POSelectForInvoiceModal = (props: IProps) => {
  const t = useTranslations('VendorInvoice');
  const { isOpen, onCancel, onSelect } = props;
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<IPurchaseOrderListItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue>(null);

  const fetchPOs = useCallback(async (search?: string): Promise<void> => {
    if (!accessToken) return;

    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<PurchaseOrderListResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders`,
        method: 'GET',
        queryParams: {
          pageSize: 50,
          status: INVOICE_ELIGIBLE_PO_STATUSES,
          ...(search ? { poNumber: `/${search}/i` } : {}),
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        const list = res.data.results || res.data.result || [];
        setPos(list);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (isOpen) {
      void fetchPOs();
    }
  }, [fetchPOs, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchText('');
      setDateRange(null);
    }
  }, [isOpen]);

  const filteredPOs = useMemo(() => {
    const [startDate, endDate] = dateRange || [];

    if (!startDate && !endDate) return pos;

    return pos.filter((po) => {
      if (!po.orderDate) return false;

      const orderDate = dayjs(po.orderDate);
      if (!orderDate.isValid()) return false;
      if (startDate && orderDate.isBefore(startDate, 'day')) return false;
      if (endDate && orderDate.isAfter(endDate, 'day')) return false;

      return true;
    });
  }, [dateRange, pos]);

  const columns: ColumnsType<IPurchaseOrderListItem> = [
    {
      title: t('poSelect.columns.poNumber'),
      dataIndex: 'poNumber',
      key: 'poNumber',
      render: (text?: string) => <Text strong>{text || '-'}</Text>,
    },
    {
      title: t('poSelect.columns.vendor'),
      dataIndex: ['vendor', 'name'],
      key: 'vendor',
      render: (name?: string) => name || '-',
    },
    {
      title: t('poSelect.columns.date'),
      dataIndex: 'orderDate',
      key: 'orderDate',
      render: (date?: string) => (date ? formatDate(date) : '-'),
    },
    {
      title: t('poSelect.columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status?: string) => <Tag color="blue">{status || '-'}</Tag>,
    },
    {
      title: t('poSelect.columns.actions'),
      key: 'action',
      render: (_, record) => (
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
      width={780}
    >
      <Space orientation="vertical" size={12} style={{ width: '100%', marginBottom: 16 }}>
        <Input
          value={searchText}
          placeholder={t('poSelect.searchPlaceholder')}
          prefix={<SearchOutlined />}
          allowClear
          onChange={(e) => {
            const value = e.target.value;
            setSearchText(value);
            void fetchPOs(value);
          }}
        />
        <RangePicker
          value={dateRange}
          format="DD/MM/YYYY"
          placeholder={[t('poSelect.dateFromPlaceholder'), t('poSelect.dateToPlaceholder')]}
          style={{ width: '100%' }}
          allowClear
          onChange={(dates) => setDateRange(dates)}
        />
      </Space>
      <Table
        dataSource={filteredPOs}
        columns={columns}
        loading={loading}
        rowKey="_id"
        size="small"
        pagination={{ pageSize: 5 }}
        locale={{ emptyText: t('poSelect.emptyEligible') }}
      />
    </Modal>
  );
};

export default POSelectForInvoiceModal;
