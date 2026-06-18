'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ExportOutlined, FileDoneOutlined, PlusOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

type ExportDeliveryStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

interface IShipmentOption {
  _id: string;
  shipmentNumber: string;
  status: string;
  isStockIssued?: boolean;
  salesContract?: {
    contractNumber?: string | null;
    buyer?: { name?: string | null };
  };
}

interface IExportDeliveryItem {
  _id: string;
  productId: string;
  quantity: number;
  unit?: string | null;
  unitCost?: number;
  totalCost?: number;
  lotNumber?: string | null;
  product?: {
    sku?: string | null;
    vietnameseName?: string | null;
    englishName?: string | null;
  };
}

interface IExportDeliveryAuditEvent {
  eventType: string;
  actorUsername: string;
  occurredAt: string;
  note?: string | null;
}

interface IExportDelivery {
  _id: string;
  deliveryNumber: string;
  shipmentId: string;
  salesContractId: string;
  buyerId: string;
  deliveryDate: string;
  status: ExportDeliveryStatus;
  createdByUsername?: string | null;
  issuedByUsername?: string | null;
  issuedAt?: string | null;
  cancelledByUsername?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  note?: string | null;
  shipment?: { shipmentNumber?: string | null; status?: string | null };
  salesContract?: { contractNumber?: string | null };
  buyer?: { name?: string | null };
  items?: IExportDeliveryItem[];
  auditTrail?: IExportDeliveryAuditEvent[] | null;
}

interface IPaginatedResponse<T> {
  results: T[];
  meta?: { current: number; pageSize: number; total: number };
}

const statusColor: Record<ExportDeliveryStatus, string> = {
  DRAFT: 'gold',
  ISSUED: 'green',
  CANCELLED: 'red',
};

const ExportDeliveriesPage = () => {
  const t = useTranslations('ExportDeliveries');
  const locale = useLocale();
  const { data: session } = useSession();
  const { message } = App.useApp();
  const accessToken = getAccessToken(session);
  const [form] = Form.useForm<{ shipmentRef: string; deliveryDate?: dayjs.Dayjs; note?: string }>();
  const [cancelForm] = Form.useForm<{ reason: string }>();

  const [rows, setRows] = useState<IExportDelivery[]>([]);
  const [shipments, setShipments] = useState<IShipmentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [selected, setSelected] = useState<IExportDelivery | null>(null);

  const authHeaders = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    [accessToken],
  );

  const fetchRows = useCallback(async () => {
    if (!authHeaders) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<IPaginatedResponse<IExportDelivery>>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/export-deliveries`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 50 },
        headers: authHeaders,
    });
    setRows(res?.data?.results ?? []);
    } catch {
      message.error(t('messages.loadError'));
    } finally {
      setLoading(false);
    }
  }, [authHeaders, message, t]);

  const fetchShipments = useCallback(async () => {
    if (!authHeaders) return;
    const res = await sendRequest<IBackendRes<IPaginatedResponse<IShipmentOption>>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments`,
      method: 'GET',
      queryParams: { current: 1, pageSize: 100 },
      headers: authHeaders,
    });
    setShipments((res?.data?.results ?? []).filter((item) => !item.isStockIssued));
  }, [authHeaders]);

  useEffect(() => {
    fetchRows();
    fetchShipments();
  }, [fetchRows, fetchShipments]);

  const createDelivery = async () => {
    if (!authHeaders) return;
    const values = await form.validateFields();
    const res = await sendRequest<IBackendRes<IExportDelivery>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/export-deliveries/from-shipment/${values.shipmentRef}`,
      method: 'POST',
      body: {
        deliveryDate: values.deliveryDate?.format('YYYY-MM-DD'),
        note: values.note,
      },
      headers: authHeaders,
    });

    if (res?.data) {
      message.success(t('messages.createSuccess', { number: res.data.deliveryNumber }));
      form.resetFields();
      setModalOpen(false);
      fetchRows();
      fetchShipments();
    }
  };

  const issueDelivery = async (record: IExportDelivery) => {
    if (!authHeaders) return;
    const res = await sendRequest<IBackendRes<IExportDelivery>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/export-deliveries/${record._id}/issue`,
      method: 'PATCH',
      headers: authHeaders,
    });

    if (res?.data) {
      message.success(t('messages.issueSuccess', { number: res.data.deliveryNumber }));
      fetchRows();
      fetchShipments();
    }
  };

  const cancelDelivery = async () => {
    if (!authHeaders || !selected) return;
    const values = await cancelForm.validateFields();
    const res = await sendRequest<IBackendRes<IExportDelivery>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/export-deliveries/${selected._id}/cancel`,
      method: 'PATCH',
      body: { reason: values.reason },
      headers: authHeaders,
    });

    if (res?.data) {
      message.success(t('messages.cancelSuccess', { number: res.data.deliveryNumber }));
      cancelForm.resetFields();
      setCancelOpen(false);
      setSelected(null);
      fetchRows();
      fetchShipments();
    }
  };

  const columns: ColumnsType<IExportDelivery> = [
    {
      title: t('table.delivery'),
      dataIndex: 'deliveryNumber',
      render: (value: string, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.deliveryDate ? dayjs(record.deliveryDate).format('DD/MM/YYYY') : '-'}</Text>
        </Space>
      ),
    },
    {
      title: t('table.shipment'),
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.shipment?.shipmentNumber || '-'}</Text>
          <Text type="secondary">{record.salesContract?.contractNumber || '-'}</Text>
        </Space>
      ),
    },
    {
      title: t('table.buyer'),
      render: (_, record) => record.buyer?.name || '-',
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      render: (value: ExportDeliveryStatus) => <Tag color={statusColor[value]}>{t(`status.${value}`)}</Tag>,
    },
    {
      title: t('table.lines'),
      render: (_, record) => record.items?.length ?? 0,
      align: 'right',
      width: 90,
    },
    {
      title: t('table.actions'),
      width: 230,
      render: (_, record) => (
        <Space wrap>
          <Button
            size="small"
            icon={<FileDoneOutlined />}
            onClick={() => {
              setSelected(record);
              setDetailOpen(true);
            }}
          >
            {t('actions.detail')}
          </Button>
          {record.status === 'DRAFT' && (
            <Popconfirm
              title={t('confirm.issueTitle')}
              onConfirm={() => issueDelivery(record)}
              okText={t('actions.issue')}
              cancelText={t('actions.cancel')}
            >
              <Button size="small" type="primary" icon={<ExportOutlined />}>
                {t('actions.issue')}
              </Button>
            </Popconfirm>
          )}
          {record.status === 'DRAFT' && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => {
                setSelected(record);
                setCancelOpen(true);
              }}
            >
              {t('actions.cancel')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const itemColumns: ColumnsType<IExportDeliveryItem> = [
    {
      title: t('itemTable.sku'),
      render: (_, record) => {
        const productName = locale === 'vi'
          ? record.product?.vietnameseName || record.product?.englishName
          : record.product?.englishName || record.product?.vietnameseName;

        return (
          <Space orientation="vertical" size={0}>
            <Text strong>{record.product?.sku || record.productId}</Text>
            <Text type="secondary">{productName || '-'}</Text>
          </Space>
        );
      },
    },
    {
      title: t('itemTable.quantity'),
      dataIndex: 'quantity',
      align: 'right',
      render: (value: number, record) => `${Number(value || 0).toLocaleString()} ${record.unit || ''}`,
    },
    {
      title: t('itemTable.lot'),
      dataIndex: 'lotNumber',
      render: (value?: string | null) => value ? <Tag color="blue">{value}</Tag> : '-',
    },
  ];

  return (
    <AdminPageScroll>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <PageHeader
          title={t('title')}
          icon={<ExportOutlined />}
          description={t('description')}
        />

        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={fetchRows}>
              {t('actions.reload')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              {t('actions.createFromShipment')}
            </Button>
          </Space>
        </Space>

        <Table<IExportDelivery>
          rowKey="_id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          locale={{ emptyText: t('empty.noDeliveries') }}
          pagination={{ pageSize: 10 }}
        />
      </Space>

      <Modal
        title={t('modal.createTitle')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={createDelivery}
        okText={t('actions.createDelivery')}
        cancelText={t('actions.close')}
      >
        <Form form={form} layout="vertical">
          <Form.Item label={t('form.shipment')} name="shipmentRef" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={shipments.map((item) => ({
                value: item._id,
                label: `${item.shipmentNumber} - ${item.salesContract?.contractNumber || ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item label={t('form.deliveryDate')} name="deliveryDate" initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('form.note')} name="note">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('modal.cancelTitle')}
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onOk={cancelDelivery}
        okText={t('actions.cancelDelivery')}
        okButtonProps={{ danger: true }}
        cancelText={t('actions.close')}
      >
        <Form form={cancelForm} layout="vertical">
          <Form.Item label={t('form.reason')} name="reason" rules={[{ required: true, min: 3 }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={selected?.deliveryNumber || t('drawer.defaultTitle')}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        size="large"
      >
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label={t('drawer.status')}>
              {selected?.status && <Tag color={statusColor[selected.status]}>{t(`status.${selected.status}`)}</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label={t('drawer.shipment')}>{selected?.shipment?.shipmentNumber || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('drawer.buyer')}>{selected?.buyer?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('drawer.createdBy')}>{selected?.createdByUsername || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('drawer.issuedBy')}>{selected?.issuedByUsername || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('drawer.issuedAt')}>
              {selected?.issuedAt ? dayjs(selected.issuedAt).format('DD/MM/YYYY HH:mm') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('drawer.note')} span={2}>{selected?.note || '-'}</Descriptions.Item>
          </Descriptions>

          <Table<IExportDeliveryItem>
            rowKey="_id"
            columns={itemColumns}
            dataSource={selected?.items ?? []}
            pagination={false}
            locale={{ emptyText: t('empty.noItems') }}
            size="small"
          />

          <Table<IExportDeliveryAuditEvent>
            rowKey={(record) => `${record.eventType}-${record.occurredAt}`}
            columns={[
              { title: t('auditTable.event'), dataIndex: 'eventType' },
              { title: t('auditTable.actor'), dataIndex: 'actorUsername' },
              {
                title: t('auditTable.time'),
                dataIndex: 'occurredAt',
                render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm'),
              },
              { title: t('auditTable.note'), dataIndex: 'note', render: (value?: string | null) => value || '-' },
            ]}
            dataSource={selected?.auditTrail ?? []}
            pagination={false}
            locale={{ emptyText: t('empty.noAudit') }}
            size="small"
          />
        </Space>
      </Drawer>
    </AdminPageScroll>
  );
};

export default ExportDeliveriesPage;
