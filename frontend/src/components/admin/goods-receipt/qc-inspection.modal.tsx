'use client';

import React, { useEffect, useMemo } from 'react';
import { Alert, App, Form, Input, InputNumber, Modal, Select, Space, Tag, Typography } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import type { IGoodsReceipt, IGRNLine } from '@/types/goods-receipt';
import type { IQualityCheck, QCResult } from '@/types/purchase-exception';

const { Text } = Typography;

type QcDecision = 'PASS' | 'QUARANTINE' | 'REJECT';

interface QcInspectionFormValues {
  goodsReceiptItemId: string;
  decision: QcDecision;
  rejectedQuantity?: number;
  defectRate?: number;
  inspectorNotes?: string;
  correctiveAction?: string;
}

interface QcInspectionModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  goodsReceipt: IGoodsReceipt | null;
  onSuccess: () => void;
}

const getLineNeedsQc = (line: IGRNLine): boolean => (
  !line.hasActiveQualityCheck &&
  (Number(line.quantityRejected || 0) > 0 || Boolean(line.qualityStatus && line.qualityStatus !== 'PASS'))
);

const toQcResult = (decision: QcDecision): QCResult => {
  if (decision === 'PASS') return 'PASSED';
  if (decision === 'QUARANTINE') return 'CONDITIONAL';
  return 'FAILED';
};

const QcInspectionModal = ({
  isOpen,
  setIsOpen,
  goodsReceipt,
  onSuccess,
}: QcInspectionModalProps) => {
  const t = useTranslations('GoodsReceipt.qc');
  const { message } = App.useApp();
  const { data: session } = useSession();
  const [form] = Form.useForm<QcInspectionFormValues>();

  const lineOptions = useMemo(() => (
    (goodsReceipt?.items ?? []).filter(getLineNeedsQc)
  ), [goodsReceipt?.items]);

  const selectedLineId = Form.useWatch('goodsReceiptItemId', form);
  const selectedLine = useMemo(
    () => lineOptions.find((line) => line._id === selectedLineId) ?? lineOptions[0] ?? null,
    [lineOptions, selectedLineId],
  );

  useEffect(() => {
    if (!isOpen || !goodsReceipt) return;
    const firstLine = lineOptions[0];
    form.setFieldsValue({
      goodsReceiptItemId: firstLine?._id,
      decision: 'QUARANTINE',
      rejectedQuantity: Number(firstLine?.quantityRejected || 0),
      defectRate: firstLine?.quantityReceived
        ? Number(((Number(firstLine.quantityRejected || 0) / Number(firstLine.quantityReceived || 1)) * 100).toFixed(2))
        : 0,
      inspectorNotes: firstLine?.rejectionReason || firstLine?.lineNote || undefined,
      correctiveAction: t('defaultCorrectiveAction'),
    });
  }, [form, goodsReceipt, isOpen, lineOptions, t]);

  const handleSubmit = async (): Promise<void> => {
    if (!goodsReceipt || !selectedLine) return;

    const values = await form.validateFields();
    const rejectedQuantity = values.decision === 'PASS' ? 0 : Number(values.rejectedQuantity || 0);

    const res = await sendRequest<IBackendRes<IQualityCheck>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quality-control`,
      method: 'POST',
      headers: { Authorization: `Bearer ${getAccessToken(session)}` },
      body: {
        goodsReceiptId: goodsReceipt._id,
        goodsReceiptItemId: selectedLine._id,
        purchaseOrderId: goodsReceipt.purchaseOrder?._id ?? goodsReceipt.purchaseOrderId,
        productId: selectedLine.productId,
        result: toQcResult(values.decision),
        receivedQuantity: Number(selectedLine.quantityReceived || 0),
        rejectedQuantity,
        defectRate: values.defectRate,
        inspectorNotes: values.inspectorNotes,
        correctiveAction: values.correctiveAction,
      },
    });

    if (res?.data) {
      message.success(t('success'));
      setIsOpen(false);
      onSuccess();
      return;
    }

    message.error(res?.message || t('failed'));
  };

  const hasRejectedStock = Number(selectedLine?.quantityRejected || 0) > 0;

  return (
    <Modal
      title={(
        <Space>
          <ExperimentOutlined />
          <span>{t('title')}</span>
          {goodsReceipt?.grNumber ? <Tag color="blue">{goodsReceipt.grNumber}</Tag> : null}
        </Space>
      )}
      open={isOpen}
      onCancel={() => setIsOpen(false)}
      onOk={() => void handleSubmit()}
      okText={t('submit')}
      cancelText={t('cancel')}
      width={720}
      destroyOnHidden
    >
      {lineOptions.length === 0 ? (
        <Alert type="success" showIcon title={t('empty')} />
      ) : (
        <Form<QcInspectionFormValues> form={form} layout="vertical">
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title={t('warningTitle')}
            description={t('warningDescription')}
          />

          <Form.Item
            name="goodsReceiptItemId"
            label={t('line')}
            rules={[{ required: true, message: t('lineRequired') }]}
          >
            <Select
              options={lineOptions.map((line) => ({
                value: line._id,
                label: `${line.product?.sku || line.productId} - ${line.product?.vietnameseName || ''}`,
              }))}
              onChange={(lineId) => {
                const nextLine = lineOptions.find((line) => line._id === lineId);
                form.setFieldsValue({
                  rejectedQuantity: Number(nextLine?.quantityRejected || 0),
                  defectRate: nextLine?.quantityReceived
                    ? Number(((Number(nextLine.quantityRejected || 0) / Number(nextLine.quantityReceived || 1)) * 100).toFixed(2))
                    : 0,
                  inspectorNotes: nextLine?.rejectionReason || nextLine?.lineNote || undefined,
                });
              }}
            />
          </Form.Item>

          {selectedLine ? (
            <Space wrap style={{ marginBottom: 16 }}>
              <Text>{t('received')}: <Text strong>{selectedLine.quantityReceived}</Text></Text>
              <Text type="danger">{t('rejected')}: <Text strong type="danger">{selectedLine.quantityRejected}</Text></Text>
              {selectedLine.lotNumber ? <Tag color="magenta">{selectedLine.lotNumber}</Tag> : null}
              {selectedLine.qualityStatus ? <Tag>{selectedLine.qualityStatus}</Tag> : null}
            </Space>
          ) : null}

          <Form.Item
            name="decision"
            label={t('decision')}
            rules={[{ required: true, message: t('decisionRequired') }]}
            extra={hasRejectedStock ? t('passDisabledHint') : undefined}
          >
            <Select
              options={[
                { value: 'PASS', label: t('decisions.PASS'), disabled: hasRejectedStock },
                { value: 'QUARANTINE', label: t('decisions.QUARANTINE') },
                { value: 'REJECT', label: t('decisions.REJECT') },
              ]}
            />
          </Form.Item>

          <Space size="middle" style={{ width: '100%' }} align="start">
            <Form.Item
              name="rejectedQuantity"
              label={t('rejectedQuantity')}
              rules={[{ required: true, message: t('rejectedRequired') }]}
            >
              <InputNumber min={0} max={Number(selectedLine?.quantityReceived || 0)} style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="defectRate" label={t('defectRate')}>
              <InputNumber min={0} max={100} addonAfter="%" style={{ width: 160 }} />
            </Form.Item>
          </Space>

          <Form.Item
            name="inspectorNotes"
            label={t('inspectorNotes')}
            rules={[{ required: true, message: t('notesRequired') }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="correctiveAction" label={t('correctiveAction')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};

export default QcInspectionModal;
