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
  Tabs,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LineChartOutlined,
  PlusOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SendOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
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

interface IVendorEvaluationFormValues {
  vendorId: string;
  evaluationMonth?: Dayjs;
  qualityScore: number;
  deliveryScore: number;
  priceScore: number;
  communicationScore?: number;
  onTimeDeliveryRate?: number;
  defectRate?: number;
  note?: string;
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

const VendorEvaluationsPage = () => {
  const t = useTranslations('VendorEvaluations');
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const { message } = App.useApp();
  const [form] = Form.useForm<IVendorEvaluationFormValues>();
  const { token } = theme.useToken();

  const [dashboard, setDashboard] = useState<IVendorDashboard | null>(null);
  const [evaluations, setEvaluations] = useState<IVendorEvaluation[]>([]);
  const [vendors, setVendors] = useState<IPartnerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('scorecard');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedScorecard, setSelectedScorecard] = useState<IVendorScorecard | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<IVendorScorecardDetail | null>(null);
  const [detailMonth, setDetailMonth] = useState<Dayjs>(dayjs().startOf('month'));

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

  const emptyTableText = t('empty.noData');
  const tableLocale = { emptyText: emptyTableText };
  const detailMetricCardStyle: React.CSSProperties = { height: '100%' };
  const detailMetricBodyStyle: React.CSSProperties = { padding: 14 };

  const formatMaybePercent = (value?: number | null): string => (
    value !== null && value !== undefined ? t('format.percent', { value }) : '-'
  );

  const hasApprovedEvaluation = (record: IVendorScorecard): boolean => Boolean(record.latestEvaluation);

  const officialScore = (record: IVendorScorecard): number | null => (
    record.latestEvaluation?.overallScore ?? null
  );

  const officialGrade = (record: IVendorScorecard): VendorGrade | null => (
    record.latestEvaluation?.grade ?? null
  );

  const officialComponentScore = (
    record: IVendorScorecard,
    key: 'qualityScore' | 'deliveryScore' | 'priceScore',
  ): number | string => (
    record.latestEvaluation ? record.latestEvaluation[key] : '-'
  );

  const statusText = (status: VendorEvaluationStatus): string => t(`status.${status}`);
  const apStatusText = (status: string): string => {
    const knownStatuses = ['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'];
    return knownStatuses.includes(status) ? t(`apStatus.${status}`) : status;
  };

  const normalizedSearch = search.trim().toLowerCase();

  const filteredScorecards = useMemo(() => {
    if (!normalizedSearch) return dashboard?.scorecards ?? [];

    return (dashboard?.scorecards ?? []).filter((item) => (
      item.vendor?.name?.toLowerCase().includes(normalizedSearch)
      || item.vendor?.partnerType?.toLowerCase().includes(normalizedSearch)
      || item.latestEvaluation?.note?.toLowerCase().includes(normalizedSearch)
      || item.latestEvaluation?._id?.toLowerCase().includes(normalizedSearch)
    ));
  }, [dashboard?.scorecards, normalizedSearch]);

  const filteredDuePayables = useMemo(() => {
    if (!normalizedSearch) return dashboard?.dueSoonPayables ?? [];

    return (dashboard?.dueSoonPayables ?? []).filter((item) => (
      item.vendor?.name?.toLowerCase().includes(normalizedSearch)
      || item.vendorId.toLowerCase().includes(normalizedSearch)
      || item.invoiceNumber?.toLowerCase().includes(normalizedSearch)
      || item.status.toLowerCase().includes(normalizedSearch)
    ));
  }, [dashboard?.dueSoonPayables, normalizedSearch]);

  const filteredEvaluations = useMemo(() => {
    if (!normalizedSearch) return evaluations;

    return evaluations.filter((item) => (
      item.vendor?.name?.toLowerCase().includes(normalizedSearch)
      || item.note?.toLowerCase().includes(normalizedSearch)
      || item._id.toLowerCase().includes(normalizedSearch)
    ));
  }, [evaluations, normalizedSearch]);

  const createEvaluation = async () => {
    const values = await form.validateFields();
    if (!headers) return;
    const evaluationMonth = values.evaluationMonth;

    const res = await sendRequest<IBackendRes<IVendorEvaluation>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/vendor-evaluations`,
      method: 'POST',
      headers,
      body: {
        vendorId: values.vendorId,
        qualityScore: values.qualityScore,
        deliveryScore: values.deliveryScore,
        priceScore: values.priceScore,
        communicationScore: values.communicationScore,
        onTimeDeliveryRate: values.onTimeDeliveryRate,
        defectRate: values.defectRate,
        note: values.note,
        periodStart: evaluationMonth ? evaluationMonth.startOf('month').format('YYYY-MM-DD') : undefined,
        periodEnd: evaluationMonth ? evaluationMonth.endOf('month').format('YYYY-MM-DD') : undefined,
      },
    });

    if (res?.data) {
      message.success(t('messages.createSuccess'));
      setModalOpen(false);
      setActiveSection('workflow');
      form.resetFields();
      await fetchRows();
    } else {
      message.error(res?.message || t('messages.createError'));
    }
  };

  const mutateEvaluation = async (record: IVendorEvaluation, action: 'submit' | 'approve' | 'reject') => {
    if (!headers) return;

    const res = await sendRequest<IBackendRes<IVendorEvaluation>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/vendor-evaluations/${record._id}/${action}`,
      method: 'PATCH',
      headers,
      body: action === 'approve'
        ? { approvalNote: 'Approved from vendor evaluation dashboard' }
        : action === 'reject'
          ? { approvalNote: 'Rejected from vendor evaluation dashboard' }
          : undefined,
    });

    if (res?.data) {
      message.success(t(`messages.${action}Success`));
      setActiveSection(action === 'approve' ? 'scorecard' : 'workflow');
      await fetchRows();
    } else {
      message.error(res?.message || t('messages.workflowError'));
    }
  };

  const loadVendorDrilldown = async (
    record: IVendorScorecard,
    monthValue: Dayjs,
    clearDetail = false,
  ) => {
    if (!headers || !record.vendor?._id) return;

    setDetailLoading(true);
    if (clearDetail) setSelectedDetail(null);
    try {
      const res = await sendRequest<IBackendRes<IVendorScorecardDetail>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/vendor-evaluations/vendors/${record.vendor._id}/scorecard`,
        method: 'GET',
        queryParams: { months: 6, month: monthValue.format('YYYY-MM') },
        headers,
      });

      if (res?.data) {
        setSelectedDetail(res.data);
      } else {
        message.error(res?.message || t('messages.detailError'));
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const openVendorDrilldown = async (record: IVendorScorecard) => {
    const currentMonth = dayjs().startOf('month');
    setSelectedScorecard(record);
    setDetailMonth(currentMonth);
    setDetailOpen(true);
    await loadVendorDrilldown(record, currentMonth, true);
  };

  const closeVendorDrilldown = () => {
    setDetailOpen(false);
    setSelectedScorecard(null);
    setSelectedDetail(null);
  };

  const handleDetailMonthChange = async (value: Dayjs | null) => {
    if (!value || !selectedScorecard) return;
    const selectedMonth = value.startOf('month');
    setDetailMonth(selectedMonth);
    await loadVendorDrilldown(selectedScorecard, selectedMonth);
  };

  const trendColumns: ColumnsType<IVendorTrendPoint> = [
    {
      title: t('columns.month'),
      dataIndex: 'month',
      key: 'month',
      width: 96,
    },
    {
      title: t('columns.total'),
      key: 'overallScore',
      render: (_, record) => (
        <Space>
          <Text strong>{record.overallScore ?? '-'}</Text>
          <Text type="secondary">({record.evaluationCount})</Text>
        </Space>
      ),
    },
    {
      title: t('columns.componentScores'),
      key: 'componentScores',
      render: (_, record) => `${record.qualityScore ?? '-'} / ${record.deliveryScore ?? '-'} / ${record.priceScore ?? '-'}`,
    },
    {
      title: t('columns.onTime'),
      key: 'onTimeDeliveryRate',
      render: (_, record) => formatMaybePercent(record.onTimeDeliveryRate),
    },
    {
      title: t('columns.defect'),
      key: 'defectRate',
      render: (_, record) => formatMaybePercent(record.defectRate),
    },
  ];

  const poGrnColumns: ColumnsType<IPoGrnPerformance> = [
    {
      title: t('columns.poGrn'),
      key: 'document',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.poNumber || record.purchaseOrderId || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.type === 'GRN' ? record.grNumber : t('fallback.noGrn')}
          </Text>
        </Space>
      ),
    },
    {
      title: t('columns.deliveryDate'),
      key: 'dates',
      width: 170,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{t('labels.expectedDate', { date: record.expectedDeliveryDate ? dayjs(record.expectedDeliveryDate).format('DD/MM/YYYY') : '-' })}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('labels.receivedDate', { date: record.receivedDate ? dayjs(record.receivedDate).format('DD/MM/YYYY') : '-' })}
          </Text>
        </Space>
      ),
    },
    {
      title: t('columns.onTimeStatus'),
      key: 'onTime',
      width: 120,
      render: (_, record) => {
        if (record.isOnTime === null || record.isOnTime === undefined) return <Tag>{t('labels.unmeasured')}</Tag>;
        return record.isOnTime
          ? <Tag color="green">{t('labels.onTime')}</Tag>
          : <Tag color="red">{t('labels.lateDays', { days: record.daysLate ?? 0 })}</Tag>;
      },
    },
    {
      title: t('columns.quantityQc'),
      key: 'quantity',
      width: 150,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{t('labels.receivedQuantity', { quantity: record.receivedQuantity })}</Text>
          <Text type={record.rejectedQuantity > 0 ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
            {t('labels.rejectedAndIssue', { rejected: record.rejectedQuantity, issue: record.qualityIssueCount ?? 0 })}
          </Text>
        </Space>
      ),
    },
    {
      title: t('columns.status'),
      key: 'status',
      width: 120,
      render: (_, record) => <Tag>{record.status || '-'}</Tag>,
    },
  ];

  const claimColumns: ColumnsType<IVendorClaimItem> = [
    {
      title: t('columns.claimQc'),
      key: 'claim',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.claimNumber || record.checkNumber || record._id}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.productName || '-'}</Text>
        </Space>
      ),
    },
    {
      title: t('columns.source'),
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
      title: t('columns.status'),
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
      title: t('columns.aging'),
      key: 'aging',
      width: 100,
      render: (_, record) => <Text type={record.ageDays > 30 ? 'danger' : undefined}>{t('labels.days', { days: record.ageDays })}</Text>,
    },
    {
      title: t('columns.defectQuantity'),
      key: 'quantity',
      width: 140,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{t('labels.rejectedQuantity', { quantity: record.rejectedQuantity })}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('labels.backorderQuantity', { quantity: record.backorderQuantity })}</Text>
        </Space>
      ),
    },
    {
      title: t('columns.resolution'),
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
      title: t('columns.vendor'),
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
      title: t('columns.totalScore'),
      key: 'overallScore',
      width: 220,
      render: (_, record) => {
        const score = officialScore(record);
        const grade = officialGrade(record);

        return (
          <Space orientation="vertical" size={4} style={{ width: '100%' }}>
            <Space wrap>
              <Text strong>{score ?? '-'}</Text>
              {grade ? <Tag color={gradeColor[grade]}>{grade}</Tag> : <Tag>{t('labels.noApprovedScore')}</Tag>}
              {record.scoreTrend !== null && record.scoreTrend !== undefined && hasApprovedEvaluation(record) ? (
                <Tag color={record.scoreTrend >= 0 ? 'green' : 'red'}>
                  {record.scoreTrend >= 0 ? '+' : ''}{record.scoreTrend}
                </Tag>
              ) : null}
            </Space>
            <Progress
              percent={Number(score || 0)}
              size="small"
              status={progressStatus(score)}
              showInfo={false}
            />
          </Space>
        );
      },
    },
    {
      title: t('columns.quality'),
      key: 'quality',
      render: (_, record) => officialComponentScore(record, 'qualityScore'),
    },
    {
      title: t('columns.delivery'),
      key: 'delivery',
      render: (_, record) => officialComponentScore(record, 'deliveryScore'),
    },
    {
      title: t('columns.price'),
      key: 'price',
      render: (_, record) => officialComponentScore(record, 'priceScore'),
    },
    {
      title: t('columns.kpiPoGrn'),
      key: 'ops',
      width: 190,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{t('labels.onTimeValue', { value: record.onTimeDeliveryRate ?? '-' })}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('labels.defectValue', { value: record.defectRate ?? '-' })}</Text>
        </Space>
      ),
    },
    {
      title: t('columns.claimQc'),
      key: 'claims',
      width: 160,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{t('labels.claimCount', { count: record.claimCount ?? 0 })}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('labels.rejectCount', { count: record.rejectionCount ?? 0 })}</Text>
        </Space>
      ),
    },
    {
      title: t('columns.drilldown'),
      key: 'drilldown',
      align: 'right',
      width: 130,
      render: (_, record) => (
        <Button icon={<ProfileOutlined />} onClick={() => openVendorDrilldown(record)}>
          {t('actions.details')}
        </Button>
      ),
    },
  ];

  const evaluationColumns: ColumnsType<IVendorEvaluation> = [
    {
      title: t('columns.evaluationProfile'),
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
      title: t('columns.score'),
      key: 'scores',
      render: (_, record) => (
        <Space orientation="vertical" size={2}>
          <Text>Q: {record.qualityScore} / D: {record.deliveryScore} / P: {record.priceScore}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('labels.onTimeDefect', { onTime: record.onTimeDeliveryRate, defect: record.defectRate })}
          </Text>
        </Space>
      ),
    },
    {
      title: t('columns.total'),
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
      title: t('columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (value: VendorEvaluationStatus) => <Tag color={statusColor[value]}>{statusText(value)}</Tag>,
    },
    {
      title: t('columns.actor'),
      key: 'actor',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.evaluatedByUsername || '-'}</Text>
          {record.approvedByUsername ? (
            <Text type="secondary" style={{ fontSize: 12 }}>{t('labels.approvedBy', { username: record.approvedByUsername })}</Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('columns.actions'),
      key: 'actions',
      align: 'right',
      width: 360,
      render: (_, record) => (
        <Space wrap>
          <Button
            icon={<SendOutlined />}
            disabled={record.status !== 'DRAFT' && record.status !== 'REJECTED'}
            onClick={() => mutateEvaluation(record, 'submit')}
          >
            {t('actions.submit')}
          </Button>
          <Popconfirm
            title={t('confirm.approveTitle')}
            okText={t('actions.approve')}
            cancelText={t('actions.cancel')}
            onConfirm={() => mutateEvaluation(record, 'approve')}
          >
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              disabled={record.status !== 'SUBMITTED'}
            >
              {t('actions.approve')}
            </Button>
          </Popconfirm>
          <Popconfirm
            title={t('confirm.rejectTitle')}
            okText={t('actions.reject')}
            cancelText={t('actions.cancel')}
            onConfirm={() => mutateEvaluation(record, 'reject')}
          >
            <Button
              danger
              icon={<CloseCircleOutlined />}
              disabled={record.status !== 'SUBMITTED'}
            >
              {t('actions.reject')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const dueColumns: ColumnsType<IDuePayable> = [
    {
      title: t('columns.apInvoice'),
      key: 'invoice',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.invoiceNumber || record._id}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.vendor?.name || record.vendorId}</Text>
        </Space>
      ),
    },
    {
      title: t('columns.remainingAmount'),
      key: 'remainingAmount',
      align: 'right',
      render: (_, record) => (
        <Text strong>{formatMoneyStatic(record.remainingAmount, record.currency || 'VND')}</Text>
      ),
    },
    {
      title: t('columns.dueDate'),
      key: 'dueDate',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.dueDate ? dayjs(record.dueDate).format('DD/MM/YYYY') : '-'}</Text>
          <Tag color={record.isOverdue ? 'red' : 'orange'}>
            {record.isOverdue
              ? t('labels.overdueDays', { days: Math.abs(record.daysUntilDue || 0) })
              : t('labels.dueInDays', { days: record.daysUntilDue ?? '-' })}
          </Tag>
        </Space>
      ),
    },
    {
      title: t('columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => <Tag color={value === 'PARTIAL' ? 'blue' : 'gold'}>{apStatusText(value)}</Tag>,
    },
  ];

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('title')}
        icon={<AuditOutlined />}
        description={t('description')}
        extra={(
          <Space>
            <Input.Search
              allowClear
              placeholder={t('actions.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ width: 280 }}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchRows}>
              {t('actions.reload')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              {t('actions.create')}
            </Button>
          </Space>
        )}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title={t('stats.vendorCount')} value={dashboard?.stats.vendorCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title={t('stats.evaluatedVendors')} value={dashboard?.stats.evaluatedVendors ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title={t('stats.avgScore')} value={dashboard?.stats.avgScore ?? 0} precision={2} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title={t('stats.submittedCount')} value={dashboard?.stats.submittedCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title={t('stats.dueSoonCount')} value={dashboard?.stats.dueSoonCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title={t('stats.overdueCount')} value={dashboard?.stats.overdueCount ?? 0} styles={{ content: { color: '#cf1322' } }} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title={t('stats.onTimePoGrn')} value={avgOperationalOnTime} suffix="%" precision={2} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={4}>
          <Card variant="borderless">
            <Statistic title={t('stats.claimQc')} value={operationalSummary.claimCount + operationalSummary.rejectionCount} styles={{ content: { color: '#fa8c16' } }} />
          </Card>
        </Col>
      </Row>

      {(dashboard?.stats.overdueCount ?? 0) > 0 ? (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          title={t('alerts.overdueTitle', { count: dashboard?.stats.overdueCount ?? 0 })}
          description={t('alerts.overdueDescription')}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Tabs
        activeKey={activeSection}
        onChange={setActiveSection}
        items={[
          {
            key: 'scorecard',
            label: t('sections.scorecard'),
            children: (
              <Card title={t('sections.scorecard')} variant="borderless" style={{ overflow: 'hidden' }}>
                <Table<IVendorScorecard>
                  rowKey={(record) => record.vendor._id}
                  columns={scoreColumns}
                  dataSource={filteredScorecards}
                  loading={loading}
                  locale={tableLocale}
                  pagination={{ pageSize: 8, showSizeChanger: true }}
                  scroll={{ x: 980 }}
                />
              </Card>
            ),
          },
          {
            key: 'ap',
            label: t('sections.apAlerts'),
            children: (
              <Card title={t('sections.apAlerts')} variant="borderless" style={{ overflow: 'hidden' }}>
                <Table<IDuePayable>
                  rowKey="_id"
                  columns={dueColumns}
                  dataSource={filteredDuePayables}
                  loading={loading}
                  locale={tableLocale}
                  pagination={{ pageSize: 8, showSizeChanger: true }}
                  scroll={{ x: 620 }}
                />
              </Card>
            ),
          },
          {
            key: 'workflow',
            label: t('sections.workflow'),
            children: (
              <Card title={t('sections.workflow')} variant="borderless" style={{ overflow: 'hidden' }}>
                <Alert
                  type="info"
                  showIcon
                  title={t('alerts.workflowHintTitle')}
                  description={t('alerts.workflowHintDescription')}
                  style={{ marginBottom: 16 }}
                />
                <Table<IVendorEvaluation>
                  rowKey="_id"
                  columns={evaluationColumns}
                  dataSource={filteredEvaluations}
                  loading={loading}
                  locale={tableLocale}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 1040 }}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={selectedDetail ? t('drawer.titleWithVendor', { vendor: selectedDetail.vendor.name }) : t('sections.scorecard')}
        open={detailOpen}
        onCancel={closeVendorDrilldown}
        footer={null}
        width="min(1200px, calc(100vw - 32px))"
        centered
        destroyOnHidden
        styles={{
          header: {
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            margin: 0,
            padding: '16px 20px',
          },
          body: {
            background: token.colorBgLayout,
            maxHeight: 'calc(100vh - 140px)',
            overflowY: 'auto',
            padding: 20,
          },
        }}
      >
        {selectedDetail ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Row justify="end" align="middle" gutter={[12, 12]}>
              <Col>
                <Space wrap>
                  <Text type="secondary">{t('labels.viewMonth')}</Text>
                  <DatePicker
                    picker="month"
                    format="MM/YYYY"
                    value={detailMonth}
                    allowClear={false}
                    disabled={detailLoading}
                    onChange={handleDetailMonthChange}
                  />
                </Space>
              </Col>
            </Row>
            <Row gutter={[12, 12]}>
              <Col xs={12} md={8} xl={4}>
                <Card
                  size="small"
                  variant="borderless"
                  loading={detailLoading}
                  style={detailMetricCardStyle}
                  styles={{ body: detailMetricBodyStyle }}
                >
                  <Statistic
                    title={t('stats.latestScore')}
                    value={selectedDetail.summary.latestScore ?? 0}
                    precision={2}
                    suffix={selectedDetail.summary.latestGrade ? `/${selectedDetail.summary.latestGrade}` : ''}
                  />
                </Card>
              </Col>
              <Col xs={12} md={8} xl={4}>
                <Card
                  size="small"
                  variant="borderless"
                  loading={detailLoading}
                  style={detailMetricCardStyle}
                  styles={{ body: detailMetricBodyStyle }}
                >
                  <Statistic
                    title={t('stats.scoreTrend')}
                    value={selectedDetail.summary.scoreTrend ?? 0}
                    precision={2}
                    prefix={<LineChartOutlined />}
                    styles={{ content: { color: (selectedDetail.summary.scoreTrend ?? 0) >= 0 ? '#389e0d' : '#cf1322' } }}
                  />
                </Card>
              </Col>
              <Col xs={12} md={8} xl={4}>
                <Card
                  size="small"
                  variant="borderless"
                  loading={detailLoading}
                  style={detailMetricCardStyle}
                  styles={{ body: detailMetricBodyStyle }}
                >
                  <Statistic title={t('stats.onTimePoGrn')} value={selectedDetail.summary.onTimeRate ?? 0} suffix="%" precision={2} />
                </Card>
              </Col>
              <Col xs={12} md={8} xl={4}>
                <Card
                  size="small"
                  variant="borderless"
                  loading={detailLoading}
                  style={detailMetricCardStyle}
                  styles={{ body: detailMetricBodyStyle }}
                >
                  <Statistic title={t('stats.grnOnTimeLate')} value={`${selectedDetail.summary.onTimeCount}/${selectedDetail.summary.delayedCount}`} />
                </Card>
              </Col>
              <Col xs={12} md={8} xl={4}>
                <Card
                  size="small"
                  variant="borderless"
                  loading={detailLoading}
                  style={detailMetricCardStyle}
                  styles={{ body: detailMetricBodyStyle }}
                >
                  <Statistic
                    title={t('stats.openClaims')}
                    value={selectedDetail.summary.openClaimCount}
                    prefix={<ClockCircleOutlined />}
                    styles={{ content: { color: selectedDetail.summary.openClaimCount > 0 ? '#fa8c16' : undefined } }}
                  />
                </Card>
              </Col>
              <Col xs={12} md={8} xl={4}>
                <Card
                  size="small"
                  variant="borderless"
                  loading={detailLoading}
                  style={detailMetricCardStyle}
                  styles={{ body: detailMetricBodyStyle }}
                >
                  <Statistic
                    title={t('stats.remainingAp')}
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
                title={t('alerts.oldClaimTitle', { days: selectedDetail.summary.oldestOpenClaimAgeDays ?? 0 })}
                description={t('alerts.oldClaimDescription')}
              />
            ) : null}

            <Tabs
              defaultActiveKey="scoreTrend"
              tabBarStyle={{ marginBottom: 12 }}
              items={[
                {
                  key: 'scoreTrend',
                  label: t('sections.scoreTrend'),
                  children: (
                    <Card
                      title={(
                        <Space>
                          <LineChartOutlined />
                          {t('sections.scoreTrend')}
                        </Space>
                      )}
                      variant="borderless"
                      style={{ overflow: 'hidden', minHeight: 260 }}
                    >
                      <Table<IVendorTrendPoint>
                        rowKey="month"
                        columns={trendColumns}
                        dataSource={selectedDetail.evaluationTrend}
                        loading={detailLoading}
                        locale={tableLocale}
                        pagination={false}
                        size="small"
                        scroll={{ x: 640 }}
                      />
                    </Card>
                  ),
                },
                {
                  key: 'claimAging',
                  label: t('sections.claimAging'),
                  children: (
                    <Card title={t('sections.claimAging')} variant="borderless" loading={detailLoading}>
                      <Row gutter={[16, 16]} align="middle">
                        <Col xs={24} md={6}>
                          <Statistic title={t('stats.openSent')} value={selectedDetail.claimAging.open + selectedDetail.claimAging.sent} />
                          <Divider style={{ margin: '12px 0' }} />
                          <Text type="secondary">
                            {t('labels.resolvedCancelled', { resolved: selectedDetail.claimAging.resolved, cancelled: selectedDetail.claimAging.cancelled })}
                          </Text>
                        </Col>
                        <Col xs={24} md={18}>
                          <Row gutter={[16, 12]}>
                            <Col xs={24} md={12}>
                              <Text>{t('labels.bucket0To7', { count: selectedDetail.claimAging.buckets.days0To7 })}</Text>
                              <Progress
                                percent={Math.min((selectedDetail.claimAging.buckets.days0To7 / Math.max(selectedDetail.summary.openClaimCount, 1)) * 100, 100)}
                                showInfo={false}
                                size="small"
                              />
                            </Col>
                            <Col xs={24} md={12}>
                              <Text>{t('labels.bucket8To14', { count: selectedDetail.claimAging.buckets.days8To14 })}</Text>
                              <Progress
                                percent={Math.min((selectedDetail.claimAging.buckets.days8To14 / Math.max(selectedDetail.summary.openClaimCount, 1)) * 100, 100)}
                                showInfo={false}
                                size="small"
                              />
                            </Col>
                            <Col xs={24} md={12}>
                              <Text>{t('labels.bucket15To30', { count: selectedDetail.claimAging.buckets.days15To30 })}</Text>
                              <Progress
                                percent={Math.min((selectedDetail.claimAging.buckets.days15To30 / Math.max(selectedDetail.summary.openClaimCount, 1)) * 100, 100)}
                                showInfo={false}
                                size="small"
                              />
                            </Col>
                            <Col xs={24} md={12}>
                              <Text type={selectedDetail.claimAging.buckets.over30 > 0 ? 'danger' : undefined}>
                                {t('labels.bucketOver30', { count: selectedDetail.claimAging.buckets.over30 })}
                              </Text>
                              <Progress
                                percent={Math.min((selectedDetail.claimAging.buckets.over30 / Math.max(selectedDetail.summary.openClaimCount, 1)) * 100, 100)}
                                showInfo={false}
                                status={selectedDetail.claimAging.buckets.over30 > 0 ? 'exception' : 'normal'}
                                size="small"
                              />
                            </Col>
                          </Row>
                        </Col>
                      </Row>
                    </Card>
                  ),
                },
                {
                  key: 'claimHistory',
                  label: t('sections.claimHistory'),
                  children: (
                    <Card title={t('sections.claimHistory')} variant="borderless" style={{ overflow: 'hidden', minHeight: 260 }}>
                      <Table<IVendorClaimItem>
                        rowKey="_id"
                        columns={claimColumns}
                        dataSource={selectedDetail.claimItems}
                        loading={detailLoading}
                        locale={tableLocale}
                        pagination={{ pageSize: 6 }}
                        size="small"
                        scroll={{ x: 820 }}
                      />
                    </Card>
                  ),
                },
                {
                  key: 'poGrn',
                  label: t('sections.poGrnDrilldown'),
                  children: (
                    <Card title={t('sections.poGrnDrilldown')} variant="borderless" style={{ overflow: 'hidden', minHeight: 260 }}>
                      <Table<IPoGrnPerformance>
                        rowKey={(record) => `${record.type}-${record._id}`}
                        columns={poGrnColumns}
                        dataSource={selectedDetail.poGrnPerformance}
                        loading={detailLoading}
                        locale={tableLocale}
                        pagination={{ pageSize: 8 }}
                        size="small"
                        scroll={{ x: 760 }}
                      />
                    </Card>
                  ),
                },
                {
                  key: 'ap',
                  label: t('sections.vendorOpenAp'),
                  children: (
                    <Card title={t('sections.vendorOpenAp')} variant="borderless" style={{ overflow: 'hidden', minHeight: 260 }}>
                      <Table<IDuePayable>
                        rowKey="_id"
                        columns={dueColumns}
                        dataSource={selectedDetail.payables}
                        loading={detailLoading}
                        locale={tableLocale}
                        pagination={{ pageSize: 6 }}
                        size="small"
                        scroll={{ x: 620 }}
                      />
                    </Card>
                  ),
                },
              ]}
            />
          </Space>
        ) : (
          <Card variant="borderless" loading={detailLoading}>
            {!detailLoading ? <Alert type="info" title={t('empty.noScorecardDetail')} /> : null}
          </Card>
        )}
      </Modal>

      <Modal
        title={t('modal.createTitle')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={createEvaluation}
        okText={t('modal.save')}
        cancelText={t('actions.cancel')}
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
            evaluationMonth: dayjs().startOf('month'),
          }}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="vendorId"
                label={t('form.vendor')}
                rules={[{ required: true, message: t('validation.vendor') }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder={t('form.vendorPlaceholder')}
                  options={vendors.map((vendor) => ({
                    label: `${vendor.name} (${vendor.partnerType})`,
                    value: vendor._id,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="evaluationMonth"
                label={t('form.evaluationMonth')}
                rules={[{ required: true, message: t('validation.month') }]}
              >
                <DatePicker picker="month" format="MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="qualityScore"
                label={t('form.qualityScore')}
                rules={[{ required: true, message: t('validation.score') }]}
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="deliveryScore"
                label={t('form.deliveryScore')}
                rules={[{ required: true, message: t('validation.score') }]}
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="priceScore"
                label={t('form.priceScore')}
                rules={[{ required: true, message: t('validation.score') }]}
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="communicationScore" label={t('form.communicationScore')}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="onTimeDeliveryRate" label={t('form.onTimeRate')}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="defectRate" label={t('form.defectRate')}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="note" label={t('form.note')}>
                <Input.TextArea rows={3} placeholder={t('form.notePlaceholder')} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </AdminPageScroll>
  );
};

export default VendorEvaluationsPage;
