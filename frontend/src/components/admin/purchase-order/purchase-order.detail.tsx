'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button, Modal, Space, Table, Tag, Typography, Spin, App } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalendarOutlined,
  DollarOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  PrinterOutlined,
  HistoryOutlined,
  FileProtectOutlined,
  BarcodeOutlined,
  FileDoneOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Steps } from 'antd';
import { useReactToPrint } from 'react-to-print';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';

// Chuyển sang Relative Path để tránh lỗi Alias
import { IPurchaseOrder, IPOLine, POStatus } from '@/types/purchase-order';
import { PO_STATUS_CONFIG } from '@/constants/purchase-order';
import { formatDate } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';
import { cn } from '@/utils/cn';

const { Text } = Typography;

const PO_STATUS_FLOW: POStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT',
  'PARTIAL_RECEIPT',
  'RECEIVED',
  'COMPLETED',
];

const panelClass =
  'print-card rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/85';
const mutedLabelClass = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const strongValueClass = 'mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50';

interface IProps {
  poId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PurchaseOrderDetailModal: React.FC<IProps> = ({ poId, open, onClose }) => {
  const { notification } = App.useApp();
  const t = useTranslations('PurchaseOrder');
  const { data: session } = useSession();
  const { formatMoney, formatNumber } = useCurrency();
  const [data, setData] = useState<IPurchaseOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const receiptSummary = useMemo(() => {
    const items = data?.items ?? [];
    const orderedQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const receivedQty = items.reduce((sum, item) => sum + Number(item.receivedQuantity || 0), 0);
    const receiptRate = orderedQty > 0 ? Math.min((receivedQty / orderedQty) * 100, 100) : 0;

    return {
      lineCount: items.length,
      orderedQty,
      receivedQty,
      receiptRate,
    };
  }, [data?.items]);

  const vatSummaryLabel = useMemo(() => {
    const rates = Array.from(
      new Set(
        (data?.items ?? [])
          .map((item) => Number(item.taxRate))
          .filter((rate) => Number.isFinite(rate)),
      ),
    );

    if (rates.length === 0) return t('detail.vatLabel');

    return `${t('detail.vatLabel')} (${rates.map((rate) => `${formatNumber(rate)}%`).join(', ')})`;
  }, [data?.items, formatNumber, t]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `PO_${data?.poNumber || 'PDF'}`,
  });

  // Tự động Fetch Detail theo ID khi mở Modal
  useEffect(() => {
    if (!open || !poId || !getAccessToken(session)) return;
    
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await sendRequest<IBackendRes<IPurchaseOrder>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders/${poId}`,
          method: 'GET',
          headers: { Authorization: `Bearer ${getAccessToken(session)}` },
        });
        if (res?.data) setData(res.data);
      } catch {
        notification.error({ title: t('notifications.fetchError') });
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [poId, open, session, notification, t]);

  const lineColumns = useMemo<ColumnsType<IPOLine>>(() => [
    {
      title: t('detail.columns.index'),
      key: 'index',
      render: (_value: unknown, _record: IPOLine, index: number) => index + 1,
      width: 56,
    },
    {
      title: t('detail.columns.product'),
      dataIndex: 'product',
      key: 'product',
      render: (product?: IPOLine['product']) => (
        <div>
          <Text strong>{product?.vietnameseName ?? '-'}</Text>
          {product?.sku && <div><Text type="secondary" style={{ fontSize: 12 }}>SKU: {product.sku}</Text></div>}
        </div>
      ),
    },
    {
      title: t('detail.columns.qtyOrdered'),
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right' as const,
      render: (v: number) => formatNumber(v),
    },
    {
      title: t('detail.columns.qtyReceived'),
      dataIndex: 'receivedQuantity',
      key: 'receivedQuantity',
      width: 100,
      align: 'right' as const,
      render: (v: number) => (
        <Text type={v > 0 ? 'success' : 'secondary'}>
          {formatNumber(v)}
        </Text>
      ),
    },
    { title: t('detail.columns.unit'), dataIndex: 'unit', key: 'unit', width: 70 },
    {
      title: t('detail.columns.unitPrice'),
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 130,
      align: 'right' as const,
      render: (v: number) => formatMoney(v, data?.currency),
    },
    {
      title: t('detail.columns.amount'),
      key: 'lineSubtotal',
      width: 150,
      align: 'right' as const,
      render: (_value: unknown, record: IPOLine) => (
        <Text strong>{formatMoney((record.quantity || 0) * (record.unitPrice || 0), data?.currency)}</Text>
      ),
    },
  ], [data?.currency, formatMoney, formatNumber, t]);

  const getStatusConfig = (status?: POStatus) => {
    if (!status) return { color: 'default', label: '-' };
    const config = PO_STATUS_CONFIG[status];
    const statusKey = `status.${status}`;
    return { ...config, label: status && t.has(statusKey) ? t(statusKey) : status || 'N/A' };
  };

  if (!data && !loading) return null;

  return (
    <Modal
      title={
        <Space>
          <ShoppingCartOutlined style={{ color: '#1677ff' }} />
          <span>{t('detail.modalTitle')} — <Text style={{ color: '#1677ff' }}>{data?.poNumber}</Text></span>
          {data?.status && (
            <Tag color={getStatusConfig(data.status).color}>
              {getStatusConfig(data.status).label}
            </Tag>
          )}
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={1000}
      mask={{ closable: false }}
      destroyOnHidden
      className="purchase-order-detail-modal"
      styles={{ body: { padding: 0 } }}
      footer={[
        <Button key="close" onClick={onClose}>{t('detail.closeBtn')}</Button>,
        <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={() => handlePrint()} disabled={loading}>
          {t('detail.printBtn')}
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
        {data && (
          <div className="bg-slate-50 dark:bg-[#061053]">
            <div className="border-b border-slate-200 px-6 py-5 dark:border-blue-400/20">
              <Steps
                current={Math.max(0, PO_STATUS_FLOW.indexOf(data.status))}
                status={['REJECTED', 'CANCELLED'].includes(data.status) ? 'error' : 'process'}
                size="small"
                items={[
                  { title: t('steps.draft'), icon: <FileProtectOutlined /> },
                  { title: t('steps.approval'), icon: <FileProtectOutlined /> },
                  { title: t('steps.approved'), icon: <FileProtectOutlined /> },
                  { title: t('steps.ordered'), icon: <ShoppingCartOutlined /> },
                  { title: t('steps.receiving'), icon: <HistoryOutlined /> },
                  { title: t('steps.received'), icon: <BarcodeOutlined /> },
                  { title: t('steps.completed'), icon: <FileDoneOutlined /> },
                ]}
              />

              <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t('detail.orderStatusLabel')}
                </span>
                <Tag color={getStatusConfig(data.status).color} style={{ marginInlineEnd: 0 }}>
                  {getStatusConfig(data.status).label}
                </Tag>
              </div>
            </div>

            <div
              ref={printRef}
              className="purchase-order-detail-print max-h-[72vh] overflow-y-auto bg-slate-50 p-6 text-slate-900 dark:bg-[#061053] dark:text-slate-100"
            >
              <div className={cn(panelClass, 'mb-4 p-5')}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className={mutedLabelClass}>{t('detail.printTitle')}</div>
                    <div className="mt-1 text-2xl font-bold text-slate-950 dark:text-slate-50">
                      {data.poNumber}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <UserOutlined />
                      <span className="font-medium text-slate-700 dark:text-slate-200">{data.vendor?.name ?? '-'}</span>
                      {data.vendor?.phone && <span>• {t('detail.phoneLabel')}: {data.vendor.phone}</span>}
                    </div>
                  </div>
                  <Tag color={getStatusConfig(data.status).color} style={{ marginInlineEnd: 0 }}>
                    {getStatusConfig(data.status).label}
                  </Tag>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className={cn(panelClass, 'p-4')}>
                  <div className="mb-2 flex items-center gap-2 text-slate-400">
                    <FileTextOutlined />
                    <span className={mutedLabelClass}>{t('detail.lineCountLabel')}</span>
                  </div>
                  <div className="text-xl font-bold text-slate-950 dark:text-slate-50">
                    {formatNumber(receiptSummary.lineCount)}
                  </div>
                </div>
                <div className={cn(panelClass, 'p-4')}>
                  <div className="mb-2 flex items-center gap-2 text-slate-400">
                    <ShoppingCartOutlined />
                    <span className={mutedLabelClass}>{t('detail.columns.qtyOrdered')}</span>
                  </div>
                  <div className="text-xl font-bold text-slate-950 dark:text-slate-50">
                    {formatNumber(receiptSummary.orderedQty)}
                  </div>
                </div>
                <div className={cn(panelClass, 'p-4')}>
                  <div className="mb-2 flex items-center gap-2 text-slate-400">
                    <BarcodeOutlined />
                    <span className={mutedLabelClass}>{t('detail.columns.qtyReceived')}</span>
                  </div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-300">
                    {formatNumber(receiptSummary.receivedQty)}
                  </div>
                </div>
                <div className={cn(panelClass, 'p-4')}>
                  <div className="mb-2 flex items-center gap-2 text-slate-400">
                    <DollarOutlined />
                    <span className={mutedLabelClass}>{t('detail.totalLabel')}</span>
                  </div>
                  <div className="text-xl font-bold text-red-600 dark:text-red-300">
                    {formatMoney(data.totalAmount, data.currency)}
                  </div>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className={cn(panelClass, 'p-5')}>
                  <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-slate-50">
                    <UserOutlined />
                    {t('detail.vendorLabel')}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className={mutedLabelClass}>{t('detail.vendorLabel')}</div>
                      <div className={strongValueClass}>{data.vendor?.name ?? '-'}</div>
                    </div>
                    <div>
                      <div className={mutedLabelClass}>{t('detail.phoneLabel')}</div>
                      <div className={strongValueClass}>{data.vendor?.phone || '-'}</div>
                    </div>
                    {data.vendor?.address && (
                      <div>
                        <div className={mutedLabelClass}>{t('detail.addressLabel')}</div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{data.vendor.address}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={cn(panelClass, 'p-5')}>
                  <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-slate-50">
                    <CalendarOutlined />
                    {t('detail.orderInfoTitle')}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <div className={mutedLabelClass}>{t('detail.poNumberLabel')}</div>
                      <div className={strongValueClass}>{data.poNumber}</div>
                    </div>
                    <div>
                      <div className={mutedLabelClass}>{t('detail.currencyLabel')}</div>
                      <div className={strongValueClass}>{data.currency}</div>
                    </div>
                    <div>
                      <div className={mutedLabelClass}>{t('detail.orderDateLabel')}</div>
                      <div className={strongValueClass}>{formatDate(data.orderDate)}</div>
                    </div>
                    <div>
                      <div className={mutedLabelClass}>{t('detail.expectedDeliveryLabel')}</div>
                      <div className={strongValueClass}>
                        {data.expectedDeliveryDate ? formatDate(data.expectedDeliveryDate) : '-'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span>{t('detail.receiptProgressLabel')}</span>
                      <span>{formatNumber(receiptSummary.receiptRate)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${receiptSummary.receiptRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={cn(panelClass, 'p-4')}>
                <div className="mb-4 text-base font-semibold text-slate-950 dark:text-slate-50">
                  {t('detail.itemsTitle')}
                </div>

                <Table<IPOLine>
                  className="purchase-order-detail-lines"
                  size="small"
                  bordered
                  dataSource={data.items ?? []}
                  columns={lineColumns}
                  rowKey={(record) => record._id || record.productId}
                  pagination={false}
                  scroll={{ x: 820 }}
                  summary={() => (
                    <Table.Summary fixed>
                      <Table.Summary.Row key="subtotal">
                        <Table.Summary.Cell index={0} colSpan={6} align="right"><Text strong>{t('detail.subtotalLabel')}</Text></Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right">
                          <Text strong>{formatMoney(data.subTotal, data.currency)}</Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                      <Table.Summary.Row key="tax">
                        <Table.Summary.Cell index={0} colSpan={6} align="right"><Text strong>{vatSummaryLabel}</Text></Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right">
                          <Text strong>{formatMoney(data.taxAmount, data.currency)}</Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                      <Table.Summary.Row key="total">
                        <Table.Summary.Cell index={0} colSpan={6} align="right"><Text strong>{t('detail.totalLabel')}</Text></Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right">
                          <Text strong type="danger" style={{ fontSize: 16 }}>{formatMoney(data.totalAmount, data.currency)}</Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              </div>

              {data.note && (
                <div className={cn(panelClass, 'mt-4 p-4')}>
                  <div className="text-sm font-semibold text-slate-950 dark:text-slate-50">{t('detail.noteLabel')}</div>
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                    {data.note}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Spin>
      <style jsx global>{`
        .dark .purchase-order-detail-modal .ant-steps-item-title {
          color: #dbeafe !important;
        }
        .dark .purchase-order-detail-modal .ant-steps-item-description {
          color: #94a3b8 !important;
        }
        .dark .purchase-order-detail-lines .ant-table,
        .dark .purchase-order-detail-lines .ant-table-container,
        .dark .purchase-order-detail-lines .ant-table-content {
          background: transparent !important;
        }
        .dark .purchase-order-detail-lines .ant-table-thead > tr > th {
          background: #1e293b !important;
          color: #f8fafc !important;
          border-color: #334155 !important;
        }
        .dark .purchase-order-detail-lines .ant-table-tbody > tr > td,
        .dark .purchase-order-detail-lines .ant-table-summary > tr > td {
          background: #0f172a !important;
          color: #e2e8f0 !important;
          border-color: #334155 !important;
        }
        .dark .purchase-order-detail-lines .ant-table-tbody > tr:hover > td {
          background: #172036 !important;
        }
        .dark .purchase-order-detail-lines .ant-table-cell-scrollbar {
          box-shadow: none !important;
        }
        @media print {
          .purchase-order-detail-print {
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #111827 !important;
            padding: 24px !important;
          }
          .purchase-order-detail-print .print-card {
            background: #ffffff !important;
            border-color: #e5e7eb !important;
            box-shadow: none !important;
          }
          .purchase-order-detail-print * {
            color: #111827 !important;
          }
          .purchase-order-detail-print .ant-tag {
            color: inherit !important;
          }
        }
      `}</style>
    </Modal>
  );
};

export default PurchaseOrderDetailModal;
