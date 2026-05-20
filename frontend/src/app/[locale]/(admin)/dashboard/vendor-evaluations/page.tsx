'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
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
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  LineChartOutlined,
  PlusOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SendOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSession } from 'next-auth/react';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import { formatMoneyStatic } from '@/utils/format';

const { Text } = Typography;

type VendorEvaluationStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
type VendorGrade = 'A' | 'B' | 'C' | 'D';

interface IPartnerOption {
  _id: string;
  name: string;
  partnerType: string;
  qualityScore?: number | null;
  deliveryScore?: number | null;
  priceScore?: number | null;
  vendorOverallScore?: number | null;
  vendorGrade?: VendorGrade | null;
  vendorOnTimeDeliveryRate?: number | null;
  vendorDefectRate?: number | null;
  vendorClaimCount?: number;
  vendorRejectionCount?: number;
  vendorLastEvaluationAt?: string | null;
}

interface IVendorEvaluation {
  _id: string;
  vendorId: string;
  vendor?: IPartnerOption | null;
  purchaseOrderId?: string | null;
  goodsReceiptId?: string | null;
  vendorInvoiceId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  qualityScore: number;
  deliveryScore: number;
  priceScore: number;
  communicationScore: number;
  defectRate: number;
  onTimeDeliveryRate: number;
  overallScore: number;
  grade: VendorGrade;
  status: VendorEvaluationStatus;
  evaluatedByUsername?: string | null;
  submittedByUsername?: string | null;
  approvedByUsername?: string | null;
  approvedAt?: string | null;
  note?: string | null;
  approvalNote?: string | null;
  updatedAt?: string | null;
}

interface IVendorScorecard {
  vendor: IPartnerOption;
  latestEvaluation?: IVendorEvaluation | null;
  overallScore?: number | null;
  grade?: VendorGrade | null;
  qualityScore?: number | null;
  deliveryScore?: number | null;
  priceScore?: number | null;
  onTimeDeliveryRate?: number | null;
  defectRate?: number | null;
  claimCount?: number;
  rejectionCount?: number;
  lastEvaluationAt?: string | null;
  scoreTrend?: number | null;
}

interface IDuePayable {
  _id: string;
  vendor?: IPartnerOption | null;
  vendorId: string;
  invoiceNumber?: string | null;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  currency: string;
  dueDate?: string | null;
  status: string;
  isOverdue: boolean;
  daysUntilDue?: number | null;
}

interface IVendorTrendPoint {
  month: string;
  qualityScore?: number | null;
  deliveryScore?: number | null;
  priceScore?: number | null;
  onTimeDeliveryRate?: number | null;
  defectRate?: number | null;
  overallScore?: number | null;
  evaluationCount: number;
}

interface IClaimAging {
  open: number;
  sent: number;
  resolved: number;
  cancelled: number;
  oldestOpenAgeDays?: number | null;
  buckets: {
    days0To7: number;
    days8To14: number;
    days15To30: number;
    over30: number;
  };
}

interface IVendorClaimItem {
  _id: string;
  checkNumber?: string | null;
  claimNumber?: string | null;
  claimStatus: string;
  result: string;
  productName?: string | null;
  poNumber?: string | null;
  grNumber?: string | null;
  rejectedQuantity: number;
  quarantineQuantity: number;
  backorderQuantity: number;
  creditAmount: number;
  ageDays: number;
  claimSentAt?: string | null;
  resolvedAt?: string | null;
  resolutionType?: string | null;
  replacementDueDate?: string | null;
}

interface IPoGrnPerformance {
  _id: string;
  type: 'GRN' | 'PO' | string;
  purchaseOrderId?: string | null;
  poNumber?: string | null;
  grNumber?: string | null;
  expectedDeliveryDate?: string | null;
  receivedDate?: string | null;
  isOnTime?: boolean | null;
  daysLate?: number | null;
  receivedQuantity: number;
  rejectedQuantity: number;
  qualityIssueCount?: number;
  status?: string | null;
}

interface IVendorScorecardDetail {
  vendor: IPartnerOption;
  summary: {
    evaluationCount: number;
    latestScore?: number | null;
    latestGrade?: VendorGrade | null;
    scoreTrend?: number | null;
    onTimeRate?: number | null;
    measurablePoGrnCount: number;
    onTimeCount: number;
    delayedCount: number;
    claimCount: number;
    openClaimCount: number;
    oldestOpenClaimAgeDays?: number | null;
    payableRemainingAmount: number;
    overduePayableCount: number;
  };
  evaluationTrend: IVendorTrendPoint[];
  poGrnPerformance: IPoGrnPerformance[];
  claimAging: IClaimAging;
  claimItems: IVendorClaimItem[];
  payables: IDuePayable[];
}

interface IVendorDashboard {
  stats: {
    vendorCount: number;
    evaluatedVendors: number;
    submittedCount: number;
    avgScore: number;
    dueSoonCount: number;
    overdueCount: number;
  };
  topVendors: IVendorScorecard[];
  lowScoreVendors: IVendorScorecard[];
  dueSoonPayables: IDuePayable[];
  scorecards: IVendorScorecard[];
}

const progressStatus = (score?: number | null) => {
  if (score === null || score === undefined) return 'normal';
  if (score >= 85) return 'success';
  if (score < 55) return 'exception';
  return 'normal';
};

const gradeColor: Record<VendorGrade, string> = {
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
};

const statusColor: Record<VendorEvaluationStatus, string> = {
  DRAFT: 'default',
  SUBMITTED: 'gold',
  APPROVED: 'green',
  REJECTED: 'red',
};

const statusLabel: Record<VendorEvaluationStatus, string> = {
  DRAFT: 'Nhap',
  SUBMITTED: 'Cho duyet',
  APPROVED: 'Da duyet',
  REJECTED: 'Tu choi',
};

const VendorEvaluationsPage = () => {
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const [dashboard, setDashboard] = useState<IVendorDashboard | null>(null);
  const [evaluations, setEvaluations] = useState<IVendorEvaluation[]>([]);
  const [vendors, setVendors] = useState<IPartnerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<IVendorScorecardDetail | null>(null);

  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const fetchReferenceData = useCallback(async () => {
    if (!headers) return;

    const res = await sendRequest<IBackendRes<{ results: IPartnerOption[] }>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
      method: 'GET',
      queryParams: { current: 1, pageSize: 500 },
      headers,
    });

    setVendors((res?.data?.results ?? []).filter((partner) => (
      partner.partnerType === 'SUPPLIER' || partner.partnerType === 'LOGISTICS'
    )));
  }, [headers]);

  const fetchRows = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const [dashboardRes, evaluationRes] = await Promise.all([
        sendRequest<IBackendRes<IVendorDashboard>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/vendor-evaluations/dashboard`,
          method: 'GET',
          queryParams: { days: 14 },
          headers,
        }),
        sendRequest<IBackendRes<{ results: IVendorEvaluation[] }>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/vendor-evaluations`,
          method: 'GET',
          queryParams: { current: 1, pageSize: 100 },
          headers,
        }),
      ]);

      setDashboard(dashboardRes?.data ?? null);
      setEvaluations(evaluationRes?.data?.results ?? []);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchReferenceData();
    fetchRows();
  }, [fetchReferenceData, fetchRows]);

  const operationalSummary = useMemo(() => {
    const scorecards = dashboard?.scorecards ?? [];
    return scorecards.reduce(
      (acc, item) => {
        acc.claimCount += Number(item.claimCount || 0);
        acc.rejectionCount += Number(item.rejectionCount || 0);
        if (item.onTimeDeliveryRate !== null && item.onTimeDeliveryRate !== undefined) {
          acc.onTimeSum += Number(item.onTimeDeliveryRate);
          acc.onTimeCount += 1;
        }
        return acc;
      },
      { claimCount: 0, rejectionCount: 0, onTimeSum: 0, onTimeCount: 0 },
    );
  }, [dashboard?.scorecards]);

  const avgOperationalOnTime = operationalSummary.onTimeCount
    ? Number((operationalSummary.onTimeSum / operationalSummary.onTimeCount).toFixed(2))
    : 0;

  const filteredEvaluations = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return evaluations;

    return evaluations.filter((item) => (
      item.vendor?.name?.toLowerCase().includes(keyword)
      || item.note?.toLowerCase().includes(keyword)
      || item._id.toLowerCase().includes(keyword)
    ));
  }, [evaluations, search]);

  const createEvaluation = async () => {
    const values = await form.validateFields();
    if (!headers) return;

    const res = await sendRequest<IBackendRes<IVendorEvaluation>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/vendor-evaluations`,
      method: 'POST',
      headers,
      body: {
        ...values,
        periodStart: values.periodStart ? values.periodStart.format('YYYY-MM-DD') : undefined,
        periodEnd: values.periodEnd ? values.periodEnd.format('YYYY-MM-DD') : undefined,
      },
    });

    if (res?.data) {
      message.success('Da tao danh gia nha cung cap');
      setModalOpen(false);
      form.resetFields();
      fetchRows();
    } else {
      message.error(res?.message || 'Khong tao duoc danh gia');
    }
  };

  const mutateEvaluation = async (record: IVendorEvaluation, action: 'submit' | 'approve' | 'reject') => {
    if (!headers) return;

    const res = await sendRequest<IBackendRes<IVendorEvaluation>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/vendor-evaluations/${record._id}/${action}`,
      method: 'PATCH',
      headers,
      body: action === 'approve' ? { approvalNote: 'Approved from vendor evaluation dashboard' } : undefined,
    });

    if (res?.data) {
      message.success('Da cap nhat workflow danh gia');
      fetchRows();
    } else {
      message.error(res?.message || 'Khong cap nhat duoc danh gia');
    }
  };

  const openVendorDrilldown = async (record: IVendorScorecard) => {
    if (!headers || !record.vendor?._id) return;

    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedDetail(null);
    try {
      const res = await sendRequest<IBackendRes<IVendorScorecardDetail>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/vendor-evaluations/vendors/${record.vendor._id}/scorecard`,
        method: 'GET',
        queryParams: { months: 6 },
        headers,
      });

      if (res?.data) {
        setSelectedDetail(res.data);
      } else {
        message.error(res?.message || 'Khong tai duoc scorecard NCC');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const trendColumns: ColumnsType<IVendorTrendPoint> = [
    {
      title: 'Thang',
      dataIndex: 'month',
      key: 'month',
      width: 96,
    },
    {
      title: 'Tong',
      key: 'overallScore',
      render: (_, record) => (
        <Space>
          <Text strong>{record.overallScore ?? '-'}</Text>
          <Text type="secondary">({record.evaluationCount})</Text>
        </Space>
      ),
    },
    {
      title: 'Q/D/P',
      key: 'componentScores',
      render: (_, record) => `${record.qualityScore ?? '-'} / ${record.deliveryScore ?? '-'} / ${record.priceScore ?? '-'}`,
    },
    {
      title: 'On-time',
      key: 'onTimeDeliveryRate',
      render: (_, record) => record.onTimeDeliveryRate !== null && record.onTimeDeliveryRate !== undefined
        ? `${record.onTimeDeliveryRate}%`
        : '-',
    },
    {
      title: 'Defect',
      key: 'defectRate',
      render: (_, record) => record.defectRate !== null && record.defectRate !== undefined ? `${record.defectRate}%` : '-',
    },
  ];

  const poGrnColumns: ColumnsType<IPoGrnPerformance> = [
    {
      title: 'PO/GRN',
      key: 'document',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.poNumber || record.purchaseOrderId || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.type === 'GRN' ? record.grNumber : 'Chua co GRN'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Ngay giao',
      key: 'dates',
      width: 170,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>Du kien: {record.expectedDeliveryDate ? dayjs(record.expectedDeliveryDate).format('DD/MM/YYYY') : '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Nhan: {record.receivedDate ? dayjs(record.receivedDate).format('DD/MM/YYYY') : '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Dung han',
      key: 'onTime',
      width: 120,
      render: (_, record) => {
        if (record.isOnTime === null || record.isOnTime === undefined) return <Tag>Chua do</Tag>;
        return record.isOnTime
          ? <Tag color="green">Dung han</Tag>
          : <Tag color="red">Tre {record.daysLate ?? 0} ngay</Tag>;
      },
    },
    {
      title: 'SL/QC',
      key: 'quantity',
      width: 150,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>Nhap: {record.receivedQuantity}</Text>
          <Text type={record.rejectedQuantity > 0 ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
            Reject: {record.rejectedQuantity} | Issue: {record.qualityIssueCount ?? 0}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Trang thai',
      key: 'status',
      width: 120,
      render: (_, record) => <Tag>{record.status || '-'}</Tag>,
    },
  ];

  const claimColumns: ColumnsType<IVendorClaimItem> = [
    {
      title: 'Claim/QC',
      key: 'claim',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.claimNumber || record.checkNumber || record._id}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.productName || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Nguon',
      key: 'source',
      width: 150,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.poNumber || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.grNumber || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Trang thai',
      key: 'status',
      width: 160,
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Tag color={record.claimStatus === 'RESOLVED' ? 'green' : record.claimStatus === 'CANCELLED' ? 'default' : 'orange'}>
            {record.claimStatus}
          </Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.result}</Text>
        </Space>
      ),
    },
    {
      title: 'Aging',
      key: 'aging',
      width: 100,
      render: (_, record) => <Text type={record.ageDays > 30 ? 'danger' : undefined}>{record.ageDays} ngay</Text>,
    },
    {
      title: 'SL loi',
      key: 'quantity',
      width: 140,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>Reject: {record.rejectedQuantity}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>Backorder: {record.backorderQuantity}</Text>
        </Space>
      ),
    },
    {
      title: 'Xu ly',
      key: 'resolution',
      width: 150,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.resolutionType || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.creditAmount ? formatMoneyStatic(record.creditAmount, 'VND') : '0 VND'}
          </Text>
        </Space>
      ),
    },
  ];

  const scoreColumns: ColumnsType<IVendorScorecard> = [
    {
      title: 'Nha cung cap',
      key: 'vendor',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Button
            type="link"
            onClick={() => openVendorDrilldown(record)}
            style={{ height: 'auto', padding: 0, fontWeight: 600 }}
          >
            {record.vendor?.name}
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.vendor?.partnerType}</Text>
        </Space>
      ),
    },
    {
      title: 'Tong diem',
      key: 'overallScore',
      width: 220,
      render: (_, record) => (
        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          <Space>
            <Text strong>{record.overallScore ?? '-'}</Text>
            {record.grade ? <Tag color={gradeColor[record.grade]}>{record.grade}</Tag> : <Tag>Chua co</Tag>}
            {record.scoreTrend !== null && record.scoreTrend !== undefined ? (
              <Tag color={record.scoreTrend >= 0 ? 'green' : 'red'}>
                {record.scoreTrend >= 0 ? '+' : ''}{record.scoreTrend}
              </Tag>
            ) : null}
          </Space>
          <Progress
            percent={Number(record.overallScore || 0)}
            size="small"
            status={progressStatus(record.overallScore)}
            showInfo={false}
          />
        </Space>
      ),
    },
    {
      title: 'Chat luong',
      key: 'quality',
      render: (_, record) => record.qualityScore ?? '-',
    },
    {
      title: 'Giao hang',
      key: 'delivery',
      render: (_, record) => record.deliveryScore ?? '-',
    },
    {
      title: 'Gia ca',
      key: 'price',
      render: (_, record) => record.priceScore ?? '-',
    },
    {
      title: 'KPI PO/GRN',
      key: 'ops',
      width: 190,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>On-time: {record.onTimeDeliveryRate ?? '-'}%</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>Defect: {record.defectRate ?? '-'}%</Text>
        </Space>
      ),
    },
    {
      title: 'Claim/QC',
      key: 'claims',
      width: 160,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>Claim: {record.claimCount ?? 0}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>Reject: {record.rejectionCount ?? 0}</Text>
        </Space>
      ),
    },
    {
      title: 'Drilldown',
      key: 'drilldown',
      align: 'right',
      width: 130,
      render: (_, record) => (
        <Button icon={<ProfileOutlined />} onClick={() => openVendorDrilldown(record)}>
          Chi tiet
        </Button>
      ),
    },
  ];

  const evaluationColumns: ColumnsType<IVendorEvaluation> = [
    {
      title: 'Ho so danh gia',
      key: 'evaluation',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.vendor?.name || record.vendorId}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.periodStart ? dayjs(record.periodStart).format('DD/MM/YYYY') : '-'} - {record.periodEnd ? dayjs(record.periodEnd).format('DD/MM/YYYY') : '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Diem',
      key: 'scores',
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Text>Q: {record.qualityScore} / D: {record.deliveryScore} / P: {record.priceScore}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            On-time {record.onTimeDeliveryRate}% | Defect {record.defectRate}%
          </Text>
        </Space>
      ),
    },
    {
      title: 'Tong',
      key: 'overall',
      width: 160,
      render: (_, record) => (
        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          <Space>
            <Text strong>{record.overallScore}</Text>
            <Tag color={gradeColor[record.grade]}>{record.grade}</Tag>
          </Space>
          <Progress
            percent={Number(record.overallScore || 0)}
            size="small"
            status={progressStatus(record.overallScore)}
            showInfo={false}
          />
        </Space>
      ),
    },
    {
      title: 'Trang thai',
      dataIndex: 'status',
      key: 'status',
      render: (value: VendorEvaluationStatus) => <Tag color={statusColor[value]}>{statusLabel[value]}</Tag>,
    },
    {
      title: 'Nguoi xu ly',
      key: 'actor',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.evaluatedByUsername || '-'}</Text>
          {record.approvedByUsername ? (
            <Text type="secondary" style={{ fontSize: 12 }}>Duyet: {record.approvedByUsername}</Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Thao tac',
      key: 'actions',
      align: 'right',
      width: 260,
      render: (_, record) => (
        <Space>
          <Button
            icon={<SendOutlined />}
            disabled={record.status !== 'DRAFT' && record.status !== 'REJECTED'}
            onClick={() => mutateEvaluation(record, 'submit')}
          >
            Gui duyet
          </Button>
          <Popconfirm
            title="Duyet danh gia nay?"
            okText="Duyet"
            cancelText="Huy"
            onConfirm={() => mutateEvaluation(record, 'approve')}
          >
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              disabled={record.status !== 'SUBMITTED'}
            >
              Duyet
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const dueColumns: ColumnsType<IDuePayable> = [
    {
      title: 'Hoa don AP',
      key: 'invoice',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.invoiceNumber || record._id}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.vendor?.name || record.vendorId}</Text>
        </Space>
      ),
    },
    {
      title: 'Con phai tra',
      key: 'remainingAmount',
      align: 'right',
      render: (_, record) => (
        <Text strong>{formatMoneyStatic(record.remainingAmount, record.currency || 'VND')}</Text>
      ),
    },
    {
      title: 'Han thanh toan',
      key: 'dueDate',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.dueDate ? dayjs(record.dueDate).format('DD/MM/YYYY') : '-'}</Text>
          <Tag color={record.isOverdue ? 'red' : 'orange'}>
            {record.isOverdue ? `Qua han ${Math.abs(record.daysUntilDue || 0)} ngay` : `Con ${record.daysUntilDue ?? '-'} ngay`}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Trang thai',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => <Tag color={value === 'PARTIAL' ? 'blue' : 'gold'}>{value}</Tag>,
    },
  ];

  return (
    <AdminPageScroll>
      <PageHeader
        title="Danh gia nha cung cap"
        icon={<AuditOutlined />}
        description="Vendor scorecard, workflow duyet danh gia va canh bao cong no AP sap den han"
        extra={(
          <Space>
            <Input.Search
              allowClear
              placeholder="Tim NCC hoac ghi chu"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ width: 280 }}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchRows}>
              Tai lai
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              Tao danh gia
            </Button>
          </Space>
        )}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title="Tong NCC" value={dashboard?.stats.vendorCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title="Da danh gia" value={dashboard?.stats.evaluatedVendors ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title="Diem TB" value={dashboard?.stats.avgScore ?? 0} precision={2} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title="Cho duyet" value={dashboard?.stats.submittedCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title="AP sap han" value={dashboard?.stats.dueSoonCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title="AP qua han" value={dashboard?.stats.overdueCount ?? 0} styles={{ content: { color: '#cf1322' } }} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title="On-time PO/GRN" value={avgOperationalOnTime} suffix="%" precision={2} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title="Claim/QC NCC" value={operationalSummary.claimCount + operationalSummary.rejectionCount} styles={{ content: { color: '#fa8c16' } }} />
          </Card>
        </Col>
      </Row>

      {(dashboard?.stats.overdueCount ?? 0) > 0 ? (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          title={`${dashboard?.stats.overdueCount} khoan AP da qua han`}
          description="Ke toan/Purchasing can kiem tra dieu kien thanh toan, phe duyet chi va lien he nha cung cap."
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="Scorecard NCC" variant="borderless">
            <Table<IVendorScorecard>
              rowKey={(record) => record.vendor._id}
              columns={scoreColumns}
              dataSource={dashboard?.scorecards ?? []}
              loading={loading}
              pagination={{ pageSize: 6 }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="Canh bao AP sap den han" variant="borderless">
            <Table<IDuePayable>
              rowKey="_id"
              columns={dueColumns}
              dataSource={dashboard?.dueSoonPayables ?? []}
              loading={loading}
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Workflow danh gia" variant="borderless" style={{ marginTop: 16 }}>
        <Table<IVendorEvaluation>
          rowKey="_id"
          columns={evaluationColumns}
          dataSource={filteredEvaluations}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Drawer
        title={selectedDetail ? `Scorecard NCC - ${selectedDetail.vendor.name}` : 'Scorecard NCC'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        size={1040}
      >
        {selectedDetail ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8} xl={4}>
                <Card variant="borderless" loading={detailLoading}>
                  <Statistic
                    title="Diem moi nhat"
                    value={selectedDetail.summary.latestScore ?? 0}
                    precision={2}
                    suffix={selectedDetail.summary.latestGrade ? `/${selectedDetail.summary.latestGrade}` : ''}
                  />
                </Card>
              </Col>
              <Col xs={24} md={8} xl={4}>
                <Card variant="borderless" loading={detailLoading}>
                  <Statistic
                    title="Trend diem"
                    value={selectedDetail.summary.scoreTrend ?? 0}
                    precision={2}
                    prefix={<LineChartOutlined />}
                    styles={{ content: { color: (selectedDetail.summary.scoreTrend ?? 0) >= 0 ? '#389e0d' : '#cf1322' } }}
                  />
                </Card>
              </Col>
              <Col xs={24} md={8} xl={4}>
                <Card variant="borderless" loading={detailLoading}>
                  <Statistic title="On-time PO/GRN" value={selectedDetail.summary.onTimeRate ?? 0} suffix="%" precision={2} />
                </Card>
              </Col>
              <Col xs={24} md={8} xl={4}>
                <Card variant="borderless" loading={detailLoading}>
                  <Statistic title="GRN dung/tre" value={`${selectedDetail.summary.onTimeCount}/${selectedDetail.summary.delayedCount}`} />
                </Card>
              </Col>
              <Col xs={24} md={8} xl={4}>
                <Card variant="borderless" loading={detailLoading}>
                  <Statistic
                    title="Claim dang mo"
                    value={selectedDetail.summary.openClaimCount}
                    prefix={<ClockCircleOutlined />}
                    styles={{ content: { color: selectedDetail.summary.openClaimCount > 0 ? '#fa8c16' : undefined } }}
                  />
                </Card>
              </Col>
              <Col xs={24} md={8} xl={4}>
                <Card variant="borderless" loading={detailLoading}>
                  <Statistic
                    title="AP con lai"
                    value={selectedDetail.summary.payableRemainingAmount}
                    formatter={(value) => formatMoneyStatic(Number(value || 0), 'VND')}
                  />
                </Card>
              </Col>
            </Row>

            {(selectedDetail.summary.oldestOpenClaimAgeDays ?? 0) > 30 ? (
              <Alert
                type="warning"
                showIcon
                title={`Claim lau nhat dang mo ${selectedDetail.summary.oldestOpenClaimAgeDays} ngay`}
                description="Can Purchasing/QC theo doi xu ly voi NCC de tranh tre credit note, replacement hoac purchase return."
              />
            ) : null}

            <Card
              title={(
                <Space>
                  <LineChartOutlined />
                  Trend diem 6 thang
                </Space>
              )}
              variant="borderless"
            >
              <Table<IVendorTrendPoint>
                rowKey="month"
                columns={trendColumns}
                dataSource={selectedDetail.evaluationTrend}
                loading={detailLoading}
                pagination={false}
                size="small"
              />
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={8}>
                <Card title="Claim aging" variant="borderless" loading={detailLoading}>
                  <Statistic title="Open/Sent" value={selectedDetail.claimAging.open + selectedDetail.claimAging.sent} />
                  <Divider />
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    <Text>0-7 ngay: {selectedDetail.claimAging.buckets.days0To7}</Text>
                    <Progress
                      percent={Math.min((selectedDetail.claimAging.buckets.days0To7 / Math.max(selectedDetail.summary.openClaimCount, 1)) * 100, 100)}
                      showInfo={false}
                      size="small"
                    />
                    <Text>8-14 ngay: {selectedDetail.claimAging.buckets.days8To14}</Text>
                    <Progress
                      percent={Math.min((selectedDetail.claimAging.buckets.days8To14 / Math.max(selectedDetail.summary.openClaimCount, 1)) * 100, 100)}
                      showInfo={false}
                      size="small"
                    />
                    <Text>15-30 ngay: {selectedDetail.claimAging.buckets.days15To30}</Text>
                    <Progress
                      percent={Math.min((selectedDetail.claimAging.buckets.days15To30 / Math.max(selectedDetail.summary.openClaimCount, 1)) * 100, 100)}
                      showInfo={false}
                      size="small"
                    />
                    <Text type={selectedDetail.claimAging.buckets.over30 > 0 ? 'danger' : undefined}>
                      &gt;30 ngay: {selectedDetail.claimAging.buckets.over30}
                    </Text>
                    <Progress
                      percent={Math.min((selectedDetail.claimAging.buckets.over30 / Math.max(selectedDetail.summary.openClaimCount, 1)) * 100, 100)}
                      showInfo={false}
                      status={selectedDetail.claimAging.buckets.over30 > 0 ? 'exception' : 'normal'}
                      size="small"
                    />
                    <Divider />
                    <Text type="secondary">Resolved: {selectedDetail.claimAging.resolved} | Cancelled: {selectedDetail.claimAging.cancelled}</Text>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} xl={16}>
                <Card title="Claim/Rejection history" variant="borderless">
                  <Table<IVendorClaimItem>
                    rowKey="_id"
                    columns={claimColumns}
                    dataSource={selectedDetail.claimItems}
                    loading={detailLoading}
                    pagination={{ pageSize: 5 }}
                    size="small"
                  />
                </Card>
              </Col>
            </Row>

            <Card title="PO/GRN on-time drilldown" variant="borderless">
              <Table<IPoGrnPerformance>
                rowKey={(record) => `${record.type}-${record._id}`}
                columns={poGrnColumns}
                dataSource={selectedDetail.poGrnPerformance}
                loading={detailLoading}
                pagination={{ pageSize: 8 }}
                size="small"
              />
            </Card>

            <Card title="AP dang mo cua NCC" variant="borderless">
              <Table<IDuePayable>
                rowKey="_id"
                columns={dueColumns}
                dataSource={selectedDetail.payables}
                loading={detailLoading}
                pagination={{ pageSize: 5 }}
                size="small"
              />
            </Card>
          </Space>
        ) : (
          <Card variant="borderless" loading={detailLoading}>
            {!detailLoading ? <Alert type="info" title="Chua co du lieu scorecard NCC" /> : null}
          </Card>
        )}
      </Drawer>

      <Modal
        title="Tao danh gia nha cung cap"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={createEvaluation}
        okText="Luu danh gia"
        width={760}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            qualityScore: 80,
            deliveryScore: 80,
            priceScore: 80,
            communicationScore: 80,
            onTimeDeliveryRate: 100,
            defectRate: 0,
            periodStart: dayjs().startOf('month'),
            periodEnd: dayjs().endOf('month'),
          }}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="vendorId"
                label="Nha cung cap"
                rules={[{ required: true, message: 'Chon nha cung cap' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chon supplier/logistics"
                  options={vendors.map((vendor) => ({
                    label: `${vendor.name} (${vendor.partnerType})`,
                    value: vendor._id,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="periodStart" label="Tu ngay">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="periodEnd" label="Den ngay">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="qualityScore"
                label="Chat luong"
                rules={[{ required: true, message: 'Nhap diem' }]}
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="deliveryScore"
                label="Giao hang"
                rules={[{ required: true, message: 'Nhap diem' }]}
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="priceScore"
                label="Gia ca"
                rules={[{ required: true, message: 'Nhap diem' }]}
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="communicationScore" label="Phan hoi">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="onTimeDeliveryRate" label="On-time %">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="defectRate" label="Defect %">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="note" label="Ghi chu">
                <Input.TextArea rows={3} placeholder="Nhan xet chat luong, giao hang, gia ca, su co neu co..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </AdminPageScroll>
  );
};

export default VendorEvaluationsPage;
