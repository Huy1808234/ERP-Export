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
import { sendRequest } from '@/lib/api-client';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { getAccessToken } from '@/lib/auth-token';

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
  const tShipment = useTranslations('Shipment');
  const tInc = useTranslations('Incoterms');
  const [submitting, setSubmitting] = useState(false);
  const [forwarders, setForwarders] = useState<any[]>([]);

  useEffect(() => {
    const fetchForwarders = async () => {
      const accessToken = getAccessToken(session);
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
    const accessToken = getAccessToken(session);

    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments`,
      method: 'POST',
      body: {
        proformaInvoiceId: pi?._id,
        salesContractId: pi?.salesContractId,
        logisticsPartnerId: values.logisticsPartnerId,
        bookingNumber: values.bookingNumber,
        pol: values.pol,
        pod: values.pod,
        vesselName: values.vesselFlight,
        etd: values.etd ? values.etd.format('YYYY-MM-DD') : undefined,
        eta: values.eta ? values.eta.format('YYYY-MM-DD') : undefined,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    setSubmitting(false);

    if (res?.data) {
      handleClose();
      notification.success({
        title: tShipment('createFromPI.notifications.success'),
        description: tShipment('createFromPI.notifications.shipmentNumber', { number: res.data.shipmentNumber }),
      });
    } else {
      notification.error({ title: tShipment('createFromPI.notifications.error'), description: res?.message });
    }
  };

  if (!pi) return null;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TruckOutlined style={{ color: '#096dd9' }} />
          <span>{pi?.salesContractId ? tShipment('createFromPI.exportTitle') : tShipment('createFromPI.modalTitle')}</span>
        </div>
      }
      open={open}
      onOk={() => form.submit()}
      onCancel={handleClose}
      mask={{ closable: false }}
      width={700}
      confirmLoading={submitting}
      okText={pi?.salesContractId ? tShipment('createFromPI.okRelease') : tShipment('createFromPI.okSave')}
      cancelText={tShipment('createFromPI.cancel')}
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
          📋 {pi?.salesContractId ? tShipment('createFromPI.contractLabel') : tShipment('createFromPI.piInfoLabel')} <span style={{ color: '#096dd9' }}>{pi.piNumber}</span>
        </Text>
        <div style={{ marginTop: 4 }}>
          <Tag color="geekblue">Incoterms: {pi.incoterm ? tInc(pi.incoterm) : '-'}</Tag>
          <Tag color="cyan">{tShipment('createFromPI.customerLabel')} {pi.customer?.name}</Tag>
        </div>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item
            label={tShipment('createFromPI.form.forwarder')}
            name="logisticsPartnerId"
            rules={[{ required: true, message: tShipment('createFromPI.form.forwarderRequired') }]}
          >
            <Select
              placeholder={tShipment('createFromPI.form.forwarderPlaceholder')}
              options={forwarders.map(f => ({ value: f._id, label: f.name }))}
            />
          </Form.Item>

          <Form.Item label={tShipment('createFromPI.form.bookingNumber')} name="bookingNumber">
            <Input placeholder={tShipment('createFromPI.form.bookingPlaceholder')} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label={tShipment('createFromPI.form.pol')} name="pol">
            <Input placeholder={tShipment('createFromPI.form.polPlaceholder')} />
          </Form.Item>
          <Form.Item label={tShipment('createFromPI.form.pod')} name="pod">
            <Input placeholder={tShipment('createFromPI.form.podPlaceholder')} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label={tShipment('createFromPI.form.vessel')} name="vesselFlight">
            <Input placeholder={tShipment('createFromPI.form.vesselPlaceholder')} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item label={tShipment('createFromPI.form.etd')} name="etd">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item label={tShipment('createFromPI.form.eta')} name="eta">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

export default ShipmentFromPIModal;
