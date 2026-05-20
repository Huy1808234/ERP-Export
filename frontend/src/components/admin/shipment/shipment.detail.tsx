'use client'

import {
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
  theme,
  App,
} from 'antd';
import { useTranslations } from 'next-intl';
import { ContainerOutlined, DeleteOutlined, PlusOutlined, TruckOutlined, PrinterOutlined, AuditOutlined, DollarOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { getSession } from 'next-auth/react';
import { useTheme } from '@/context/theme.context';

import { sendRequest } from '@/lib/api-client';
import { SHIPMENT_STATUS_CONFIG, SHIPMENT_STATUS_KEYS } from '@/constants/o2c';
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

const ShipmentDetailDrawer = ({ shipmentId, open, onClose, onSuccess }: IProps) => {
  const { notification } = App.useApp();
  const [data, setData] = useState<IShipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [partners, setPartners] = useState<any[]>([]);
  const [containerModalOpen, setContainerModalOpen] = useState(false);
  const [form] = Form.useForm<IContainer>();
  const [costForm] = Form.useForm();
  const [costModalOpen, setCostModalOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();
  
  const tStatus = useTranslations('ShipmentStatus');
  const tDetail = useTranslations('ShipmentDetail');

  const shipmentStatusOptions = useMemo(() => {
    return SHIPMENT_STATUS_KEYS.map(key => ({
      value: key,
      label: tStatus(key)
    }));
  }, [tStatus]);

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
    } catch (error) {
      notification.error({ title: 'Lỗi tải thông tin lô hàng' });
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    if (!open) {
      setData(null);
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
        onSuccess();
      } else {
        notification.error({ title: 'Có lỗi xảy ra', description: res?.message });
      }
    } catch (error) {
      notification.error({ title: 'Lỗi cập nhật trạng thái' });
    }
  }, [shipmentId, onSuccess]);

  const handleSaveContainer = useCallback(async (values: IContainer) => {
    if (!data || !shipmentId) return;

    try {
      const session = await getSession();
      const accessToken = getAccessToken(session);

      if (!accessToken) {
        notification.error({ title: 'Phiên đăng nhập đã hết hạn' });
        return;
      }

      const updatedContainers = [...(data.containers ?? []), values];

      const res = await sendRequest<IBackendRes<IShipment>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${shipmentId}`,
        method: 'PATCH',
        body: { containers: updatedContainers },
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
    } catch (error) {
      notification.error({ title: 'Lỗi khi hạ container' });
    }
  }, [data, shipmentId, fetchDetail, form]);

  const handleDeleteContainer = useCallback(async (containerNumber: string) => {
    if (!data || !shipmentId) return;

    try {
      const session = await getSession();
      const accessToken = getAccessToken(session);

      if (!accessToken) {
        notification.error({ title: 'Phiên đăng nhập đã hết hạn' });
        return;
      }

      const updatedContainers = (data.containers ?? []).filter(
        (container) => container.containerNumber !== containerNumber
      );

      const res = await sendRequest<IBackendRes<IShipment>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${shipmentId}`,
        method: 'PATCH',
        body: { containers: updatedContainers },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({ title: 'Xóa Container thành công' });
        fetchDetail();
      }
    } catch (error) {
      notification.error({ title: 'Lỗi xóa container' });
    }
  }, [data, shipmentId, fetchDetail]);

  const fetchPartners = useCallback(async () => {
    try {
      const session = await getSession();
      const accessToken = getAccessToken(session);
      
      const res = await sendRequest<IBackendRes<any>>({
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

  // TECH LEAD FIX: Only set fields when the modal is actually open to avoid "form not connected" warning
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

  const handleSaveCosts = useCallback(async (values: any) => {
    if (!shipmentId) return;

    try {
      const session = await getSession();
      const accessToken = getAccessToken(session);

      if (!accessToken) {
        notification.error({ title: 'Phiên đăng nhập đã hết hạn' });
        return;
      }

      const res = await sendRequest<IBackendRes<IShipment>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${shipmentId}`,
        method: 'PATCH',
        body: values,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({ title: 'Cập nhật chi phí thành công' });
        setCostModalOpen(false);
        fetchDetail();
      } else {
        notification.error({ title: 'Có lỗi xảy ra', description: res?.message });
      }
    } catch (error) {
      notification.error({ title: 'Lỗi cập nhật chi phí' });
    }
  }, [shipmentId, fetchDetail]);

  const columns = useMemo(() => [
    { title: 'Số Container', dataIndex: 'containerNumber', key: 'containerNumber', render: (value: string) => <Text strong>{value}</Text> },
    { title: 'Số Chì (Seal)', dataIndex: 'sealNumber', key: 'sealNumber' },
    { title: 'Loại Cont', dataIndex: 'containerType', key: 'containerType', render: (value: string) => <Tag>{value}</Tag> },
    { title: 'Ghi chú', dataIndex: 'notes', key: 'notes' },
    {
      title: 'Hành động',
      key: 'action',
      render: (_value: unknown, record: IContainer) => (
        <Popconfirm title="Xóa container này?" onConfirm={() => handleDeleteContainer(record.containerNumber)}>
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
      }}
      styles={{ 
        wrapper: { width: 800 },
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
              rowKey="containerNumber"
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
                            defaultValue={data.documentChecklist?.[doc.key] || 'PENDING'}
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

                               const newChecklist = { ...(data.documentChecklist || {}), [doc.key]: val };
                               const res = await sendRequest<IBackendRes<IShipment>>({
                                 url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${shipmentId}`,
                                 method: 'PATCH',
                                 body: { documentChecklist: newChecklist },
                                 headers: { Authorization: `Bearer ${accessToken}` },
                               });

                               if (res?.data) {
                                 notification.success({ title: `Cập nhật ${doc.label}`, description: 'Đã lưu trạng thái chứng từ' });
                                 setData(prev => (prev ? { ...prev, documentChecklist: newChecklist } : prev));
                               }
                             } catch (error) {
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
      >
        <Form form={form} layout="vertical" onFinish={handleSaveContainer}>
          <Form.Item name="containerNumber" label="Số Container" rules={[{ required: true, message: 'Nhập số Container' }]}>
            <Input placeholder="Vd: TCNU1234567" />
          </Form.Item>
          <Form.Item name="sealNumber" label="Số Chì (Seal Number)">
            <Input placeholder="Vd: 98765432" />
          </Form.Item>
          <Form.Item name="containerType" label="Loại Container" rules={[{ required: true }]} initialValue="20DC">
            <Select
              options={[
                { value: '20DC', label: tDetail('contTypes.20DC') },
                { value: '40DC', label: tDetail('contTypes.40DC') },
                { value: '40HC', label: tDetail('contTypes.40HC') },
                { value: 'LCL', label: tDetail('contTypes.LCL') },
              ]}
            />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
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
