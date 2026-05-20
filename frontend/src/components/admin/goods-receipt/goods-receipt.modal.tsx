'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { notification } from '@/providers/antd-static';
import {
  BarcodeOutlined,
  ClearOutlined,
  FileProtectOutlined,
  InboxOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { sendRequest, sendRequestFile } from '@/lib/api-client';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { useCurrency } from '@/hooks/useCurrency';
import { getAccessToken } from '@/lib/auth-token';
import { formatDate } from '@/utils/format';

const { Text } = Typography;

type QualityStatus = 'PASS' | 'DAMAGED' | 'WRONG_SPEC' | 'QUARANTINE';

type GoodsReceiptLine = {
  purchaseOrderItem_id?: string;
  productId: string;
  sku?: string;
  vietnameseName?: string;
  orderedQuantity: number;
  previouslyReceived: number;
  remainingQuantity: number;
  quantityReceived: number;
  quantityRejected: number;
  unit?: string;
  lotNumber?: string;
  qualityStatus: QualityStatus;
  rejectionReason?: string;
  lineNote?: string;
};

type GoodsReceiptFormValues = {
  receivedDate: Dayjs;
  deliveryNoteNumber?: string;
  warehouseName?: string;
  warehouseLocation?: string;
  attachmentUrl?: string;
  note?: string;
  items: GoodsReceiptLine[];
};

interface IProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  poId: string | null;
  fetchData: () => void;
}

const draftKeyFor = (poId: string | null) => `goods-receipt-draft-${poId ?? 'unknown'}`;

const GoodsReceiptModal = (props: IProps) => {
  const t = useTranslations('GoodsReceipt');
  const { isOpen, setIsOpen, poId, fetchData } = props;
  const { data: session } = useSession();
  const [form] = Form.useForm<GoodsReceiptFormValues>();
  const { formatNumber, formatMoney } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [poData, setPoData] = useState<any>(null);
  const watchedFormItems = Form.useWatch('items', form);
  const watchedItems = useMemo(() => watchedFormItems ?? [], [watchedFormItems]);

  const currentUser = session?.user as any;
  const receiverName = currentUser?.username || currentUser?.name || 'system';

  const qualityOptions = useMemo(() => ([
    { value: 'PASS', label: t('modal.quality.PASS') },
    { value: 'DAMAGED', label: t('modal.quality.DAMAGED') },
    { value: 'WRONG_SPEC', label: t('modal.quality.WRONG_SPEC') },
    { value: 'QUARANTINE', label: t('modal.quality.QUARANTINE') },
  ]), [t]);

  const summary = useMemo(() => {
    const totalLines = watchedItems.length;
    const orderedQty = watchedItems.reduce((sum, item) => sum + Number(item?.orderedQuantity || 0), 0);
    const previouslyReceived = watchedItems.reduce((sum, item) => sum + Number(item?.previouslyReceived || 0), 0);
    const remainingQty = watchedItems.reduce((sum, item) => sum + Number(item?.remainingQuantity || 0), 0);
    const receivedNow = watchedItems.reduce((sum, item) => sum + Number(item?.quantityReceived || 0), 0);
    const rejectedQty = watchedItems.reduce((sum, item) => sum + Number(item?.quantityRejected || 0), 0);
    const acceptedQty = Math.max(receivedNow - rejectedQty, 0);
    const finalReceived = previouslyReceived + receivedNow;
    const variance = orderedQty - finalReceived;
    const hasOverReceipt = watchedItems.some(
      (item) => Number(item?.quantityReceived || 0) > Number(item?.remainingQuantity || 0),
    );
    const hasQualityIssue = watchedItems.some(
      (item) => item?.qualityStatus && item.qualityStatus !== 'PASS',
    );

    let status: 'EMPTY' | 'FULL' | 'PARTIAL' | 'OVER' = 'EMPTY';
    if (hasOverReceipt) status = 'OVER';
    else if (finalReceived >= orderedQty && orderedQty > 0) status = 'FULL';
    else if (receivedNow > 0 || previouslyReceived > 0) status = 'PARTIAL';

    return {
      totalLines,
      orderedQty,
      previouslyReceived,
      remainingQty,
      receivedNow,
      rejectedQty,
      acceptedQty,
      variance,
      hasQualityIssue,
      status,
    };
  }, [watchedItems]);

  const statusConfig = {
    EMPTY: { color: 'default', label: t('modal.receiptStatus.EMPTY') },
    FULL: { color: 'green', label: t('modal.receiptStatus.FULL') },
    PARTIAL: { color: 'orange', label: t('modal.receiptStatus.PARTIAL') },
    OVER: { color: 'red', label: t('modal.receiptStatus.OVER') },
  }[summary.status];

  useEffect(() => {
    const fetchPODetail = async () => {
      if (!poId || !isOpen) return;
      setLoading(true);
      try {
        const res = await sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders/${poId}`,
          method: 'GET',
          headers: { Authorization: `Bearer ${getAccessToken(session)}` },
        });

        if (res?.data) {
          setPoData(res.data);
          const items = res.data.items?.map((item: any, index: number) => {
            const orderedQuantity = Number(item.quantity || 0);
            const previouslyReceived = Number(item.receivedQuantity || 0);
            const remainingQuantity = Math.max(orderedQuantity - previouslyReceived, 0);

            return {
              purchaseOrderItem_id: item._id,
              productId: item.productId,
              sku: item.product?.sku,
              vietnameseName: item.product?.vietnameseName,
              orderedQuantity,
              previouslyReceived,
              remainingQuantity,
              quantityReceived: remainingQuantity,
              quantityRejected: 0,
              unit: item.unit,
              lotNumber: `${res.data.poNumber}-${String(index + 1).padStart(2, '0')}`,
              qualityStatus: 'PASS' as QualityStatus,
              rejectionReason: '',
              lineNote: '',
            };
          }) || [];

          const draftRaw = localStorage.getItem(draftKeyFor(poId));
          if (draftRaw) {
            const draft = JSON.parse(draftRaw);
            form.setFieldsValue({
              ...draft,
              receivedDate: draft.receivedDate ? dayjs(draft.receivedDate) : dayjs(),
            });
          } else {
            form.setFieldsValue({
              items,
              receivedDate: dayjs(),
              deliveryNoteNumber: '',
              warehouseName: 'Main Warehouse',
              warehouseLocation: '',
              attachmentUrl: '',
              note: '',
            });
          }
        }
      } catch {
        notification.error({ title: t('notifications.fetchPODetailError') });
      } finally {
        setLoading(false);
      }
    };

    fetchPODetail();
  }, [isOpen, poId, session, form, t]);

  const updateAllItems = (mapper: (item: GoodsReceiptLine) => GoodsReceiptLine) => {
    const items = form.getFieldValue('items') || [];
    form.setFieldsValue({ items: items.map(mapper) });
  };

  const handleFillRemaining = () => {
    updateAllItems((item) => ({
      ...item,
      quantityReceived: Number(item.remainingQuantity || 0),
      quantityRejected: 0,
      qualityStatus: 'PASS',
    }));
  };

  const handleClearQuantities = () => {
    updateAllItems((item) => ({
      ...item,
      quantityReceived: 0,
      quantityRejected: 0,
    }));
  };

  const handleSaveDraft = () => {
    if (!poId) return;
    const values = form.getFieldsValue(true);
    localStorage.setItem(draftKeyFor(poId), JSON.stringify({
      ...values,
      receivedDate: values.receivedDate?.toISOString?.(),
    }));
    notification.success({ title: t('modal.actions.draftSaved') });
  };

  const handleUploadAttachment = async (options: any) => {
    const { file, onSuccess, onError } = options;
    const accessToken = getAccessToken(session);

    if (!accessToken) {
      const error = new Error(t('notifications.systemErrorDesc'));
      onError?.(error);
      notification.error({ title: t('notifications.systemError'), description: t('notifications.systemErrorDesc') });
      return;
    }

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file as File);

      const res = await sendRequestFile<IBackendRes<{
        fileName: string;
        originalName: string;
        mimeType: string;
        size: number;
        url: string;
      }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/files/upload`,
        method: 'POST',
        queryParams: { folder: 'goods-receipts' },
        body: formData,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res?.data?.url) {
        throw new Error(res?.message || t('modal.form.uploadFailed'));
      }

      form.setFieldValue('attachmentUrl', res.data.url);
      notification.success({
        title: t('modal.form.uploadSuccess'),
        description: res.data.originalName || res.data.fileName,
      });
      onSuccess?.(res.data);
    } catch (error) {
      onError?.(error);
      notification.error({
        title: t('modal.form.uploadFailed'),
        description: error instanceof Error ? error.message : t('notifications.systemErrorDesc'),
      });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const buildRejectionReason = (item: GoodsReceiptLine) => {
    return [
      item.qualityStatus && item.qualityStatus !== 'PASS' ? t(`modal.quality.${item.qualityStatus}`) : '',
      item.rejectionReason,
      item.lineNote,
    ].filter(Boolean).join(' | ');
  };

  const onFinish = async (values: GoodsReceiptFormValues) => {
    setLoading(true);
    try {
      if (!values.items || values.items.length === 0) {
        notification.warning({
          title: t('notifications.noItemsWarning'),
          description: t('notifications.noItemsWarningDesc'),
        });
        return;
      }

      const payload = {
        purchaseOrderId: poId,
        receivedDate: values.receivedDate.format('YYYY-MM-DD'),
        deliveryNoteNumber: values.deliveryNoteNumber,
        warehouseName: values.warehouseName,
        warehouseLocation: values.warehouseLocation,
        attachmentUrl: values.attachmentUrl,
        note: values.note,
        items: values.items.map((item) => ({
          purchaseOrderItem_id: item.purchaseOrderItem_id,
          productId: item.productId,
          quantityReceived: Number(item.quantityReceived || 0),
          quantityOrdered: Number(item.orderedQuantity || 0),
          quantityRejected: Number(item.quantityRejected || 0),
          rejectionReason: buildRejectionReason(item),
          lotNumber: item.lotNumber,
          qualityStatus: item.qualityStatus || 'PASS',
          lineNote: item.lineNote,
          unit: item.unit,
        })),
      };

      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/goods-receipts`,
        method: 'POST',
        body: payload,
        headers: { Authorization: `Bearer ${getAccessToken(session)}` },
      });

      if (res?.data) {
        notification.success({
          title: t('notifications.createSuccess'),
          description: t('notifications.grNumber', { grNumber: res.data.grNumber || res.data.grnNumber }),
        });
        if (poId) localStorage.removeItem(draftKeyFor(poId));
        setIsOpen(false);
        form.resetFields();
        fetchData();
      } else {
        notification.error({
          title: t('notifications.businessError'),
          description: res?.message || t('notifications.businessErrorDesc'),
        });
      }
    } catch {
      notification.error({
        title: t('notifications.systemError'),
        description: t('notifications.systemErrorDesc'),
      });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t('modal.form.product'),
      key: 'product',
      width: 220,
      fixed: 'left' as const,
      render: (_: any, { name }: any) => {
        const item = form.getFieldValue(['items', name]);
        return (
          <div style={{ padding: '4px 0' }}>
            <Form.Item name={[name, 'productId']} hidden><Input /></Form.Item>
            <Form.Item name={[name, 'unit']} hidden><Input /></Form.Item>
            <Form.Item name={[name, 'orderedQuantity']} hidden><Input /></Form.Item>
            <Form.Item name={[name, 'previouslyReceived']} hidden><Input /></Form.Item>
            <Form.Item name={[name, 'remainingQuantity']} hidden><Input /></Form.Item>
            <Text strong>{item?.vietnameseName}</Text>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>SKU: {item?.sku}</div>
          </div>
        );
      },
    },
    {
      title: t('modal.form.orderedQty'),
      key: 'orderedQuantity',
      width: 105,
      align: 'right' as const,
      render: (_: any, { name }: any) => {
        const item = form.getFieldValue(['items', name]);
        return <Text strong>{formatNumber(item?.orderedQuantity || 0)}</Text>;
      },
    },
    {
      title: t('modal.form.previouslyReceived'),
      key: 'previouslyReceived',
      width: 105,
      align: 'right' as const,
      render: (_: any, { name }: any) => {
        const item = form.getFieldValue(['items', name]);
        return <Text type="secondary">{formatNumber(item?.previouslyReceived || 0)}</Text>;
      },
    },
    {
      title: t('modal.form.remainingQty'),
      key: 'remainingQuantity',
      width: 105,
      align: 'right' as const,
      render: (_: any, { name }: any) => {
        const item = form.getFieldValue(['items', name]);
        return <Tag color={Number(item?.remainingQuantity || 0) > 0 ? 'blue' : 'green'}>{formatNumber(item?.remainingQuantity || 0)}</Tag>;
      },
    },
    {
      title: t('modal.form.receivedQty'),
      key: 'quantityReceived',
      width: 145,
      render: (_: any, { name, key: fieldKey, ...restField }: any) => (
        <Form.Item
          key={fieldKey}
          {...restField}
          name={[name, 'quantityReceived']}
          rules={[
            { required: true, message: t('modal.form.qtyRequired') },
            {
              validator: (_: any, value: any) => {
                const num = Number(value);
                if (Number.isNaN(num)) return Promise.reject(new Error(t('modal.form.qtyNumberError')));
                if (!Number.isInteger(num)) return Promise.reject(new Error(t('modal.form.qtyIntegerError')));
                const item = form.getFieldValue(['items', name]);
                if (num > Number(item?.remainingQuantity || 0)) {
                  return Promise.reject(new Error(t('modal.form.qtyRemainingError')));
                }
                return Promise.resolve();
              },
            },
          ]}
          style={{ marginBottom: 0 }}
        >
          <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder={t('modal.form.qtyPlaceholder')} />
        </Form.Item>
      ),
    },
    {
      title: t('modal.form.rejectedQty'),
      key: 'quantityRejected',
      width: 125,
      render: (_: any, { name, key: fieldKey, ...restField }: any) => (
        <Form.Item
          key={fieldKey}
          {...restField}
          name={[name, 'quantityRejected']}
          rules={[
            {
              validator: (_: any, value: any) => {
                const rejected = Number(value || 0);
                const received = Number(form.getFieldValue(['items', name, 'quantityReceived']) || 0);
                if (rejected > received) {
                  return Promise.reject(new Error(t('modal.form.rejectedMaxError')));
                }
                return Promise.resolve();
              },
            },
          ]}
          style={{ marginBottom: 0 }}
        >
          <InputNumber min={0} precision={0} style={{ width: '100%' }} />
        </Form.Item>
      ),
    },
    {
      title: t('modal.form.qualityStatus'),
      key: 'qualityStatus',
      width: 160,
      render: (_: any, { name, key: fieldKey, ...restField }: any) => (
        <Form.Item key={fieldKey} {...restField} name={[name, 'qualityStatus']} style={{ marginBottom: 0 }}>
          <Select options={qualityOptions} />
        </Form.Item>
      ),
    },
    {
      title: t('modal.form.lotNumber'),
      key: 'lotNumber',
      width: 170,
      render: (_: any, { name, key: fieldKey, ...restField }: any) => (
        <Form.Item key={fieldKey} {...restField} name={[name, 'lotNumber']} style={{ marginBottom: 0 }}>
          <Input placeholder={t('modal.form.lotPlaceholder')} />
        </Form.Item>
      ),
    },
    {
      title: t('modal.form.lineNote'),
      key: 'lineNote',
      width: 190,
      render: (_: any, { name, key: fieldKey, ...restField }: any) => (
        <Space.Compact orientation="vertical" style={{ width: '100%' }}>
          <Form.Item key={`${fieldKey}-rejection`} {...restField} name={[name, 'rejectionReason']} style={{ marginBottom: 4 }}>
            <Input placeholder={t('modal.form.rejectionReasonPlaceholder')} />
          </Form.Item>
          <Form.Item key={`${fieldKey}-note`} {...restField} name={[name, 'lineNote']} style={{ marginBottom: 0 }}>
            <Input placeholder={t('modal.form.lineNotePlaceholder')} />
          </Form.Item>
        </Space.Compact>
      ),
    },
    {
      title: t('modal.form.unit'),
      key: 'unitDisplay',
      width: 80,
      align: 'center' as const,
      render: (_: any, { name }: any) => {
        const item = form.getFieldValue(['items', name]);
        return <Tag>{item?.unit}</Tag>;
      },
    },
  ];

  return (
    <Modal
      title={
        <Space size="middle">
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #08979c 0%, #00474f 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <BarcodeOutlined style={{ color: '#fff', fontSize: 18 }} />
          </div>
          <div>
            <Text strong style={{ fontSize: 16 }}>
              {t('modal.titleCreate', { poNumber: poData?.poNumber ?? '...' })}
            </Text>
            <div><Text type="secondary" style={{ fontSize: 12 }}>{t('modal.subtitle')}</Text></div>
          </div>
        </Space>
      }
      open={isOpen}
      onCancel={handleClose}
      width={1280}
      destroyOnHidden
      mask={{ closable: false }}
      style={{ top: 24 }}
      footer={[
        <Button key="fill" icon={<ThunderboltOutlined />} onClick={handleFillRemaining}>
          {t('modal.actions.fillRemaining')}
        </Button>,
        <Button key="clear" icon={<ClearOutlined />} onClick={handleClearQuantities}>
          {t('modal.actions.clearQty')}
        </Button>,
        <Button key="draft" icon={<SaveOutlined />} onClick={handleSaveDraft}>
          {t('modal.actions.saveDraft')}
        </Button>,
        <Button key="cancel" onClick={handleClose}>
          {t('modal.cancelText')}
        </Button>,
        <Button key="submit" type="primary" icon={<InboxOutlined />} loading={loading} onClick={() => form.submit()}>
          {t('modal.okText')}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark="optional">
        <Card size="small" style={{ marginBottom: 16, borderRadius: 10 }}>
          <Descriptions size="small" column={{ xs: 1, md: 2, lg: 4 }}>
            <Descriptions.Item label={t('modal.poOverview.poNumber')}>
              <Text strong>{poData?.poNumber || '-'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('modal.poOverview.vendor')}>
              {poData?.vendor?.name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('modal.poOverview.orderDate')}>
              {poData?.orderDate ? formatDate(poData.orderDate) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('modal.poOverview.expectedDelivery')}>
              {poData?.expectedDeliveryDate ? formatDate(poData.expectedDeliveryDate) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('modal.poOverview.totalAmount')}>
              {formatMoney(Number(poData?.totalAmount || 0), poData?.currency)}
            </Descriptions.Item>
            <Descriptions.Item label={t('modal.poOverview.receiptStatus')}>
              <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6} lg={4}>
            <Card size="small"><Statistic title={t('modal.summary.totalLines')} value={summary.totalLines} /></Card>
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Card size="small"><Statistic title={t('modal.summary.orderedQty')} value={summary.orderedQty} /></Card>
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Card size="small"><Statistic title={t('modal.summary.receivedNow')} value={summary.receivedNow} /></Card>
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Card size="small"><Statistic title={t('modal.summary.acceptedQty')} value={summary.acceptedQty} /></Card>
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Card size="small"><Statistic title={t('modal.summary.rejectedQty')} value={summary.rejectedQty} /></Card>
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Card size="small">
              <Statistic
                title={t('modal.summary.variance')}
                value={summary.variance}
                styles={{ content: { color: summary.variance === 0 ? '#52c41a' : summary.variance < 0 ? '#ff4d4f' : '#fa8c16' } }}
              />
            </Card>
          </Col>
        </Row>

        {summary.hasQualityIssue && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title={t('modal.qualityWarning')}
          />
        )}

        <Row gutter={16}>
          <Col xs={24} md={8} lg={4}>
            <Form.Item
              label={t('modal.form.receivedDate')}
              name="receivedDate"
              rules={[{ required: true, message: t('modal.form.receivedDateRequired') }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8} lg={5}>
            <Form.Item label={t('modal.form.deliveryNoteNumber')} name="deliveryNoteNumber">
              <Input prefix={<FileProtectOutlined />} placeholder={t('modal.form.deliveryNotePlaceholder')} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8} lg={5}>
            <Form.Item label={t('modal.form.warehouseName')} name="warehouseName">
              <Input placeholder={t('modal.form.warehousePlaceholder')} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8} lg={5}>
            <Form.Item label={t('modal.form.warehouseLocation')} name="warehouseLocation">
              <Input placeholder={t('modal.form.locationPlaceholder')} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8} lg={5}>
            <Form.Item label={t('modal.form.receivedBy')}>
              <Input value={receiverName} disabled />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} lg={10}>
            <Form.Item label={t('modal.form.attachmentUrl')}>
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="attachmentUrl" noStyle>
                  <Input readOnly placeholder={t('modal.form.attachmentPlaceholder')} />
                </Form.Item>
                <Upload
                  accept="image/*,.pdf"
                  customRequest={handleUploadAttachment}
                  maxCount={1}
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />} loading={uploadingAttachment}>
                    {t('modal.form.uploadAttachment')}
                  </Button>
                </Upload>
              </Space.Compact>
            </Form.Item>
          </Col>
          <Col xs={24} lg={14}>
            <Form.Item label={t('modal.form.note')} name="note">
              <Input placeholder={t('modal.form.notePlaceholder')} />
            </Form.Item>
          </Col>
        </Row>

        <Divider titlePlacement="left" style={{ fontSize: 14, color: '#8c8c8c' }}>
          {t('modal.form.itemsDivider')}
        </Divider>

        <Form.List name="items">
          {(fields) => (
            <Table
              dataSource={fields}
              columns={columns}
              pagination={false}
              size="middle"
              bordered
              rowKey={(field) => `grn-line-${poId ?? 'new'}-${field.key}-${field.name}`}
              scroll={{ x: 1450 }}
              loading={loading}
              style={{ marginBottom: 12 }}
            />
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};

export default GoodsReceiptModal;
