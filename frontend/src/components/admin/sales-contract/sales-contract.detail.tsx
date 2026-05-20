'use client';

import React, { useEffect, useState } from 'react';
import { Badge, Card, Col, Descriptions, Divider, Modal, Row, Space, Table, Tag, Timeline, Typography } from 'antd';
import { FileProtectOutlined, UserOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import dayjs from 'dayjs';
import { useCurrency } from '@/hooks/useCurrency';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';

const { Title, Text } = Typography;

interface SalesContractDetailProps {
  open: boolean;
  onCancel: () => void;
  data: any;
}

interface SignatureAuditPacket {
  certificate: {
    certificateNumber: string | null;
    certificateHash: string | null;
    packetHash: string;
    generatedAt: string;
  };
  timeline: Array<{
    action: string;
    at: string;
    actor: string | null;
    note?: string | null;
  }>;
}

const SalesContractDetailModal: React.FC<SalesContractDetailProps> = ({ open, onCancel, data }) => {
  const { formatMoney, formatVND } = useCurrency();
  const { data: session } = useSession();
  const [auditPacket, setAuditPacket] = useState<SignatureAuditPacket | null>(null);

  useEffect(() => {
    const fetchAuditPacket = async () => {
      if (!open || !data?._id) return;

      const res = await sendRequest<IBackendRes<SignatureAuditPacket>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/${data._id}/signature-packet`,
        method: 'GET',
        headers: { Authorization: `Bearer ${getAccessToken(session)}` },
      });
      setAuditPacket(res?.data || null);
    };

    setAuditPacket(null);
    fetchAuditPacket();
  }, [data?._id, open, session]);

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
      ),
    },
    { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', align: 'right' as const },
    {
      title: 'Đơn giá',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right' as const,
      render: (val: number) => formatMoney(val, data.currencyCode),
    },
    {
      title: 'Thành tiền',
      key: 'total',
      align: 'right' as const,
      render: (_: any, record: any) => formatMoney(record.totalPrice || (record.quantity * record.unitPrice), data.currencyCode),
    },
  ];

  const signatureColumns = [
    {
      title: 'Bên ký',
      dataIndex: 'signerType',
      key: 'signerType',
      render: (value: string) => <Tag color={value === 'BUYER' ? 'purple' : 'blue'}>{value}</Tag>,
    },
    {
      title: 'Người ký',
      key: 'signer',
      render: (record: any) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.signerName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.signerTitle || record.signerEmail || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Thời điểm',
      dataIndex: 'signedAt',
      key: 'signedAt',
      render: (value: string) => value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-',
    },
  ];

  const invitationColumns = [
    {
      title: 'Tráº¡ng thÃ¡i',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => <Tag color={value === 'SIGNED' ? 'green' : value === 'REVOKED' ? 'red' : 'purple'}>{value}</Tag>,
    },
    {
      title: 'NgÆ°á»i nháº­n',
      key: 'signer',
      render: (record: any) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.signerName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.signerEmail || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Háº¿t háº¡n',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (value: string) => value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-',
    },
    {
      title: 'Certificate',
      dataIndex: 'certificateNumber',
      key: 'certificateNumber',
      render: (value: string | null) => value || '-',
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
              <Descriptions.Item label="Điều kiện Incoterms">
                <Tag color="magenta">{data.incoterm}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tiền tệ">
                {data.currencyCode} (Tỷ giá: {data.exchangeRate})
              </Descriptions.Item>
              <Descriptions.Item label="Cảng đi POL">
                <Text strong>{data.pol || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Cảng đến POD">
                <Text strong>{data.pod || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Số Booking">
                <Text strong>{data.bookingNumber || '-'}</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Divider titlePlacement="left">Danh sách hàng hóa</Divider>
          <Table
            dataSource={data.items}
            columns={itemColumns}
            pagination={false}
            rowKey={(record: any) => record._id || record.productId}
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
                <Text type="secondary">Phí cảng:</Text>
                <Text>{formatMoney(data.portCharges, data.currencyCode)}</Text>
              </div>
              <div className="flex justify-between">
                <Text type="secondary">Cước tàu:</Text>
                <Text>{formatMoney(data.seaFreight, data.currencyCode)}</Text>
              </div>
              <div className="flex justify-between">
                <Text type="secondary">Bảo hiểm:</Text>
                <Text>{formatMoney(data.insuranceCost, data.currencyCode)}</Text>
              </div>
              <div className="flex justify-between">
                <Text type="secondary">Phí Logistics:</Text>
                <Text>{formatMoney(data.logisticsFee, data.currencyCode)}</Text>
              </div>
              <div className="flex justify-between">
                <Text type="secondary">Phí khác:</Text>
                <Text>{formatMoney(data.otherFee, data.currencyCode)}</Text>
              </div>
              <Divider className="my-2" />
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
            <Divider className="my-2" />
            <Text type="secondary">Ghi chú:</Text>
            <p className="italic text-gray-500">{data.notes || 'Không có ghi chú'}</p>
          </Card>

          <Card title="Approval & E-sign" variant="borderless" className="mt-6 bg-indigo-50/20">
            <Space orientation="vertical" className="w-full" size="middle">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Người gửi duyệt">
                  {data.submittedForApprovalByUsername || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Người duyệt">
                  {data.approvedByUsername || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái ký">
                  <Tag color="purple">{data.signatureStatus || 'NOT_SENT'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Hash chứng từ">
                  <Text copyable={!!data.signatureDocumentHash} style={{ fontSize: 11 }}>
                    {data.signatureDocumentHash || '-'}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Audit packet">
                  <Text copyable={!!auditPacket?.certificate.packetHash} style={{ fontSize: 11 }}>
                    {auditPacket?.certificate.packetHash || '-'}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Certificate">
                  {auditPacket?.certificate.certificateNumber || '-'}
                </Descriptions.Item>
              </Descriptions>
              <Table
                dataSource={data.signatures || []}
                columns={signatureColumns}
                pagination={false}
                size="small"
                rowKey={(record: any) => record._id || `${record.signerType}-${record.signedAt}`}
              />
              <Divider className="my-2" titlePlacement="left">Signer invitation lifecycle</Divider>
              <Table
                dataSource={data.signatureInvitations || []}
                columns={invitationColumns}
                pagination={false}
                size="small"
                rowKey={(record: any) => record._id}
              />
              {auditPacket?.timeline?.length ? (
                <>
                  <Divider className="my-2" titlePlacement="left">Audit trail</Divider>
                  <Timeline
                    items={auditPacket.timeline.slice(-8).map((event) => ({
                      children: (
                        <Space orientation="vertical" size={0}>
                          <Text strong>{event.action}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(event.at).format('DD/MM/YYYY HH:mm')} · {event.actor || 'portal'}{event.note ? ` · ${event.note}` : ''}
                          </Text>
                        </Space>
                      ),
                    }))}
                  />
                </>
              ) : null}
            </Space>
          </Card>
        </Col>
      </Row>
    </Modal>
  );
};

export default SalesContractDetailModal;
