'use client';

import React from 'react';
import { Modal, Descriptions, Tag, Typography, Divider, Space } from 'antd';
import { useTranslations } from 'next-intl';
import { FileDoneOutlined, CalendarOutlined, UserOutlined, DollarOutlined } from '@ant-design/icons';
import { IVendorInvoice } from '@/types/vendor-invoice';
import { formatDate, formatVND } from '@/utils/format';

const { Text } = Typography;

interface IProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  data: IVendorInvoice | null;
}

const VendorInvoiceDetailModal = (props: IProps) => {
  const t = useTranslations('VendorInvoice');
  const { isOpen, setIsOpen, data } = props;

  return (
    <Modal
      title={
        <Space size="middle">
          <div style={{ 
            width: 32, height: 32, borderRadius: 8, 
            background: 'linear-gradient(135deg, #722ed1 0%, #391085 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FileDoneOutlined style={{ color: '#fff' }} />
          </div>
          <Text strong style={{ fontSize: 16 }}>{t('detail.modalTitle', { invoiceNumber: data?.invoiceNumber })}</Text>
        </Space>
      }
      open={isOpen}
      onCancel={() => setIsOpen(false)}
      footer={null}
      width={700}
    >
      <Descriptions bordered column={2} size="small" style={{ marginTop: 16 }}>
        <Descriptions.Item label={<Space><CalendarOutlined />{t('detail.invoiceDate')}</Space>}>
          {formatDate(data?.invoiceDate || '')}
        </Descriptions.Item>
        <Descriptions.Item label={<Space><FileDoneOutlined />{t('detail.poNumber')}</Space>}>
          <Tag color="blue">{data?.purchaseOrder?.poNumber}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label={t('detail.vendor')} span={2}>
          <Text strong>{data?.vendor?.name}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t('detail.amount')}>
          {formatVND(data?.amount || 0)}
        </Descriptions.Item>
        <Descriptions.Item label={t('detail.taxAmount')}>
          {formatVND(data?.taxAmount || 0)}
        </Descriptions.Item>
        <Descriptions.Item label={<Space><DollarOutlined />{t('detail.totalAmount')}</Space>} span={2}>
          <Text strong type="danger" style={{ fontSize: 18 }}>{formatVND(data?.totalAmount || 0)}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t('detail.dueDate')}>
          {data?.dueDate ? formatDate(data.dueDate) : '---'}
        </Descriptions.Item>
        <Descriptions.Item label={t('detail.status')}>
          <Tag color={data?.status === 'PAID' ? 'green' : 'orange'}>
            {data?.status === 'PAID' ? t('status.PAID') : t('status.PENDING')}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label={t('detail.note')} span={2}>
          {data?.note || '---'}
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  );
};

export default VendorInvoiceDetailModal;
