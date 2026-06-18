'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Row,
  Col,
  message,
  Divider,
  Upload,
  Button,
  Space,
} from 'antd';
import { lcService } from '@/services/lc.service';
import { sendRequest, sendRequestFile } from '@/lib/api-client';
import { UploadOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';
import type { IBackendRes } from '@/services/base.service';

type LCType = 'AT_SIGHT' | 'DEFERRED' | 'USANCE';

type SalesContractOption = {
  _id: string;
  contractNumber: string;
  currencyCode?: string | null;
  totalAmount?: number | string | null;
  buyer?: {
    name?: string | null;
  } | null;
};

type LCFormValues = {
  lcNumber: string;
  salesContractId: string;
  lcType: LCType;
  amount: number;
  currency: string;
  issuingBank: string;
  advisingBank?: string | null;
  issueDate: Dayjs;
  expiryDate: Dayjs;
  latestShipmentDate?: Dayjs;
  presentationDeadline?: Dayjs;
  descriptionOfGoods?: string | null;
  documentsRequired?: string | null;
  additionalConditions?: string | null;
  attachmentUrl?: string | null;
};

type LCInitialValues = Partial<Omit<LCFormValues, 'issueDate' | 'expiryDate' | 'latestShipmentDate' | 'presentationDeadline'>> & {
  _id?: string;
  issueDate?: string | Date | null;
  expiryDate?: string | Date | null;
  latestShipmentDate?: string | Date | null;
  presentationDeadline?: string | Date | null;
  attachmentUrl?: string | null;
};

interface LCModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  initialValues?: LCInitialValues | null;
}

const toDayjs = (value?: string | Date | null) => (value ? dayjs(value) : undefined);

const LCModal: React.FC<LCModalProps> = ({ open, onCancel, onSuccess, initialValues }) => {
  const [form] = Form.useForm<LCFormValues>();
  const { data: session } = useSession();
  const t = useTranslations('LetterOfCredit.modal');
  const [loading, setLoading] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [contracts, setContracts] = useState<SalesContractOption[]>([]);
  const accessToken = getAccessToken(session);

  const handleUploadAttachment = async (options: any) => {
    const { file, onSuccess, onError } = options;

    if (!accessToken) {
      const error = new Error(t('notifications.error'));
      onError?.(error);
      message.error(t('notifications.error'));
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
        queryParams: { folder: 'documents' },
        body: formData,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res?.data?.url) {
        throw new Error(res?.message || t('notifications.error'));
      }

      form.setFieldValue('attachmentUrl', res.data.url);
      message.success(t('notifications.uploadSuccess'));
      onSuccess?.(res.data);
    } catch (error) {
      onError?.(error);
      message.error(error instanceof Error ? error.message : t('notifications.uploadFailed'));
    } finally {
      setUploadingAttachment(false);
    }
  };

  const fetchContracts = useCallback(async () => {
    if (!accessToken) return;
    const res = await sendRequest<IBackendRes<{ results: SalesContractOption[] }>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setContracts(res?.data?.results || []);
  }, [accessToken]);

  useEffect(() => {
    if (!open) return;
    fetchContracts();
    if (initialValues) {
      form.setFieldsValue({
        ...initialValues,
        issueDate: toDayjs(initialValues.issueDate),
        expiryDate: toDayjs(initialValues.expiryDate),
        latestShipmentDate: toDayjs(initialValues.latestShipmentDate),
        presentationDeadline: toDayjs(initialValues.presentationDeadline),
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ currency: 'USD', lcType: 'AT_SIGHT' });
    }
  }, [open, initialValues, fetchContracts, form]);

  const handleFinish = async (values: LCFormValues) => {
    if (!accessToken) {
      message.error(t('notifications.error'));
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...values,
        issueDate: values.issueDate.toISOString(),
        expiryDate: values.expiryDate.toISOString(),
        latestShipmentDate: values.latestShipmentDate?.toISOString(),
        presentationDeadline: values.presentationDeadline?.toISOString(),
      };

      if (initialValues?._id) {
        const res = await lcService.update(initialValues._id, payload, accessToken);
        if (res?.error) throw new Error(res.message || t('notifications.error'));
        message.success(t('notifications.updateSuccess'));
      } else {
        const res = await lcService.create(payload, accessToken);
        if (res?.error) throw new Error(res.message || t('notifications.error'));
        message.success(t('notifications.createSuccess'));
      }
      onSuccess();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('notifications.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={initialValues ? t('editTitle') : t('createTitle')}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={860}
      style={{ top: 20 }}
      okText={initialValues ? t('okUpdate') : t('okCreate')}
      cancelText={t('cancel')}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item label={t('fields.lcNumber')} name="lcNumber" rules={[{ required: true, message: t('validation.lcNumber') }]}>
              <Input placeholder={t('placeholders.lcNumber')} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label={t('fields.salesContract')} name="salesContractId" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder={t('placeholders.salesContract')}
                optionFilterProp="label"
                options={contracts.map((contract) => ({
                  value: contract._id,
                  label: `${contract.contractNumber} - ${contract.buyer?.name || '-'}`,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label={t('fields.lcType')} name="lcType" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'AT_SIGHT', label: t('lcTypes.AT_SIGHT') },
                  { value: 'DEFERRED', label: t('lcTypes.DEFERRED') },
                  { value: 'USANCE', label: t('lcTypes.USANCE') },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label={t('fields.amount')} name="amount" rules={[{ required: true }]}>
              <InputNumber<number>
                style={{ width: '100%' }}
                min={0.01}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => Number(value?.replace(/,/g, '') || 0)}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label={t('fields.currency')} name="currency" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'EUR', label: 'EUR' },
                  { value: 'VND', label: 'VND' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider>{t('sections.bankInfo')}</Divider>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item label={t('fields.issuingBank')} name="issuingBank" rules={[{ required: true }]}>
              <Input placeholder={t('placeholders.issuingBank')} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label={t('fields.advisingBank')} name="advisingBank">
              <Input placeholder={t('placeholders.advisingBank')} />
            </Form.Item>
          </Col>
        </Row>

        <Divider>{t('sections.datesDocuments')}</Divider>

        <Row gutter={16}>
          <Col xs={24} md={6}>
            <Form.Item label={t('fields.issueDate')} name="issueDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item
              label={t('fields.expiryDate')}
              name="expiryDate"
              dependencies={['issueDate']}
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator(_, value: Dayjs | undefined) {
                    const issueDate = getFieldValue('issueDate') as Dayjs | undefined;
                    if (!value || !issueDate || !value.isBefore(issueDate, 'day')) return Promise.resolve();
                    return Promise.reject(new Error(t('validation.expiryAfterIssue')));
                  },
                }),
              ]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item
              label={t('fields.latestShipmentDate')}
              name="latestShipmentDate"
              dependencies={['expiryDate']}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value: Dayjs | undefined) {
                    const expiryDate = getFieldValue('expiryDate') as Dayjs | undefined;
                    if (!value || !expiryDate || !value.isAfter(expiryDate, 'day')) return Promise.resolve();
                    return Promise.reject(new Error(t('validation.shipmentBeforeExpiry')));
                  },
                }),
              ]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item
              label={t('fields.presentationDeadline')}
              name="presentationDeadline"
              dependencies={['expiryDate']}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value: Dayjs | undefined) {
                    const expiryDate = getFieldValue('expiryDate') as Dayjs | undefined;
                    if (!value || !expiryDate || !value.isAfter(expiryDate, 'day')) return Promise.resolve();
                    return Promise.reject(new Error(t('validation.presentationBeforeExpiry')));
                  },
                }),
              ]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label={t('fields.descriptionOfGoods')} name="descriptionOfGoods">
          <Input.TextArea rows={3} placeholder={t('placeholders.descriptionOfGoods')} />
        </Form.Item>

        <Form.Item label={t('fields.documentsRequired')} name="documentsRequired">
          <Input.TextArea rows={3} placeholder={t('placeholders.documentsRequired')} />
        </Form.Item>

        <Form.Item label={t('fields.additionalConditions')} name="additionalConditions">
          <Input.TextArea rows={2} placeholder={t('placeholders.additionalConditions')} />
        </Form.Item>

        <Divider>{t('sections.attachments')}</Divider>

        <Form.Item label={t('fields.attachmentUrl')}>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="attachmentUrl" noStyle>
              <Input placeholder={t('placeholders.attachmentUrl')} />
            </Form.Item>
            <Upload
              accept="image/*,.pdf"
              customRequest={handleUploadAttachment}
              maxCount={1}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />} loading={uploadingAttachment}>
                {t('upload.uploadAttachment')}
              </Button>
            </Upload>
          </Space.Compact>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default LCModal;
