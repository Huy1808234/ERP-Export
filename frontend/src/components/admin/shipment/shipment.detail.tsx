'use client'

import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Divider,
  Row,
  Col,
  Card,
  App,
} from 'antd';
import { useTranslations } from 'next-intl';
import { ContainerOutlined, DeleteOutlined, PlusOutlined, TruckOutlined, PrinterOutlined, AuditOutlined, DollarOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { getSession } from 'next-auth/react';
import { useTheme } from '@/context/theme.context';

import { sendRequest } from '@/lib/api-client';
import { SHIPMENT_STATUS_CONFIG, SHIPMENT_STATUS_KEYS, SHIPMENT_STATUS_TRANSITIONS } from '@/constants/o2c';
import type { IContainer, IShipment, ShipmentStatus } from '@/types/o2c';
import { formatDate } from '@/utils/format';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

interface IProps {
  shipmentId: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PartnerOption {
  _id: string;
  name: string;
  partnerType: 'CUSTOMER' | 'SUPPLIER' | 'LOGISTICS' | string;
}

interface ShipmentCostFormValues {
  logisticsPartnerId?: string;
  freightCost?: number;
  insuranceCost?: number;
  localChargesVnd?: number;
  truckingCostVnd?: number;
  customsFeeVnd?: number;
}

interface ShipmentContainerFormValues {
  containerNumber?: string;
  sealNumber?: string;
  type: string;
  weightKg?: number;
  cbm?: number;
}

type ShipmentDocumentStatus = 'PENDING' | 'DONE' | 'NA';

interface ShipmentDocumentRecord {
  _id: string;
  documentType: string;
  documentNumber?: string | null;
  issueDate?: string | null;
  fileUrl?: string | null;
  status: ShipmentDocumentStatus;
}

interface ShipmentAuditTrailEntry {
  action: string;
  actor: string;
  at: string;
  reason?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
}

const ShipmentDetailDrawer = ({ shipmentId, open, onClose, onSuccess }: IProps) => {
  const { notification } = App.useApp();
  const [data, setData] = useState<IShipment | null>(null);
  const [documents, setDocuments] = useState<ShipmentDocumentRecord[]>([]);
  const [auditTrail, setAuditTrail] = useState<ShipmentAuditTrailEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [containerModalOpen, setContainerModalOpen] = useState(false);
  const [form] = Form.useForm<ShipmentContainerFormValues>();
  const [costForm] = Form.useForm<ShipmentCostFormValues>();
  const [costModalOpen, setCostModalOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();
  
  const tStatus = useTranslations('ShipmentStatus');
  const tDetail = useTranslations('ShipmentDetail');

  const shipmentStatusOptions = useMemo(() => {
    if (!data?.status) return [];
    const allowedTransitions = SHIPMENT_STATUS_TRANSITIONS[data.status] || [];
    return SHIPMENT_STATUS_KEYS.map(key => ({
      value: key,
      label: tStatus(key),
      disabled:
        (key !== data.status && !allowedTransitions.includes(key)) ||
        (key === 'LOADING' && !data.isStockIssued),
    }));
  }, [tStatus, data?.status, data?.isStockIssued]);

  const readinessWarnings = useMemo(() => {
    if (!data || data.status !== 'LOADING') return [];

    const warnings: string[] = [];
    if (!data.isStockIssued) warnings.push('chưa xuất kho');
    if (!data.logisticsPartnerId) warnings.push('chưa chọn forwarder');
    if (!data.bookingNumber) warnings.push('chưa có booking');
    if (!data.pol) warnings.push('thiếu POL');
    if (!data.pod) warnings.push('thiếu POD');
    if (!data.etd) warnings.push('thiếu ETD');
    if (!data.vesselName) warnings.push('thiếu tàu/chuyến');
    if (!data.containers?.length) warnings.push('chưa có container/loading unit');

    const incompleteContainers = (data.containers || []).filter(
      (container) => container.type !== 'LCL' && (!container.containerNumber || !container.sealNumber),
    );
    if (incompleteContainers.length > 0) warnings.push('container FCL thiếu số cont hoặc seal');

    return warnings;
  }, [data]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Lohang_${data?.shipmentNumber || 'PDF'}`,
  });

  const fetchDetail = useCallback(async () => {
    if (!shipmentId) return;

    setLoading(true);
    try {
      const session = await getSession();
      const accessToken = getAccessToken(session);

      if (!accessToken) {
        notification.error({ title: 'Phiên đăng nhập đã hết hạn' });
        return;
      }

      const res = await sendRequest<IBackendRes<IShipment>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${shipmentId}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) setData(res.data);

      const [documentsRes, auditRes] = await Promise.all([
        sendRequest<IBackendRes<ShipmentDocumentRecord[]>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${shipmentId}/documents`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<ShipmentAuditTrailEntry[]>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${shipmentId}/audit-trail`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      setDocuments(documentsRes?.data ?? []);
      setAuditTrail(auditRes?.data ?? []);
    } catch {
      notification.error({ title: 'Lỗi tải thông tin lô hàng' });
    } finally {
      setLoading(false);
    }
  }, [notification, shipmentId]);

  useEffect(() => {
    if (!open) {
      setData(null);
      setDocuments([]);
      setAuditTrail([]);
      return;
    }

    fetchDetail();
  }, [open, fetchDetail]);

  const handleUpdateStatus = useCallback(async (status: ShipmentStatus) => {
    if (!shipmentId) return;

    try {
      const session = await getSession();
      const accessToken = getAccessToken(session);

      if (!accessToken) {
        notification.error({ title: 'Phiên đăng nhập đã hết hạn' });
        return;
      }

      const res = await sendRequest<IBackendRes<IShipment>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${shipmentId}/status`,
        method: 'PATCH',
        body: { status },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({ title: 'Cập nhật trạng thái thành công' });
        setData((prev) => (prev ? { ...prev, status } : prev));
        fetchDetail();
        onSuccess();
      } else {
        notification.error({ title: 'Có lỗi xảy ra', description: res?.message });
      }
    } catch {
      notification.error({ title: 'Lỗi cập nhật trạng thái' });
    }
  }, [shipmentId, onSuccess, fetchDetail, notification]);

  const handleSaveContainer = useCallback(async (values: ShipmentContainerFormValues) => {
    if (!shipmentId) return;

    try {
      const session = await getSession();
      const accessToken = getAccessToken(session);

      if (!accessToken) {
        notification.error({ title: 'Phiên đăng nhập đã hết hạn' });
        return;
      }

      const res = await sendRequest<IBackendRes<IContainer>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${shipmentId}/containers`,
        method: 'POST',
        body: {
          containerNumber: values.containerNumber,
          sealNumber: values.sealNumber,
          type: values.type,
          weightKg: values.weightKg ?? 0,
          cbm: values.cbm ?? 0,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({ title: 'Thêm Container thành công' });
        setContainerModalOpen(false);
        form.resetFields();
        fetchDetail();
      } else {
        notification.error({ title: 'Có lỗi xảy ra', description: res?.message });
      }
    } catch {
      notification.error({ title: 'Lỗi khi hạ container' });
    }
  }, [shipmentId, fetchDetail, form, notification]);

  const handleDeleteContainer = useCallback(async (containerId: string) => {
    if (!shipmentId) return;

    try {
      const session = await getSession();
      const accessToken = getAccessToken(session);

      if (!accessToken) {
        notification.error({ title: 'Phiên đăng nhập đã hết hạn' });
        return;
      }

      const res = await sendRequest<IBackendRes<{ deleted: boolean; containerId: string }>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${shipmentId}/containers/${containerId}`,
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({ title: 'Xóa Container thành công' });
        fetchDetail();
      }
    } catch {
      notification.error({ title: 'Lỗi xóa container' });
    }
  }, [shipmentId, fetchDetail, notification]);

  const fetchPartners = useCallback(async () => {
    try {
      const session = await getSession();
      const accessToken = getAccessToken(session);
      
      const res = await sendRequest<IBackendRes<IModelPaginate<PartnerOption>>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners?pageSize=100`,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data?.results) {
        setPartners(res.data.results);
      }
    } catch (error) {
      console.error('Fetch partners error', error);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchPartners();
    }
  }, [open, fetchPartners]);

  useEffect(() => {
    if (costModalOpen && data) {
      costForm.setFieldsValue({
        logisticsPartnerId: data.logisticsPartnerId,
        freightCost: data.freightCost,
        insuranceCost: data.insuranceCost,
        localChargesVnd: data.localChargesVnd,
        truckingCostVnd: data.truckingCostVnd,
        customsFeeVnd: data.customsFeeVnd,
      });
    }
  }, [costModalOpen, data, costForm]);

  const handleSaveCosts = useCallback(async (values: ShipmentCostFormValues) => {
    if (!shipmentId) return;

    try {
      const session = await getSession();
      const accessToken = getAccessToken(session);

      if (!accessToken) {
        notification.error({ title: 'Phiên đăng nhập đã hết hạn' });
        return;
      }

      const payload: Record<string, unknown> = { ...values };
      const res = await sendRequest<IBackendRes<IShipment>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${shipmentId}`,
        method: 'PATCH',
        body: payload,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({ title: 'Cập nhật chi phí thành công' });
        setCostModalOpen(false);
        fetchDetail();
      } else {
        notification.error({ title: 'Có lỗi xảy ra', description: res?.message });
      }
    } catch {
      notification.error({ title: 'Lỗi cập nhật chi phí' });
    }
  }, [shipmentId, fetchDetail, notification]);

  const columns = useMemo(() => [
    { title: 'Số Container', dataIndex: 'containerNumber', key: 'containerNumber', render: (value?: string | null) => <Text strong>{value || '-'}</Text> },
    { title: 'Số Chì (Seal)', dataIndex: 'sealNumber', key: 'sealNumber', render: (value?: string | null) => value || '-' },
    { title: 'Loại Cont', dataIndex: 'type', key: 'type', render: (value: string) => <Tag>{value}</Tag> },
    { title: 'Gross Weight', dataIndex: 'weightKg', key: 'weightKg', align: 'right' as const, render: (value?: number) => `${(value || 0).toLocaleString()} kg` },
    { title: 'CBM', dataIndex: 'cbm', key: 'cbm', align: 'right' as const, render: (value?: number) => (value || 0).toLocaleString() },
    {
      title: 'Hành động',
      key: 'action',
      render: (_value: unknown, record: IContainer) => (
        <Popconfirm title="Xóa container này?" onConfirm={() => handleDeleteContainer(record._id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ], [handleDeleteContainer]);

  if (!open && !data) return null;

  return (
    <Drawer
      title={
        <Space>
          <TruckOutlined style={{ color: '#096dd9' }} />
          <span>Chi tiết Lô hàng: {data?.shipmentNumber}</span>
          {data?.status && (
            <Tag color={SHIPMENT_STATUS_CONFIG[data.status].color}>
              {tStatus(data.status)}
            </Tag>
          )}
        </Space>
      }
      open={open}
      onClose={() => {
        onClose();
        setData(null);
        setDocuments([]);
        setAuditTrail([]);
      }}
      size={800}
      styles={{ 
        body: { padding: '24px' } 
      }}
      destroyOnHidden
      extra={
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => handlePrint()} disabled={loading}>
          Xuất PDF / In
        </Button>
      }
    >
      <Spin spinning={loading} description="Đang tải dữ liệu...">
        {data && (
          <div ref={printRef} style={{ padding: '12px' }}>
            <h2 style={{ textAlign: 'center', marginBottom: 24, display: 'none' }} className="print-title">
              CHI TIẾT LÔ HÀNG (SHIPMENT)
            </h2>
            <style>{`
              @media print {
                .print-title { display: block !important; }
                .no-print { display: none !important; }
              }
            `}</style>
            <div className="no-print" style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Select
                value={data.status}
                style={{ width: 220 }}
                onChange={handleUpdateStatus}
                options={shipmentStatusOptions}
              />
            </div>

            {readinessWarnings.length > 0 ? (
              <Alert
                className="no-print"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title="Chưa đủ điều kiện lên tàu"
                description={readinessWarnings.join(', ')}
              />
            ) : null}

            <Descriptions title="Thông tin vận chuyển" bordered column={2} styles={{ label: { width: '150px' } }}>
              <Descriptions.Item label="Từ PI">{data.salesContract?.proformaInvoice?.piNumber || data.proformaInvoice?.piNumber || '-'}</Descriptions.Item>
              <Descriptions.Item label="Đơn vị vận tải (Forwarder)">
                <Text strong style={{ color: '#1677ff' }}>{data.logisticsPartner?.name || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Số Booking">{data.bookingNumber || '-'}</Descriptions.Item>
              <Descriptions.Item label="Tên Tàu / Chuyến">{data.vesselName || '-'}</Descriptions.Item>
              <Descriptions.Item label="Cảng đi (POL)">{data.pol || '-'}</Descriptions.Item>
              <Descriptions.Item label="Cảng đến (POD)">{data.pod || '-'}</Descriptions.Item>
              <Descriptions.Item label="Ngày tàu chạy (ETD)">{formatDate(data.etd)}</Descriptions.Item>
              <Descriptions.Item label="Ngày cập cảng (ETA)">{formatDate(data.eta)}</Descriptions.Item>
              
              <Descriptions.Item label="Cước biển (USD)">
                <Text type="danger" strong>{(data.freightCost || 0).toLocaleString()} {data.freightCurrency || 'USD'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Bảo hiểm (USD)">
                <Text type="danger" strong>{(data.insuranceCost || 0).toLocaleString()} {data.insuranceCurrency || 'USD'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Phí Local (VND)">
                <Text type="warning" strong>{(data.localChargesVnd || 0).toLocaleString()} ₫</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Phí Trucking (VND)">
                <Text type="warning" strong>{(data.truckingCostVnd || 0).toLocaleString()} ₫</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Phí Hải quan (VND)">
                <Text type="warning" strong>{(data.customsFeeVnd || 0).toLocaleString()} ₫</Text>
              </Descriptions.Item>
            </Descriptions>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text strong style={{ fontSize: 16 }}><ContainerOutlined /> Danh sách Container</Text>
              <Space>
                <Button 
                  icon={<DollarOutlined />} 
                  onClick={() => {
                    costForm.setFieldsValue({
                      logisticsPartnerId: data.logisticsPartnerId,
                      freightCost: data.freightCost,
                      insuranceCost: data.insuranceCost,
                      customsFeeVnd: data.customsFeeVnd,
                      truckingCostVnd: data.truckingCostVnd,
                      localChargesVnd: data.localChargesVnd,
                    });
                    setCostModalOpen(true);
                  }}
                >
                  Cập nhật Chi phí
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setContainerModalOpen(true)}>
                  Thêm Container
                </Button>
              </Space>
            </div>

            <Table<IContainer>
              dataSource={data.containers ?? []}
              rowKey="_id"
              pagination={false}
              bordered
              columns={columns}
              locale={{ emptyText: 'Chưa có dữ liệu Container hạ bãi' }}
              style={{ marginBottom: 32 }}
            />

            <Divider titlePlacement="left"><Text strong><AuditOutlined /> KIỂM SOÁT CHỨNG TỪ (DOCS CHECKLIST)</Text></Divider>
            <div style={{ background: isDark ? '#1d1d1d' : '#f0f2f5', padding: '16px', borderRadius: '12px' }}>
               <Row gutter={[16, 16]}>
                 {[
                  { key: 'SALES_CONTRACT', label: tDetail('docs.SALES_CONTRACT') },
                  { key: 'COMMERCIAL_INVOICE', label: tDetail('docs.COMMERCIAL_INVOICE') },
                  { key: 'PACKING_LIST', label: tDetail('docs.PACKING_LIST') },
                  { key: 'BILL_OF_LADING', label: tDetail('docs.BILL_OF_LADING') },
                  { key: 'CERTIFICATE_OF_ORIGIN', label: tDetail('docs.CERTIFICATE_OF_ORIGIN') },
                  { key: 'PHYTOSANITARY', label: tDetail('docs.PHYTOSANITARY') },
                ].map(doc => (
                   <Col span={12} key={doc.key}>
                     <Card size="small" variant="borderless" style={{ borderRadius: 8 }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <Text>{doc.label}</Text>
                          <Select 
                            size="small"
                            value={data.documentChecklist?.[doc.key] || 'PENDING'}
                            style={{ width: 120 }}
                            options={[
                              { value: 'PENDING', label: tDetail('docStatus.PENDING') },
                              { value: 'DONE', label: tDetail('docStatus.DONE') },
                              { value: 'NA', label: tDetail('docStatus.NA') },
                            ]}
                           onChange={async (val) => {
                             if (!data || !shipmentId) return;
                             try {
                               const session = await getSession();
                               const accessToken = getAccessToken(session);
                               if (!accessToken) return;

                               const newChecklist = { ...(data.documentChecklist || {}), [doc.key]: val as ShipmentDocumentStatus };
                               const res = await sendRequest<IBackendRes<ShipmentDocumentRecord>>({
                                 url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${shipmentId}/documents`,
                                 method: 'POST',
                                 body: {
                                   documentType: doc.key,
                                   status: val,
                                 },
                                 headers: { Authorization: `Bearer ${accessToken}` },
                               });

                               if (res?.data) {
                                 notification.success({ title: `Cập nhật ${doc.label}`, description: 'Đã lưu trạng thái chứng từ' });
                                 setData(prev => (prev ? { ...prev, documentChecklist: newChecklist } : prev));
                                 setDocuments(prev => {
                                   const remaining = prev.filter(item => item.documentType !== res.data?.documentType);
                                   return res.data ? [...remaining, res.data] : remaining;
                                 });
                               }
                             } catch {
                               notification.error({ title: 'Lỗi cập nhật chứng từ' });
                             }
                           }}
                         />
                       </div>
                     </Card>
                   </Col>
                 ))}
               </Row>
            </div>

            <Divider titlePlacement="left"><Text strong>Chứng từ đã ghi nhận</Text></Divider>
            <Table<ShipmentDocumentRecord>
              dataSource={documents}
              rowKey="_id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Loại chứng từ', dataIndex: 'documentType', key: 'documentType' },
                { title: 'Số chứng từ', dataIndex: 'documentNumber', key: 'documentNumber', render: (value?: string | null) => value || '-' },
                { title: 'Ngày phát hành', dataIndex: 'issueDate', key: 'issueDate', render: (value?: string | null) => formatDate(value || undefined) },
                { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (value: ShipmentDocumentStatus) => <Tag color={value === 'DONE' ? 'success' : value === 'NA' ? 'default' : 'warning'}>{value}</Tag> },
              ]}
              locale={{ emptyText: 'Chưa có chứng từ nào được ghi nhận' }}
              style={{ marginBottom: 24 }}
            />

            <Divider titlePlacement="left"><Text strong>Lịch sử thao tác</Text></Divider>
            <Table<ShipmentAuditTrailEntry>
              dataSource={auditTrail}
              rowKey={(record) => `${record.action}-${record.at}`}
              pagination={{ pageSize: 5 }}
              size="small"
              columns={[
                { title: 'Thời gian', dataIndex: 'at', key: 'at', render: (value: string) => formatDate(value) },
                { title: 'Hành động', dataIndex: 'action', key: 'action', render: (value: string) => <Tag color="blue">{value}</Tag> },
                { title: 'Người thao tác', dataIndex: 'actor', key: 'actor' },
                { title: 'Ghi chú', dataIndex: 'reason', key: 'reason', render: (value?: string) => value || '-' },
              ]}
              locale={{ emptyText: 'Chưa có lịch sử thao tác' }}
            />
          </div>
        )}
      </Spin>

      <Modal
        title="Khai báo Container (Hạ Cont)"
        open={containerModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setContainerModalOpen(false)}
        okText="Thêm mới"
        cancelText="Hủy"
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={handleSaveContainer}>
          <Form.Item name="containerNumber" label="Số Container" rules={[{ required: true, message: 'Nhập số Container' }]}>
            <Input placeholder="Vd: TCNU1234567" />
          </Form.Item>
          <Form.Item name="sealNumber" label="Số Chì (Seal Number)">
            <Input placeholder="Vd: 98765432" />
          </Form.Item>
          <Form.Item name="type" label="Loại Container" rules={[{ required: true }]} initialValue="20DC">
            <Select
              options={[
                { value: '20DC', label: tDetail('contTypes.20DC') },
                { value: '40DC', label: tDetail('contTypes.40DC') },
                { value: '40HC', label: tDetail('contTypes.40HC') },
                { value: '20RF', label: '20RF' },
                { value: '40RF', label: '40RF' },
                { value: 'LCL', label: tDetail('contTypes.LCL') },
              ]}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="weightKg" label="Gross Weight (kg)" initialValue={0}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cbm" label="CBM" initialValue={0}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Cập nhật Chi phí Logistics"
        open={costModalOpen}
        onOk={() => costForm.submit()}
        onCancel={() => setCostModalOpen(false)}
        okText="Lưu chi phí"
        cancelText="Hủy"
        destroyOnHidden
        forceRender
      >
        <Form form={costForm} layout="vertical" onFinish={handleSaveCosts}>
          <Form.Item name="logisticsPartnerId" label="Đơn vị vận tải (Forwarder)" rules={[{ required: true, message: 'Vui lòng chọn đơn vị vận tải' }]}>
            <Select
              showSearch
              placeholder="Chọn Forwarder để hạch toán công nợ"
              optionFilterProp="label"
              options={partners
                .filter(p => p.partnerType === 'LOGISTICS' || p.partnerType === 'SUPPLIER')
                .map(p => ({
                  value: p._id,
                  label: p.name,
                }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Cước biển/hàng không (USD)">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="freightCost" noStyle>
                    <InputNumber 
                      style={{ width: '100%' }} 
                      placeholder="0.00"
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                  <div style={{ padding: '4px 11px', background: '#f5f5f5', border: '1px solid #d9d9d9', borderLeft: 0, borderRadius: '0 6px 6px 0' }}>USD</div>
                </Space.Compact>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Phí bảo hiểm (USD)">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="insuranceCost" noStyle>
                    <InputNumber 
                      style={{ width: '100%' }} 
                      placeholder="0.00"
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                  <div style={{ padding: '4px 11px', background: '#f5f5f5', border: '1px solid #d9d9d9', borderLeft: 0, borderRadius: '0 6px 6px 0' }}>USD</div>
                </Space.Compact>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Phụ phí Local (VND)">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="localChargesVnd" noStyle>
                <InputNumber 
                  style={{ width: '100%' }} 
                  placeholder="0"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
              <div style={{ padding: '4px 11px', background: '#f5f5f5', border: '1px solid #d9d9d9', borderLeft: 0, borderRadius: '0 6px 6px 0' }}>₫</div>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="Phí Trucking nội địa (VND)">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="truckingCostVnd" noStyle>
                <InputNumber 
                  style={{ width: '100%' }} 
                  placeholder="0"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
              <div style={{ padding: '4px 11px', background: '#f5f5f5', border: '1px solid #d9d9d9', borderLeft: 0, borderRadius: '0 6px 6px 0' }}>₫</div>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="Phí Hải quan (VND)">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="customsFeeVnd" noStyle>
                <InputNumber 
                  style={{ width: '100%' }} 
                  placeholder="0"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
              <div style={{ padding: '4px 11px', background: '#f5f5f5', border: '1px solid #d9d9d9', borderLeft: 0, borderRadius: '0 6px 6px 0' }}>₫</div>
            </Space.Compact>
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
};

export default ShipmentDetailDrawer;
