'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Col,
  Divider,
  Empty,
  Modal,
  Row,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FileProtectOutlined, UserOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import dayjs from 'dayjs';
import { useCurrency } from '@/hooks/useCurrency';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';

const { Title, Text, Paragraph } = Typography;

type Nullable<T> = T | null | undefined;

interface SalesContractBuyer {
  name?: string | null;
  country?: string | null;
}

interface SalesContractProduct {
  _id?: string;
  sku?: string | null;
  vietnameseName?: string | null;
  name?: string | null;
}

interface SalesContractItem {
  _id?: string;
  product?: SalesContractProduct | null;
  quantity?: number | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
}

interface SalesContractSignature {
  _id?: string;
  signerType?: string | null;
  signerName?: string | null;
  signerTitle?: string | null;
  signerEmail?: string | null;
  signedAt?: string | null;
}

interface SalesContractInvitation {
  _id?: string;
  status?: string | null;
  signerName?: string | null;
  signerEmail?: string | null;
  expiresAt?: string | null;
  certificateNumber?: string | null;
}

interface SalesContractDetail {
  _id: string;
  contractNumber?: string | null;
  buyer?: SalesContractBuyer | null;
  createdAt?: string | null;
  status?: string | null;
  incoterm?: string | null;
  currencyCode?: string | null;
  exchangeRate?: number | null;
  pol?: string | null;
  pod?: string | null;
  bookingNumber?: string | null;
  items?: SalesContractItem[];
  totalAmount?: number | null;
  totalAmountVnd?: number | null;
  domesticTransportCost?: number | null;
  portCharges?: number | null;
  seaFreight?: number | null;
  insuranceCost?: number | null;
  logisticsFee?: number | null;
  otherFee?: number | null;
  deliveryDate?: string | null;
  validUntil?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  submittedForApprovalByUsername?: string | null;
  approvedByUsername?: string | null;
  signatureStatus?: string | null;
  signatureDocumentHash?: string | null;
  signatures?: SalesContractSignature[];
  signatureInvitations?: SalesContractInvitation[];
}

interface SalesContractDetailProps {
  open: boolean;
  onCancel: () => void;
  data: SalesContractDetail | null;
}

interface SignatureAuditPacket {
  certificate?: {
    certificateNumber?: string | null;
    certificateHash?: string | null;
    packetHash?: string | null;
    generatedAt?: string | null;
  } | null;
  timeline?: Array<{
    action: string;
    at: string;
    actor: string | null;
    note?: string | null;
  }>;
}

const formatDateTime = (value: Nullable<string>) => (
  value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-'
);

const formatDate = (value: Nullable<string>) => (
  value ? dayjs(value).format('DD/MM/YYYY') : 'N/A'
);

const getInvitationColor = (value: Nullable<string>) => {
  if (value === 'SIGNED') return 'green';
  if (value === 'REVOKED' || value === 'EXPIRED') return 'red';
  if (value === 'SENT') return 'processing';
  return 'purple';
};

const getSignatureColor = (value: Nullable<string>) => (
  value === 'BUYER' ? 'purple' : 'blue'
);

const detailCardClass = 'border border-[#E5E7EB] bg-white shadow-none dark:border-slate-800 dark:bg-slate-950/70';
const detailGroupClass = 'rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] p-4 dark:border-slate-800 dark:bg-slate-900/70';
const detailNoteClass = 'rounded-lg border border-[#E5E7EB] bg-white p-4 dark:border-slate-700 dark:bg-slate-950/60';

const getStatusClassName = (value: Nullable<string>) => {
  if (value === 'SHIPPED' || value === 'PAID' || value === 'CONFIRMED' || value === 'COMPLETED' || value === 'COUNTER_SIGNED') {
    return 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300';
  }
  if (value === 'DRAFT' || value === 'NOT_SENT') {
    return 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300';
  }
  if (value === 'PENDING_APPROVAL' || value === 'PENDING_BUYER_SIGNATURE' || value === 'PENDING_CANCEL_APPROVAL' || value === 'PENDING_BUYER') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300';
  }
  if (value === 'APPROVED' || value === 'BUYER_SIGNED') {
    return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
  }
  if (value === 'REJECTED' || value === 'CANCELLED') {
    return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300';
  }
  return 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300';
};

const StatusPill: React.FC<{ value: Nullable<string> }> = ({ value }) => (
  <span className={`inline-flex max-w-full items-center rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusClassName(value)}`}>
    <span className="truncate">{value || '-'}</span>
  </span>
);

interface InfoTileProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

const InfoTile: React.FC<InfoTileProps> = ({ label, children, className }) => (
  <div className={`flex min-w-0 flex-col gap-1 ${className || ''}`}>
    <span className="text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
      {label}
    </span>
    <div className="min-w-0 text-sm font-semibold text-gray-900 dark:text-slate-100">
      {children}
    </div>
  </div>
);

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

  const currencyCode = data?.currencyCode || 'VND';

  const itemColumns = useMemo<ColumnsType<SalesContractItem>>(() => [
    {
      title: 'Sản phẩm',
      key: 'product',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.product?.vietnameseName || record.product?.name || 'N/A'}</Text>
          {record.product?.sku ? (
            <Text type="secondary" className="text-xs">
              [{record.product.sku}]
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
      width: 104,
      render: (value: number | null) => value || 0,
    },
    {
      title: 'Đơn giá',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right',
      width: 148,
      render: (value: number | null) => formatMoney(Number(value || 0), currencyCode),
    },
    {
      title: 'Thành tiền',
      key: 'total',
      align: 'right',
      width: 168,
      render: (_, record) => {
        const total = Number(record.totalPrice || 0) || Number(record.quantity || 0) * Number(record.unitPrice || 0);
        return <Text strong>{formatMoney(total, currencyCode)}</Text>;
      },
    },
  ], [currencyCode, formatMoney]);

  const signatureColumns = useMemo<ColumnsType<SalesContractSignature>>(() => [
    {
      title: 'Bên ký',
      dataIndex: 'signerType',
      key: 'signerType',
      width: 140,
      render: (value: string | null) => (
        <Tag color={getSignatureColor(value)}>{value || '-'}</Tag>
      ),
    },
    {
      title: 'Người ký',
      key: 'signer',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.signerName || '-'}</Text>
          <Text type="secondary" className="text-xs">
            {record.signerTitle || record.signerEmail || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Thời điểm',
      dataIndex: 'signedAt',
      key: 'signedAt',
      width: 180,
      render: (value: string | null) => formatDateTime(value),
    },
  ], []);

  const invitationColumns = useMemo<ColumnsType<SalesContractInvitation>>(() => [
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (value: string | null) => (
        <Tag color={getInvitationColor(value)}>{value || '-'}</Tag>
      ),
    },
    {
      title: 'Người nhận',
      key: 'signer',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.signerName || '-'}</Text>
          <Text type="secondary" className="text-xs">
            {record.signerEmail || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Hết hạn',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 180,
      render: (value: string | null) => formatDateTime(value),
    },
    {
      title: 'Certificate',
      dataIndex: 'certificateNumber',
      key: 'certificateNumber',
      width: 180,
      render: (value: string | null) => value || '-',
    },
  ], []);

  if (!data) return null;

  const logisticsRows = [
    ['Vận tải nội địa', data.domesticTransportCost],
    ['Phí cảng', data.portCharges],
    ['Cước tàu', data.seaFreight],
    ['Bảo hiểm', data.insuranceCost],
    ['Phí logistics', data.logisticsFee],
    ['Phí khác', data.otherFee],
  ] as const;

  const emptyText = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có dữ liệu" />;

  return (
    <Modal
      title={(
        <Space>
          <FileProtectOutlined className="text-blue-500" />
          <span>Chi tiết hợp đồng: {data.contractNumber || '-'}</span>
        </Space>
      )}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={1120}
      centered={false}
      destroyOnHidden
      style={{ top: 24 }}
      styles={{
        body: {
          padding: 0,
          maxHeight: 'calc(100vh - 112px)',
          overflowY: 'auto',
        },
      }}
    >
      <Tabs
        defaultActiveKey="overview"
        className="px-6 pb-6"
        tabBarStyle={{ marginBottom: 20 }}
        items={[
          {
            key: 'overview',
            label: <span className="font-semibold">Tổng quan</span>,
            children: (
              <Row gutter={[20, 20]}>
                <Col xs={24} lg={15}>
                  <Card
                    title="Thông tin chung"
                    variant="borderless"
                    className={detailCardClass}
                    styles={{ body: { padding: 20 } }}
                  >
                    <div className={detailGroupClass}>
                      <div className="flex flex-wrap items-center gap-2">
                        <UserOutlined className="text-gray-500" />
                        <Text strong className="text-gray-900 dark:text-slate-100">{data.buyer?.name || '-'}</Text>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                          {data.buyer?.country || '-'}
                        </span>
                      </div>

                      <Divider className="my-4 border-[#E5E7EB] dark:border-slate-800" />

                      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                        <InfoTile label="Ngày tạo">
                          {formatDateTime(data.createdAt)}
                        </InfoTile>
                        <InfoTile label="Trạng thái">
                          <StatusPill value={data.status} />
                        </InfoTile>
                        <InfoTile label="Incoterms">
                          <span className="rounded-md bg-pink-50 px-2 py-0.5 text-xs font-semibold text-pink-700 dark:bg-pink-950/50 dark:text-pink-300">
                            {data.incoterm || '-'}
                          </span>
                        </InfoTile>
                        <InfoTile label="Tiền tệ">
                          <span className="break-words">{currencyCode} · Tỷ giá {data.exchangeRate || 1}</span>
                        </InfoTile>
                        <InfoTile label="Cảng đi POL">
                          {data.pol || '-'}
                        </InfoTile>
                        <InfoTile label="Cảng đến POD">
                          {data.pod || '-'}
                        </InfoTile>
                        <InfoTile label="Số Booking" className="sm:col-span-2">
                          {data.bookingNumber || '-'}
                        </InfoTile>
                      </div>
                    </div>
                  </Card>

                  <Card
                    title="Danh sách hàng hóa"
                    variant="borderless"
                    className={`mt-5 ${detailCardClass}`}
                    styles={{ body: { padding: 20 } }}
                  >
                    <Table
                      dataSource={data.items || []}
                      columns={itemColumns}
                      pagination={false}
                      rowKey={(record) => record._id || record.product?.sku || `${record.product?.name || 'item'}-${record.quantity || 0}`}
                      size="small"
                      locale={{ emptyText }}
                      tableLayout="fixed"
                      footer={() => (
                        <div className="flex flex-wrap justify-end gap-4">
                          <Text>Tổng trị giá hàng hóa:</Text>
                          <Text strong className="text-blue-700 dark:text-blue-300">
                            {formatMoney(Number(data.totalAmount || 0), currencyCode)}
                          </Text>
                        </div>
                      )}
                    />
                  </Card>
                </Col>

                <Col xs={24} lg={9}>
                  <Space orientation="vertical" className="w-full" size={20}>
                  <Card
                    title="Chi phí logistics"
                    variant="borderless"
                    className={detailCardClass}
                    styles={{ body: { padding: 20 } }}
                  >
                    <Space orientation="vertical" className="w-full" size="middle">
                      {logisticsRows.map(([label, value]) => (
                        <div className="flex justify-between gap-4" key={label}>
                          <Text className="text-gray-500 dark:text-slate-400">{label}:</Text>
                          <Text strong className="text-gray-900 dark:text-slate-100">{formatMoney(Number(value || 0), currencyCode)}</Text>
                        </div>
                      ))}
                      <Divider className="my-2" />
                      <div className="rounded-lg border border-sky-100 bg-sky-50 p-4 text-right dark:border-sky-900/60 dark:bg-sky-950/30">
                        <Text strong className="text-xs text-gray-600 dark:text-slate-300">TỔNG GIÁ TRỊ (VND)</Text>
                        <Title level={3} className="!mb-0 !mt-2 !text-[26px] !leading-tight text-gray-950 dark:text-white">
                          {formatVND(Number(data.totalAmountVnd || 0))}
                        </Title>
                      </div>
                    </Space>
                  </Card>

                  <Card
                    title="Điều khoản & ghi chú"
                    variant="borderless"
                    className={detailCardClass}
                    styles={{ body: { padding: 20 } }}
                  >
                    <Space orientation="vertical" className="w-full" size={14}>
                      <InfoTile label="Thời hạn giao hàng">
                        {formatDate(data.deliveryDate)}
                      </InfoTile>
                      <InfoTile label="Thời hạn hiệu lực">
                        {formatDate(data.validUntil)}
                      </InfoTile>
                      <InfoTile label="Điều khoản thanh toán">
                        {data.paymentTerms || 'T/T 100%'}
                      </InfoTile>
                      <Divider className="my-2" />
                      <div className={detailNoteClass}>
                        <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Ghi chú</span>
                        <Paragraph className="mb-0 italic text-slate-700 dark:text-slate-200">
                          {data.notes || 'Không có ghi chú'}
                        </Paragraph>
                      </div>
                    </Space>
                  </Card>
                  </Space>
                </Col>
              </Row>
            ),
          },
          {
            key: 'approval',
            label: <span className="font-semibold">Approval & E-sign</span>,
            children: (
              <Space orientation="vertical" className="w-full" size="large">
                <Row gutter={[20, 20]}>
                  <Col xs={24} lg={11}>
                    <Card
                      title="Trạng thái phê duyệt"
                      variant="borderless"
                      className={`h-full ${detailCardClass}`}
                      styles={{ body: { padding: 20 } }}
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                        <InfoTile label="Người gửi duyệt">
                          {(data as any).submittedForApprovalByName || data.submittedForApprovalByUsername || '-'}
                        </InfoTile>
                        <InfoTile label="Người duyệt">
                          {(data as any).approvedByName || data.approvedByUsername || '-'}
                        </InfoTile>
                        <InfoTile label="Trạng thái ký">
                          <StatusPill value={data.signatureStatus || 'NOT_SENT'} />
                        </InfoTile>
                      </div>
                    </Card>
                  </Col>

                  <Col xs={24} lg={13}>
                    <Card
                      title="Audit packet"
                      variant="borderless"
                      className={`h-full ${detailCardClass}`}
                      styles={{ body: { padding: 20 } }}
                    >
                      <Space orientation="vertical" className="w-full" size={12}>
                        <InfoTile label="Hash chứng từ">
                          <Paragraph copyable={!!data.signatureDocumentHash} className="mb-0 break-all text-xs">
                            {data.signatureDocumentHash || '-'}
                          </Paragraph>
                        </InfoTile>
                        <InfoTile label="Packet hash">
                          <Paragraph copyable={!!auditPacket?.certificate?.packetHash} className="mb-0 break-all text-xs">
                            {auditPacket?.certificate?.packetHash || '-'}
                          </Paragraph>
                        </InfoTile>
                        <InfoTile label="Certificate">
                          {auditPacket?.certificate?.certificateNumber || '-'}
                        </InfoTile>
                      </Space>
                    </Card>
                  </Col>
                </Row>

                <Card title="Chữ ký hợp đồng" variant="borderless" className={detailCardClass} styles={{ body: { padding: 20 } }}>
                  <Table
                    dataSource={data.signatures || []}
                    columns={signatureColumns}
                    pagination={false}
                    size="small"
                    rowKey={(record) => record._id || `${record.signerType || 'signer'}-${record.signedAt || record.signerEmail || 'pending'}`}
                    scroll={{ x: 560 }}
                    locale={{ emptyText }}
                  />
                </Card>

                <Card title="Vòng đời lời mời ký" variant="borderless" className={detailCardClass} styles={{ body: { padding: 20 } }}>
                  <Table
                    dataSource={data.signatureInvitations || []}
                    columns={invitationColumns}
                    pagination={false}
                    size="small"
                    rowKey={(record) => record._id || `${record.signerEmail || 'invitation'}-${record.expiresAt || 'open'}`}
                    scroll={{ x: 720 }}
                    locale={{ emptyText }}
                  />
                </Card>

                <Card title="Audit trail" variant="borderless" className={detailCardClass} styles={{ body: { padding: 20 } }}>
                  {auditPacket?.timeline?.length ? (
                    <Timeline
                      items={auditPacket.timeline.slice(-10).map((event) => ({
                        content: (
                          <Space orientation="vertical" size={0}>
                            <Text strong>{event.action}</Text>
                            <Text type="secondary" className="text-xs">
                              {formatDateTime(event.at)} · {event.actor || 'portal'}{event.note ? ` · ${event.note}` : ''}
                            </Text>
                          </Space>
                        ),
                      }))}
                    />
                  ) : (
                    emptyText
                  )}
                </Card>
              </Space>
            ),
          },
        ]}
      />
    </Modal>
  );
};

export default SalesContractDetailModal;
