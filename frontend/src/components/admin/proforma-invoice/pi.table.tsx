'use client'

import {
  Button,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Input,
  App,
} from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  FileDoneOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  ShoppingCartOutlined,
  TruckOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { formatDate } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { PageHeader } from '@/components/ui/PageHeader';
import ProformaInvoiceDetailModal from './pi.detail';
import PIFromQuotationModal from './pi.from-quotation';
import POFromPIModal from '../purchase-order/po.from-pi';
import ShipmentFromPIModal from '../shipment/shipment.from-pi';

const { Text } = Typography;

const PI_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default',
  SENT: 'blue',
  DEPOSIT_RECEIVED: 'gold',
  CONFIRMED: 'success',
  CANCELLED: 'error',
};

const PI_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  SENT: 'Đã gửi',
  DEPOSIT_RECEIVED: 'Đã nhận cọc',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
};

const ProformaInvoiceTable = () => {
  const { notification } = App.useApp();
  const { formatMoney } = useCurrency();
  const [piList, setPiList] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [meta, setMeta] = useState({ current: 1, pageSize: 10, total: 0 });

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPI, setSelectedPI] = useState<any>(null);

  const [fromQuotationOpen, setFromQuotationOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);

  const [fromPIOpen, setFromPIOpen] = useState(false);
  const [fromPIShipmentOpen, setFromPIShipmentOpen] = useState(false);
  const [searchText, setSearchText] = useState<string>("");

  const fetchPIs = async () => {
    const currentSession = await getSession();
    const headers = { Authorization: `Bearer ${currentSession?.user?.access_token}` };

    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/proforma-invoices`,
      method: 'GET',
      queryParams: { 
        current: meta.current, 
        pageSize: meta.pageSize, 
        populate: 'customer,createdBy,quotation,salesContract',
        ...(searchText ? { piNumber: `/${searchText}/i` } : {}) 
      },
      headers,
    });

    if (res?.data) {
      setPiList(res.data.results);
      setMeta(prev => ({ ...prev, total: res.data.meta.total }));
    }
  };

  const fetchQuotations = async () => {
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations`,
      method: 'GET',
      queryParams: { current: 1, pageSize: 100, status: 'SENT' },
      headers: { Authorization: `Bearer ${currentSession?.user?.access_token}` },
    });
    if (res?.data) setQuotations(res.data.results ?? []);
  };

  useEffect(() => {
    fetchPIs();
    fetchQuotations();
  }, [meta.current, meta.pageSize, searchText]);

  const confirmDelete = async (id: string) => {
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/proforma-invoices/${id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentSession?.user?.access_token}` },
    });
    if (res?.data) {
      notification.success({ title: 'xóa pi thành công' });
      fetchPIs();
    } else {
      notification.error({ title: 'có lỗi xảy ra', description: res?.message });
    }
  };

  const handleOpenFromQuotation = (qt: any) => {
    setSelectedQuotation(qt);
    setFromQuotationOpen(true);
  };

  const columns = [
    {
      title: 'Số PI',
      dataIndex: 'piNumber',
      key: 'piNumber',
      render: (v: string) => <Text strong style={{ color: '#722ed1' }}>{v}</Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customer',
      key: 'customer',
      render: (c: any) => c?.name ?? '-',
    },
    {
      title: 'Incoterms',
      dataIndex: 'incoterm',
      key: 'incoterm',
      render: (v: string) => <Tag color="geekblue">{v}</Tag>,
    },
    {
      title: 'Tổng tiền',
      key: 'total',
      render: (_: any, r: any) => (
        <Text strong>
          {formatMoney(r.totalAmount, r.currency)}
        </Text>
      ),
    },
    {
      title: 'Tiền cọc',
      key: 'deposit',
      render: (_: any, r: any) => (
        <Text style={{ color: '#fa8c16' }}>
          {r.depositPercent}% — {formatMoney(r.depositAmount, r.currency)}
        </Text>
      ),
    },
    {
      title: 'Hợp đồng',
      dataIndex: 'salesContract',
      key: 'salesContract',
      render: (sc: any) => sc ? <Tag color="purple">{sc.contractNumber}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Ngày phát hành',
      dataIndex: 'issueDate',
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v: string) => <Tag color={PI_STATUS_COLOR[v] ?? 'default'}>{PI_STATUS_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => { setSelectedPI(record); setDetailOpen(true); }}
          >
            Xem
          </Button>
          <Tooltip title="Lên đơn mua hàng nội địa (PO) gửi xưởng">
            <Button
              size="small"
              icon={<ShoppingCartOutlined />}
              style={{ color: '#13c2c2', borderColor: '#13c2c2' }}
              onClick={() => { setSelectedPI(record); setFromPIOpen(true); }}
            >
              Tạo PO
            </Button>
          </Tooltip>
          <Popconfirm
            title="Xóa PI này?"
            onConfirm={() => confirmDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <PageHeader 
          title="Proforma Invoice (PI)" 
          icon={<FileDoneOutlined />} 
          description="Hóa đơn chiếu lệ — căn cứ để khách chuyển tiền cọc" 
        />
        <Space>
          <Input.Search
            placeholder="Tìm theo số PI..."
            allowClear
            onSearch={(value) => {
              setSearchText(value);
              setMeta(prev => ({ ...prev, current: 1 }));
            }}
            style={{ width: 200 }}
          />
          {/* Dropdown tạo PI từ Quotation */}
          {quotations.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {quotations.slice(0, 3).map(qt => (
                <Tooltip key={qt.id} title={`Tạo PI từ ${qt.quotationNumber}`}>
                  <Button
                    icon={<ThunderboltOutlined />}
                    style={{ borderColor: '#722ed1', color: '#722ed1' }}
                    size="small"
                    onClick={() => handleOpenFromQuotation(qt)}
                  >
                    PI từ {qt.quotationNumber}
                  </Button>
                </Tooltip>
              ))}
            </div>
          )}
          <Button type="primary" icon={<PlusOutlined />} disabled>
            Tạo PI thủ công
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        bordered
        dataSource={piList}
        columns={columns}
        onChange={p => setMeta(prev => ({ ...prev, current: p.current!, pageSize: p.pageSize! }))}
        pagination={{
          current: meta.current,
          pageSize: meta.pageSize,
          total: meta.total,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} PI`,
        }}
      />

      <ProformaInvoiceDetailModal
        open={detailOpen}
        setOpen={setDetailOpen}
        piData={selectedPI}
        fetchPIs={fetchPIs}
      />

      {selectedQuotation && (
        <PIFromQuotationModal
          open={fromQuotationOpen}
          setOpen={setFromQuotationOpen}
          quotation={selectedQuotation}
          fetchPIs={fetchPIs}
        />
      )}

      {selectedPI && (
        <POFromPIModal
          open={fromPIOpen}
          setOpen={setFromPIOpen}
          pi={selectedPI}
        />
      )}

      {selectedPI && (
        <ShipmentFromPIModal
          open={fromPIShipmentOpen}
          setOpen={setFromPIShipmentOpen}
          pi={selectedPI}
        />
      )}
    </>
  );
};

export default ProformaInvoiceTable;
