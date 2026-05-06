'use client';

import React from 'react';
import { Modal, Descriptions, Badge, Table, Divider, Typography, Row, Col, Card, Tag, Space } from 'antd';
import { FileProtectOutlined, UserOutlined, CalendarOutlined, DollarOutlined, GlobalOutlined, CarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useCurrency } from '@/hooks/useCurrency';

const { Title, Text } = Typography;

interface SalesContractDetailProps {
  open: boolean;
  onCancel: () => void;
  data: any;
}

const SalesContractDetailModal: React.FC<SalesContractDetailProps> = ({ open, onCancel, data }) => {
  const { formatMoney, formatVND } = useCurrency();

  if (!data) return null;

  const itemColumns = [
    { 
      title: 'Sản phẩm', 
      key: 'product',
      render: (record: any) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.product?.vietnameseName || 'N/A'}</Text>
          {record.product?.sku && <Text type="secondary" style={{ fontSize: 12 }}>[{record.product.sku}]</Text>}
        </Space>
      )
    },
    { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', align: 'right' as const },
    { 
      title: 'Đơn giá', 
      dataIndex: 'unitPrice', 
      key: 'unitPrice', 
      align: 'right' as const,
      render: (val: number) => formatMoney(val, data.currencyCode)
    },
    { 
      title: 'Thành tiền', 
      key: 'total', 
      align: 'right' as const,
      render: (_: any, record: any) => formatMoney(record.totalPrice || (record.quantity * record.unitPrice), data.currencyCode)
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <FileProtectOutlined className="text-blue-500" />
          <span>Chi tiết Hợp đồng: {data.contractNumber}</span>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      width={1000}
      centered
      styles={{ body: { padding: '24px' } }}
    >
      <Row gutter={[24, 24]}>
        <Col span={16}>
          <Card title="Thông tin chung" variant="borderless" className="bg-slate-50/50">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Khách hàng" span={2}>
                <Space>
                  <UserOutlined />
                  <Text strong>{data.buyer?.name}</Text>
                  <Tag color="blue">{data.buyer?.country}</Tag>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">
                {dayjs(data.createdAt).format('DD/MM/YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Badge status="processing" text={data.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Điều kiện (Incoterms)">
                <Tag color="magenta">{data.incoterm}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tiền tệ">
                {data.currencyCode} (Tỷ giá: {data.exchangeRate})
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Divider titlePlacement={"left" as any}>Danh sách hàng hóa</Divider>
          <Table 
            dataSource={data.items} 
            columns={itemColumns} 
            pagination={false} 
            rowKey="id" 
            size="small"
            footer={() => (
              <div className="flex justify-end gap-8">
                <Text>Tổng trị giá hàng hóa:</Text>
                <Text strong className="text-blue-600">{formatMoney(data.totalAmount, data.currencyCode)}</Text>
              </div>
            )}
          />
        </Col>

        <Col span={8}>
          <Card title="Chi phí Logistics" variant="borderless" className="bg-blue-50/30">
            <Space orientation="vertical" className="w-full">
              <div className="flex justify-between">
                <Text type="secondary">Vận tải nội địa:</Text>
                <Text>{formatMoney(data.domesticTransportCost, data.currencyCode)}</Text>
              </div>
              <div className="flex justify-between">
                <Text type="secondary">Phí cảng (THC...):</Text>
                <Text>{formatMoney(data.portCharges, data.currencyCode)}</Text>
              </div>
              <div className="flex justify-between">
                <Text type="secondary">Cước tàu (Sea Freight):</Text>
                <Text>{formatMoney(data.seaFreight, data.currencyCode)}</Text>
              </div>
              <div className="flex justify-between">
                <Text type="secondary">Bảo hiểm:</Text>
                <Text>{formatMoney(data.insuranceCost, data.currencyCode)}</Text>
              </div>
              <Divider className="my-2" titlePlacement={"center" as any} />
              <div className="flex flex-col items-end">
                <Text strong className="text-lg">TỔNG GIÁ TRỊ (VND)</Text>
                <Title level={3} className="m-0 text-emerald-600">{formatVND(data.totalAmountVnd)}</Title>
              </div>
            </Space>
          </Card>

          <Card title="Điều khoản & Ghi chú" variant="borderless" className="mt-6 bg-orange-50/20">
            <Text type="secondary">Thời hạn giao hàng:</Text>
            <p>{data.deliveryDate ? dayjs(data.deliveryDate).format('DD/MM/YYYY') : 'N/A'}</p>
            <Text type="secondary">Điều khoản thanh toán:</Text>
            <p>{data.paymentTerms || 'T/T 100%'}</p>
            <Divider className="my-2" titlePlacement={"center" as any} />
            <Text type="secondary">Ghi chú:</Text>
            <p className="italic text-gray-500">{data.notes || 'Không có ghi chú'}</p>
          </Card>
        </Col>
      </Row>
    </Modal>
  );
};

export default SalesContractDetailModal;
