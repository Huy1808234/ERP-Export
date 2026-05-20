'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import type { IGoodsReceipt, IGRNLine } from '@/types/goods-receipt';

const { Text } = Typography;

type QCResult = 'PASSED' | 'FAILED' | 'CONDITIONAL';
type QCExceptionStatus = 'NONE' | 'QUARANTINED' | 'RETURN_CREATED' | 'CLAIM_OPEN' | 'CLOSED';
type QCClaimStatus = 'NONE' | 'OPEN' | 'SENT' | 'RESOLVED' | 'CANCELLED';
type QCResolutionType = 'NONE' | 'REPLACEMENT' | 'CREDIT_NOTE' | 'ACCEPT_AS_IS' | 'CANCELLED' | 'OTHER';

interface IQualityCheck {
  _id: string;
  checkNumber: string;
  result: QCResult;
  exceptionStatus: QCExceptionStatus;
  claimStatus: QCClaimStatus;
  claimNumber?: string | null;
  claimSentByUsername?: string | null;
  claimSentAt?: string | null;
  resolutionType?: QCResolutionType;
  creditAmount?: number;
  replacementDueDate?: string | null;
  resolvedByUsername?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  quarantineQuantity: number;
  backorderQuantity: number;
  inspectorNotes?: string | null;
  correctiveAction?: string | null;
  inspectorUsername?: string | null;
  createdAt: string;
  product?: {
    _id: string;
    sku?: string;
    vietnameseName?: string;
  } | null;
  goodsReceipt?: {
    _id: string;
    grNumber?: string;
    purchaseOrder?: {
      _id: string;
      poNumber?: string;
      vendor?: {
        _id: string;
        name?: string;
      } | null;
    } | null;
  } | null;
  goodsReceiptItem?: {
    _id: string;
    product?: {
      _id: string;
      sku?: string;
      vietnameseName?: string;
    } | null;
    unit?: string | null;
  } | null;
  purchaseOrder?: {
    _id: string;
    poNumber?: string;
    vendor?: {
      _id: string;
      name?: string;
    } | null;
  } | null;
  purchaseReturn?: {
    _id: string;
    returnNumber?: string;
    status?: string;
  } | null;
}

interface IGRNLineOption {
  value: string;
  label: string;
  grn: IGoodsReceipt;
  line: IGRNLine;
}

interface IExceptionDashboard {
  summary: {
    openExceptionCount: number;
    sentClaimCount: number;
    rejectedQuantity: number;
    backorderQuantity: number;
    overdueReplacementCount: number;
  };
  claimAging: {
    days0To7: number;
    days8To14: number;
    days15To30: number;
    over30: number;
  };
  byVendor: Array<{
    vendorId: string;
    vendorName: string;
    openExceptionCount: number;
    openClaimCount: number;
    rejectedQuantity: number;
    backorderQuantity: number;
  }>;
  byProduct: Array<{
    productId: string;
    sku?: string | null;
    productName?: string | null;
    openExceptionCount: number;
    rejectedQuantity: number;
    backorderQuantity: number;
  }>;
}

const exceptionColor: Record<QCExceptionStatus, string> = {
  NONE: 'default',
  QUARANTINED: 'orange',
  RETURN_CREATED: 'purple',
  CLAIM_OPEN: 'gold',
  CLOSED: 'green',
};

const claimColor: Record<QCClaimStatus, string> = {
  NONE: 'default',
  OPEN: 'orange',
  SENT: 'blue',
  RESOLVED: 'green',
  CANCELLED: 'red',
};

const resultColor: Record<QCResult, string> = {
  PASSED: 'green',
  FAILED: 'red',
  CONDITIONAL: 'orange',
};

const P2PExceptionsPage = () => {
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [closeForm] = Form.useForm();

  const [rows, setRows] = useState<IQualityCheck[]>([]);
  const [grns, setGrns] = useState<IGoodsReceipt[]>([]);
  const [dashboard, setDashboard] = useState<IExceptionDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [resolvingRecord, setResolvingRecord] = useState<IQualityCheck | null>(null);

  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const fetchRows = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const [exceptionsRes, grnRes, dashboardRes] = await Promise.all([
        sendRequest<IBackendRes<IQualityCheck[]>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quality-control/exceptions`,
          method: 'GET',
          headers,
        }),
        sendRequest<IBackendRes<{ results: IGoodsReceipt[] }>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/goods-receipts`,
          method: 'GET',
          queryParams: { current: 1, pageSize: 200 },
          headers,
        }),
        sendRequest<IBackendRes<IExceptionDashboard>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quality-control/exceptions/dashboard`,
          method: 'GET',
          headers,
        }),
      ]);

      setRows(exceptionsRes?.data ?? []);
      setGrns(grnRes?.data?.results ?? []);
      setDashboard(dashboardRes?.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const grnLineOptions = useMemo<IGRNLineOption[]>(() => (
    grns.flatMap((grn) => (grn.items ?? []).map((line) => ({
      value: line._id,
      label: `${grn.grNumber || grn.grnNumber || 'GRN'} | ${grn.purchaseOrder?.poNumber || 'PO'} | ${line.product?.sku || line.productId} - ${line.product?.vietnameseName || ''}`,
      grn,
      line,
    })))
  ), [grns]);
  const selectedLineId = Form.useWatch('goodsReceiptItemId', form);
  const selectedLine = useMemo(() => (
    grnLineOptions.find((option) => option.value === selectedLineId)
  ), [grnLineOptions, selectedLineId]);

  const openCreateModal = () => {
    form.resetFields();
    form.setFieldsValue({
      result: 'FAILED',
      rejectedQuantity: 0,
      defectRate: 0,
    });
    setModalOpen(true);
  };

  const submitException = async () => {
    const values = await form.validateFields();
    if (!headers) return;

    const res = await sendRequest<IBackendRes<IQualityCheck>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quality-control`,
      method: 'POST',
      headers,
      body: values,
    });

    if (res?.data) {
      message.success('Da tao QC exception va lien ket purchase return/claim');
      setModalOpen(false);
      fetchRows();
    } else {
      message.error(res?.message || 'Khong tao duoc QC exception');
    }
  };

  const sendClaim = async (record: IQualityCheck) => {
    if (!headers) return;
    const res = await sendRequest<IBackendRes<IQualityCheck>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quality-control/${record._id}/send-claim`,
      method: 'PATCH',
      headers,
      body: { note: `Sent from exception board for ${record.claimNumber || record.checkNumber}` },
    });

    if (res?.data) {
      message.success('Da gui claim cho NCC');
      fetchRows();
    } else {
      message.error(res?.message || 'Khong gui duoc claim');
    }
  };

  const resolveException = async () => {
    if (!resolvingRecord || !headers) return;
    const values = await closeForm.validateFields();

    const res = await sendRequest<IBackendRes<IQualityCheck>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quality-control/${resolvingRecord._id}/resolve-exception`,
      method: 'PATCH',
      headers,
      body: values,
    });

    if (res?.data) {
      message.success('Da resolve exception');
      setResolvingRecord(null);
      closeForm.resetFields();
      fetchRows();
    } else {
      message.error(res?.message || 'Khong dong duoc exception');
    }
  };

  const openCount = dashboard?.summary.openExceptionCount ?? rows.filter((row) => row.exceptionStatus !== 'CLOSED').length;
  const rejectedTotal = dashboard?.summary.rejectedQuantity ?? rows.reduce((sum, row) => sum + Number(row.rejectedQuantity || 0), 0);
  const backorderTotal = dashboard?.summary.backorderQuantity ?? rows.reduce((sum, row) => sum + Number(row.backorderQuantity || 0), 0);
  const sentClaimCount = dashboard?.summary.sentClaimCount ?? rows.filter((row) => row.claimStatus === 'SENT').length;

  const columns: ColumnsType<IQualityCheck> = [
    {
      title: 'QC / Hang loi',
      key: 'qc',
      render: (_, record) => {
        const product = record.goodsReceiptItem?.product ?? record.product;
        return (
          <Space orientation="vertical" size={2}>
            <Space>
              <Text strong>{record.checkNumber}</Text>
              <Tag color={resultColor[record.result]}>{record.result}</Tag>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {product?.sku || '-'} - {product?.vietnameseName || '-'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'PO / GRN / NCC',
      key: 'source',
      render: (_, record) => {
        const po = record.purchaseOrder ?? record.goodsReceipt?.purchaseOrder;
        return (
          <Space orientation="vertical" size={2}>
            <Space>
              <Tag color="blue">{po?.poNumber || '-'}</Tag>
              <Tag>{record.goodsReceipt?.grNumber || '-'}</Tag>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>{po?.vendor?.name || '-'}</Text>
          </Space>
        );
      },
    },
    {
      title: 'So luong',
      key: 'quantities',
      width: 220,
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Text>Received: <Text strong>{record.receivedQuantity}</Text></Text>
          <Text type="danger">Rejected: <Text strong type="danger">{record.rejectedQuantity}</Text></Text>
          <Text type="secondary">Backorder: {record.backorderQuantity}</Text>
        </Space>
      ),
    },
    {
      title: 'Return / Claim',
      key: 'claim',
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Space>
            <Tag color={exceptionColor[record.exceptionStatus]}>{record.exceptionStatus}</Tag>
            <Tag color={claimColor[record.claimStatus]}>{record.claimStatus}</Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.claimNumber || '-'} | {record.purchaseReturn?.returnNumber || 'Chua co return'}
          </Text>
          {record.claimSentAt ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Sent by {record.claimSentByUsername || '-'} at {new Date(record.claimSentAt).toLocaleDateString('vi-VN')}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Settlement',
      key: 'settlement',
      width: 190,
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Tag color={record.resolutionType && record.resolutionType !== 'NONE' ? 'green' : 'default'}>
            {record.resolutionType || 'NONE'}
          </Tag>
          {Number(record.creditAmount || 0) > 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>Credit: {Number(record.creditAmount).toLocaleString('vi-VN')}</Text>
          ) : null}
          {record.replacementDueDate ? (
            <Text type="secondary" style={{ fontSize: 12 }}>Replacement due: {record.replacementDueDate}</Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Ghi chu QC',
      key: 'notes',
      ellipsis: true,
      render: (_, record) => record.inspectorNotes || record.correctiveAction || '-',
    },
    {
      title: 'Thao tac',
      key: 'actions',
      align: 'right',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            icon={<SendOutlined />}
            disabled={!['OPEN', 'SENT'].includes(record.claimStatus) || record.exceptionStatus === 'CLOSED'}
            onClick={() => sendClaim(record)}
          >
            Gui claim
          </Button>
          <Popconfirm
            title="Resolve exception nay?"
            okText="Mo form"
            cancelText="Huy"
            onConfirm={() => {
              closeForm.setFieldsValue({
                resolutionType: 'REPLACEMENT',
                note: 'Vendor da xac nhan credit/replacement',
              });
              setResolvingRecord(record);
            }}
          >
            <Button
              icon={<CheckCircleOutlined />}
              disabled={record.exceptionStatus === 'CLOSED'}
            >
              Resolve
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AdminPageScroll>
      <PageHeader
        title="Ngoai le P2P / QC"
        icon={<ExclamationCircleOutlined />}
        description="Lien ket GRN, QC, quarantine, purchase return va claim/backorder cho hang khong dat"
        extra={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchRows}>
              Tai lai
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Tao QC exception
            </Button>
          </Space>
        )}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card variant="borderless">
            <Statistic title="Exception dang mo" value={openCount} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card variant="borderless">
            <Statistic title="Tong hang reject" value={rejectedTotal} suffix="don vi" styles={{ content: { color: '#cf1322' } }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card variant="borderless">
            <Statistic title="Claim da gui NCC" value={sentClaimCount} suffix="claim" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card variant="borderless">
            <Statistic title="Can thay the/backorder" value={backorderTotal} suffix="don vi" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card variant="borderless">
            <Statistic title="Claim qua 30 ngay" value={dashboard?.claimAging.over30 ?? 0} suffix="claim" styles={{ content: { color: '#cf1322' } }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card variant="borderless">
            <Statistic title="Replacement qua han" value={dashboard?.summary.overdueReplacementCount ?? 0} suffix="dong" styles={{ content: { color: '#fa8c16' } }} />
          </Card>
        </Col>
      </Row>

      {dashboard ? (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={12}>
            <Card title="Vendor claim/backorder" variant="borderless">
              <Table
                size="small"
                rowKey="vendorId"
                pagination={false}
                dataSource={dashboard.byVendor.slice(0, 5)}
                columns={[
                  { title: 'NCC', dataIndex: 'vendorName' },
                  { title: 'Open', dataIndex: 'openExceptionCount', align: 'right' as const },
                  { title: 'Claim', dataIndex: 'openClaimCount', align: 'right' as const },
                  { title: 'Backorder', dataIndex: 'backorderQuantity', align: 'right' as const },
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Product backorder" variant="borderless">
              <Table
                size="small"
                rowKey="productId"
                pagination={false}
                dataSource={dashboard.byProduct.slice(0, 5)}
                columns={[
                  { title: 'SKU', dataIndex: 'sku' },
                  { title: 'Hang', dataIndex: 'productName' },
                  { title: 'Open', dataIndex: 'openExceptionCount', align: 'right' as const },
                  { title: 'Backorder', dataIndex: 'backorderQuantity', align: 'right' as const },
                ]}
              />
            </Card>
          </Col>
        </Row>
      ) : null}

      {openCount > 0 ? (
        <Alert
          type="warning"
          showIcon
          title={`${openCount} exception chua dong`}
          description="Purchasing can theo doi claim voi NCC; Ke toan chi ghi AP cho phan hang da nhap kho hop le."
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Card variant="borderless">
        <Table<IQualityCheck>
          rowKey="_id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title="Tao QC exception tu GRN"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submitException}
        okText="Tao exception"
        width={760}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="goodsReceiptItemId"
            label="Dong phieu nhap kho"
            rules={[{ required: true, message: 'Chon dong GRN can QC' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chon GRN line"
              options={grnLineOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={(value) => {
                const option = grnLineOptions.find((item) => item.value === value);
                form.setFieldsValue({
                  receivedQuantity: option?.line.quantityReceived ?? 0,
                  rejectedQuantity: option?.line.quantityRejected ?? 0,
                });
              }}
            />
          </Form.Item>

          {selectedLine ? (
            <Alert
              type="info"
              showIcon
              title={`${selectedLine.grn.grNumber || 'GRN'} - ${selectedLine.grn.purchaseOrder?.poNumber || 'PO'}`}
              description={`${selectedLine.line.product?.sku || ''} ${selectedLine.line.product?.vietnameseName || ''} | Received ${selectedLine.line.quantityReceived} | Rejected hien tai ${selectedLine.line.quantityRejected || 0}`}
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="result" label="Ket qua QC" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'FAILED', label: 'FAILED' },
                    { value: 'CONDITIONAL', label: 'CONDITIONAL' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="receivedQuantity" label="So luong da nhan">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="rejectedQuantity"
                label="So luong reject"
                rules={[{ required: true, message: 'Nhap so luong reject' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="defectRate" label="Defect %">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item name="correctiveAction" label="Huong xu ly">
                <Input placeholder="Return, replacement, credit note..." />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="inspectorNotes"
                label="Ghi chu QC"
                rules={[{ required: true, message: 'Nhap ly do reject' }]}
              >
                <Input.TextArea rows={3} placeholder="Mo ta loi, sai quy cach, bien ban kiem hang..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={`Resolve exception ${resolvingRecord?.checkNumber || ''}`}
        open={Boolean(resolvingRecord)}
        onCancel={() => setResolvingRecord(null)}
        onOk={resolveException}
        okText="Resolve exception"
        destroyOnHidden
      >
        <Form form={closeForm} layout="vertical">
          <Form.Item
            name="resolutionType"
            label="Loai settlement"
            rules={[{ required: true, message: 'Chon cach xu ly' }]}
          >
            <Select
              options={[
                { value: 'REPLACEMENT', label: 'Replacement / giao bu' },
                { value: 'CREDIT_NOTE', label: 'Credit note / giam tru cong no' },
                { value: 'ACCEPT_AS_IS', label: 'Chap nhan co dieu kien' },
                { value: 'CANCELLED', label: 'Huy claim' },
                { value: 'OTHER', label: 'Khac' },
              ]}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="creditAmount" label="Credit amount">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="replacementDueDate" label="Ngay giao bu">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="note"
            label="Ket qua xu ly"
            rules={[{ required: true, message: 'Nhap ket qua xu ly' }]}
          >
            <Input.TextArea rows={4} placeholder="Vendor da giao bo sung / credit note / chap nhan claim..." />
          </Form.Item>
        </Form>
      </Modal>
    </AdminPageScroll>
  );
};

export default P2PExceptionsPage;
