'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'antd';
import { lcService } from '@/services/lc.service';
import { sendRequest } from '@/lib/api-client';
import { useSession } from 'next-auth/react';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';

interface LCModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  initialValues?: any;
}

const LCModal: React.FC<LCModalProps> = ({ open, onCancel, onSuccess, initialValues }) => {
  const [form] = Form.useForm();
  const { data: session } = useSession();
  const t = useTranslations('LetterOfCredit.modal');
  const [loading, setLoading] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const accessToken = getAccessToken(session);

  const fetchContracts = useCallback(async () => {
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      setContracts(res.data.results);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!open) return;
    fetchContracts();
    if (initialValues) {
      form.setFieldsValue({
        ...initialValues,
        issueDate: initialValues.issueDate ? dayjs(initialValues.issueDate) : undefined,
        expiryDate: initialValues.expiryDate ? dayjs(initialValues.expiryDate) : undefined,
        latestShipmentDate: initialValues.latestShipmentDate ? dayjs(initialValues.latestShipmentDate) : undefined,
      });
    } else {
      form.resetFields();
    }
  }, [open, initialValues, fetchContracts, form]);

  const handleFinish = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        issueDate: values.issueDate?.toISOString(),
        expiryDate: values.expiryDate?.toISOString(),
        latestShipmentDate: values.latestShipmentDate?.toISOString(),
      };

      if (initialValues?._id) {
        await lcService.update(initialValues._id, payload);
        message.success(t('notifications.updateSuccess'));
      } else {
        await lcService.create(payload);
        message.success(t('notifications.createSuccess'));
      }
      onSuccess();
    } catch (error: any) {
      message.error(error.message || t('notifications.error'));
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
      width={800}
      style={{ top: 20 }}
      okText={initialValues ? t('okUpdate') : t('okCreate')}
      cancelText={t('cancel')}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ currency: 'USD', lcType: 'AT_SIGHT' }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label={t('fields.lcNumber')} name="lcNumber" rules={[{ required: true, message: t('validation.lcNumber') }]}>
              <Input placeholder={t('placeholders.lcNumber')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('fields.salesContract')} name="salesContractId" rules={[{ required: true }]}>
              <Select placeholder={t('placeholders.salesContract')}>
                {contracts.map((contract) => (
                  <Select.Option key={contract._id} value={contract._id}>
                    {contract.contractNumber} - {contract.buyer?.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label={t('fields.lcType')} name="lcType" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="AT_SIGHT">{t('lcTypes.AT_SIGHT')}</Select.Option>
                <Select.Option value="DEFERRED">{t('lcTypes.DEFERRED')}</Select.Option>
                <Select.Option value="USANCE">{t('lcTypes.USANCE')}</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={t('fields.amount')} name="amount" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={t('fields.currency')} name="currency" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="USD">USD</Select.Option>
                <Select.Option value="EUR">EUR</Select.Option>
                <Select.Option value="VND">VND</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Divider>{t('sections.bankInfo')}</Divider>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label={t('fields.issuingBank')} name="issuingBank" rules={[{ required: true }]}>
              <Input placeholder={t('placeholders.issuingBank')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('fields.advisingBank')} name="advisingBank">
              <Input placeholder={t('placeholders.advisingBank')} />
            </Form.Item>
          </Col>
        </Row>

        <Divider>{t('sections.datesDocuments')}</Divider>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label={t('fields.issueDate')} name="issueDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={t('fields.expiryDate')} name="expiryDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={t('fields.latestShipmentDate')} name="latestShipmentDate">
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
      </Form>
    </Modal>
  );
};

export default LCModal;
