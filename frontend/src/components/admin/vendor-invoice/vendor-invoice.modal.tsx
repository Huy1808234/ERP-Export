'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Select,
  Row,
  Col,
  Typography,
  Divider,
  Space,
  Tag,
  Table,
  Card,
  Badge,
  App,
  theme
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FileProtectOutlined,
  ThunderboltOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { sendRequest } from '@/lib/api-client';
import { useSession } from 'next-auth/react';
import { getAccessToken } from '@/lib/auth-token';
import { getSetting } from '@/services/settings.service';
import AmountInWords from '@/components/ui/AmountInWords';
import { useTheme } from '@/context/theme.context';

const { Text } = Typography;
const DEFAULT_PURCHASE_VAT_RATE_KEY = 'DEFAULT_PURCHASE_VAT_RATE';

interface MatchingStatusRow {
  purchaseOrderItem_id: string;
  productId: string;
  productName: string;
  sku?: string | null;
  orderedQty: number;
  receivedQty: number;
  invoicedQty: number;
  unitPrice: number;
  status: 'MATCHED' | 'OVER_INVOICED' | 'PARTIAL' | string;
}

interface IProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  purchaseOrderId?: string;
  vendorId?: string;
  poNumber?: string;
  vendorName?: string;
  poTotalAmount?: number;
}

const VendorInvoiceModal = (props: IProps) => {
  const { open, onCancel, onSuccess, purchaseOrderId, vendorId, poNumber, vendorName, poTotalAmount } = props;
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [matchingData, setMatchingData] = useState<MatchingStatusRow[]>([]);
  const [poContext, setPoContext] = useState<any | null>(null);
  const amount = Form.useWatch('amount', form);
  const taxAmount = Form.useWatch('taxAmount', form);
  const totalAmount = Form.useWatch('totalAmount', form);
  const currency = Form.useWatch('currency', form) || 'VND';

  const resolveDefaultTaxRate = useCallback(async () => {
    if (!accessToken) return 10;

    try {
      const setting = await getSetting(DEFAULT_PURCHASE_VAT_RATE_KEY, accessToken);
      const taxRate = Number(setting?.value ?? 10);
      return Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 100 ? taxRate : 10;
    } catch {
      return 10;
    }
  }, [accessToken]);

  const fetchPoContext = useCallback(async (poId: string) => {
    if (!accessToken) return null;

    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders/${poId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return res?.data || null;
  }, [accessToken]);

  const fetchMatchingData = useCallback(async (poId: string, taxRate: number) => {
    if (!accessToken) return;

    const res = await sendRequest<IBackendRes<MatchingStatusRow[]>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/vendor-invoices/matching-status/${poId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      setMatchingData(res.data);
      // Auto-fill items for the invoice based on remaining to be invoiced
      const items = res.data.map(item => ({
        purchaseOrderItem_id: item.purchaseOrderItem_id,
        productId: item.productId,
        productName: item.productName,
        quantity: Math.max(0, item.receivedQty - item.invoicedQty),
        unitPrice: item.unitPrice,
        amount: Math.max(0, item.receivedQty - item.invoicedQty) * item.unitPrice
      }));

      const totalPreTax = items.reduce((sum, i) => sum + i.amount, 0);
      const taxAmount = (totalPreTax * taxRate) / 100;

      form.setFieldsValue({
        amount: totalPreTax,
        taxAmount: taxAmount,
        totalAmount: totalPreTax + taxAmount
      });
    }
  }, [accessToken, form]);

  useEffect(() => {
    if (open && purchaseOrderId) {
      let cancelled = false;

      const initializeInvoiceForm = async () => {
        const [taxRate, poDetail] = await Promise.all([
          resolveDefaultTaxRate(),
          fetchPoContext(purchaseOrderId),
        ]);
        if (cancelled) return;

        setPoContext(poDetail);
        form.setFieldsValue({
          purchaseOrderId,
          vendorId: vendorId || poDetail?.vendorId,
          invoiceDate: dayjs(),
          taxRate,
          currency: poDetail?.currency || 'VND',
          exchangeRate: 1
        });
        fetchMatchingData(purchaseOrderId, taxRate);
      };

      initializeInvoiceForm();

      return () => {
        cancelled = true;
      };
    }
  }, [open, purchaseOrderId, vendorId, form, fetchMatchingData, fetchPoContext, resolveDefaultTaxRate]);

  useEffect(() => {
    if (!open) {
      setPoContext(null);
      setMatchingData([]);
    }
  }, [open]);

  const calculateTotals = () => {
    const amount = form.getFieldValue('amount') || 0;
    const taxRate = form.getFieldValue('taxRate') || 0;
    const taxAmount = (amount * taxRate) / 100;
    form.setFieldsValue({
      taxAmount: taxAmount,
      totalAmount: amount + taxAmount
    });
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const items = matchingData.map(item => ({
        purchaseOrderItem_id: item.purchaseOrderItem_id,
        productId: item.productId,
        quantity: item.receivedQty - item.invoicedQty > 0 ? item.receivedQty - item.invoicedQty : 0,
        unitPrice: item.unitPrice,
        amount: (item.receivedQty - item.invoicedQty > 0 ? item.receivedQty - item.invoicedQty : 0) * item.unitPrice
      })).filter(i => i.quantity > 0);

      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/vendor-invoices`,
        method: 'POST',
        body: {
          ...values,
          invoiceDate: values.invoiceDate.toISOString(),
          dueDate: values.dueDate?.toISOString(),
          items
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        message.success('Ghi nhận hóa đơn thành công');
        onSuccess();
        onCancel();
        form.resetFields();
      } else {
        message.error(res?.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const summaryCardStyle: React.CSSProperties = {
    background: isDark ? 'rgba(15, 23, 42, 0.74)' : '#f8fbff',
    border: `1px solid ${isDark ? 'rgba(96, 165, 250, 0.34)' : '#adc6ff'}`,
    borderRadius: 8,
  };

  const summaryLabelStyle: React.CSSProperties = {
    color: isDark ? '#94a3b8' : token.colorTextSecondary,
    fontSize: 12,
  };

  const summaryValueStyle: React.CSSProperties = {
    color: isDark ? '#f8fafc' : token.colorText,
  };

  const matchingColumns: ColumnsType<MatchingStatusRow> = [
    {
      title: 'Sản phẩm',
      dataIndex: 'productName',
      key: 'productName',
      width: 240,
      render: (text: string, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>SKU: {record.sku}</Text>
        </Space>
      )
    },
    {
      title: 'Đặt hàng (PO)',
      dataIndex: 'orderedQty',
      key: 'orderedQty',
      align: 'center' as const,
      render: (v: number) => <Tag color="blue">{v}</Tag>
    },
    {
      title: 'Đã nhập (GRN)',
      dataIndex: 'receivedQty',
      key: 'receivedQty',
      align: 'center' as const,
      render: (v: number) => <Tag color="green">{v}</Tag>
    },
    {
      title: 'Đã đòi tiền',
      dataIndex: 'invoicedQty',
      key: 'invoicedQty',
      align: 'center' as const,
      render: (v: number) => <Tag color="orange">{v}</Tag>
    },
    {
      title: 'Trạng thái đối chiếu',
      dataIndex: 'status',
      key: 'status',
      width: 180,
      render: (status: string) => {
        switch (status) {
          case 'MATCHED': return <Badge status="success" text="Khớp 100%" />;
          case 'OVER_INVOICED': return <Badge status="error" text="Vượt định mức" />;
          case 'PARTIAL': return <Badge status="processing" text="Đang tính nợ" />;
          default: return <Badge status="default" text="Chờ đối chiếu" />;
        }
      }
    }
  ];

  const displayPoNumber = poNumber || poContext?.poNumber || '-';
  const displayVendorName = vendorName || poContext?.vendor?.name || '-';
  const displayPoTotalAmount = poTotalAmount ?? Number(poContext?.totalAmount || 0);

  return (
    <Modal
      title={
        <Space>
          <FileProtectOutlined style={{ color: '#1890ff' }} />
          <span>Ghi nhận Hóa đơn Nhà cung cấp (3-Way Matching)</span>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      width={900}
      confirmLoading={loading}
      className="vendor-invoice-modal"
      styles={{
        body: {
          paddingTop: 10,
          maxHeight: 'calc(100vh - 178px)',
          overflowY: 'auto',
        },
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <Card size="small" style={summaryCardStyle} styles={{ body: { padding: '10px 12px' } }}>
          <Row gutter={[16, 8]} align="middle">
            <Col xs={24} md={8}>
              <Text style={summaryLabelStyle}>Đơn đặt hàng:</Text>{' '}
              <Text strong style={summaryValueStyle}>{displayPoNumber}</Text>
            </Col>
            <Col xs={24} md={8}>
              <Text style={summaryLabelStyle}>Nhà cung cấp:</Text>{' '}
              <Text strong style={summaryValueStyle}>{displayVendorName}</Text>
            </Col>
            <Col xs={24} md={8}>
              <Text style={summaryLabelStyle}>Hạn mức PO:</Text>{' '}
              <Text strong style={{ color: isDark ? '#fca5a5' : '#cf1322' }}>
                {displayPoTotalAmount.toLocaleString('vi-VN')} VND
              </Text>
            </Col>
          </Row>
        </Card>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Số hóa đơn (VAT)" name="invoiceNumber" rules={[{ required: true, message: 'Vui lòng nhập số hóa đơn' }]}>
              <Input placeholder="VD: 0000123" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Ký hiệu" name="invoiceSeries">
              <Input placeholder="VD: 1C23TML" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Ngày hóa đơn" name="invoiceDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
        </Row>

        <Divider titlePlacement="start" style={{ margin: '12px 0' }}>
          <Space><ThunderboltOutlined style={{ color: '#faad14' }} /> <Text strong>Kết quả Đối chiếu 3 bên (3-Way Matching)</Text></Space>
        </Divider>

        <Table
          size="small"
          dataSource={matchingData}
          columns={matchingColumns}
          pagination={false}
          rowKey="productId"
          scroll={{ x: 760 }}
          className="vendor-invoice-matching-table"
          style={{ marginBottom: 24 }}
        />

        <Divider titlePlacement="start" style={{ margin: '12px 0' }}>Thông tin tài chính</Divider>

        <Row gutter={[14, 10]} align="top">
          <Col xs={24} md={12} lg={6}>
            <Form.Item label="Tiền trước thuế" name="amount" rules={[{ required: true }]}>
              <InputNumber
                style={{ width: '100%' }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => Number(v!.replace(/\$\s?|(,*)/g, ''))}
                onChange={calculateTotals}
              />
            </Form.Item>
            <AmountInWords amount={amount} currency={currency} />
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Form.Item label="Tiền tệ" name="currency">
              <Select onChange={(v) => form.setFieldsValue({ exchangeRate: v === 'VND' ? 1 : 25450 })}>
                <Select.Option value="VND">VND</Select.Option>
                <Select.Option value="USD">USD</Select.Option>
                <Select.Option value="EUR">EUR</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={12} md={6} lg={5}>
            <Form.Item label="Tỷ giá hạch toán" name="exchangeRate" rules={[{ required: true }]}>
              <InputNumber
                style={{ width: '100%' }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => Number(v!.replace(/\$\s?|(,*)/g, ''))}
              />
            </Form.Item>
          </Col>
          <Col xs={12} md={6} lg={3}>
            <Form.Item label="VAT (%)" name="taxRate">
              <InputNumber style={{ width: '100%' }} min={0} max={100} onChange={calculateTotals} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Form.Item label="Tiền thuế" name="taxAmount">
              <InputNumber
                style={{ width: '100%' }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => Number(v!.replace(/\$\s?|(,*)/g, ''))}
                readOnly
              />
            </Form.Item>
            <AmountInWords amount={taxAmount} currency={currency} />
          </Col>
          <Col xs={24} md={12} lg={8}>
            <Form.Item label="Tổng tiền (Thanh toán)" name="totalAmount" rules={[{ required: true }]}>
              <InputNumber
                style={{ width: '100%', fontWeight: 'bold' }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => Number(v!.replace(/\$\s?|(,*)/g, ''))}
                status={(form.getFieldValue('totalAmount') > displayPoTotalAmount + 1) ? 'error' : ''}
              />
            </Form.Item>
            <AmountInWords amount={totalAmount} currency={currency} />
          </Col>
        </Row>

        <Form.Item hidden name="purchaseOrderId"><Input /></Form.Item>
        <Form.Item hidden name="vendorId"><Input /></Form.Item>

        <Form.Item label="Ghi chú" name="note">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>

      {(form.getFieldValue('totalAmount') > displayPoTotalAmount + 1) && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 4 }}>
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <Text type="danger" strong>Cảnh báo: Tổng tiền hóa đơn vượt quá hạn mức của Đơn đặt hàng (PO)!</Text>
          </Space>
        </div>
      )}

      <style jsx global>{`
        .vendor-invoice-modal .ant-modal-content {
          overflow: hidden;
        }

        .vendor-invoice-modal .ant-form-item {
          margin-bottom: 12px;
        }

        .vendor-invoice-matching-table .ant-table-container {
          border: 1px solid ${isDark ? 'rgba(148, 163, 184, 0.32)' : '#d9d9d9'};
          border-radius: 8px;
          overflow: hidden;
        }

        .vendor-invoice-matching-table .ant-table {
          background: transparent;
        }

        .vendor-invoice-matching-table .ant-table-thead > tr > th {
          white-space: nowrap;
        }

        .vendor-invoice-matching-table .ant-table-tbody > tr > td {
          vertical-align: middle;
        }
      `}</style>
    </Modal>
  );
};

export default VendorInvoiceModal;
