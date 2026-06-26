'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Table, Tag, Card, Button, Space, Typography, Tooltip, Badge, Popconfirm, App, Skeleton, Select, Row, Col, Drawer, Form, Input, Divider, theme, Statistic, Modal, Upload, AutoComplete } from 'antd';
import {
  CheckCircleOutlined,
  SendOutlined,
  RocketOutlined,
  DollarOutlined,
  EyeOutlined,
  FilePdfOutlined,
  PlusOutlined,
  SearchOutlined,
  FilterOutlined, FileProtectOutlined, ReloadOutlined, TruckOutlined, CloseCircleOutlined, UploadOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { getSession, useSession } from 'next-auth/react';
import { sendRequest, sendRequestFile } from '@/lib/api-client';
import { useCurrency } from '@/hooks/useCurrency';
import { GLOBAL_EXCHANGE_RATE } from '@/constants/currency.config';
import SalesContractDetailModal from './sales-contract.detail';
import useDebounce from '@/hooks/useDebounce';
import dayjs from 'dayjs';
import SalesContractModal from './sales-contract.modal';
import ShipmentFromPIModal from '../shipment/shipment.from-pi';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { getAccessToken } from '@/lib/auth-token';
import { getAccessRoleName } from '@/lib/access-control';


const { Text } = Typography;

const SALES_CONTRACT_WRITE_ROLES = new Set(['ADMIN', 'MANAGER', 'SALES_EXPORT']);

type SalesContractActionResponse = {
  invitation?: {
    signingUrl?: string;
    expiresAt?: string;
    signerEmailMasked?: string | null;
  };
  deliveryStatus?: string;
};

type SignatureInvitationStatus = 'CREATED' | 'SENT' | 'OPENED' | 'OTP_VERIFIED' | 'SIGNED' | 'REVOKED' | 'EXPIRED';

type SalesContractInvitation = {
  _id?: string;
  signerType?: 'BUYER' | 'INTERNAL' | string | null;
  status?: SignatureInvitationStatus | string | null;
  createdAt?: string | null;
};

type SalesContractRecord = {
  _id: string;
  signatureInvitations?: SalesContractInvitation[];
};

type SalesContractListResponse = {
  results: Array<Record<string, unknown>>;
  meta: {
    current: number;
    pageSize: number;
    total: number;
  };
};

type SalesContractAdvancedFilters = {
  buyerId?: string;
  incoterm?: string;
  paymentTerms?: string;
};

type SalesContractQueryParams = {
  current: number;
  pageSize: number;
  contractNumber?: string;
  status?: string;
  buyerId?: string;
  incoterm?: string;
  paymentTerms?: string;
};

type FetchSalesContractsOptions = {
  silent?: boolean;
};

type PartnerOption = {
  _id: string;
  name?: string;
};

type PartnerListResponse = {
  results: PartnerOption[];
};

type SignatureFormValues = {
  signerName: string;
  signerTitle?: string;
  signerEmail?: string;
  consentText: string;
};

const ACTIVE_SIGNATURE_INVITATION_STATUSES: SignatureInvitationStatus[] = [
  'CREATED',
  'SENT',
  'OPENED',
  'OTP_VERIFIED',
];

const getActiveBuyerInvitation = (record: SalesContractRecord): SalesContractInvitation | null => {
  const invitations = record.signatureInvitations || [];
  return invitations
    .filter((item) => item.signerType === 'BUYER' && ACTIVE_SIGNATURE_INVITATION_STATUSES.includes(item.status as SignatureInvitationStatus))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0] || null;
};


const getStatusConfig = (t: any): Record<string, { color: string; icon: React.ReactNode; label: string }> => ({
  DRAFT: { color: 'cyan', icon: <SendOutlined />, label: t('status.DRAFT') },
  PENDING_APPROVAL: { color: 'processing', icon: <SendOutlined />, label: t('status.PENDING_APPROVAL') },
  APPROVED: { color: 'green', icon: <CheckCircleOutlined />, label: t('status.APPROVED') },
  PENDING_BUYER_SIGNATURE: { color: 'purple', icon: <FileProtectOutlined />, label: t('status.PENDING_BUYER_SIGNATURE') },
  BUYER_SIGNED: { color: 'gold', icon: <FileProtectOutlined />, label: t('status.BUYER_SIGNED') },
  REJECTED: { color: 'red', icon: <CloseCircleOutlined />, label: t('status.REJECTED') },
  CONFIRMED: { color: 'blue', icon: <CheckCircleOutlined />, label: t('status.CONFIRMED') },
  SHIPPED: { color: 'orange', icon: <RocketOutlined />, label: t('status.SHIPPED') },
  PAID: { color: 'green', icon: <DollarOutlined />, label: t('status.PAID') },
  CANCELLED: { color: 'red', icon: <CheckCircleOutlined />, label: t('status.CANCELLED') },
});

const SalesContractTable = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState<{ record: any; signerType: 'BUYER' | 'INTERNAL' } | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get('id');
    if (id && !selectedRecord) {
      const fetchSingle = async () => {
        try {
          const res = await sendRequest<IBackendRes<any>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/${id}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${getAccessToken(null)}` }, // Note: session might be needed, but getting from localStorage via getAccessToken is enough on client side.
          });
          if (res?.data) {
            setSelectedRecord(res.data);
            setIsDetailOpen(true);
          }
        } catch (error) {
          console.error('Failed to fetch sales contract details', error);
        }
      };
      fetchSingle();
    }
  }, [searchParams]);

  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState<SalesContractAdvancedFilters>({
    buyerId: undefined,
    incoterm: undefined,
    paymentTerms: undefined,
  });
  const [filterForm] = Form.useForm();
  const [signatureForm] = Form.useForm();
  const [uploadFiles, setUploadFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const debouncedSearch = useDebounce(searchText, 500);
  const lastAutoRefreshAtRef = useRef(0);

  const { data: session } = useSession();
  const { message, notification } = App.useApp();
  const t = useTranslations('SalesContract');
  const { formatMoney, formatVND } = useCurrency();
  const { token } = theme.useToken();
  const isDark = (session?.user as any)?.theme === 'dark';

  const canWrite = SALES_CONTRACT_WRITE_ROLES.has(getAccessRoleName(session?.user));


  const fetchData = useCallback(async (
    current = 1,
    pageSize = 10,
    search = debouncedSearch,
    options: FetchSalesContractsOptions = {},
  ) => {
    if (!session) {
      setLoading(false);
      return;
    }

    if (!options.silent) setLoading(true);
    try {
      const queryParams: SalesContractQueryParams = { current, pageSize };
      if (search) queryParams.contractNumber = `/${search}/i`;
      if (statusFilter) queryParams.status = statusFilter;
      
      // Merge advanced filters
      if (advancedFilters.buyerId) queryParams.buyerId = advancedFilters.buyerId;
      if (advancedFilters.incoterm) queryParams.incoterm = advancedFilters.incoterm;
      if (advancedFilters.paymentTerms) queryParams.paymentTerms = `/${advancedFilters.paymentTerms}/i`;

      const res = await sendRequest<IBackendRes<SalesContractListResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts`,
        method: 'GET',
        queryParams,
        headers: { Authorization: `Bearer ${getAccessToken(session)}` }
      });

      if (res?.data) {
        setData(res.data.results);
        setMeta(res.data.meta);
      }
    } catch {
      message.error(t('messages.fetchError'));
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, [advancedFilters, debouncedSearch, message, session, statusFilter, t]);

  const refreshCurrentPage = useCallback((options: FetchSalesContractsOptions = {}) => {
    void fetchData(meta.current, meta.pageSize, debouncedSearch, options);
  }, [debouncedSearch, fetchData, meta.current, meta.pageSize]);

  useEffect(() => {
    void fetchData(1, meta.pageSize, debouncedSearch);
  }, [debouncedSearch, fetchData, meta.pageSize]);

  useEffect(() => {
    if (!session) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;

      const now = Date.now();
      if (now - lastAutoRefreshAtRef.current < 1000) return;

      lastAutoRefreshAtRef.current = now;
      refreshCurrentPage({ silent: true });
    };

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshCurrentPage, session]);

  useEffect(() => {
    const fetchPartners = async () => {
      const res = await sendRequest<IBackendRes<PartnerListResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 100 },
        headers: { Authorization: `Bearer ${getAccessToken(session)}` }
      });
      if (res?.data) setPartners(res.data.results);
    };
    if (session) fetchPartners();
  }, [session]);

  const handleApplyFilters = (values: SalesContractAdvancedFilters) => {
    setAdvancedFilters(values);
    setIsFilterOpen(false);
  };

  const handleResetFilters = () => {
    filterForm.resetFields();
    setAdvancedFilters({});
    setStatusFilter(null);
    setIsFilterOpen(false);
  };

  const activeFilterCount = Object.values(advancedFilters).filter(v => v !== undefined && v !== '').length;

  const handleAction = async (id: string, action: 'submit-approval' | 'send-signature' | 'resend-signature' | 'confirm' | 'ship') => {
    try {
      const session = await getSession();
      const actionUrl = action === 'resend-signature'
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/${id}/signature-invitations/resend`
        : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/${id}/${action}`;
      const res = await sendRequest<IBackendRes<SalesContractActionResponse>>({
        url: actionUrl,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getAccessToken(session)}` }
      });

      if (res?.data) {
        const successKey: Record<string, string> = {
          'submit-approval': t('messages.submitApprovalSuccess'),
          'send-signature': t('messages.sendSignatureSuccess'),
          'resend-signature': t('messages.resendSignatureSuccess'),
          confirm: t('messages.confirmSuccess'),
          ship: t('messages.shipSuccess'),
        };
        if ((action === 'send-signature' || action === 'resend-signature') && res.data.invitation?.signingUrl) {
          const signingUrl = res.data.invitation.signingUrl;
          let copied = false;
          try {
            await navigator.clipboard?.writeText(signingUrl);
            copied = true;
          } catch {
            copied = false;
          }

          notification.success({
            title: successKey[action],
            description: copied
              ? t('messages.portalLinkCopied', { delivery: res.data.deliveryStatus || 'SENT' })
              : t('messages.portalLinkFallback', { url: signingUrl }),
            duration: 6,
          });
        } else {
          message.success(successKey[action]);
        }
        fetchData(meta.current, meta.pageSize);
      } else {
        message.error(res?.message || t('messages.actionFailed'));
      }
    } catch {
      message.error(t('messages.actionFailed'));
    }
  };

  const handleRevokeSignature = async (record: SalesContractRecord) => {
    const invitation = getActiveBuyerInvitation(record);
    if (!invitation?._id) {
      message.warning(t('messages.noActiveSignatureInvitation'));
      return;
    }

    try {
      const session = await getSession();
      const res = await sendRequest<IBackendRes<SalesContractRecord>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/${record._id}/signature-invitations/${invitation._id}/revoke`,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getAccessToken(session)}` },
        body: { reason: 'Revoked from sales contract dashboard' },
      });

      if (res?.data) {
        message.success(t('messages.revokeSignatureSuccess'));
        fetchData(meta.current, meta.pageSize);
      } else {
        message.error(res?.message || t('messages.actionFailed'));
      }
    } catch {
      message.error(t('messages.actionFailed'));
    }
  };

  const openSignatureModal = (record: any, signerType: 'BUYER' | 'INTERNAL') => {
    setSignatureTarget({ record, signerType });
    setIsSignatureModalOpen(true);
  };

  useEffect(() => {
    if (!isSignatureModalOpen || !signatureTarget) return;

    const { record, signerType } = signatureTarget;
    signatureForm.setFieldsValue({
      signerName: signerType === 'BUYER'
        ? record.buyer?.contactName || record.buyer?.name
        : session?.user?.name || session?.user?.username,
      signerTitle: signerType === 'BUYER' ? 'Authorized Representative' : (session?.user as any)?.roleName || 'Authorized Signatory',
      signerEmail: signerType === 'BUYER' ? record.buyer?.email : session?.user?.email,
      consentText: t('signature.defaultConsent'),
    });
  }, [isSignatureModalOpen, signatureTarget, signatureForm, session?.user?.name, session?.user?.username, t]);

  const handleSignatureSubmit = async (values: SignatureFormValues & { password?: string }) => {
    if (!signatureTarget) return;
    setUploading(true);

    try {
      const currentSession = await getSession();
      let signatureImageFileId = null;

      // Handle file upload first if a file is selected
      if (uploadFiles.length > 0 && uploadFiles[0].originFileObj) {
        const formData = new FormData();
        formData.append('fileUpload', uploadFiles[0].originFileObj);
        formData.append('folderType', 'documents');

        const uploadRes = await sendRequestFile<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/files/upload`,
          method: 'POST',
          headers: { Authorization: `Bearer ${getAccessToken(currentSession)}` },
          body: formData,
        });

        if (uploadRes?.data?._id) {
          signatureImageFileId = uploadRes.data._id;
        } else {
          message.error('Lỗi khi tải lên chữ ký hình ảnh.');
          setUploading(false);
          return;
        }
      }

      const res = await sendRequest<IBackendRes<SalesContractRecord>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/${signatureTarget.record._id}/signatures`,
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken(currentSession)}` },
        body: {
          signerType: signatureTarget.signerType,
          signerName: values.signerName,
          signerTitle: values.signerTitle,
          signerEmail: values.signerEmail,
          consentText: values.consentText,
          signatureImageFileId: signatureImageFileId,
          password: values.password,
        },
      });

      if (res?.data) {
        message.success(
          signatureTarget.signerType === 'BUYER'
            ? t('messages.buyerSignSuccess')
            : t('messages.internalSignSuccess'),
        );
        setIsSignatureModalOpen(false);
        setSignatureTarget(null);
        signatureForm.resetFields();
        setUploadFiles([]);
        fetchData(meta.current, meta.pageSize);
      } else {
        message.error(res?.message || t('messages.actionFailed'));
      }
    } catch {
      message.error(t('messages.actionFailed'));
    } finally {
      setUploading(false);
    }
  };

  const columns = [
    {
      title: t('table.columns.contract'),
      dataIndex: 'contractNumber',
      key: 'contractNumber',
      render: (text: string, record: any) => (
        <div className="flex flex-col">
          <Text strong className="text-slate-800 dark:text-slate-200 text-sm m-0">{text}</Text>
          <Text className="text-gray-400 text-[10px]">{dayjs(record.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
        </div>
      ),
    },
    {
      title: t('table.columns.buyer'),
      dataIndex: 'buyer',
      key: 'buyer',
      render: (buyer: any) => (
        <Space size="middle">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
            {buyer?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col">
            <Text strong className="text-slate-200">{buyer?.name || 'Unknown'}</Text>
            <Text className="text-gray-500 text-xs">{buyer?.country || 'N/A'}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: t('table.columns.value'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (val: number, record: any) => (
        <div className="flex flex-col items-end">
          <Text className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {formatMoney(val, record.currencyCode)}
          </Text>
          <div className="flex items-center gap-2 mt-1">
            {record.currencyCode !== 'VND' && (
              <Text type="secondary" className="text-[10px] italic">
                (~ {formatVND(record.totalAmountVnd)})
              </Text>
            )}
            <Tag color="magenta" className="m-0 border-none font-bold px-3 py-0.5 rounded-full">
              {record.incoterm || 'FOB'}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: t('table.columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = getStatusConfig(t)[status] || getStatusConfig(t).DRAFT;
        return (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            key={status}
          >
            <Tag
              icon={config.icon}
              color={config.color}
              className="font-bold px-4 py-1 rounded-lg border-none shadow-sm uppercase tracking-wider"
            >
              {config.label}
            </Tag>
          </motion.div>
        );
      },
    },
    {
      title: t('table.columns.actions'),
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          {(record.status === 'DRAFT' || record.status === 'REJECTED') && canWrite && (
            <Popconfirm
              title={t('messages.submitApprovalTitle')}
              onConfirm={() => handleAction(record._id, 'submit-approval')}
              okText={t('messages.confirmOk')}
              cancelText={t('messages.cancel')}
            >
              <Button
                type="primary"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-none h-10 px-6 rounded-xl font-bold shadow-lg shadow-blue-500/30"
                icon={<SendOutlined />}
              >
                {t('actions.submitApproval')}
              </Button>
            </Popconfirm>
          )}

          {record.status === 'APPROVED' && canWrite && (
            <Button
              type="primary"
              className="bg-gradient-to-r from-purple-600 to-blue-600 border-none h-10 px-6 rounded-xl font-bold shadow-lg shadow-purple-500/25"
              icon={<FileProtectOutlined />}
              onClick={() => handleAction(record._id, 'send-signature')}
            >
              {t('actions.sendSignature')}
            </Button>
          )}

          {record.status === 'PENDING_BUYER_SIGNATURE' && canWrite && (
            <>
              <Button
                className="h-10 px-5 rounded-xl font-bold border-purple-200 text-purple-600 hover:border-purple-400 hover:text-purple-700"
                icon={<ReloadOutlined />}
                onClick={() => handleAction(record._id, 'resend-signature')}
              >
                {t('actions.resendSignature')}
              </Button>
              <Popconfirm
                title={t('messages.revokeSignatureTitle')}
                onConfirm={() => handleRevokeSignature(record)}
                okText={t('messages.confirmOk')}
                cancelText={t('messages.cancel')}
              >
                <Button
                  danger
                  className="h-10 px-5 rounded-xl font-bold"
                  icon={<CloseCircleOutlined />}
                >
                  {t('actions.revokeSignature')}
                </Button>
              </Popconfirm>
            </>
          )}

          {record.status === 'BUYER_SIGNED' && canWrite && (
            <Button
              type="primary"
              className="bg-gradient-to-r from-emerald-600 to-blue-600 border-none h-10 px-6 rounded-xl font-bold shadow-lg shadow-emerald-500/25"
              icon={<CheckCircleOutlined />}
              onClick={() => openSignatureModal(record, 'INTERNAL')}
            >
              {t('actions.internalSign')}
            </Button>
          )}

          {record.status === 'CONFIRMED' && canWrite && (
            <Button
              type="primary"
              className="bg-gradient-to-r from-blue-500 to-indigo-600 border-none h-10 px-6 rounded-xl font-bold shadow-lg shadow-blue-500/30"
              icon={<TruckOutlined />}
              onClick={() => { setSelectedRecord(record); setIsShipmentModalOpen(true); }}
            >
              {t('table.createShipment')}
            </Button>
          )}

          <Tooltip title={t('actions.view')}>
            <Button
              onClick={() => { setSelectedRecord(record); setIsDetailOpen(true); }}
              shape="circle"
              className="bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-white"
              icon={<EyeOutlined />}
            />
          </Tooltip>
          <Tooltip title={t('actions.pdf')}>
            <Button
              onClick={() => message.info(t('table.pdfGenerating'))}
              shape="circle"
              className="bg-slate-800 border-slate-700 text-red-400 hover:text-red-300 hover:border-red-300"
              icon={<FilePdfOutlined />}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Restored Header Section */}
      <div className="flex justify-between items-center mb-2">
        <PageHeader
          title={t('title').replace('(O2C)', '').trim()}
          icon={<FileProtectOutlined className="text-blue-500" />}
          description={t('description')}
        />
        <div className="flex space-x-3">
          <Button
            icon={<FilePdfOutlined />}
            className="flex items-center rounded-xl h-10 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900/50 hover:border-blue-500 hover:text-blue-500 transition-all"
            onClick={() => message.info(t('table.pdfGenerating'))}
          >
            {t('buttons.exportPdf')}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="bg-blue-600 hover:bg-blue-500 h-10 px-6 rounded-xl font-bold shadow-md shadow-blue-500/20 border-none flex items-center transition-all"
            onClick={() => canWrite && setIsModalOpen(true)}
            disabled={!canWrite}
          >
            {t('buttons.createNew')}
          </Button>
        </div>
      </div>

      {/* 2. Synchronized Statistics Cards */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>{t('stats.totalValue')}</Text>}
              value={data.reduce((sum, item) => sum + Number(item.totalAmountVnd || 0), 0) / GLOBAL_EXCHANGE_RATE}
              formatter={(val) => formatMoney(Number(val), 'USD')}
              styles={{ content: { color: isDark ? '#f8fafc' : '#1e293b', fontWeight: 900, fontSize: '24px' } }}
              prefix={<DollarOutlined style={{ color: '#3b82f6', marginRight: '8px' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>{t('stats.pending')}</Text>}
              value={data.filter(item => ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PENDING_BUYER_SIGNATURE', 'BUYER_SIGNED'].includes(item.status)).length}
              styles={{ content: { color: isDark ? '#f8fafc' : '#1e293b', fontWeight: 900, fontSize: '24px' } }}
              prefix={<SendOutlined style={{ color: '#f59e0b', marginRight: '8px' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>{t('stats.shipped')}</Text>}
              value={data.filter(item => item.status === 'SHIPPED' || item.status === 'PAID').length}
              styles={{ content: { color: isDark ? '#f8fafc' : '#1e293b', fontWeight: 900, fontSize: '24px' } }}
              prefix={<RocketOutlined style={{ color: '#10b981', marginRight: '8px' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 3. Main Data Section (Integrated Toolbar + Table) */}
      <Card
        variant="borderless"
        style={{
          borderRadius: '12px',
          background: isDark ? '#1e293b' : token.colorBgContainer,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)',
          marginTop: '20px'
        }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Toolbar inside Card */}
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size="large">
            <Input
              placeholder={t('filters.searchPlaceholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined className="text-slate-400" />}
              className="rounded-xl border-slate-200"
              style={{ width: 320, height: 40 }}
              allowClear
            />
            <Select
              placeholder={t('filters.allStatus')}
              allowClear
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              style={{ width: 180, height: 40 }}
              className="rounded-xl"
              options={[
                { value: 'DRAFT', label: t('status.DRAFT') },
                { value: 'PENDING_APPROVAL', label: t('status.PENDING_APPROVAL') },
                { value: 'APPROVED', label: t('status.APPROVED') },
                { value: 'PENDING_BUYER_SIGNATURE', label: t('status.PENDING_BUYER_SIGNATURE') },
                { value: 'BUYER_SIGNED', label: t('status.BUYER_SIGNED') },
                { value: 'REJECTED', label: t('status.REJECTED') },
                { value: 'CONFIRMED', label: t('status.CONFIRMED') },
                { value: 'SHIPPED', label: t('status.SHIPPED') },
                { value: 'PAID', label: t('status.PAID') },
              ]}
            />
          </Space>
          <div className="flex items-center space-x-3">
            <Badge count={activeFilterCount} size="small" offset={[2, 0]}>
              <Button 
                icon={<FilterOutlined />} 
                className={`rounded-xl h-10 transition-all ${activeFilterCount > 0 ? 'border-blue-500 text-blue-500 bg-blue-50' : 'border-slate-200 text-slate-500 bg-transparent hover:border-blue-500 hover:text-blue-500'}`}
                onClick={() => setIsFilterOpen(true)}
              >
                {t('filters.advancedFilter')}
              </Button>
            </Badge>
            <Button 
              icon={<ReloadOutlined />} 
              shape="circle" 
              className="border-slate-200 text-slate-400"
              onClick={() => fetchData(meta.current, meta.pageSize)}
            />
          </div>
        </div>

        {/* Table Section */}
        <div className="premium-table">
          {loading ? (
            <div className="p-12"><Skeleton active paragraph={{ rows: 8 }} /></div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={searchText + (statusFilter || '')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Table
                  columns={columns}
                  dataSource={data}
                  pagination={{
                    ...meta,
                    showSizeChanger: true,
                    className: "px-6 py-4 border-t border-slate-50",
                    showTotal: (total) => t('table.totalCount', { total })
                  }}
                  onChange={(pagination) => fetchData(pagination.current, pagination.pageSize)}
                  rowKey={(record: any) => record._id || record.contractNumber}
                  bordered={false}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </Card>
      <style jsx global>{`
        .premium-table .ant-table {
          background: transparent !important;
        }
        .premium-table .ant-table-thead > tr > th {
          background: transparent !important;
          color: #64748b !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          font-size: 11px !important;
          letter-spacing: 0.05em !important;
          border-bottom: 1px solid rgba(226, 232, 240, 0.1) !important;
          padding: 16px 24px !important;
        }
        .premium-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid rgba(226, 232, 240, 0.05) !important;
          padding: 20px 24px !important;
        }
        .premium-table .ant-pagination-item-active {
            background: #2563eb !important;
            border-color: #2563eb !important;
        }
        .premium-table .ant-pagination-item-active a {
            color: white !important;
        }
        .premium-select-dynamic .ant-select-selector {
            background-color: rgba(248, 250, 252, 0.05) !important;
            border-color: rgba(226, 232, 240, 0.1) !important;
            border-radius: 12px !important;
            height: 42px !important;
            display: flex !important;
            align-items: center !important;
            color: inherit !important;
        }
      `}</style>
      <SalesContractModal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchData(1, meta.pageSize);
        }}
      />
      <SalesContractDetailModal
        open={isDetailOpen}
        onCancel={() => setIsDetailOpen(false)}
        data={selectedRecord}
      />

      {selectedRecord && (
        <ShipmentFromPIModal
          open={isShipmentModalOpen}
          setOpen={setIsShipmentModalOpen}
          pi={{
            ...selectedRecord,
            piNumber: selectedRecord.contractNumber, 
            id: undefined, 
            salesContractId: selectedRecord._id,
            customer: selectedRecord.buyer // Map buyer to customer for modal display
          }}
        />
      )}

      <Modal
        title={signatureTarget?.signerType === 'BUYER' ? t('signature.buyerTitle') : t('signature.internalTitle')}
        open={isSignatureModalOpen}
        onCancel={() => {
          setIsSignatureModalOpen(false);
          setSignatureTarget(null);
          signatureForm.resetFields();
        }}
        onOk={() => signatureForm.submit()}
        okText={signatureTarget?.signerType === 'BUYER' ? t('signature.buyerOk') : t('signature.internalOk')}
        cancelText={t('messages.cancel')}
        confirmLoading={uploading}
        destroyOnHidden
      >
        <Form
          form={signatureForm}
          layout="vertical"
          onFinish={handleSignatureSubmit}
          className="pt-2"
        >
          <Form.Item
            label={t('signature.signerName')}
            name="signerName"
            rules={[{ required: true, message: t('signature.signerRequired') }]}
          >
            <Input disabled={signatureTarget?.signerType === 'INTERNAL'} className={signatureTarget?.signerType === 'INTERNAL' ? 'bg-slate-50' : ''} />
          </Form.Item>
          <Form.Item label={t('signature.signerTitle')} name="signerTitle">
            <AutoComplete
              options={[
                { value: 'Giám đốc (Director)' },
                { value: 'Phó Giám đốc (Vice Director)' },
                { value: 'Trưởng phòng Kinh doanh (Sales Manager)' },
                { value: 'Kế toán trưởng (Chief Accountant)' },
                { value: 'Người đại diện theo ủy quyền (Authorized Signatory)' }
              ]}
              placeholder="Nhập hoặc chọn chức danh..."
              filterOption={(inputValue, option) =>
                option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
              }
            />
          </Form.Item>
          <Form.Item
            label={t('signature.signerEmail')}
            name="signerEmail"
            rules={[{ type: 'email', message: t('signature.emailInvalid') }]}
          >
            <Input disabled={signatureTarget?.signerType === 'INTERNAL'} className={signatureTarget?.signerType === 'INTERNAL' ? 'bg-slate-50' : ''} />
          </Form.Item>

          {/* Document Preview Block */}
          <div className="mb-4 mt-2 p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center space-x-2 mb-2 text-slate-600">
              <FilePdfOutlined className="text-red-500" />
              <span className="font-bold text-sm">Contract Preview</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-100 h-32 overflow-y-auto text-xs text-slate-500 font-mono shadow-inner leading-relaxed">
              <p className="font-bold text-slate-700 mb-2">SALES CONTRACT #{signatureTarget?.record?.contractNumber || 'N/A'}</p>
              <p>Buyer: {signatureTarget?.record?.buyer?.name || 'N/A'}</p>
              <p>Total Value: {signatureTarget?.record?.totalAmount || 0} {signatureTarget?.record?.currencyCode || 'USD'}</p>
              <p>Incoterm: {signatureTarget?.record?.incoterm || 'N/A'}</p>
              <p className="mt-2 italic">-- Please scroll to review full contract terms --</p>
              <br/><br/><br/><br/><br/>
              <p>End of document.</p>
            </div>
          </div>

          <Form.Item
            label={t('signature.consent')}
            name="consentText"
            rules={[{ required: true, message: t('signature.consentRequired') }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>

          {signatureTarget?.signerType === 'INTERNAL' && (
            <>
              <Form.Item
                label="Mật khẩu xác thực (2FA)"
                name="password"
                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu để xác thực chữ ký' }]}
                extra={<span className="text-xs text-red-500 font-medium">Lưu ý: Nhập mật khẩu ĐĂNG NHẬP của tài khoản bạn. Vui lòng KHÔNG copy/dán Hash chứng từ hay Certificate vào đây.</span>}
              >
                <Input.Password placeholder="Nhập mật khẩu đăng nhập của bạn..." size="large" />
              </Form.Item>

              <Form.Item label="Ảnh chữ ký điện tử / Con dấu (Không bắt buộc)">
                <Upload
                  beforeUpload={() => false}
                  fileList={uploadFiles}
                  onChange={(info: any) => setUploadFiles(info.fileList)}
                  maxCount={1}
                  listType="picture"
                >
                  <Button icon={<UploadOutlined />}>Chọn file ảnh chữ ký (PNG/JPG)</Button>
                </Upload>
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      <Drawer
        title={
          <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-100">
            <FilterOutlined className="text-blue-500" />
            <span className="font-bold">{t('table.filter.title')}</span>
          </div>
        }
        placement="right"
        onClose={() => setIsFilterOpen(false)}
        open={isFilterOpen}
        size={400}
        styles={{ 
          body: { padding: '24px' } 
        }}
        extra={
          <Button type="link" onClick={handleResetFilters} className="text-slate-400 hover:text-blue-500">
            {t('table.filter.reset')}
          </Button>
        }
        footer={
          <div className="flex space-x-3 p-2">
            <Button className="flex-1 rounded-xl h-11 border-slate-200" onClick={() => setIsFilterOpen(false)}>
              {t('table.filter.cancel')}
            </Button>
            <Button type="primary" className="flex-1 rounded-xl h-11 bg-blue-600" onClick={() => filterForm.submit()}>
              {t('table.filter.apply')}
            </Button>
          </div>
        }
        className="dark:bg-slate-900"
      >
        <Form
          form={filterForm}
          layout="vertical"
          onFinish={handleApplyFilters}
          initialValues={advancedFilters}
          className="premium-form"
        >
          <Form.Item label={t('table.filter.buyer')} name="buyerId">
            <Select
              placeholder={t('table.filter.buyerPlaceholder')}
              showSearch
              allowClear
              optionFilterProp="label"
              options={partners.map(p => ({ value: p._id, label: p.name }))}
              className="premium-select-dynamic"
            />
          </Form.Item>

          <Form.Item label={t('table.filter.incoterm')} name="incoterm">
            <Select
              placeholder={t('table.filter.incotermPlaceholder')}
              allowClear
              options={[
                { value: 'EXW', label: 'EXW - Ex Works' },
                { value: 'FOB', label: 'FOB - Free On Board' },
                { value: 'CIF', label: 'CIF - Cost, Insurance and Freight' },
                { value: 'CFR', label: 'CFR - Cost and Freight' },
                { value: 'DDP', label: 'DDP - Delivered Duty Paid' },
              ]}
              className="premium-select-dynamic"
            />
          </Form.Item>

          <Form.Item label={t('table.filter.status')} name="status">
            <Select
              placeholder={t('table.filter.statusPlaceholder')}
              allowClear
              options={[
                { value: 'DRAFT', label: t('status.DRAFT') },
                { value: 'PENDING_APPROVAL', label: t('status.PENDING_APPROVAL') },
                { value: 'APPROVED', label: t('status.APPROVED') },
                { value: 'PENDING_BUYER_SIGNATURE', label: t('status.PENDING_BUYER_SIGNATURE') },
                { value: 'BUYER_SIGNED', label: t('status.BUYER_SIGNED') },
                { value: 'REJECTED', label: t('status.REJECTED') },
                { value: 'CONFIRMED', label: t('status.CONFIRMED') },
                { value: 'SHIPPED', label: t('status.SHIPPED') },
                { value: 'PAID', label: t('status.PAID') },
              ]}
              className="premium-select-dynamic"
            />
          </Form.Item>

          <Form.Item label={t('table.filter.payment')} name="paymentTerms">
            <Input placeholder={t('table.filter.paymentPlaceholder')} className="rounded-xl h-10 border-slate-200" />
          </Form.Item>
          
          <Divider className="my-6 border-slate-100 dark:border-slate-800" />
          
          <div className="bg-blue-50/50 dark:bg-blue-500/5 p-4 rounded-2xl border border-blue-100 dark:border-blue-500/10">
            <Text className="text-[11px] text-blue-600/70 uppercase font-bold tracking-widest block mb-2">{t('table.filter.hintTitle')}</Text>
            <Text className="text-slate-500 text-xs leading-relaxed">
              {t('table.filter.hintText')}
            </Text>
          </div>
        </Form>
      </Drawer>
    </div>
  );
};

export default SalesContractTable;
