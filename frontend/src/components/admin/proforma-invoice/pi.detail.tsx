'use client'

import {
  Button,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Steps,
  App,
  Spin,
} from 'antd';
import { FileDoneOutlined, PrinterOutlined, BlockOutlined, DashboardOutlined, ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import { getSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { useTranslations } from 'next-intl';

const { Text, Title } = Typography;

const PI_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default',
  SENT: 'blue',
  ACCEPTED: 'success',
  CANCELLED: 'error',
};

const PI_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  SENT: 'Đã gửi khách',
  ACCEPTED: 'Khách đã chấp nhận',
  CANCELLED: 'Đã hủy',
};

interface IProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  piData: any;
  fetchPIs?: () => void;
}

const ProformaInvoiceDetailModal = ({ open, setOpen, piData, fetchPIs }: IProps) => {
  const { notification } = App.useApp();
  const router = useRouter();
  const tInc = useTranslations('Incoterms');
  const printRef = useRef<HTMLDivElement>(null);

  const [fullData, setFullData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const displayData = fullData || piData;

  const fetchDetail = async () => {
    if (!piData?.id) return;
    setLoading(true);
    const currentSession = await getSession();
    const accessToken = (currentSession as any)?.user?.access_token;
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/proforma-invoices/${piData.id}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      setFullData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchDetail();
    } else {
      setFullData(null);
    }
  }, [open, piData?.id]);

  const logisticsFee = Number(displayData?.logisticsFee) || 0;
  const otherFee = Number(displayData?.otherFee) || 0;
  const totalAmount = Number(displayData?.totalAmount) || 0;
  const subtotalAmount = totalAmount - logisticsFee - otherFee;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `PI_${displayData?.piNumber || 'PDF'}`,
  });

  const handleUpdateStatus = async (status: string) => {
    if (!displayData?.id) return;

    const currentSession = await getSession();
    const accessToken = (currentSession as any)?.user?.access_token;
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/proforma-invoices/${displayData.id}/status`,
      method: 'PATCH',
      body: { status },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      notification.success({ title: 'Cập nhật trạng thái thành công' });
      if (fetchPIs) fetchPIs();
      setOpen(false);
    } else {
      notification.error({ title: 'Có lỗi xảy ra', description: res?.message });
    }
  };

  const handleCreateContract = async () => {
    if (!displayData?.id) return;
    setLoading(true);
    try {
      const currentSession = await getSession();
      const accessToken = (currentSession as any)?.user?.access_token;

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const contractNumber = `SC-${dateStr}-${randomStr}`;

      const payload = {
        contractNumber,
        buyerId: displayData.customerId,
        proformaInvoiceId: displayData.id,
        incoterm: displayData.incoterm,
        currencyCode: displayData.currency,
        exchangeRate: displayData.exchangeRate || 25000,
        domesticTransportCost: Number(displayData.logisticsFee) || 0,
        notes: `Tạo từ PI ${displayData.piNumber}`,
        items: (displayData.items || []).map((item: any) => ({
          productId: item.productId || item.product?.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: (item.quantity || 0) * (item.unitPrice || 0)
        }))
      };

      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts`,
        method: 'POST',
        body: payload,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({
          title: 'Tạo hợp đồng thành công',
          description: `Hợp đồng ${contractNumber} đã được khởi tạo. Đang chuyển hướng...`
        });
        setTimeout(() => {
          router.push('/dashboard/sales-contract');
        }, 1000);
      } else {
        notification.error({
          title: 'Tạo hợp đồng thất bại',
          description: res?.message || 'Vui lòng kiểm tra lại dữ liệu PI'
        });
      }
    } catch (error) {
      notification.error({ title: 'Lỗi hệ thống', description: 'Không thể kết nối tới máy chủ' });
    } finally {
      setLoading(false);
    }
  };

  const lineColumns = useMemo(() => [
    { title: 'STT', render: (_: any, __: any, i: number) => i + 1, width: 45 },
    {
      title: 'Sản phẩm',
      dataIndex: 'product',
      render: (p: any, record: any) => (
        <div>
          <Text strong>{record.productDescription || p?.vietnameseName}</Text>
          {p?.englishName && <div><Text type="secondary" style={{ fontSize: 12 }}>{p.englishName}</Text></div>}
        </div>
      ),
    },
    { title: 'HS Code', dataIndex: 'hsCode', width: 100, render: (v: string) => v ?? '-' },
    { title: 'SL', dataIndex: 'quantity', width: 70, render: (v: any) => parseFloat(v || 0).toLocaleString() },
    { title: 'ĐV', dataIndex: 'unit', width: 60 },
    {
      title: 'Số thùng',
      key: 'cartons',
      align: 'right' as const,
      width: 90,
      render: (_: any, record: any) => {
        const pcsPerCtn = record.product?.piecesPerCarton || 1;
        return (parseFloat(record.quantity || 0) / pcsPerCtn).toFixed(1);
      }
    },
    {
      title: 'G.W (Kg)',
      key: 'gw',
      align: 'right' as const,
      width: 100,
      render: (_: any, record: any) => {
        const pcsPerCtn = record.product?.piecesPerCarton || 1;
        const cartons = parseFloat(record.quantity || 0) / pcsPerCtn;
        return (cartons * (record.product?.grossWeightPerCarton || 0)).toFixed(2);
      }
    },
    {
      title: `Đơn giá (${displayData?.currency})`,
      dataIndex: 'unitPrice',
      width: 130,
      render: (v: any) => parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 4 }),
    },
    {
      title: 'Thành tiền',
      dataIndex: 'totalAmount',
      width: 150,
      render: (v: any) => (
        <Text strong style={{ color: '#1677ff' }}>
          {parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
  ], [displayData?.currency]);

  const getStep = (status: string) => {
    switch (status) {
      case 'DRAFT': return 0;
      case 'SENT': return 1;
      case 'ACCEPTED': return 2;
      default: return 0;
    }
  };

  const logisticsSummary = useMemo(() => {
    const items = displayData?.items || [];
    return items.reduce((acc: any, line: any) => {
      const p = line.product || {};
      const qty = parseFloat(line.quantity || 0);
      const pcsPerCtn = p.piecesPerCarton || 1;
      const cartons = qty / pcsPerCtn;
      const cbm = (p.cbmPerCarton || 0) * cartons;
      const gw = (p.grossWeightPerCarton || 0) * cartons;
      return {
        totalCBM: acc.totalCBM + cbm,
        totalGW: acc.totalGW + gw,
        totalCartons: acc.totalCartons + cartons,
      };
    }, { totalCBM: 0, totalGW: 0, totalCartons: 0 });
  }, [displayData?.items]);

  const lineItems = useMemo(() => {
    return (displayData?.items ?? []).map((line: any, index: number) => ({
      ...line,
      __rowKey: line.id || `${displayData?.id || 'pi'}-${line.product?.id || 'line'}-${index}`,
    }));
  }, [displayData?.items, displayData?.id]);

  if (!piData) return null;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <Space size="middle">
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0f766e 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 18px rgba(14, 165, 233, 0.25)'
            }}>
              <FileDoneOutlined style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>Proforma Invoice (Báo giá)</div>
              <Text style={{ fontSize: 13, color: '#0369a1', fontWeight: 600 }}>{displayData.piNumber}</Text>
            </div>
            <Tag
              variant="filled"
              color={PI_STATUS_COLOR[displayData.status]}
              style={{ borderRadius: 6, padding: '2px 10px', fontWeight: 600, marginLeft: 8 }}
            >
              {PI_STATUS_LABEL[displayData.status] ?? displayData.status}
            </Tag>
          </Space>
        </div>
      }
      open={open}
      onCancel={() => setOpen(false)}
      width="min(1120px, calc(100vw - 24px))"
      centered
      footer={
        <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid rgba(15, 23, 42, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>Chuyển trạng thái:</span>
              <Select
                value={displayData.status}
                style={{ width: 220 }}
                onChange={(val) => handleUpdateStatus(val)}
                variant="filled"
                options={[
                  { value: 'DRAFT', label: 'Nháp (DRAFT)' },
                  { value: 'SENT', label: 'Đã gửi khách (SENT)' },
                  { value: 'ACCEPTED', label: 'Khách chấp nhận (ACCEPTED)' },
                  { value: 'CANCELLED', label: 'Hủy báo giá (CANCELLED)' },
                ]}
              />
            </div>
            <Space size="middle">
              {displayData.status === 'ACCEPTED' && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  style={{ borderRadius: 8, height: 40, background: '#10b981' }}
                  onClick={handleCreateContract}
                >
                  Tạo Hợp đồng (SC)
                </Button>
              )}
              <Button onClick={() => setOpen(false)} style={{ borderRadius: 8, height: 40, padding: '0 24px' }}>Đóng</Button>
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                style={{ borderRadius: 8, height: 40, boxShadow: '0 6px 14px rgba(14, 165, 233, 0.35)' }}
                onClick={() => handlePrint()}
              >
                Xuất PDF / In
              </Button>
            </Space>
          </div>
        </div>
      }
    >
      <Spin spinning={loading}>
        <div style={{ maxHeight: 'calc(85vh - 120px)', overflowY: 'auto', padding: '24px' }}>
          <Steps
            size="small"
            current={getStep(displayData.status)}
            items={[
              { title: 'Nháp', subTitle: 'Soạn báo giá' },
              { title: 'Gửi khách', subTitle: 'Đang đàm phán' },
              { title: 'Chấp nhận', subTitle: 'Chuyển sang Hợp đồng' },
            ]}
            style={{ marginBottom: 32 }}
          />

          <div ref={printRef}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              marginBottom: 24,
              background: '#fff',
              padding: 24,
              borderRadius: 16,
              border: '1px solid rgba(14, 165, 233, 0.1)'
            }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Khách hàng</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{displayData.customer?.name}</div>
                <div style={{ fontSize: 13, color: '#64748b' }}>{displayData.customer?.address}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Thông tin chung</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Space><Text type="secondary" style={{ fontSize: 13 }}>Ngày:</Text> <Text strong>{displayData.issueDate ? new Date(displayData.issueDate).toLocaleDateString('vi-VN') : '-'}</Text></Space>
                  <Space><Text type="secondary" style={{ fontSize: 13 }}>Incoterms:</Text> <Tag color="purple">{displayData.incoterm ? tInc(displayData.incoterm) : '-'}</Tag></Space>
                  <Space><Text type="secondary" style={{ fontSize: 13 }}>Tiền tệ:</Text> <Text strong>{displayData.currency}</Text></Space>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Logistics</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Space><Text type="secondary" style={{ fontSize: 13 }}>Cảng:</Text> <Text strong>{displayData.portOfLoading} / {displayData.portOfDischarge}</Text></Space>
                  <Space><Text type="secondary" style={{ fontSize: 13 }}>Thanh toán:</Text> <Text strong>{displayData.paymentTerms || '-'}</Text></Space>
                </div>
              </div>
            </div>

            <Table
              size="middle"
              dataSource={lineItems}
              columns={lineColumns}
              rowKey="__rowKey"
              pagination={false}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row key="summary-row" style={{ background: '#f8fafc' }}>
                    <Table.Summary.Cell index={0} colSpan={9} align="right">
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40 }}>
                          <Text type="secondary">Tạm tính:</Text>
                          <Text strong style={{ width: 180, textAlign: 'right' }}>{displayData.currency} {subtotalAmount.toLocaleString()}</Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40, borderTop: '1px solid #ddd', paddingTop: 8 }}>
                          <Text style={{ fontSize: 16, fontWeight: 700 }}>TỔNG CỘNG:</Text>
                          <Text style={{ color: '#ef4444', fontSize: 20, fontWeight: 800, width: 180, textAlign: 'right' }}>
                            {displayData.currency} {totalAmount.toLocaleString()}
                          </Text>
                        </div>
                      </div>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </div>
        </div>
      </Spin>
    </Modal>
  );
};

export default ProformaInvoiceDetailModal;
