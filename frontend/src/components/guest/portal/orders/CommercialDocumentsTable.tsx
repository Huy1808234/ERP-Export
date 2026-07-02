'use client';

import { Button, Empty, Space, Table, Tag, Typography } from 'antd';
import type { TablePaginationConfig, TableProps } from 'antd';
import type { Key } from 'react';
import { EyeOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import type {
  CustomerCommercialDocument,
  CustomerCommercialDocumentSortField,
} from '@/types/customer-portal';

const { Text } = Typography;

type CommercialDocumentsTableProps = {
  data: CustomerCommercialDocument[];
  loading: boolean;
  current: number;
  pageSize: number;
  total: number;
  onOpen: (document: CustomerCommercialDocument) => void;
  onDownloadPdf: (document: CustomerCommercialDocument) => void;
  onTableChange: (
    pagination: TablePaginationConfig,
    sortBy: CustomerCommercialDocumentSortField,
    sortOrder: 'ASC' | 'DESC',
  ) => void;
};

const statusColor = (status: string): string => {
  const normalized = status.toUpperCase();
  if (['ACCEPTED', 'APPROVED', 'CONFIRMED', 'PAID', 'COMPLETED'].includes(normalized)) {
    return 'success';
  }
  if (['SENT', 'PENDING_APPROVAL', 'PENDING_BUYER_SIGNATURE', 'SHIPPED'].includes(normalized)) {
    return 'processing';
  }
  if (['REJECTED', 'CANCELLED', 'EXPIRED'].includes(normalized)) {
    return 'error';
  }
  return 'warning';
};

const formatDate = (value: string | null, locale: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US');
};

const formatMoney = (value: number, currency: string, locale: string): string => {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
};

const mapSortField = (
  field: Key | readonly Key[] | undefined,
): CustomerCommercialDocumentSortField => {
  if (field === 'documentNumber') return 'documentNumber';
  if (field === 'status') return 'status';
  if (field === 'totalAmount') return 'totalAmount';
  return 'documentDate';
};

export function CommercialDocumentsTable({
  data,
  loading,
  current,
  pageSize,
  total,
  onOpen,
  onDownloadPdf,
  onTableChange,
}: CommercialDocumentsTableProps) {
  const locale = useLocale();
  const t = useTranslations('CustomerPortal');
  const columns: TableProps<CustomerCommercialDocument>['columns'] = [
    {
      title: t('ordersTable.document'),
      dataIndex: 'documentNumber',
      sorter: true,
      render: (value: string, record) => (
        <Space orientation="vertical" size={2}>
          <Button type="link" style={{ padding: 0 }} onClick={() => onOpen(record)}>
            {value}
          </Button>
          <Space size={6} wrap>
            <Tag>{t(`documentTypes.${record.documentType}`)}</Tag>
            <Text type="secondary">
              {t.has(`lifecycleStages.${record.lifecycleStage}`)
                ? t(`lifecycleStages.${record.lifecycleStage}`)
                : record.lifecycleStage}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: t('ordersTable.date'),
      dataIndex: 'documentDate',
      sorter: true,
      render: (value: string | null) => formatDate(value, locale),
    },
    {
      title: t('ordersTable.status'),
      dataIndex: 'status',
      sorter: true,
      render: (value: string, record) => (
        <Space orientation="vertical" size={2}>
          <Tag color={statusColor(value)}>{t.has(`documentStatuses.${value}`) ? t(`documentStatuses.${value}`) : value}</Tag>
          {record.isExpired ? <Text type="danger">{t('ordersTable.expired')}</Text> : null}
        </Space>
      ),
    },
    {
      title: t('ordersTable.incoterm'),
      dataIndex: 'incoterm',
      render: (value: string | null) => value ? <Tag color="blue">{value}</Tag> : '-',
    },
    {
      title: t('ordersTable.total'),
      dataIndex: 'totalAmount',
      align: 'right',
      sorter: true,
      render: (value: number, record) => (
        <Text strong>{formatMoney(value, record.currency, locale)}</Text>
      ),
    },
    {
      title: t('ordersTable.action'),
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => onOpen(record)}>
            {t('ordersTable.view')}
          </Button>
          <Button
            icon={<FilePdfOutlined />}
            disabled={record.documentType !== 'QUOTATION'}
            onClick={() => onDownloadPdf(record)}
          >
            {t('ordersTable.pdf')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Table<CustomerCommercialDocument>
      rowKey="_id"
      loading={loading}
      dataSource={data}
      columns={columns}
      pagination={{
        current,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50],
      }}
      onChange={(pagination, _filters, sorter) => {
        const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
        onTableChange(
          pagination,
          mapSortField(activeSorter?.field),
          activeSorter?.order === 'ascend' ? 'ASC' : 'DESC',
        );
      }}
      locale={{ emptyText: <Empty description={t('ordersTable.empty')} /> }}
      scroll={{ x: 1100 }}
    />
  );
}
