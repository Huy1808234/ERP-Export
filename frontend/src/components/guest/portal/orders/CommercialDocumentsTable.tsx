'use client';

import { Button, Empty, Space, Table, Tag, Typography } from 'antd';
import type { TablePaginationConfig, TableProps } from 'antd';
import type { Key } from 'react';
import { EyeOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useLocale } from 'next-intl';
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

const getTableCopy = (locale: string) => {
  const isVietnamese = locale === 'vi';

  return {
    document: isVietnamese ? 'Chứng từ' : 'Document',
    date: isVietnamese ? 'Ngày' : 'Date',
    status: isVietnamese ? 'Trạng thái' : 'Status',
    incoterm: 'Incoterm',
    total: isVietnamese ? 'Tổng tiền' : 'Total',
    action: isVietnamese ? 'Thao tác' : 'Action',
    view: isVietnamese ? 'Xem' : 'View',
    pdf: 'PDF',
    expired: isVietnamese ? 'Hết hạn' : 'Expired',
    empty: isVietnamese ? 'Không có chứng từ thương mại phù hợp' : 'No commercial documents found',
    documentTypes: {
      QUOTATION: isVietnamese ? 'Báo giá' : 'Quotation',
      SALES_CONTRACT: isVietnamese ? 'Hợp đồng' : 'Sales Contract',
      PROFORMA_INVOICE: 'Proforma Invoice',
      COMMERCIAL_INVOICE: 'Commercial Invoice',
      ORDER: isVietnamese ? 'Đơn hàng' : 'Order',
    } satisfies Record<CustomerCommercialDocument['documentType'], string>,
    statuses: {
      SENT: isVietnamese ? 'Đã gửi' : 'SENT',
      ACCEPTED: isVietnamese ? 'Đã chấp nhận' : 'ACCEPTED',
      REJECTED: isVietnamese ? 'Đã từ chối' : 'REJECTED',
      EXPIRED: isVietnamese ? 'Hết hạn' : 'EXPIRED',
      PENDING_BUYER_SIGNATURE: isVietnamese ? 'Chờ buyer ký' : 'PENDING_BUYER_SIGNATURE',
      BUYER_SIGNED: isVietnamese ? 'Buyer đã ký' : 'BUYER_SIGNED',
      CONFIRMED: isVietnamese ? 'Đã xác nhận' : 'CONFIRMED',
      SHIPPED: isVietnamese ? 'Đã giao hàng' : 'SHIPPED',
      PAID: isVietnamese ? 'Đã thanh toán' : 'PAID',
    } as Record<string, string>,
    lifecycleStages: {
      Quotation: isVietnamese ? 'Báo giá' : 'Quotation',
      Accepted: isVietnamese ? 'Đã chấp nhận' : 'Accepted',
      Rejected: isVietnamese ? 'Đã từ chối' : 'Rejected',
      Expired: isVietnamese ? 'Hết hạn' : 'Expired',
      'Sales Contract': isVietnamese ? 'Hợp đồng' : 'Sales Contract',
      'Proforma Invoice': 'Proforma Invoice',
      Payment: isVietnamese ? 'Thanh toán' : 'Payment',
      Shipment: isVietnamese ? 'Giao hàng' : 'Shipment',
      Completed: isVietnamese ? 'Hoàn tất' : 'Completed',
    } as Record<string, string>,
  };
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
  const copy = getTableCopy(locale);
  const columns: TableProps<CustomerCommercialDocument>['columns'] = [
    {
      title: copy.document,
      dataIndex: 'documentNumber',
      sorter: true,
      render: (value: string, record) => (
        <Space orientation="vertical" size={2}>
          <Button type="link" style={{ padding: 0 }} onClick={() => onOpen(record)}>
            {value}
          </Button>
          <Space size={6} wrap>
            <Tag>{copy.documentTypes[record.documentType]}</Tag>
            <Text type="secondary">
              {copy.lifecycleStages[record.lifecycleStage] || record.lifecycleStage}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: copy.date,
      dataIndex: 'documentDate',
      sorter: true,
      render: (value: string | null) => formatDate(value, locale),
    },
    {
      title: copy.status,
      dataIndex: 'status',
      sorter: true,
      render: (value: string, record) => (
        <Space orientation="vertical" size={2}>
          <Tag color={statusColor(value)}>{copy.statuses[value] || value}</Tag>
          {record.isExpired ? <Text type="danger">{copy.expired}</Text> : null}
        </Space>
      ),
    },
    {
      title: copy.incoterm,
      dataIndex: 'incoterm',
      render: (value: string | null) => value ? <Tag color="blue">{value}</Tag> : '-',
    },
    {
      title: copy.total,
      dataIndex: 'totalAmount',
      align: 'right',
      sorter: true,
      render: (value: number, record) => (
        <Text strong>{formatMoney(value, record.currency, locale)}</Text>
      ),
    },
    {
      title: copy.action,
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => onOpen(record)}>
            {copy.view}
          </Button>
          <Button
            icon={<FilePdfOutlined />}
            disabled={record.documentType !== 'QUOTATION'}
            onClick={() => onDownloadPdf(record)}
          >
            {copy.pdf}
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
      locale={{ emptyText: <Empty description={copy.empty} /> }}
      scroll={{ x: 1100 }}
    />
  );
}
