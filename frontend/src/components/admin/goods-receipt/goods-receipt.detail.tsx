'use client';

import React from 'react';
import { Modal, Descriptions, Table, Tag, Typography, Divider, Space } from 'antd';
import { BarcodeOutlined, CalendarOutlined, UserOutlined, FileTextOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { IGoodsReceipt } from '@/types/goods-receipt';
import { formatDate } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';

const { Text, Title } = Typography;

interface IProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  data: IGoodsReceipt | null;
}

const GoodsReceiptDetailModal = (props: IProps) => {
  const t = useTranslations('GoodsReceipt');
  const tCommon = useTranslations('Common');
  const { isOpen, setIsOpen, data } = props;
  const { formatNumber } = useCurrency();

  const columns = [
    {
      title: t('detail.columns.product'),
      key: 'product',
      render: (_: any, record: any) => (
        <div>
          <Text strong>{record.product?.vietnameseName}</Text>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>SKU: {record.product?.sku}</div>
        </div>
      ),
    },
    {
      title: t('detail.columns.qtyReceived'),
      dataIndex: 'quantityReceived',
      key: 'quantityReceived',
      align: 'right' as const,
      render: (val: number) => <Text strong>{formatNumber(val)}</Text>,
    },
    {
      title: t('detail.columns.unit'),
      dataIndex: 'unit',
      key: 'unit',
      align: 'center' as const,
      render: (unit: string) => <Tag color="blue">{unit}</Tag>,
    },
  ];

  return (
    <Modal
      title={
        <Space size="middle">
          <div style={{ 
            width: 32, height: 32, borderRadius: 8, 
            background: 'linear-gradient(135deg, #08979c 0%, #00474f 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <BarcodeOutlined style={{ color: '#fff' }} />
          </div>
          <Text strong style={{ fontSize: 16 }}>
            {t('detail.modalTitle', { grnNumber: data?.grnNumber || 'N/A' })}
          </Text>
        </Space>
      }
      open={isOpen}
      onCancel={() => setIsOpen(false)}
      footer={null}
      width={800}
    >
      {!data ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Text type="secondary">{tCommon('loading')}</Text>
        </div>
      ) : (
        <>
          <Descriptions bordered column={2} size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label={<Space><CalendarOutlined />{t('detail.receivedDate')}</Space>}>
              {formatDate(data.receivedDate)}
            </Descriptions.Item>
            <Descriptions.Item label={<Space><FileTextOutlined />{t('detail.poNumber')}</Space>}>
              <Tag color="processing">{data.purchaseOrder?.poNumber || 'N/A'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={<Space><UserOutlined />{t('detail.receivedBy')}</Space>}>
              {data.receivedBy?.email || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label={t('detail.status')}>
              <Tag color={data.status === 'COMPLETED' ? 'green' : data.status === 'CANCELLED' ? 'red' : 'processing'}>
                {data.status ? t(`status.${data.status}`) : 'N/A'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('detail.note')} span={2}>
              {data.note || '---'}
            </Descriptions.Item>
          </Descriptions>

          <Divider titlePlacement="left" style={{ fontSize: 14, color: '#8c8c8c' }}>{t('detail.itemsDivider')}</Divider>
          
          <Table 
            dataSource={data.items || []} 
            columns={columns} 
            pagination={false}
            rowKey="id"
            size="middle"
            bordered
          />
        </>
      )}
    </Modal>
  );
};

export default GoodsReceiptDetailModal;
