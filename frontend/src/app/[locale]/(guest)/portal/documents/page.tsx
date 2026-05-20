'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Empty, Input, Space, Table, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DownloadOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import PageBanner from '@/components/guest/PageBanner';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

interface PortalDocument {
  _id: string;
  documentType: string;
  documentNumber?: string | null;
  versionNo: number;
  checklistStatus: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  sharedAt?: string | null;
  downloadCount?: number;
  shipment?: {
    _id: string;
    shipmentNumber?: string | null;
    status?: string | null;
    pol?: string | null;
    pod?: string | null;
    salesContract?: {
      contractNumber?: string | null;
    } | null;
  } | null;
}

const typeLabel: Record<string, string> = {
  COMMERCIAL_INVOICE: 'Commercial Invoice',
  PACKING_LIST: 'Packing List',
  BILL_OF_LADING: 'Bill of Lading',
  AIRWAY_BILL: 'Airway Bill',
  CERTIFICATE_OF_ORIGIN: 'Certificate of Origin',
  CUSTOMS_DECLARATION: 'Customs Declaration',
  PACKING_DECLARATION: 'Packing Declaration',
  PHYTOSANITARY_CERTIFICATE: 'Phytosanitary Certificate',
  HEALTH_CERTIFICATE: 'Health Certificate',
  FUMIGATION_CERTIFICATE: 'Fumigation Certificate',
  QUALITY_INSPECTION_CERTIFICATE: 'Quality Inspection Certificate',
  VAT_REFUND_DOSSIER: 'VAT Refund Dossier',
  OTHER: 'Other document',
};

const statusColor: Record<string, string> = {
  UPLOADED: 'blue',
  GENERATED: 'cyan',
  REVIEWED: 'purple',
  APPROVED: 'green',
};

const formatFileSize = (value?: number | null) => {
  if (!value) return '-';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};

const resolveFileName = (record: PortalDocument, disposition: string | null) => {
  const encodedName = disposition?.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  const quotedName = disposition?.match(/filename="?([^";]+)"?/)?.[1];
  const rawName = encodedName || quotedName;

  if (rawName) {
    try {
      return decodeURIComponent(rawName);
    } catch {
      return rawName;
    }
  }

  return record.fileName || `${record.documentType}_${record.shipment?.shipmentNumber || record._id}.pdf`;
};

const DocumentPortal = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);

  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const fetchDocuments = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<PortalDocument[]>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/export-documents/portal`,
        method: 'GET',
        headers,
      });
      setDocuments(res?.data ?? []);
    } catch {
      message.error('Không tải được danh sách chứng từ');
    } finally {
      setLoading(false);
    }
  }, [headers, message]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const filteredDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return documents;

    return documents.filter((doc) => (
      doc.documentType.toLowerCase().includes(keyword)
      || doc.documentNumber?.toLowerCase().includes(keyword)
      || doc.fileName?.toLowerCase().includes(keyword)
      || doc.shipment?.shipmentNumber?.toLowerCase().includes(keyword)
      || doc.shipment?.salesContract?.contractNumber?.toLowerCase().includes(keyword)
    ));
  }, [documents, search]);

  const downloadDocument = async (record: PortalDocument) => {
    if (!accessToken) return;

    setDownloadingKey(record._id);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/export-documents/portal/${record._id}/download`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.ok) {
        message.error('Không tải được chứng từ');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = resolveFileName(record, response.headers.get('Content-Disposition'));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Đã tải chứng từ');
      fetchDocuments();
    } finally {
      setDownloadingKey(null);
    }
  };

  const columns: ColumnsType<PortalDocument> = [
    {
      title: 'Tên chứng từ',
      key: 'document',
      render: (_, record) => (
        <Space>
          {record.mimeType?.startsWith('image/') ? (
            <FileTextOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
          ) : (
            <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
          )}
          <div>
            <Text strong>{typeLabel[record.documentType] || record.documentType}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.documentNumber || record.fileName || `v${record.versionNo}`}
              </Text>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Lô hàng',
      key: 'shipment',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Tag color="blue">{record.shipment?.shipmentNumber || '-'}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.shipment?.pol || '?'} {'->'} {record.shipment?.pod || '?'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Hợp đồng',
      key: 'contract',
      render: (_, record) => record.shipment?.salesContract?.contractNumber || '-',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'checklistStatus',
      key: 'status',
      render: (status: string) => <Tag color={statusColor[status] || 'default'}>{status}</Tag>,
    },
    {
      title: 'Ngày chia sẻ',
      dataIndex: 'sharedAt',
      key: 'sharedAt',
      render: (date?: string | null) => date ? new Date(date).toLocaleDateString('vi-VN') : '-',
    },
    {
      title: 'Dung lượng',
      dataIndex: 'fileSize',
      key: 'fileSize',
      render: formatFileSize,
    },
    {
      title: 'Lượt tải',
      dataIndex: 'downloadCount',
      key: 'downloadCount',
      render: (value?: number) => value ?? 0,
    },
    {
      title: 'Tải về',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          loading={downloadingKey === record._id}
          onClick={() => downloadDocument(record)}
        >
          Tải
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ margin: '-40px -40px 32px -40px', overflow: 'hidden', borderRadius: '24px 24px 0 0' }}>
        <PageBanner
          title="Trung tâm chứng từ"
          subtitle="Tải bộ chứng từ gốc đã được chia sẻ cho từng lô hàng xuất khẩu."
          height="200px"
          breadcrumbs={[{ title: 'Portal', href: '/portal' }, { title: 'Chứng từ' }]}
        >
          <div style={{ marginTop: 20 }}>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm chứng từ, lô hàng, hợp đồng..."
              prefix={<SearchOutlined />}
              style={{ width: 360, borderRadius: 12, height: 45 }}
            />
          </div>
        </PageBanner>
      </div>

      <Card
        bordered={false}
        style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}
        extra={(
          <Button icon={<SyncOutlined />} onClick={fetchDocuments}>
            Làm mới
          </Button>
        )}
      >
        <Table<PortalDocument>
          rowKey="_id"
          dataSource={filteredDocuments}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: <Empty description="Chưa có chứng từ được chia sẻ" /> }}
          scroll={{ x: 980 }}
        />
      </Card>
    </div>
  );
};

export default DocumentPortal;
