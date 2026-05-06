'use client'

import {
  Button,
  Form,
  Modal,
  Select,
  Input,
  App,
  Typography,
  Tag,
  DatePicker,
} from 'antd';
import { TruckOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';

const { Text } = Typography;

interface IProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  pi: any; // Proforma Invoice data
}

const ShipmentFromPIModal = ({ open, setOpen, pi }: IProps) => {
  const { notification } = App.useApp();
  const { data: session } = useSession();
  const [form] = Form.useForm();
  const tInc = useTranslations('Incoterms');
  const [submitting, setSubmitting] = useState(false);
  const [forwarders, setForwarders] = useState<any[]>([]);

  useEffect(() => {
    const fetchForwarders = async () => {
      const accessToken = session?.access_token;
      if (!accessToken) return;

      const res = await sendRequest<IBackendRes<IModelPaginate<any>>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 100, partnerType: 'LOGISTICS' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        setForwarders(res.data.results ?? []);
      }
    };
    if (open && session) fetchForwarders();
  }, [open, session]);

  useEffect(() => {
    if (open && pi) {
      form.setFieldsValue({
        pol: 'Hai Phong Port, Vietnam',
        pod: pi.customer?.address || '',
      });
    }
  }, [open, pi, form]);

  const handleClose = () => {
    form.resetFields();
    setOpen(false);
  };

  const onFinish = async (values: any) => {
    setSubmitting(true);
    const accessToken = session?.access_token;

    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments`,
      method: 'POST',
      body: {
        proformaInvoiceId: pi?.id,
        salesContractId: pi?.salesContractId,
        logisticsPartnerId: values.logisticsPartnerId,
        bookingNumber: values.bookingNumber,
        pol: values.pol,
        pod: values.pod,
        vesselFlight: values.vesselFlight,
        etd: values.etd ? values.etd.format('YYYY-MM-DD') : undefined,
        eta: values.eta ? values.eta.format('YYYY-MM-DD') : undefined,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    setSubmitting(false);

    if (res?.data) {
      handleClose();
      notification.success({ 
        title: 'Tạo lô hàng thành công',
        description: `Mã Lô Hàng: ${res.data.shipmentNumber}`,
      });
    } else {
      notification.error({ title: 'Có lỗi xảy ra', description: res?.message });
    }
  };

  if (!pi) return null;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TruckOutlined style={{ color: '#096dd9' }} />
          <span>{pi?.salesContractId ? 'XUẤT KHO & LẬP BOOKING' : 'LÊN LÔ HÀNG (SHIPMENT / BOOKING)'}</span>
        </div>
      }
      open={open}
      onOk={() => form.submit()}
      onCancel={handleClose}
      mask={{ closable: false }}
      width={700}
      confirmLoading={submitting}
      okText={pi?.salesContractId ? 'Xác nhận Xuất kho' : 'Lưu Booking'}
      cancelText="Hủy"
      okButtonProps={{ style: { background: '#096dd9', borderColor: '#096dd9' } }}
      destroyOnHidden
    >
      <div style={{
        background: '#e6f7ff',
        border: '1px solid #91d5ff',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 20,
      }}>
        <Text strong style={{ display: 'block', marginBottom: 4 }}>
          📋 {pi?.salesContractId ? 'Số Hợp đồng:' : 'Thông tin PI gốc:'} <span style={{ color: '#096dd9' }}>{pi.piNumber}</span>
        </Text>
        <div style={{ marginTop: 4 }}>
          <Tag color="geekblue">Incoterms: {pi.incoterm ? tInc(pi.incoterm) : '-'}</Tag>
          <Tag color="cyan">Khách: {pi.customer?.name}</Tag>
        </div>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item
            label="Đại lý Vận Tải (Forwarder)"
            name="logisticsPartnerId"
            rules={[{ required: true, message: 'Vui lòng chọn Forwarder!' }]}
          >
            <Select
              placeholder="Chọn Forwarder"
              options={forwarders.map(f => ({ value: f.id, label: f.name }))}
            />
          </Form.Item>
          
          <Form.Item label="Số Booking" name="bookingNumber">
            <Input placeholder="Nhập số Booking từ Hãng Tàu" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label="Cảng Đi (POL)" name="pol">
            <Input placeholder="Vd: Hai Phong, VN" />
          </Form.Item>
          <Form.Item label="Cảng Đến (POD)" name="pod">
            <Input placeholder="Vd: Los Angeles, USA" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label="Tên Tàu / Chuyến (Vessel / Flight)" name="vesselFlight">
            <Input placeholder="Vd: EVER GIVEN v.123E" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label="Ngày Tàu Chạy Dự Kiến (ETD)" name="etd">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item label="Ngày Tàu Đến Dự Kiến (ETA)" name="eta">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

export default ShipmentFromPIModal;
