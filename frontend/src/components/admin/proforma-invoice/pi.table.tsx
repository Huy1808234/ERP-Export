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
  theme,
} from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  FileDoneOutlined,
  ThunderboltOutlined,
  ShoppingCartOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { PageHeader } from '@/components/ui/PageHeader';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/context/theme.context';
import ProformaInvoiceDetailModal from './pi.detail';
import PIFromQuotationModal from './pi.from-quotation';
import POFromPIModal from '../purchase-order/po.from-pi';
import ShipmentFromPIModal from '../shipment/shipment.from-pi';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

type ProformaInvoiceRow = {
  status?: string;
  depositPercent?: number | string | null;
  depositAmount?: number | string | null;
  isPaid?: boolean | null;
};

const ProformaInvoiceTable = () => {
  const { notification } = App.useApp();
  const { token } = theme.useToken();
  const { isDark } = useTheme();
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

  const t = useTranslations('ProformaInvoice');
  const tCommon = useTranslations('Common');
  const { current, pageSize } = meta;

  const PI_STATUS_COLOR: Record<string, string> = {
    DRAFT: 'default',
    PENDING_APPROVAL: 'processing',
    SENT: 'blue',
    ACCEPTED: 'success',
    DEPOSIT_RECEIVED: 'gold',
    CONFIRMED: 'success',
    REJECTED: 'error',
    CANCELLED: 'error',
  };

  const fetchPIs = useCallback(async () => {
    const currentSession = await getSession();
    const headers = { Authorization: `Bearer ${getAccessToken(currentSession)}` };

    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/proforma-invoices`,
      method: 'GET',
      queryParams: {
        current,
        pageSize,
        populate: 'customer,createdBy,quotation,salesContract',
        ...(searchText ? { piNumber: `/${searchText}/i` } : {})
      },
      headers,
    });

    if (res?.data) {
      setPiList(res.data.results);
      setMeta(prev => ({ ...prev, total: res.data.meta.total }));
    }
  }, [current, pageSize, searchText]);

  const fetchQuotations = useCallback(async () => {
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations`,
      method: 'GET',
      queryParams: { current: 1, pageSize: 100, status: 'SENT' },
      headers: { Authorization: `Bearer ${getAccessToken(currentSession)}` },
    });
    if (res?.data) setQuotations(res.data.results ?? []);
  }, []);

  useEffect(() => {
    fetchPIs();
    fetchQuotations();
  }, [fetchPIs, fetchQuotations]);

  const confirmDelete = async (id: string) => {
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/proforma-invoices/${id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getAccessToken(currentSession)}` },
    });
    if (res?.data) {
      notification.success({ title: t('table.deleteSuccess') });
      fetchPIs();
    } else {
      notification.error({ title: t('table.error'), description: res?.message });
    }
  };

  const handleStatusChange = async (recordId: string, status: string) => {
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/proforma-invoices/${recordId}/status`,
      method: 'PATCH',
      body: { status },
      headers: { Authorization: `Bearer ${getAccessToken(currentSession)}` },
    });

    if (res?.data) {
      const nextStatus = res.data.status;
      notification.success({
        title:
          nextStatus === 'PENDING_APPROVAL'
            ? t('table.submitApprovalSuccess')
            : t('table.statusUpdateSuccess'),
      });
      fetchPIs();
    } else {
      notification.error({ title: t('table.error'), description: res?.message });
    }
  };

  const handleOpenFromQuotation = (qt: any) => {
    setSelectedQuotation(qt);
    setFromQuotationOpen(true);
  };

  const getCreatePoBlockReason = (record: ProformaInvoiceRow): string | null => {
    if (record.status !== 'ACCEPTED') {
      return 'Chỉ tạo PO NCC sau khi PI đã được khách chấp nhận (ACCEPTED).';
    }

    const requiresDeposit =
      Number(record.depositPercent || 0) > 0 || Number(record.depositAmount || 0) > 0;
    if (requiresDeposit && !record.isPaid) {
      return 'PI có điều kiện cọc/thanh toán. Vui lòng xác nhận đã nhận cọc trước khi tạo PO NCC.';
    }

    return null;
  };

  const openCreatePOFromPI = (record: ProformaInvoiceRow) => {
    const blockReason = getCreatePoBlockReason(record);
    if (blockReason) {
      notification.warning({ title: 'Chưa đủ điều kiện tạo PO', description: blockReason });
      return;
    }
    setSelectedPI(record);
    setFromPIOpen(true);
  };

  const columns = [
    {
      title: t('table.piNumber'),
      dataIndex: 'piNumber',
      key: 'piNumber',
      render: (v: string) => <Text strong style={{ color: '#722ed1' }}>{v}</Text>,
    },
    {
      title: t('table.customer'),
      dataIndex: 'customer',
      key: 'customer',
      render: (c: any) => c?.name ?? '-',
    },
    {
      title: t('table.incoterm'),
      dataIndex: 'incoterm',
      key: 'incoterm',
      render: (v: string) => <Tag color="geekblue">{v}</Tag>,
    },
    {
      title: t('table.total'),
      key: 'total',
      render: (_: any, r: any) => (
        <Text strong>
          {formatMoney(r.totalAmount, r.currency)}
        </Text>
      ),
    },
    {
      title: t('table.deposit'),
      key: 'deposit',
      render: (_: any, r: any) => (
        <Text style={{ color: '#fa8c16' }}>
          {r.depositPercent}% — {formatMoney(r.depositAmount, r.currency)}
        </Text>
      ),
    },
    {
      title: t('table.contract'),
      dataIndex: 'salesContract',
      key: 'salesContract',
      render: (sc: any) => sc ? <Tag color="purple">{sc.contractNumber}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: t('table.issueDate'),
      dataIndex: 'issueDate',
      render: (v: string) => formatDate(v),
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      render: (v: string) => {
        const statusKey = `status.${v}`;
        return (
          <Tag color={PI_STATUS_COLOR[v] ?? 'default'}>
            {t.has(statusKey) ? t(statusKey) : v}
          </Tag>
        );
      },
    },
    {
      title: t('table.actions'),
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          {['DRAFT', 'REJECTED'].includes(record.status) && (
            <Tooltip title={t('table.submitApprovalHint')}>
              <Button
                size="small"
                icon={<SendOutlined />}
                onClick={() => handleStatusChange(record._id, 'SENT')}
                style={{ color: '#52c41a', borderColor: '#52c41a' }}
              >
                {t('table.submitApproval')}
              </Button>
            </Tooltip>
          )}
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => { setSelectedPI(record); setDetailOpen(true); }}
          >
            {t('table.view')}
          </Button>
          <Tooltip
            title={
              getCreatePoBlockReason(record) ?? t('table.createPoHint')
            }
          >
            <Button
              size="small"
              icon={<ShoppingCartOutlined />}
              disabled={!!getCreatePoBlockReason(record)}
              style={{
                color: !getCreatePoBlockReason(record)
                  ? '#13c2c2'
                  : undefined,
                borderColor: !getCreatePoBlockReason(record)
                  ? '#13c2c2'
                  : undefined,
              }}
              onClick={() => openCreatePOFromPI(record)}
            >
              {t('table.createPo')}
            </Button>
          </Tooltip>
          <Popconfirm
            title={t('table.deleteTitle')}
            description={t('table.deleteConfirm')}
            onConfirm={() => confirmDelete(record._id)}
            okText={tCommon('confirm')}
            cancelText={tCommon('cancel')}
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
          title={t('title')}
          icon={<FileDoneOutlined />}
          description={t('description')}
        />
        <Space>
          <Input.Search
            placeholder={t('table.searchPlaceholder')}
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
                <Tooltip key={qt._id} title={t('table.createFromQuotation', { number: qt.quotationNumber })}>
                  <Button
                    icon={<ThunderboltOutlined />}
                    style={{ borderColor: '#722ed1', color: '#722ed1' }}
                    size="small"
                    onClick={() => handleOpenFromQuotation(qt)}
                  >
                    {t('table.createFromQuotation', { number: qt.quotationNumber })}
                  </Button>
                </Tooltip>
              ))}
            </div>
          )}
        </Space>
      </div>

      <div className="premium-table">
        <Table
          rowKey={(record: any) => record._id || record.piNumber}
          dataSource={piList}
          columns={columns}
          scroll={{ x: 'max-content' }}
          onChange={p => setMeta(prev => ({ ...prev, current: p.current!, pageSize: p.pageSize! }))}
          pagination={{
            current: meta.current,
            pageSize: meta.pageSize,
            total: meta.total,
            showSizeChanger: true,
            showTotal: (total, range) => t('table.totalCount', { start: range[0], end: range[1], total }),
          }}
        />
      </div>

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
          onSuccess={fetchPIs}
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

      <style jsx global>{`
        .premium-table {
          max-width: 100%;
          overflow: hidden;
        }
        .premium-table .ant-table {
          background: transparent !important;
        }
        .premium-table .ant-table-thead > tr > th {
          background: ${isDark ? 'rgba(30, 41, 59, 0.5)' : '#fafafa'} !important;
          color: ${isDark ? '#94a3b8' : '#595959'} !important;
          font-weight: 600 !important;
          border-bottom: 1px solid ${isDark ? '#334155' : '#f0f0f0'} !important;
        }
        .premium-table .ant-table-tbody > tr > td {
          background: transparent !important;
          color: ${isDark ? '#e2e8f0' : token.colorText} !important;
          border-bottom: 1px solid ${isDark ? '#334155' : '#f0f0f0'} !important;
        }
        .premium-table .ant-table-tbody > tr:hover > td {
          background: ${isDark ? 'rgba(51, 65, 85, 0.45)' : '#f8fafc'} !important;
        }
        .premium-table .ant-table-placeholder {
          background: transparent !important;
        }
        .premium-table .ant-empty-description {
          color: ${isDark ? '#94a3b8' : '#595959'} !important;
        }
      `}</style>
    </>
  );
};

export default ProformaInvoiceTable;
