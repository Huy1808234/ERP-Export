'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button, Descriptions, Divider, Modal, Space, Table, Tag, Typography, Spin, App } from 'antd';
import { 
  ShoppingCartOutlined, 
  PrinterOutlined, 
  HistoryOutlined, 
  FileProtectOutlined,
  BarcodeOutlined,
  FileDoneOutlined
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

const { Text, Title } = Typography;

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

  const lineColumns = useMemo(() => [
    { title: t('detail.columns.index'), key: 'index', render: (_: any, __: any, i: number) => i + 1, width: 45 },
    {
      title: t('detail.columns.product'),
      dataIndex: 'product',
      key: 'product',
      render: (p: any) => (
        <div>
          <Text strong>{p?.vietnameseName ?? '-'}</Text>
          {p?.sku && <div><Text type="secondary" style={{ fontSize: 12 }}>SKU: {p.sku}</Text></div>}
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
      render: (_: any, record: IPOLine) => (
        <Text strong>{formatMoney((record.quantity || 0) * (record.unitPrice || 0), data?.currency)}</Text>
      ),
    },
  ], [data?.currency, formatMoney, formatNumber, t]);

  // Helper to get status config safely - using any cast to suppress index error
  const getStatusConfig = (status?: POStatus) => {
    if (!status) return { color: 'default', label: '-' };
    const config = (PO_STATUS_CONFIG as any)[status];
    if (!config) return { color: 'default', label: status };
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
      footer={[
        <Button key="close" onClick={onClose}>{t('detail.closeBtn')}</Button>,
        <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={() => handlePrint()} disabled={loading}>
          {t('detail.printBtn')}
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
        {data && (
          <>
            <div style={{ marginBottom: 24, padding: '0 16px' }}>
              <Steps
                current={['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIAL_RECEIPT', 'RECEIVED', 'COMPLETED'].indexOf(data.status)}
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
            </div>

            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
              <Text strong>{t('detail.orderStatusLabel')}</Text>
              <Tag color={getStatusConfig(data.status).color} style={{ marginInlineEnd: 0 }}>
                {getStatusConfig(data.status).label}
              </Tag>
            </div>

            {/* Print Container */}
            <div ref={printRef} style={{ padding: '24px', backgroundColor: '#fff' }}>
              <div className="print-header" style={{ textAlign: 'center', marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>{t('detail.printTitle')}</Title>
                <Text type="secondary">{t('detail.poNumberLabel')}: {data.poNumber}</Text>
              </div>

              <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
                <Descriptions.Item label={t('detail.vendorLabel')} span={2}>
                  <Text strong>{data.vendor?.name ?? '-'}</Text>
                  {data.vendor?.address && <div><Text type="secondary">{data.vendor.address}</Text></div>}
                  {data.vendor?.phone && <div><Text type="secondary">{t('detail.phoneLabel')}: {data.vendor.phone}</Text></div>}
                </Descriptions.Item>
                <Descriptions.Item label={t('detail.orderDateLabel')}>
                  {formatDate(data.orderDate)}
                </Descriptions.Item>
                <Descriptions.Item label={t('detail.expectedDeliveryLabel')}>
                  {data.expectedDeliveryDate ? formatDate(data.expectedDeliveryDate) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label={t('detail.currencyLabel')}>
                  {data.currency}
                </Descriptions.Item>
                <Descriptions.Item label={t('detail.prRefLabel')}>
                  {data.poNumber ? <Tag color="blue">{data.poNumber}</Tag> : '-'}
                </Descriptions.Item>
              </Descriptions>

              <Divider titlePlacement="left" styles={{ content: { margin: 0 } }}>{t('detail.itemsTitle')}</Divider>

              <Table<IPOLine>
                size="small"
                bordered
                dataSource={data.items ?? []}
                columns={lineColumns}
                rowKey={(record) => record._id || record.productId}
                pagination={false}
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

              {data.note && (
                <div style={{ marginTop: 24 }}>
                  <Text strong>{t('detail.noteLabel')}</Text>
                  <div style={{ padding: '8px 12px', background: '#fafafa', borderRadius: 6, marginTop: 4 }}>
                    <Text type="secondary">{data.note}</Text>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </Spin>
    </Modal>
  );
};

export default PurchaseOrderDetailModal;
