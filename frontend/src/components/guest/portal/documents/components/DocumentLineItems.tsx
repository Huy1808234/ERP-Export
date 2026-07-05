import { Table, Space, Typography, Empty, Divider } from 'antd';
import type { TableProps } from 'antd/es/table';
import { useTranslations, useFormatter } from 'next-intl';
import { formatMoney, formatQuantity, type Formatter } from '../document.formatters';
import type { CustomerCommercialDocument, CustomerDocumentLineItem } from '@/types/customer-portal';

const { Text } = Typography;

const getLineColumns = (
  currency: string,
  format: Formatter,
  t: ReturnType<typeof useTranslations>,
): TableProps<CustomerDocumentLineItem>['columns'] => [
  {
    title: t('documentDetail.product'),
    width: 340,
    render: (_, item) => (
      <Space orientation="vertical" size={2}>
        <Text strong>{item.productName}</Text>
        <Text type="secondary">{item.sku || item.product_id || '-'}</Text>
      </Space>
    ),
  },
  {
    title: t('documentDetail.qty'),
    dataIndex: 'quantity',
    align: 'right',
    width: 132,
    render: (value: number, item) => <Text>{formatQuantity(value, item.unit, format)}</Text>,
  },
  {
    title: t('documentDetail.unitPrice'),
    dataIndex: 'unitPrice',
    align: 'right',
    width: 150,
    render: (value: number) => formatMoney(value, currency, format),
  },
  {
    title: t('documentDetail.amount'),
    dataIndex: 'totalAmount',
    align: 'right',
    width: 160,
    render: (value: number) => <Text strong>{formatMoney(value, currency, format)}</Text>,
  },
];

type DocumentLineItemsProps = {
  document: CustomerCommercialDocument;
};

export const DocumentLineItems = ({ document }: DocumentLineItemsProps) => {
  const t = useTranslations('CustomerPortal');
  const format = useFormatter();

  if (!document.lineItems?.length) {
    return <Empty description={t('documentDetail.noLineItems')} />;
  }

  return (
    <>
      <Table
        columns={getLineColumns(document.currency, format, t)}
        dataSource={document.lineItems}
        rowKey="_id"
        pagination={false}
        scroll={{ x: 800 }}
        size="middle"
        locale={{ emptyText: <Empty description={t('documentDetail.noLineItems')} /> }}
      />
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <div style={{ width: 320 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">{t('documentDetail.subtotal')}</Text>
              <Text>{formatMoney(document.totalAmount, document.currency, format)}</Text>
            </div>
            {document.currency !== 'VND' && (document.totalAmountVnd || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('documentDetail.totalAmountVnd')}</Text>
                <Text>{formatMoney(document.totalAmountVnd || 0, 'VND', format)}</Text>
              </div>
            )}
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text strong>{t('documentDetail.total')}</Text>
              <Text strong style={{ fontSize: 18 }}>
                {formatMoney(document.totalAmount, document.currency, format)}
              </Text>
            </div>
          </Space>
        </div>
      </div>
    </>
  );
};
