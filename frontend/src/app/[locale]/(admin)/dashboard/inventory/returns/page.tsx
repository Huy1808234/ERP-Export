'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import { canReadCostFields, sanitizeCostPayload } from '@/lib/field-access';
import { formatCurrency, formatVND } from '@/utils/format';

const { Text } = Typography;

type ReturnStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RECEIVED' | 'REJECTED';

interface IPartner {
  _id: string;
  name: string;
  partnerType: string;
}

interface IProduct {
  _id: string;
  sku: string;
  vietnameseName: string;
  englishName?: string | null;
  unitOfMeasure?: string | null;
  purchasePriceVnd?: number | null;
}

interface IShipment {
  _id: string;
  shipmentNumber: string;
  salesContract?: {
    _id: string;
    contractNumber?: string;
    buyerId?: string;
    buyer?: IPartner;
  };
}

interface ICustomerReturnItem {
  _id: string;
  productId: string;
  product?: IProduct;
  quantity: number;
  unit?: string | null;
  unitCost?: number | null;
  lotNumber?: string | null;
  quarantine: boolean;
  note?: string | null;
}

interface ICustomerReturn {
  _id: string;
  returnNumber: string;
  buyerId: string;
  buyer?: IPartner;
  shipmentId?: string | null;
  shipment?: IShipment | null;
  salesContractId?: string | null;
  reason: string;
  status: ReturnStatus;
  returnDate: string;
  note?: string | null;
  createdByUsername: string;
  submittedByUsername?: string | null;
  approvedByUsername?: string | null;
  receivedByUsername?: string | null;
  createdAt: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  receivedAt?: string | null;
  items?: ICustomerReturnItem[];
}

interface ILotMovement {
  _id: string;
  productId: string;
  product?: IProduct;
  transactionType: string;
  quantityChange: number;
  balanceAfter: number;
  unitPrice?: number | null;
  lotNumber?: string | null;
  referenceId: string;
  partnerId?: string | null;
  referenceNumber?: string | null;
  isQuarantine: boolean;
  createdBy?: string | null;
  notes?: string | null;
  createdAt: string;
}

const statusConfig: Record<ReturnStatus, { badge: 'default' | 'processing' | 'success' | 'warning' | 'error' }> = {
  DRAFT: { badge: 'default' },
  SUBMITTED: { badge: 'processing' },
  APPROVED: { badge: 'warning' },
  RECEIVED: { badge: 'success' },
  REJECTED: { badge: 'error' },
};

const reasonValues = [
  'DAMAGED',
  'WRONG_ITEM',
  'QUALITY_CLAIM',
  'OVER_SHIPPED',
  'COMMERCIAL_RETURN',
  'OTHER',
];

const transactionValues = [
  'GOODS_RECEIPT',
  'SALES_DISPATCH',
  'ADJUSTMENT',
  'RETURN',
  'REJECTION',
  'RESERVE',
  'RELEASE',
];

const InventoryReturnsPage = () => {
  const t = useTranslations('InventoryReturns');
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const canViewCost = canReadCostFields(session?.user);
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const [returns, setReturns] = useState<ICustomerReturn[]>([]);
  const [movements, setMovements] = useState<ILotMovement[]>([]);
  const [partners, setPartners] = useState<IPartner[]>([]);
  const [products, setProducts] = useState<IProduct[]>([]);
  const [shipments, setShipments] = useState<IShipment[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [returnSearch, setReturnSearch] = useState('');
  const [movementFilters, setMovementFilters] = useState<Record<string, string | undefined>>({});

  const roleName = String(
    typeof (session?.user as any)?.role === 'string'
      ? (session?.user as any)?.role
      : session?.user?.role?.name || '',
  ).toUpperCase();
  const canCreate = ['ADMIN', 'WAREHOUSE', 'SALES_EXPORT'].includes(roleName);
  const canApprove = ['ADMIN', 'SUPER ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(roleName);
  const canReceive = ['ADMIN', 'WAREHOUSE'].includes(roleName);

  const authHeaders = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const buyerOptions = useMemo(() => partners.map((partner) => ({
    value: partner._id,
    label: partner.name,
  })), [partners]);

  const productOptions = useMemo(() => products.map((product) => ({
    value: product._id,
    label: `${product.sku} - ${product.vietnameseName || product.englishName || ''}`,
  })), [products]);

  const shipmentOptions = useMemo(() => shipments.map((shipment) => ({
    value: shipment._id,
    label: shipment.shipmentNumber,
  })), [shipments]);

  const reasonOptions = useMemo(
    () => reasonValues.map((value) => ({ value, label: t(`reasons.${value}`) })),
    [t],
  );

  const transactionOptions = useMemo(
    () => transactionValues.map((value) => ({ value, label: t(`transactions.${value}`) })),
    [t],
  );

  const fetchReturns = useCallback(async () => {
    if (!authHeaders) return;
    setLoadingReturns(true);
    try {
      const res = await sendRequest<IBackendRes<{ results: ICustomerReturn[] }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/customer-returns`,
        method: 'GET',
        queryParams: { pageSize: 50 },
        headers: authHeaders,
      });
      setReturns(res?.data?.results ?? []);
    } finally {
      setLoadingReturns(false);
    }
  }, [authHeaders]);

  const fetchMovements = useCallback(async () => {
    if (!authHeaders) return;
    setLoadingMovements(true);
    try {
      const res = await sendRequest<IBackendRes<{ results: ILotMovement[] }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/lot-movements`,
        method: 'GET',
        queryParams: { pageSize: 50, ...movementFilters },
        headers: authHeaders,
      });
      setMovements(res?.data?.results ?? []);
    } finally {
      setLoadingMovements(false);
    }
  }, [authHeaders, movementFilters]);

  const fetchReferenceData = useCallback(async () => {
    if (!authHeaders) return;
    const [partnerRes, productRes, shipmentRes] = await Promise.all([
      sendRequest<IBackendRes<{ results: IPartner[] }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 100, partnerType: 'CUSTOMER' },
        headers: authHeaders,
      }),
      sendRequest<IBackendRes<{ results: IProduct[] }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 100, sort: '-updatedAt' },
        headers: authHeaders,
      }),
      sendRequest<IBackendRes<{ results: IShipment[] }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 100 },
        headers: authHeaders,
      }),
    ]);
    setPartners(partnerRes?.data?.results ?? []);
    setProducts(productRes?.data?.results ?? []);
    setShipments(shipmentRes?.data?.results ?? []);
  }, [authHeaders]);

  useEffect(() => {
    fetchReturns();
    fetchReferenceData();
  }, [fetchReturns, fetchReferenceData]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const filteredReturns = useMemo(() => {
    const keyword = returnSearch.trim().toLowerCase();
    if (!keyword) return returns;
    return returns.filter((record) => (
      record.returnNumber.toLowerCase().includes(keyword)
      || record.buyer?.name?.toLowerCase().includes(keyword)
      || record.shipment?.shipmentNumber?.toLowerCase().includes(keyword)
      || record.createdByUsername.toLowerCase().includes(keyword)
    ));
  }, [returns, returnSearch]);

  const handleProductChange = (productId: string, index: number) => {
    const product = products.find((item) => item._id === productId);
    if (!product) return;
    const items = form.getFieldValue('items') || [];
    items[index] = {
      ...items[index],
      unit: items[index]?.unit || product.unitOfMeasure || undefined,
      ...(canViewCost ? { unitCost: items[index]?.unitCost ?? product.purchasePriceVnd ?? 0 } : {}),
    };
    form.setFieldValue('items', items);
  };

  const createReturn = async () => {
    if (!authHeaders) return;
    const values = await form.validateFields();
    const res = await sendRequest<IBackendRes<ICustomerReturn>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/customer-returns`,
      method: 'POST',
      body: sanitizeCostPayload({
        ...values,
        returnDate: values.returnDate || dayjs().format('YYYY-MM-DD'),
        items: (values.items || []).map((item: any) => {
          const line = {
            ...item,
            quantity: Number(item.quantity || 0),
            quarantine: item.quarantine ?? true,
          };

          if (canViewCost && item.unitCost !== undefined && item.unitCost !== null && item.unitCost !== '') {
            return { ...line, unitCost: Number(item.unitCost || 0) };
          }

          return line;
        }),
      }, canViewCost),
      headers: authHeaders,
    });
    if (res?.data) {
      message.success(t('messages.createSuccess'));
      setModalOpen(false);
      form.resetFields();
      fetchReturns();
    } else {
      message.error(res?.message || t('messages.createError'));
    }
  };

  const runReturnAction = async (record: ICustomerReturn, action: 'submit' | 'approve' | 'reject' | 'receive') => {
    if (!authHeaders) return;
    const res = await sendRequest<IBackendRes<ICustomerReturn>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/customer-returns/${record._id}/${action}`,
      method: 'PATCH',
      body: { note: `${action} from admin ${dayjs().format('YYYY-MM-DD HH:mm')}` },
      headers: authHeaders,
    });
    if (res?.data) {
      message.success(t('messages.actionSuccess', { action: t(`actions.${action}`) }));
      fetchReturns();
      fetchMovements();
    } else {
      message.error(res?.message || t('messages.actionError', { action: t(`actions.${action}`) }));
    }
  };

  const returnColumns: ColumnsType<ICustomerReturn> = [
    {
      title: t('returnTable.return'),
      key: 'return',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.returnNumber}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.shipment?.shipmentNumber || record.salesContractId || t('returnTable.noShipment')}
          </Text>
        </Space>
      ),
    },
    {
      title: t('returnTable.buyer'),
      key: 'buyer',
      render: (_, record) => record.buyer?.name || record.buyerId,
    },
    {
      title: t('returnTable.reason'),
      dataIndex: 'reason',
      key: 'reason',
      render: (value: string) => <Tag>{t(`reasons.${value}`)}</Tag>,
    },
    {
      title: t('returnTable.status'),
      dataIndex: 'status',
      key: 'status',
      render: (value: ReturnStatus) => (
        <Badge status={statusConfig[value]?.badge || 'default'} text={t(`status.${value}`)} />
      ),
    },
    {
      title: t('returnTable.qty'),
      key: 'qty',
      align: 'right',
      render: (_, record) => formatCurrency((record.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0), 2),
    },
    {
      title: t('returnTable.handler'),
      key: 'handler',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.receivedByUsername || record.approvedByUsername || record.submittedByUsername || record.createdByUsername}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(record.receivedAt || record.approvedAt || record.submittedAt || record.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
        </Space>
      ),
    },
    {
      title: t('returnTable.actions'),
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button
            size="small"
            icon={<SendOutlined />}
            disabled={record.status !== 'DRAFT' || !canCreate}
            onClick={() => runReturnAction(record, 'submit')}
          >
            {t('actions.submit')}
          </Button>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<CheckCircleOutlined />}
            disabled={record.status !== 'SUBMITTED' || !canApprove}
            onClick={() => runReturnAction(record, 'approve')}
          >
            {t('actions.approve')}
          </Button>
          <Button
            size="small"
            icon={<InboxOutlined />}
            disabled={record.status !== 'APPROVED' || !canReceive}
            onClick={() => runReturnAction(record, 'receive')}
          >
            {t('actions.receive')}
          </Button>
          <Popconfirm
            title={t('confirm.rejectTitle')}
            okText={t('actions.reject')}
            okButtonProps={{ danger: true }}
            onConfirm={() => runReturnAction(record, 'reject')}
          >
            <Button size="small" danger disabled={!['SUBMITTED', 'APPROVED'].includes(record.status) || !canApprove}>
              {t('actions.reject')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const returnItemColumns: ColumnsType<ICustomerReturnItem> = [
    {
      title: t('itemTable.product'),
      key: 'product',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.product?.sku || record.productId}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.product?.vietnameseName || record.product?.englishName || '-'}</Text>
        </Space>
      ),
    },
    { title: t('itemTable.lot'), dataIndex: 'lotNumber', key: 'lotNumber', render: (value?: string) => value ? <Tag color="blue">{value}</Tag> : '-' },
    { title: t('itemTable.qty'), dataIndex: 'quantity', key: 'quantity', align: 'right', render: (value: number) => formatCurrency(value, 2) },
    { title: t('itemTable.unit'), dataIndex: 'unit', key: 'unit' },
    ...(canViewCost ? [
      { title: t('itemTable.unitCost'), dataIndex: 'unitCost', key: 'unitCost', align: 'right' as const, render: (value: number) => formatVND(value || 0) },
    ] : []),
    { title: t('itemTable.quarantine'), dataIndex: 'quarantine', key: 'quarantine', render: (value: boolean) => <Tag color={value ? 'orange' : 'green'}>{value ? t('yes') : t('no')}</Tag> },
    { title: t('itemTable.note'), dataIndex: 'note', key: 'note', render: (value?: string) => value || '-' },
  ];

  const movementColumns: ColumnsType<ILotMovement> = [
    {
      title: t('movementTable.time'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{dayjs(value).format('DD/MM/YYYY')}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(value).format('HH:mm')}</Text>
        </Space>
      ),
    },
    {
      title: t('movementTable.product'),
      key: 'product',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.product?.sku || record.productId}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.product?.vietnameseName || record.product?.englishName || '-'}</Text>
        </Space>
      ),
    },
    { title: t('movementTable.lot'), dataIndex: 'lotNumber', key: 'lotNumber', render: (value?: string) => value ? <Tag color="blue">{value}</Tag> : '-' },
    { title: t('movementTable.type'), dataIndex: 'transactionType', key: 'transactionType', render: (value: string) => <Tag>{t(`transactions.${value}`)}</Tag> },
    {
      title: t('movementTable.qty'),
      dataIndex: 'quantityChange',
      key: 'quantityChange',
      align: 'right',
      render: (value: number) => <Text strong type={value < 0 ? 'danger' : undefined}>{value > 0 ? `+${formatCurrency(value, 2)}` : formatCurrency(value, 2)}</Text>,
    },
    { title: t('movementTable.balance'), dataIndex: 'balanceAfter', key: 'balanceAfter', align: 'right', render: (value: number) => formatCurrency(value, 2) },
    ...(canViewCost ? [
      { title: t('movementTable.cost'), dataIndex: 'unitPrice', key: 'unitPrice', align: 'right' as const, render: (value: number) => formatVND(value || 0) },
    ] : []),
    { title: t('movementTable.reference'), dataIndex: 'referenceNumber', key: 'referenceNumber', render: (value?: string) => value ? <Text code>{value}</Text> : '-' },
    { title: t('movementTable.quarantine'), dataIndex: 'isQuarantine', key: 'isQuarantine', render: (value: boolean) => value ? <Tag color="orange">{t('yes')}</Tag> : <Tag color="green">{t('no')}</Tag> },
    { title: t('movementTable.note'), dataIndex: 'notes', key: 'notes', render: (value?: string) => <Text type="secondary">{value || '-'}</Text> },
  ];

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('title')}
        icon={<RollbackOutlined />}
        description={t('description')}
        extra={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchReturns(); fetchMovements(); fetchReferenceData(); }}>
              {t('actions.refresh')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canCreate} onClick={() => setModalOpen(true)}>
              {t('actions.newReturn')}
            </Button>
          </Space>
        )}
      />

      <Tabs
        items={[
          {
            key: 'returns',
            label: t('tabs.returns'),
            children: (
              <Card
                variant="borderless"
                title={t('sections.returnWorkflow')}
                extra={(
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder={t('placeholders.searchReturn')}
                    value={returnSearch}
                    onChange={(event) => setReturnSearch(event.target.value)}
                    style={{ width: 300 }}
                  />
                )}
              >
                <Table<ICustomerReturn>
                  rowKey="_id"
                  columns={returnColumns}
                  dataSource={filteredReturns}
                  loading={loadingReturns}
                  expandable={{
                    expandedRowRender: (record) => (
                      <Table<ICustomerReturnItem>
                        rowKey="_id"
                        columns={returnItemColumns}
                        dataSource={record.items || []}
                        pagination={false}
                        size="small"
                      />
                    ),
                  }}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                />
              </Card>
            ),
          },
          {
            key: 'movements',
            label: t('tabs.movements'),
            children: (
              <Card variant="borderless" title={t('sections.lotTrace')}>
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                  <Col xs={24} md={6}>
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder={t('placeholders.lotNumber')}
                      onChange={(event) => setMovementFilters((prev) => ({ ...prev, lotNumber: event.target.value || undefined }))}
                    />
                  </Col>
                  <Col xs={24} md={6}>
                    <Select
                      allowClear
                      showSearch
                      placeholder={t('form.buyer')}
                      optionFilterProp="label"
                      options={buyerOptions}
                      style={{ width: '100%' }}
                      onChange={(value) => setMovementFilters((prev) => ({ ...prev, buyerId: value }))}
                    />
                  </Col>
                  <Col xs={24} md={6}>
                    <Select
                      allowClear
                      showSearch
                      placeholder={t('form.shipment')}
                      optionFilterProp="label"
                      options={shipmentOptions}
                      style={{ width: '100%' }}
                      onChange={(value) => setMovementFilters((prev) => ({ ...prev, shipmentId: value }))}
                    />
                  </Col>
                  <Col xs={24} md={6}>
                    <Select
                      allowClear
                      placeholder={t('placeholders.movementType')}
                      options={transactionOptions}
                      style={{ width: '100%' }}
                      onChange={(value) => setMovementFilters((prev) => ({ ...prev, transactionType: value }))}
                    />
                  </Col>
                </Row>
                <Table<ILotMovement>
                  rowKey="_id"
                  columns={movementColumns}
                  dataSource={movements}
                  loading={loadingMovements}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={t('modal.createTitle')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={createReturn}
        okText={t('actions.create')}
        destroyOnHidden
        width={960}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            reason: 'QUALITY_CLAIM',
            returnDate: dayjs().format('YYYY-MM-DD'),
            items: [{ quantity: 1, quarantine: true }],
          }}
        >
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item name="buyerId" label={t('form.buyer')} rules={[{ required: true, message: t('validation.buyerRequired') }]}>
                <Select showSearch optionFilterProp="label" options={buyerOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="shipmentId" label={t('form.shipment')}>
                <Select allowClear showSearch optionFilterProp="label" options={shipmentOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item name="reason" label={t('form.reason')} rules={[{ required: true }]}>
                <Select options={reasonOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item name="returnDate" label={t('form.returnDate')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="note" label={t('form.headerNote')}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                {fields.map(({ key, name, ...restField }) => (
                  <Card
                    key={key}
                    size="small"
                    title={t('form.lineTitle', { index: name + 1 })}
                    extra={fields.length > 1 ? <Button danger size="small" onClick={() => remove(name)}>{t('actions.remove')}</Button> : null}
                  >
                    <Row gutter={12}>
                      <Col xs={24} md={8}>
                        <Form.Item {...restField} name={[name, 'productId']} label={t('form.product')} rules={[{ required: true }]}>
                          <Select
                            showSearch
                            optionFilterProp="label"
                            options={productOptions}
                            onChange={(value) => handleProductChange(value, name)}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={4}>
                        <Form.Item {...restField} name={[name, 'quantity']} label={t('form.qty')} rules={[{ required: true }]}>
                          <InputNumber min={0.0001} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={3}>
                        <Form.Item {...restField} name={[name, 'unit']} label={t('form.unit')}>
                          <Input />
                        </Form.Item>
                      </Col>
                      {canViewCost && (
                        <Col xs={12} md={4}>
                          <Form.Item {...restField} name={[name, 'unitCost']} label={t('form.unitCost')}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      )}
                      <Col xs={12} md={5}>
                        <Form.Item {...restField} name={[name, 'lotNumber']} label={t('form.lotNumber')}>
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={5}>
                        <Form.Item {...restField} name={[name, 'quarantine']} valuePropName="checked">
                          <Checkbox>{t('form.receiveIntoQuarantine')}</Checkbox>
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={19}>
                        <Form.Item {...restField} name={[name, 'note']} label={t('form.lineNote')}>
                          <Input />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button icon={<PlusOutlined />} onClick={() => add({ quantity: 1, quarantine: true })}>
                  {t('actions.addLine')}
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
    </AdminPageScroll>
  );
};

export default InventoryReturnsPage;
