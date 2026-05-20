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
import { CheckCircleOutlined, FileDoneOutlined, PrinterOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import { getSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import { theme } from 'antd';
import { useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

const PI_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'processing',
  SENT: 'blue',
  ACCEPTED: 'success',
  REJECTED: 'error',
  CANCELLED: 'error',
};

const PI_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  SENT: 'Đã gửi khách',
  ACCEPTED: 'Khách đã chấp nhận',
  REJECTED: 'Từ chối',
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

  const { token } = theme.useToken();
  const displayData = fullData || piData;

  const fetchDetail = useCallback(async () => {
    if (!piData?._id) return;
    setLoading(true);
    const currentSession = await getSession();
    const accessToken = getAccessToken(currentSession);
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/proforma-invoices/${piData._id}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      setFullData(res.data);
    }
    setLoading(false);
  }, [piData?._id]);

  useEffect(() => {
    if (open) {
      fetchDetail();
    } else {
      setFullData(null);
    }
  }, [fetchDetail, open, piData?._id]);

  const logisticsFee = Number(displayData?.logisticsFee) || 0;
  const otherFee = Number(displayData?.otherFee) || 0;
  const seaFreight = Number(displayData?.seaFreight) || 0;
  const insuranceCost = Number(displayData?.insuranceCost) || 0;
  const domesticTransportCost = Number(displayData?.domesticTransportCost) || 0;
  const portCharges = Number(displayData?.portCharges) || 0;

  const totalAmount = Number(displayData?.totalAmount) || 0;
  const subtotalAmount = totalAmount - logisticsFee - otherFee - seaFreight - insuranceCost - domesticTransportCost - portCharges;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `PI_${displayData?.piNumber || 'PDF'}`,
  });

  const handleUpdateStatus = async (status: string) => {
    if (!displayData?._id) return;

    const currentSession = await getSession();
    const accessToken = getAccessToken(currentSession);
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/proforma-invoices/${displayData._id}/status`,
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

  const handleMarkAsPaid = async () => {
    if (!displayData?._id) return;
    const currentSession = await getSession();
    const accessToken = getAccessToken(currentSession);
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/proforma-invoices/${displayData._id}`,
      method: 'PATCH',
      body: { isPaid: true, paidAt: new Date() },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      notification.success({ title: 'Xác nhận thanh toán thành công' });
      setFullData(res.data);
      if (fetchPIs) await fetchPIs();
      await fetchDetail();
    } else {
      notification.error({ title: 'Lỗi', description: res?.message });
    }
  };

  const handleCreateContract = async () => {
    if (!displayData?._id) return;
    setLoading(true);
    try {
      const currentSession = await getSession();
      const accessToken = getAccessToken(currentSession);

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const sourceRef = String(displayData.piNumber || displayData._id)
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(-6)
        .toUpperCase();
      const contractNumber = `SC-${dateStr}-${sourceRef}`;

      const payload = {
        contractNumber,
        buyerId: displayData.customerId,
        proformaInvoiceId: displayData._id,
        incoterm: displayData.incoterm,
        pol: displayData.portOfLoading,
        pod: displayData.portOfDischarge,
        currencyCode: displayData.currency,
        exchangeRate: displayData.exchangeRate || 25000,
        seaFreight: Number(displayData.seaFreight) || 0,
        insuranceCost: Number(displayData.insuranceCost) || 0,
        domesticTransportCost: Number(displayData.domesticTransportCost) || 0,
        portCharges: Number(displayData.portCharges) || 0,
        logisticsFee: Number(displayData.logisticsFee) || 0,
        otherFee: Number(displayData.otherFee) || 0,
        notes: `Tạo từ PI ${displayData.piNumber}`,
        items: (displayData.items || []).map((item: any) => ({
          productId: item.productId || item.product?._id,
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
    } catch {
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
          {p?.englishName && <div><Text type="secondary" style={{ fontSize: 12, color: token.colorTextTertiary }}>{p.englishName}</Text></div>}
        </div>
      ),
    },
    {
      title: 'HS Code',
      key: 'hsCode',
      width: 100,
      render: (_: unknown, record: any) => record.hsCode || record.product?.hsCode || '-',
    },
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
        <Text strong style={{ color: token.colorPrimary }}>
          {parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
  ], [displayData?.currency, token]);

  const getStep = (status: string) => {
    if (displayData?.salesContractId) return 3;
    switch (status) {
      case 'DRAFT': return 0;
      case 'PENDING_APPROVAL': return 1;
      case 'REJECTED': return 0;
      case 'SENT': return 1;
      case 'ACCEPTED': return 2;
      default: return 0;
    }
  };

  const lineItems = useMemo(() => {
    return (displayData?.items ?? []).map((line: any, index: number) => ({
      ...line,
      __rowKey: line._id || `${displayData?._id || 'pi'}-${line.product?._id || 'line'}-${index}`,
    }));
  }, [displayData?.items, displayData?._id]);

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
              background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryActive} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 8px 18px ${token.colorPrimaryBg}`
            }}>
              <FileDoneOutlined style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>Proforma Invoice (Báo giá)</div>
              <Text style={{ fontSize: 13, color: token.colorPrimary, fontWeight: 600 }}>{displayData.piNumber}</Text>
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
        <div style={{ padding: '16px 24px', background: token.colorBgContainer, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: token.colorTextDescription, fontSize: 13, fontWeight: 500 }}>Chuyển trạng thái:</span>
              <Select
                value={displayData.status}
                style={{ width: 220 }}
                onChange={(val) => handleUpdateStatus(val)}
                variant="filled"
                options={[
                  { value: 'DRAFT', label: 'Nháp (DRAFT)' },
                  { value: 'PENDING_APPROVAL', label: 'Chờ duyệt (PENDING_APPROVAL)' },
                  { value: 'SENT', label: 'Đã gửi khách (SENT)' },
                  { value: 'ACCEPTED', label: 'Khách chấp nhận (ACCEPTED)' },
                  { value: 'REJECTED', label: 'Từ chối (REJECTED)' },
                  { value: 'CANCELLED', label: 'Hủy báo giá (CANCELLED)' },
                ]}
              />
            </div>
            <Space size="middle">
              {displayData.status === 'ACCEPTED' && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  style={{ borderRadius: 8, height: 40, background: displayData.salesContractId ? token.colorTextDisabled : token.colorSuccess }}
                  onClick={handleCreateContract}
                  disabled={!!displayData.salesContractId}
                >
                  {displayData.salesContractId ? 'Đã tạo Hợp đồng' : 'Tạo Hợp đồng (SC)'}
                </Button>
              )}
              {!displayData.isPaid && (
                <Button
                  onClick={handleMarkAsPaid}
                  style={{ borderRadius: 8, height: 40, background: token.colorWarning, color: '#fff', border: 'none' }}
                >
                  Xác nhận Thanh toán
                </Button>
              )}
              <Button onClick={() => setOpen(false)} style={{ borderRadius: 8, height: 40, padding: '0 24px' }}>Đóng</Button>
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                style={{ borderRadius: 8, height: 40, boxShadow: `0 6px 14px ${token.colorPrimaryBg}` }}
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
              { title: 'Chấp nhận', subTitle: 'Duyệt PI' },
              { title: 'Hợp đồng', subTitle: 'Đã lên SC' },
            ]}
            style={{ marginBottom: 32 }}
          />

          <div ref={printRef}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              marginBottom: 24,
              background: token.colorBgContainer,
              padding: 24,
              borderRadius: 16,
              border: `1px solid ${token.colorBorderSecondary}`,
              boxShadow: token.boxShadowTertiary
            }}>
              <div>
                <div style={{ fontSize: 12, color: token.colorTextDescription, textTransform: 'uppercase', marginBottom: 4 }}>Khách hàng</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: token.colorTextHeading }}>{displayData.customer?.name}</div>
                <div style={{ fontSize: 13, color: token.colorTextDescription }}>{displayData.customer?.address}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: token.colorTextDescription, textTransform: 'uppercase', marginBottom: 4 }}>Thông tin chung</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Space><Text type="secondary" style={{ fontSize: 13 }}>Ngày:</Text> <Text strong>{displayData.issueDate ? new Date(displayData.issueDate).toLocaleDateString('vi-VN') : '-'}</Text></Space>
                  <Space><Text type="secondary" style={{ fontSize: 13 }}>Incoterms:</Text> <Tag color="purple">{displayData.incoterm ? tInc(displayData.incoterm) : '-'}</Tag></Space>
                  <Space><Text type="secondary" style={{ fontSize: 13 }}>Tiền tệ:</Text> <Text strong>{displayData.currency}</Text></Space>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: token.colorTextDescription, textTransform: 'uppercase', marginBottom: 4 }}>Logistics</div>
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
              style={{ background: token.colorBgContainer }}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row key="summary-row" style={{ background: token.colorBgLayout }}>
                    <Table.Summary.Cell index={0} colSpan={9} align="right">
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40 }}>
                          <Text type="secondary">Tạm tính:</Text>
                          <Text strong style={{ width: 180, textAlign: 'right', color: token.colorText }}>{displayData.currency} {subtotalAmount.toLocaleString()}</Text>
                        </div>
                        {seaFreight > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40 }}>
                            <Text type="secondary">Cước biển (Freight):</Text>
                            <Text strong style={{ width: 180, textAlign: 'right', color: token.colorText }}>{displayData.currency} {seaFreight.toLocaleString()}</Text>
                          </div>
                        )}
                        {insuranceCost > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40 }}>
                            <Text type="secondary">Bảo hiểm (Insurance):</Text>
                            <Text strong style={{ width: 180, textAlign: 'right', color: token.colorText }}>{displayData.currency} {insuranceCost.toLocaleString()}</Text>
                          </div>
                        )}
                        {domesticTransportCost > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40 }}>
                            <Text type="secondary">Vận chuyển nội địa:</Text>
                            <Text strong style={{ width: 180, textAlign: 'right', color: token.colorText }}>{displayData.currency} {domesticTransportCost.toLocaleString()}</Text>
                          </div>
                        )}
                        {portCharges > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40 }}>
                            <Text type="secondary">Phí cảng (Local charges):</Text>
                            <Text strong style={{ width: 180, textAlign: 'right', color: token.colorText }}>{displayData.currency} {portCharges.toLocaleString()}</Text>
                          </div>
                        )}
                        {(logisticsFee > 0 || otherFee > 0) && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40 }}>
                            <Text type="secondary">Phí khác:</Text>
                            <Text strong style={{ width: 180, textAlign: 'right', color: token.colorText }}>{displayData.currency} {(logisticsFee + otherFee).toLocaleString()}</Text>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 8 }}>
                          <Text style={{ fontSize: 16, fontWeight: 700, color: token.colorTextHeading }}>TỔNG CỘNG:</Text>
                          <Text style={{ color: token.colorError, fontSize: 24, fontWeight: 800, width: 220, textAlign: 'right' }}>
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
