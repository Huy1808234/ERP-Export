'use client'

import {
  App,
  Button,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/es/table';
import { FileTextOutlined, PrinterOutlined, ThunderboltOutlined, FileExcelOutlined, BlockOutlined, DashboardOutlined } from '@ant-design/icons';
import PIFromQuotationModal from '../proforma-invoice/pi.from-quotation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { getSession } from 'next-auth/react';

import { sendRequest } from '@/lib/api-client';
import { theme } from 'antd';
import { useTranslations } from 'next-intl';
import { QUOTATION_STATUS_CONFIG } from '@/constants/o2c';
import type { IQuotation, IQuotationLine, QuotationStatus } from '@/types/o2c';
import { formatCurrency, formatDate } from '@/utils/format';
import { ExcelService } from '@/utils/excel';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

interface IProps {
  quotationId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ILogisticsSummary {
  totalCBM: number;
  totalGW: number;
  totalCartons: number;
}

const QuotationDetailModal = ({ quotationId, open, onClose, onSuccess }: IProps) => {
  const { notification } = App.useApp();
  const tInc = useTranslations('Incoterms');
  const [data, setData] = useState<IQuotation | null>(null);
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isPIModalOpen, setIsPIModalOpen] = useState<boolean>(false);
  const { token } = theme.useToken();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Bao_Gia_${data?.quotationNumber || 'PDF'}`,
  });

  const fetchDetail = useCallback(async () => {
    if (!quotationId) return;
    setLoading(true);
    try {
      const session = await getSession();
      const accessToken = getAccessToken(session);

      if (!accessToken) {
        notification.error({ title: 'Phiên đăng nhập đã hết hạn' });
        return;
      }

      const [quotationRes, settingsRes] = await Promise.all([
        sendRequest<IBackendRes<IQuotation>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations/${quotationId}`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        sendRequest<IBackendRes<any[]>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/settings`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      ]);
      
      if (quotationRes?.data) setData(quotationRes.data);
      if (settingsRes?.data) setSettings(settingsRes.data);
    } catch {
      notification.error({ title: 'Không thể tải chi tiết báo giá' });
    } finally {
      setLoading(false);
    }
  }, [notification, quotationId]);

  useEffect(() => {
    if (open && quotationId) {
      fetchDetail();
    } else {
      setData(null);
    }
  }, [open, quotationId, fetchDetail]);

  const handleUpdateStatus = async (status: QuotationStatus) => {
    try {
      const session = await getSession();
      const accessToken = getAccessToken(session);

      const res = await sendRequest<IBackendRes<IQuotation>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations/${quotationId}/status`,
        method: 'PATCH',
        body: { status },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({ title: 'Cập nhật trạng thái thành công' });
        fetchDetail();
        onSuccess();
      } else {
        notification.error({ title: 'Lỗi cập nhật', description: res?.message });
      }
    } catch {
      notification.error({ title: 'Lỗi hệ thống' });
    }
  };

  const lineColumns: ColumnsType<IQuotationLine> = useMemo(() => [
    { title: 'STT', render: (_, __, i) => i + 1, width: 50 },
    {
      title: 'Sản phẩm',
      key: 'product',
      render: (_, record) => (
        <div>
          <Text strong>{record.productDescription || record.product?.vietnameseName}</Text>
          {record.product?.sku && <div style={{ fontSize: 11, color: token.colorTextTertiary }}>SKU: {record.product.sku}</div>}
        </div>
      ),
    },
    { 
        title: 'SL', 
        dataIndex: 'quantity', 
        key: 'quantity', 
        align: 'right', 
        width: 80,
        render: (v: number) => Number(v || 0).toLocaleString()
    },
    { title: 'ĐV', dataIndex: 'unit', key: 'unit', width: 70 },
    { 
      title: 'Số thùng', 
      key: 'cartons', 
      align: 'right', 
      width: 100,
      render: (_, record) => {
        const pcsPerCtn = Number(record.product?.piecesPerCarton) || 1;
        return (Number(record.quantity || 0) / pcsPerCtn).toFixed(1);
      }
    },
    { 
      title: 'G.W (Kg)', 
      key: 'gw', 
      align: 'right', 
      width: 100, 
      render: (_, record) => {
        const pcsPerCtn = Number(record.product?.piecesPerCarton) || 1;
        const cartons = Number(record.quantity || 0) / pcsPerCtn;
        return (cartons * (Number(record.product?.grossWeightPerCarton) || 0)).toFixed(2);
      }
    },
    {
      title: `Đơn giá (${data?.currency ?? ''})`,
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right',
      width: 140,
      render: (value: number) => formatCurrency(Number(value || 0), 4),
    },
    {
      title: `Thành tiền (${data?.currency ?? ''})`,
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      width: 150,
      render: (value: number, record) => {
        const amount = Number(value || 0) || (Number(record.quantity || 0) * Number(record.unitPrice || 0));
        return <Text strong style={{ color: token.colorPrimary }}>{formatCurrency(amount, 2)}</Text>;
      },
    },
  ], [data?.currency, token]);

  const logisticsSummary = useMemo<ILogisticsSummary>(() => {
    const items = data?.items || [];
    return items.reduce((acc, line) => {
      const p = line.product || {};
      const qty = Number(line.quantity || 0);
      const pcsPerCtn = Number(p.piecesPerCarton) || 1;
      const cartons = qty / pcsPerCtn;
      const cbm = (Number(p.cbmPerCarton) || 0) * cartons;
      const gw = (Number(p.grossWeightPerCarton) || 0) * cartons;
      return {
        totalCBM: acc.totalCBM + cbm,
        totalGW: acc.totalGW + gw,
        totalCartons: acc.totalCartons + cartons,
      };
    }, { totalCBM: 0, totalGW: 0, totalCartons: 0 });
  }, [data?.items]);

  if (!open) return null;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <Space size="middle">
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 10, 
              background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryActive} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 12px ${token.colorPrimaryBg}`
            }}>
              <FileTextOutlined style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>Báo Giá</div>
              <Text style={{ fontSize: 13, color: token.colorPrimary, fontWeight: 500 }}>{data?.quotationNumber || 'Đang tải...'}</Text>
            </div>
            {data?.status && (
              <Tag 
                variant="filled"
                color={QUOTATION_STATUS_CONFIG[data.status].color}
                style={{ borderRadius: 6, padding: '2px 10px', fontWeight: 600, marginLeft: 8 }}
              >
                {QUOTATION_STATUS_CONFIG[data.status].label}
              </Tag>
            )}
          </Space>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={1120}
      centered
      mask={{ closable: false }}
      destroyOnHidden
      styles={{ 
        mask: { backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
        body: { padding: 0, background: token.colorBgLayout },
        header: { padding: '20px 24px', borderBottom: `1px solid ${token.colorBorderSecondary}`, margin: 0, background: token.colorBgContainer }
      }}
      footer={
        <div style={{ padding: '16px 24px', background: token.colorBgContainer, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <Space size="middle">
                <span style={{ color: token.colorTextDescription, fontSize: 13, fontWeight: 500 }}>Trạng thái:</span>
                <Select<QuotationStatus>
                    value={data?.status}
                    style={{ width: 200 }}
                    onChange={handleUpdateStatus}
                    disabled={data?.status === 'CONVERTED'}
                    options={Object.entries(QUOTATION_STATUS_CONFIG).map(([key, config]) => ({
                        value: key as QuotationStatus,
                        label: config.label,
                    }))}
                />
             </Space>
            <Space size="middle">
              <Button onClick={onClose} style={{ borderRadius: 8, height: 40, padding: '0 24px' }}>Đóng</Button>
              
              {data?.status !== 'CONVERTED' && (
                <Button 
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    style={{ borderRadius: 8, height: 40, background: '#722ed1', borderColor: '#722ed1' }}
                    onClick={() => setIsPIModalOpen(true)}
                >
                    Tạo Proforma Invoice
                </Button>
              )}

              <Button 
                type="primary" 
                icon={<PrinterOutlined />} 
                style={{ borderRadius: 8, height: 40, boxShadow: `0 4px 12px ${token.colorPrimaryBg}` }} 
                onClick={handlePrint}
              >
                Xuất PDF / In
              </Button>
              <Button 
                icon={<FileExcelOutlined />} 
                style={{ color: token.colorSuccess, borderColor: token.colorSuccess, borderRadius: 8, height: 40 }}
                onClick={() => data && ExcelService.exportSingleQuotation(data, settings)}
              >
                Excel
              </Button>
            </Space>
          </div>
        </div>
      }
    >
      <Spin spinning={loading}>
        {data && (
          <div style={{ maxHeight: 'calc(85vh - 120px)', overflowY: 'auto', padding: '24px 32px' }}>
            <div ref={printRef}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: 24, 
                marginBottom: 32,
                background: token.colorBgContainer,
                padding: 24,
                borderRadius: 16,
                border: `1px solid ${token.colorBorderSecondary}`,
                boxShadow: token.boxShadowTertiary
              }}>
                <div>
                  <div style={{ fontSize: 12, color: token.colorTextDescription, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Khách hàng</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: token.colorTextHeading }}>{data.customer?.name}</div>
                  <div style={{ fontSize: 13, color: token.colorTextDescription, marginTop: 4 }}>{data.customer?.address}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: token.colorTextDescription, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Thông tin chung</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Space><Text type="secondary" style={{ width: 90, fontSize: 13 }}>Ngày tạo:</Text> <Text strong style={{ fontSize: 13 }}>{formatDate(data.createdAt)}</Text></Space>
                    <Space><Text type="secondary" style={{ width: 90, fontSize: 13 }}>Incoterms:</Text> <Tag color="blue" style={{ margin: 0, fontSize: 11, fontWeight: 700 }}>{data.incoterm ? tInc(data.incoterm) : '-'}</Tag></Space>
                    <Space><Text type="secondary" style={{ width: 90, fontSize: 13 }}>Tiền tệ:</Text> <Text strong style={{ fontSize: 13 }}>{data.currency}</Text></Space>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: token.colorTextDescription, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Logistics & Thanh toán</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Space><Text type="secondary" style={{ width: 90, fontSize: 13 }}>Cảng đi:</Text> <Text strong style={{ fontSize: 13 }}>{data.portOfLoading || '-'}</Text></Space>
                    <Space><Text type="secondary" style={{ width: 90, fontSize: 13 }}>Cảng đến:</Text> <Text strong style={{ fontSize: 13 }}>{data.portOfDischarge || '-'}</Text></Space>
                    <Space><Text type="secondary" style={{ width: 90, fontSize: 13 }}>Thanh toán:</Text> <Text strong style={{ fontSize: 13 }}>{data.paymentTerms || '-'}</Text></Space>
                  </div>
                </div>
                {data.proformaInvoices && data.proformaInvoices.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: token.colorTextDescription, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Chứng từ liên kết</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {data.proformaInvoices.map((pi: any) => (
                        <Space key={pi._id}>
                          <Text type="secondary" style={{ fontSize: 13 }}>PI:</Text>
                          <Tag color="green" style={{ margin: 0, fontWeight: 700, cursor: 'pointer' }}>{pi.piNumber}</Tag>
                        </Space>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 4, height: 18, background: token.colorPrimary, borderRadius: 2 }}></div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Danh mục sản phẩm</div>
              </div>

              <Table<IQuotationLine>
                size="middle"
                className="premium-table"
                dataSource={data.items ?? []}
                columns={lineColumns}
                rowKey="_id"
                pagination={false}
                style={{ 
                  borderRadius: 12, 
                  overflow: 'hidden',
                  border: `1px solid ${token.colorBorderSecondary}`,
                  marginBottom: 32,
                  background: token.colorBgContainer
                }}
                summary={() => (
                    <Table.Summary fixed>
                        <Table.Summary.Row key="summary-row" style={{ background: token.colorBgLayout }}>
                            <Table.Summary.Cell index={0} colSpan={8} align="right">
                                <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 40 }}>
                                        <Text type="secondary" style={{ fontSize: 13 }}>Tạm tính (Subtotal):</Text>
                                        <Text strong style={{ fontSize: 14, width: 180, textAlign: 'right' }}>
                                            {data.currency} {formatCurrency((
                                                Number(data.totalAmount || 0) 
                                                - Number(data.logisticsFee || 0) 
                                                - Number(data.otherFee || 0)
                                                - Number(data.seaFreight || 0)
                                                - Number(data.insuranceCost || 0)
                                                - Number(data.domesticTransportCost || 0)
                                                - Number(data.portCharges || 0)
                                            ), 2)}
                                        </Text>
                                    </div>
                                    {(Number(data.seaFreight) > 0) && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 40 }}>
                                            <Text type="secondary" style={{ fontSize: 13 }}>Cước biển (Sea Freight):</Text>
                                            <Text strong style={{ fontSize: 14, width: 180, textAlign: 'right' }}>
                                                {data.currency} {formatCurrency(Number(data.seaFreight), 2)}
                                            </Text>
                                        </div>
                                    )}
                                    {(Number(data.insuranceCost) > 0) && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 40 }}>
                                            <Text type="secondary" style={{ fontSize: 13 }}>Bảo hiểm (Insurance):</Text>
                                            <Text strong style={{ fontSize: 14, width: 180, textAlign: 'right' }}>
                                                {data.currency} {formatCurrency(Number(data.insuranceCost), 2)}
                                            </Text>
                                        </div>
                                    )}
                                    {(Number(data.domesticTransportCost) > 0) && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 40 }}>
                                            <Text type="secondary" style={{ fontSize: 13 }}>Vận chuyển nội địa:</Text>
                                            <Text strong style={{ fontSize: 14, width: 180, textAlign: 'right' }}>
                                                {data.currency} {formatCurrency(Number(data.domesticTransportCost), 2)}
                                            </Text>
                                        </div>
                                    )}
                                    {(Number(data.portCharges) > 0) && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 40 }}>
                                            <Text type="secondary" style={{ fontSize: 13 }}>Phí cảng (Port Charges):</Text>
                                            <Text strong style={{ fontSize: 14, width: 180, textAlign: 'right' }}>
                                                {data.currency} {formatCurrency(Number(data.portCharges), 2)}
                                            </Text>
                                        </div>
                                    )}
                                    {(Number(data.logisticsFee) > 0) && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 40 }}>
                                            <Text type="secondary" style={{ fontSize: 13 }}>Phí Logistics (Tổng):</Text>
                                            <Text strong style={{ fontSize: 14, width: 180, textAlign: 'right' }}>
                                                {data.currency} {formatCurrency(Number(data.logisticsFee), 2)}
                                            </Text>
                                        </div>
                                    )}
                                    {(Number(data.otherFee) > 0) && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 40 }}>
                                            <Text type="secondary" style={{ fontSize: 13 }}>Phí khác:</Text>
                                            <Text strong style={{ fontSize: 14, width: 180, textAlign: 'right' }}>
                                                {data.currency} {formatCurrency(Number(data.otherFee), 2)}
                                            </Text>
                                        </div>
                                    )}
                                    <div style={{ 
                                        marginTop: 4, 
                                        paddingTop: 16, 
                                        borderTop: `1px solid ${token.colorBorderSecondary}`, 
                                        display: 'flex', 
                                        justifyContent: 'flex-end', 
                                        alignItems: 'center', 
                                        gap: 40 
                                    }}>
                                        <Text style={{ fontSize: 16, fontWeight: 700, color: token.colorTextHeading }}>TỔNG CỘNG:</Text>
                                        <Text style={{ color: token.colorError, fontSize: 24, fontWeight: 800, width: 220, textAlign: 'right' }}>
                                            {data.currency} {formatCurrency(Number(data.totalAmount || 0), 2)}
                                        </Text>
                                    </div>
                                </div>
                            </Table.Summary.Cell>
                        </Table.Summary.Row>
                    </Table.Summary>
                )}
              />

              {/* Logistics Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 32 }}>
                <div style={{ background: token.colorInfoBg, padding: 20, borderRadius: 16, border: `1px solid ${token.colorInfoBorder}`, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <BlockOutlined style={{ fontSize: 24, color: token.colorInfo }} />
                    <div>
                        <div style={{ fontSize: 12, color: token.colorInfo, fontWeight: 600 }}>Tổng số thùng</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: token.colorText }}>{logisticsSummary.totalCartons.toFixed(1)} <span style={{ fontSize: 12 }}>CTNS</span></div>
                    </div>
                </div>
                <div style={{ background: 'rgba(114, 46, 209, 0.05)', padding: 20, borderRadius: 16, border: '1px solid rgba(114, 46, 209, 0.2)', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <DashboardOutlined style={{ fontSize: 24, color: '#722ed1' }} />
                    <div>
                        <div style={{ fontSize: 12, color: '#722ed1', fontWeight: 600 }}>Tổng trọng lượng</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: token.colorText }}>{logisticsSummary.totalGW.toFixed(2)} <span style={{ fontSize: 12 }}>KGS</span></div>
                    </div>
                </div>
                <div style={{ background: token.colorSuccessBg, padding: 20, borderRadius: 16, border: `1px solid ${token.colorSuccessBorder}`, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <ThunderboltOutlined style={{ fontSize: 24, color: token.colorSuccess }} />
                    <div>
                        <div style={{ fontSize: 12, color: token.colorSuccess, fontWeight: 600 }}>Tổng thể tích</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: token.colorText }}>{logisticsSummary.totalCBM.toFixed(3)} <span style={{ fontSize: 12 }}>M³</span></div>
                    </div>
                </div>
              </div>

              {data.bankInfo && (
                <div style={{ padding: '16px 24px', background: token.colorBgContainer, borderRadius: 12, borderLeft: `4px solid ${token.colorPrimary}`, marginBottom: 16, border: `1px solid ${token.colorBorderSecondary}`, borderLeftWidth: 4 }}>
                  <Text strong>Thông tin thanh toán:</Text>
                  <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, color: token.colorText }}>{data.bankInfo}</pre>
                </div>
              )}

              {data.note && (
                <div style={{ padding: '16px 24px', background: token.colorWarningBg, borderRadius: 12, borderLeft: `4px solid ${token.colorWarning}`, border: `1px solid ${token.colorWarningBorder}`, borderLeftWidth: 4 }}>
                  <Text strong>Ghi chú:</Text> <span style={{ color: token.colorText }}>{data.note}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Spin>

      {data && (
        <PIFromQuotationModal
          open={isPIModalOpen}
          setOpen={setIsPIModalOpen}
          quotation={data}
          onSuccess={() => {
            fetchDetail();
            onSuccess();
          }}
        />
      )}
    </Modal>
  );
};

export default QuotationDetailModal;
