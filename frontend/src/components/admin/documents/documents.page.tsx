'use client'

import {
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Row,
  Select,
  Table,
  Tag,
  Typography,
  Input,
  Badge,
  App,
  Space,
} from 'antd';
import {
  FileTextOutlined,
  FileDoneOutlined,
  FilePdfOutlined,
  PrinterOutlined,
  EyeOutlined,
  AuditOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { useReactToPrint } from 'react-to-print';
import ShipmentDocCenter from '../shipment/shipment.doc-center';

const { Text } = Typography;

const DOC_STATUS_COLOR: Record<string, string> = {
  BOOKED: 'blue', LOADING: 'orange', CUSTOMS_CLEARED: 'cyan',
  ON_BOARD: 'geekblue', ARRIVED: 'green', CLOSED: 'default',
};
const DOC_STATUS_LABEL: Record<string, string> = {
  BOOKED: 'Đã book tàu', LOADING: 'Đang đóng hàng', CUSTOMS_CLEARED: 'Đã thông quan',
  ON_BOARD: 'Tàu đã chạy', ARRIVED: 'Tàu đã cập cảng', CLOSED: 'Hoàn tất',
};

const DocumentsPage = () => {
  const { notification } = App.useApp();
  const { data: session } = useSession();
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [docCenterOpen, setDocCenterOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);

  const printCIRef = useRef<HTMLDivElement>(null);
  const printPLRef = useRef<HTMLDivElement>(null);

  const handlePrintCI = useReactToPrint({
    contentRef: printCIRef,
    documentTitle: `CI_${selected?.shipmentNumber || 'export'}`,
  });
  const handlePrintPL = useReactToPrint({
    contentRef: printPLRef,
    documentTitle: `PL_${selected?.shipmentNumber || 'export'}`,
  });

  const handleDownloadOfficialPdf = async (type: 'CI' | 'PL') => {
    if (!selected || !session) return;
    const accessToken = (session as any)?.access_token;
    
    notification.info({ title: 'Đang tạo bản PDF chính thức...' });
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/export-documents/download/${selected.id}/${type}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      
      if (!response.ok) throw new Error('Không thể tải file');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${selected.shipmentNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      notification.success({ title: `Đã tải xuống bản chính thức (${type})` });
    } catch (error: any) {
      notification.error({ title: 'Lỗi tải PDF', description: error.message });
    }
  };

  const fetchShipments = async () => {
    const accessToken = session?.access_token;
    if (!accessToken) return;

    setLoading(true);
    const res = await sendRequest<IBackendRes<IModelPaginate<any>>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments`,
      method: 'GET',
      queryParams: {
        current: 1,
        pageSize: 50,
        ...(searchText ? { shipmentNumber: `/${searchText}/i` } : {}),
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) setShipments(res.data.results ?? []);
    setLoading(false);
  };

  useEffect(() => { 
    if (session) fetchShipments(); 
  }, [searchText, session]);

  const handleOpenDetail = async (record: any) => {
    const accessToken = session?.access_token;
    if (!accessToken) return;

    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${record.id}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      setSelected(res.data);
      setDocCenterOpen(true);
    }
  };

  const columns = [
    {
      title: 'Số Lô Hàng',
      dataIndex: 'shipmentNumber',
      render: (v: string) => <Text strong style={{ color: '#096dd9' }}>{v}</Text>,
    },
    {
      title: 'Tuyến',
      render: (_: any, r: any) => <Text>{r.pol ?? '?'} → {r.pod ?? '?'}</Text>,
    },
    {
      title: 'PI / Khách hàng',
      render: (_: any, r: any) => {
        const pi = r.proformaInvoice || r.salesContract?.proformaInvoice;
        return (
          <div>
            <Tag color="purple">{pi?.piNumber ?? '-'}</Tag>
            <div><Text type="secondary" style={{ fontSize: 12 }}>{pi?.customer?.name || r.salesContract?.buyer?.name || '-'}</Text></div>
          </div>
        );
      },
    },
    {
      title: 'ETD',
      dataIndex: 'etd',
      render: (v: string) => v ? new Date(v).toLocaleDateString('vi-VN') : '-',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v: string) => <Tag color={DOC_STATUS_COLOR[v] ?? 'default'}>{DOC_STATUS_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Xuất chứng từ',
      key: 'action',
      render: (_: any, record: any) => (
        <Button
          size="small"
          type="primary"
          icon={<FilePdfOutlined />}
          onClick={() => {
            setSelectedShipmentId(record.id);
            setDocCenterOpen(true);
          }}
        >
          Xem & Xuất
        </Button>
      ),
    },
  ];

  const pi = selected?.proformaInvoice;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <PageHeader 
            title="Chứng Từ Xuất Khẩu" 
            icon={<FilePdfOutlined />} 
            description="Quản lý và in ấn bộ chứng từ xuất khẩu (INV, PKL, BL...)" 
          />
          <Text type="secondary">Xuất Commercial Invoice (CI) và Packing List (PL) từ dữ liệu lô hàng</Text>
        </div>
        <Input.Search
          placeholder="Tìm theo số lô hàng..."
          allowClear
          onSearch={setSearchText}
          style={{ width: 220 }}
        />
      </div>

      <Table
        rowKey="id"
        bordered
        dataSource={shipments}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 15, showTotal: (t, r) => `${r[0]}-${r[1]} / ${t} lô hàng` }}
      />

      <ShipmentDocCenter 
        open={docCenterOpen}
        onClose={() => {
          setDocCenterOpen(false);
          setSelectedShipmentId(null);
        }}
        shipmentId={selectedShipmentId}
        session={session}
      />
    </div>
  );
};

export default DocumentsPage;
