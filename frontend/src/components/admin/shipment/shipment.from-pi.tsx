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
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import { useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';
import PortSelect from '@/components/admin/ports/PortSelect';
import { normalizeCountryCode } from '@/constants/geo';
import type { Dayjs } from 'dayjs';

const { Text } = Typography;

interface ShipmentSourcePI {
  _id?: string;
  piNumber: string;
  incoterm?: string;
  portOfLoading?: string;
  portOfLoading_port_id?: string | null;
  portOfDischarge?: string;
  portOfDischarge_port_id?: string | null;
  salesContractId?: string;
  salesContract?: {
    pol?: string;
    pol_port_id?: string | null;
    pod?: string;
    pod_port_id?: string | null;
    buyer?: {
      country?: string;
    };
  };
  customer?: {
    name?: string;
    country?: string;
  };
}

interface ForwarderOption {
  _id: string;
  name: string;
}

interface ShipmentFromPIFormValues {
  logisticsPartnerId: string;
  bookingNumber?: string;
  pol?: string | null;
  pol_port_id?: string | null;
  pod?: string | null;
  pod_port_id?: string | null;
  vesselFlight?: string;
  etd?: Dayjs;
  eta?: Dayjs;
}

interface CreatedShipmentResponse {
  _id: string;
  shipmentNumber: string;
}

interface IProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  pi: ShipmentSourcePI | null;
}

const ShipmentFromPIModal = ({ open, setOpen, pi }: IProps) => {
  const { notification } = App.useApp();
  const { data: session } = useSession();
  const [form] = Form.useForm<ShipmentFromPIFormValues>();
  const watchedPol = Form.useWatch('pol', form);
  const watchedPod = Form.useWatch('pod', form);
  const tShipment = useTranslations('Shipment');
  const tInc = useTranslations('Incoterms');
  const [submitting, setSubmitting] = useState(false);
  const [forwarders, setForwarders] = useState<ForwarderOption[]>([]);
  const destinationCountryCode = useMemo(() => (
    normalizeCountryCode(pi?.customer?.country || pi?.salesContract?.buyer?.country)
  ), [pi]);

  useEffect(() => {
    const fetchForwarders = async () => {
      const accessToken = getAccessToken(session);
      if (!accessToken) return;

      const res = await sendRequest<IBackendRes<IModelPaginate<ForwarderOption>>>({
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
        pol: pi.portOfLoading || pi.salesContract?.pol,
        pol_port_id: pi.portOfLoading_port_id || pi.salesContract?.pol_port_id,
        pod: pi.portOfDischarge || pi.salesContract?.pod,
        pod_port_id: pi.portOfDischarge_port_id || pi.salesContract?.pod_port_id,
      });
    }
  }, [open, pi, form]);

  const handleClose = () => {
    form.resetFields();
    setOpen(false);
  };

  const onFinish = async (values: ShipmentFromPIFormValues) => {
    setSubmitting(true);
    const accessToken = getAccessToken(session);

    const res = await sendRequest<IBackendRes<CreatedShipmentResponse>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments`,
      method: 'POST',
      body: {
        proformaInvoiceId: pi?._id,
        salesContractId: pi?.salesContractId,
        logisticsPartnerId: values.logisticsPartnerId,
        bookingNumber: values.bookingNumber,
        pol: values.pol,
        pol_port_id: values.pol_port_id,
        pod: values.pod,
        pod_port_id: values.pod_port_id,
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
      forceRender
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
          <div>
            <Form.Item name="pol" hidden>
              <Input />
            </Form.Item>
            <Form.Item label={tShipment('createFromPI.form.pol')} name="pol_port_id">
              <PortSelect
                placeholder={tShipment('createFromPI.form.polPlaceholder')}
                legacyText={watchedPol}
                afterChange={(value) => {
                  form.setFieldsValue({
                    pol_port_id: value ?? null,
                    pol: null,
                  });
                }}
              />
            </Form.Item>
          </div>
          <div>
            <Form.Item name="pod" hidden>
              <Input />
            </Form.Item>
            <Form.Item label={tShipment('createFromPI.form.pod')} name="pod_port_id">
              <PortSelect
                placeholder={tShipment('createFromPI.form.podPlaceholder')}
                countryCode={destinationCountryCode}
                legacyText={watchedPod}
                afterChange={(value) => {
                  form.setFieldsValue({
                    pod_port_id: value ?? null,
                    pod: null,
                  });
                }}
              />
            </Form.Item>
          </div>
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
