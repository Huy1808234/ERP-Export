'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalculatorOutlined,
  DollarOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import PortSelect from '@/components/admin/ports/PortSelect';
import { QuickAddCountryModal } from '@/components/admin/country/country.quick-add';
import { PageHeader } from '@/components/ui/PageHeader';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import { INCOTERMS_KEYS, type IncotermKey } from '@/constants/o2c';
import {
  buildCountryOptions,
  buildRegionOptions,
  getCountryDisplayName,
  getCountryRegion,
  normalizeCountryCode,
  useCountries,
  type BuyerRegionKey,
} from '@/constants/geo';
import { formatCurrency, formatMoneyStatic } from '@/utils/format';

const { Text } = Typography;



type Incoterm = IncotermKey;
type BuyerRegion = BuyerRegionKey;
type PolicyTab = 'policies' | 'history';

interface IProductOption {
  _id: string;
  sku: string;
  vietnameseName: string;
  englishName?: string | null;
  exportCurrency?: string | null;
}

interface IPartnerOption {
  _id: string;
  name: string;
  partnerType: string;
  country?: string | null;
  region?: BuyerRegion | null;
  defaultCurrency?: string | null;
}

interface IPortRef {
  _id: string;
  code: string;
  name: string;
  localName?: string | null;
  country?: string | null;
  countryCode?: string | null;
}

interface IPricingPolicy {
  _id: string;
  productId: string;
  product?: IProductOption;
  buyerId?: string | null;
  buyer?: IPartnerOption | null;
  marketRegion?: BuyerRegion | null;
  countryCode?: string | null;
  country?: string | null;
  origin_port_id?: string | null;
  originPort?: IPortRef | null;
  destination_port_id?: string | null;
  destinationPort?: IPortRef | null;
  incoterm: Incoterm;
  currency: string;
  minQuantity: number;
  maxQuantity?: number | null;
  unitPrice: number;
  inlandCostPerUnit: number;
  portChargePerUnit: number;
  freightCostPerUnit: number;
  insuranceCostPerUnit: number;
  destinationDeliveryCostPerUnit: number;
  customsCostPerUnit: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approvalWorkflowRequestId?: string | null;
  approvedByUsername?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdByUsername: string;
  note?: string | null;
}

interface ISalesPriceHistory {
  _id: string;
  product?: IProductOption;
  buyer?: IPartnerOption;
  sourceType: string;
  sourceNumber?: string | null;
  incoterm: Incoterm;
  currency: string;
  quantity: number;
  unitPrice: number;
  createdByUsername: string;
  occurredAt: string;
  pricingPolicyId?: string | null;
}

interface IPriceBreakdown {
  baseIncoterm: Incoterm;
  targetIncoterm: Incoterm;
  baseUnitPrice: number;
  inlandCostPerUnit: number;
  portChargePerUnit: number;
  freightCostPerUnit: number;
  insuranceCostPerUnit: number;
  destinationDeliveryCostPerUnit: number;
  customsCostPerUnit: number;
  derivedUnitPrice: number;
}

interface IResolvedPrice {
  source: 'PRICING_POLICY' | 'PRICING_POLICY_DERIVED' | 'PRODUCT_DEFAULT';
  pricingPolicyId: string | null;
  unitPrice: number;
  currency: string;
  policy?: IPricingPolicy | null;
  priceBreakdown?: IPriceBreakdown;
}

interface PolicyFormValues {
  productId: string;
  buyerId?: string | null;
  marketRegion?: BuyerRegion | null;
  countryCode?: string | null;
  country?: string | null;
  origin_port_id?: string | null;
  destination_port_id?: string | null;
  incoterm: Incoterm;
  currency: string;
  minQuantity: number;
  maxQuantity?: number | null;
  unitPrice: number;
  inlandCostPerUnit?: number;
  portChargePerUnit?: number;
  freightCostPerUnit?: number;
  insuranceCostPerUnit?: number;
  destinationDeliveryCostPerUnit?: number;
  customsCostPerUnit?: number;
  effectiveFrom: Dayjs;
  effectiveTo?: Dayjs | null;
  isActive: boolean;
  note?: string | null;
}

interface ResolveFormValues {
  productId: string;
  buyerId?: string | null;
  quantity: number;
  incoterm: Incoterm;
  currency: string;
  marketRegion?: BuyerRegion | null;
  countryCode?: string | null;
  country?: string | null;
  origin_port_id?: string | null;
  destination_port_id?: string | null;
  priceDate?: Dayjs | null;
}

interface TableMeta {
  current: number;
  pageSize: number;
  total: number;
}

interface PolicyFilters {
  search: string;
  incoterm?: Incoterm;
  currency?: string;
  isActive?: string;
  effectiveOn?: Dayjs | null;
}

type DerivationCostField =
  | 'inlandCostPerUnit'
  | 'portChargePerUnit'
  | 'freightCostPerUnit'
  | 'insuranceCostPerUnit'
  | 'destinationDeliveryCostPerUnit'
  | 'customsCostPerUnit';

type DerivationAvailability = Record<DerivationCostField, boolean>;

const initialMeta: TableMeta = { current: 1, pageSize: 10, total: 0 };

const INCOTERM_RANK: Record<Incoterm, number> = {
  EXW: 0,
  FOB: 1,
  CFR: 2,
  CIF: 3,
  DAP: 4,
  DDP: 5,
};

const DERIVATION_COST_FIELDS: DerivationCostField[] = [
  'inlandCostPerUnit',
  'portChargePerUnit',
  'freightCostPerUnit',
  'insuranceCostPerUnit',
  'destinationDeliveryCostPerUnit',
  'customsCostPerUnit',
];

const getNumber = (value: number | string | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getDerivationAvailability = (incoterm?: Incoterm): DerivationAvailability => {
  const rank = incoterm ? INCOTERM_RANK[incoterm] : INCOTERM_RANK.FOB;

  return {
    inlandCostPerUnit: rank < INCOTERM_RANK.FOB,
    portChargePerUnit: rank < INCOTERM_RANK.FOB,
    freightCostPerUnit: rank < INCOTERM_RANK.CFR,
    insuranceCostPerUnit: rank < INCOTERM_RANK.CIF,
    destinationDeliveryCostPerUnit: rank < INCOTERM_RANK.DAP,
    customsCostPerUnit: rank < INCOTERM_RANK.DDP,
  };
};

const normalizeDerivationCosts = (
  incoterm: Incoterm,
  values: Pick<PolicyFormValues, DerivationCostField>,
): Record<DerivationCostField, number> => {
  const availability = getDerivationAvailability(incoterm);

  return {
    inlandCostPerUnit: availability.inlandCostPerUnit ? getNumber(values.inlandCostPerUnit) : 0,
    portChargePerUnit: availability.portChargePerUnit ? getNumber(values.portChargePerUnit) : 0,
    freightCostPerUnit: availability.freightCostPerUnit ? getNumber(values.freightCostPerUnit) : 0,
    insuranceCostPerUnit: availability.insuranceCostPerUnit ? getNumber(values.insuranceCostPerUnit) : 0,
    destinationDeliveryCostPerUnit: availability.destinationDeliveryCostPerUnit
      ? getNumber(values.destinationDeliveryCostPerUnit)
      : 0,
    customsCostPerUnit: availability.customsCostPerUnit ? getNumber(values.customsCostPerUnit) : 0,
  };
};

const isFormValidationError = (
  error: unknown,
): error is { errorFields?: Array<{ name?: Array<string | number> }> } => {
  return typeof error === 'object' && error !== null && 'errorFields' in error;
};

const hasDerivationCost = (
  record: Pick<IPricingPolicy, 'incoterm' | DerivationCostField>,
): boolean => {
  const availability = getDerivationAvailability(record.incoterm);
  return DERIVATION_COST_FIELDS.some((field) => availability[field] && getNumber(record[field]) > 0);
};

const formatPortScope = (port?: IPortRef | null, port_id?: string | null): string | null => {
  if (port) return `${port.code} - ${port.localName || port.name}`;
  return port_id || null;
};

const normalizeCountryValue = (value?: string | null): string | undefined => {
  const rawValue = value?.trim();
  if (!rawValue) return undefined;
  return normalizeCountryCode(rawValue) || rawValue.toUpperCase();
};

const PricingPoliciesPage = () => {
  const t = useTranslations('PricingPolicy');
  const tPartner = useTranslations('Partner');
  const tInc = useTranslations('Incoterms');
  const locale = useLocale();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const { message, modal } = App.useApp();
  const [policyForm] = Form.useForm<PolicyFormValues>();
  const [resolveForm] = Form.useForm<ResolveFormValues>();

  const [policies, setPolicies] = useState<IPricingPolicy[]>([]);
  const [history, setHistory] = useState<ISalesPriceHistory[]>([]);
  const [products, setProducts] = useState<IProductOption[]>([]);
  const [buyers, setBuyers] = useState<IPartnerOption[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [activeTab, setActiveTab] = useState<PolicyTab>('policies');
  const [policyMeta, setPolicyMeta] = useState<TableMeta>(initialMeta);
  const [historyMeta, setHistoryMeta] = useState<TableMeta>(initialMeta);
  const [filters, setFilters] = useState<PolicyFilters>({ search: '' });
  const [historySearch, setHistorySearch] = useState('');
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [quickAddCountryVisible, setQuickAddCountryVisible] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<IPricingPolicy | null>(null);
  const [resolveResult, setResolveResult] = useState<IResolvedPrice | null>(null);
  const { current: policyCurrent, pageSize: policyPageSize } = policyMeta;
  const { current: historyCurrent, pageSize: historyPageSize } = historyMeta;
  const watchedPolicyIncoterm = Form.useWatch('incoterm', policyForm) as Incoterm | undefined;
  const watchedPolicyCountryCode = Form.useWatch('countryCode', policyForm) as string | null | undefined;
  const watchedResolveCountryCode = Form.useWatch('countryCode', resolveForm) as string | null | undefined;
  const derivationAvailability = useMemo(
    () => getDerivationAvailability(watchedPolicyIncoterm),
    [watchedPolicyIncoterm],
  );
  const { options: countryOptions } = useCountries(locale);
  const regionOptions = useMemo(() => buildRegionOptions(tPartner), [tPartner]);
  const resolverText = useCallback((
    key: string,
    fallbackVi: string,
    fallbackEn: string,
    values?: Record<string, string | number>,
  ): string => {
    const fallback = locale === 'vi' ? fallbackVi : fallbackEn;
    return t.has(key) ? t(key, values) : fallback;
  }, [locale, t]);

  const authHeaders = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const fetchReferenceData = useCallback(async () => {
    if (!authHeaders) return;
    const [productRes, partnerRes, currencyRes] = await Promise.all([
      sendRequest<IBackendRes<IModelPaginate<IProductOption>>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 200 },
        headers: authHeaders,
      }),
      sendRequest<IBackendRes<IModelPaginate<IPartnerOption>>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 200, partnerType: 'CUSTOMER' },
        headers: authHeaders,
      }),
      sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies`,
        method: 'GET',
        headers: authHeaders,
      }),
    ]);

    setProducts(productRes?.data?.results ?? []);
    setBuyers((partnerRes?.data?.results ?? []).filter((partner) => partner.partnerType === 'CUSTOMER'));
    setCurrencies(currencyRes?.data ?? []);
  }, [authHeaders]);

  const fetchRows = useCallback(async () => {
    if (!authHeaders) return;
    setLoading(true);
    try {
      const policyParams: Record<string, string | number | undefined> = {
        current: policyCurrent,
        pageSize: policyPageSize,
        search: filters.search.trim() || undefined,
        incoterm: filters.incoterm,
        currency: filters.currency?.trim().toUpperCase() || undefined,
        isActive: filters.isActive,
        effectiveOn: filters.effectiveOn ? filters.effectiveOn.format('YYYY-MM-DD') : undefined,
      };
      const historyParams: Record<string, string | number | undefined> = {
        current: historyCurrent,
        pageSize: historyPageSize,
        search: historySearch.trim() || undefined,
      };
      const [policyRes, historyRes] = await Promise.all([
        sendRequest<IBackendRes<IModelPaginate<IPricingPolicy>>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/pricing-policies`,
          method: 'GET',
          queryParams: policyParams,
          headers: authHeaders,
        }),
        sendRequest<IBackendRes<IModelPaginate<ISalesPriceHistory>>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/pricing-policies/history`,
          method: 'GET',
          queryParams: historyParams,
          headers: authHeaders,
        }),
      ]);

      const policyData = policyRes?.data;
      const historyData = historyRes?.data;
      setPolicies(policyData?.results ?? []);
      setHistory(historyData?.results ?? []);
      setPolicyMeta((prev) => ({
        ...prev,
        total: policyData?.meta?.total ?? policyData?.results?.length ?? 0,
      }));
      setHistoryMeta((prev) => ({
        ...prev,
        total: historyData?.meta?.total ?? historyData?.results?.length ?? 0,
      }));
    } finally {
      setLoading(false);
    }
  }, [
    authHeaders,
    filters.currency,
    filters.effectiveOn,
    filters.incoterm,
    filters.isActive,
    filters.search,
    historyCurrent,
    historyPageSize,
    historySearch,
    policyCurrent,
    policyPageSize,
  ]);

  const getBuyerMarketScope = useCallback((buyerId?: string | null) => {
    const buyer = buyers.find((item) => item._id === buyerId);
    if (!buyer) {
      return {
        country: undefined,
        marketRegion: undefined,
        currency: undefined,
      };
    }

    const country = normalizeCountryValue(buyer.country);
    return {
      country,
      marketRegion: buyer.region || getCountryRegion(country),
      currency: buyer.defaultCurrency?.trim().toUpperCase(),
    };
  }, [buyers]);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const visibleActiveCount = useMemo(() => policies.filter((policy) => policy.isActive).length, [policies]);
  const visibleBuyerPolicyCount = useMemo(() => policies.filter((policy) => policy.buyerId).length, [policies]);

  const resetPolicyPagination = () => setPolicyMeta((prev) => ({ ...prev, current: 1 }));
  const resetHistoryPagination = () => setHistoryMeta((prev) => ({ ...prev, current: 1 }));

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  useEffect(() => {
    if (!policyModalOpen || !watchedPolicyIncoterm) return;

    const currentValues = policyForm.getFieldsValue() as PolicyFormValues;
    const normalizedCosts = normalizeDerivationCosts(watchedPolicyIncoterm, currentValues);
    const resetPatch: Partial<Record<DerivationCostField, number>> = {};
    let shouldReset = false;

    DERIVATION_COST_FIELDS.forEach((field) => {
      if (!derivationAvailability[field] && getNumber(currentValues[field]) !== normalizedCosts[field]) {
        resetPatch[field] = normalizedCosts[field];
        shouldReset = true;
      }
    });

    if (shouldReset) {
      policyForm.setFieldsValue(resetPatch);
    }
  }, [derivationAvailability, policyForm, policyModalOpen, watchedPolicyIncoterm]);

  const openCreateModal = () => {
    setEditingPolicy(null);
    policyForm.resetFields();
    policyForm.setFieldsValue({
      incoterm: 'FOB',
      currency: 'USD',
      minQuantity: 1,
      isActive: true,
      effectiveFrom: dayjs(),
      inlandCostPerUnit: 0,
      portChargePerUnit: 0,
      freightCostPerUnit: 0,
      insuranceCostPerUnit: 0,
      destinationDeliveryCostPerUnit: 0,
      customsCostPerUnit: 0,
    });
    setPolicyModalOpen(true);
  };

  const openEditModal = (record: IPricingPolicy) => {
    setEditingPolicy(record);
    const normalizedCosts = normalizeDerivationCosts(record.incoterm, record);
    policyForm.setFieldsValue({
      ...record,
      ...normalizedCosts,
      countryCode: normalizeCountryValue(record.countryCode || record.country),
      country: record.country || undefined,
      buyerId: record.buyerId || undefined,
      marketRegion: record.marketRegion || undefined,
      origin_port_id: record.origin_port_id || undefined,
      destination_port_id: record.destination_port_id || undefined,
      effectiveFrom: dayjs(record.effectiveFrom),
      effectiveTo: record.effectiveTo ? dayjs(record.effectiveTo) : null,
    });
    setPolicyModalOpen(true);
  };

  const serializePolicyValues = (values: PolicyFormValues): Record<string, unknown> => {
    const normalizedCosts = normalizeDerivationCosts(values.incoterm, values);

    return {
      productId: values.productId,
      buyerId: values.buyerId || null,
      marketRegion: values.marketRegion || null,
      countryCode: normalizeCountryValue(values.countryCode) || null,
      country: values.country || null,
      origin_port_id: values.origin_port_id || null,
      destination_port_id: values.destination_port_id || null,
      incoterm: values.incoterm,
      currency: values.currency.trim().toUpperCase(),
      minQuantity: getNumber(values.minQuantity),
      maxQuantity: values.maxQuantity === undefined || values.maxQuantity === null ? null : getNumber(values.maxQuantity),
      unitPrice: getNumber(values.unitPrice),
      ...normalizedCosts,
      effectiveFrom: values.effectiveFrom.format('YYYY-MM-DD'),
      effectiveTo: values.effectiveTo ? values.effectiveTo.format('YYYY-MM-DD') : null,
      isActive: values.isActive,
      note: values.note || null,
    };
  };

  const savePolicy = async () => {
    if (!authHeaders) return;
    let values: PolicyFormValues;
    try {
      values = await policyForm.validateFields();
    } catch (error) {
      if (isFormValidationError(error)) {
        const firstErrorName = error.errorFields?.[0]?.name;
        if (firstErrorName) {
          policyForm.scrollToField(firstErrorName, { block: 'center' });
        }
        message.error(t('messages.validationError'));
        return;
      }
      message.error(t('messages.saveError'));
      return;
    }

    setSaving(true);
    try {
      const res = await sendRequest<IBackendRes<IPricingPolicy>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/pricing-policies${editingPolicy ? `/${editingPolicy._id}` : ''}`,
        method: editingPolicy ? 'PATCH' : 'POST',
        body: serializePolicyValues(values),
        headers: authHeaders,
      });

      if (res?.data) {
        message.success(editingPolicy ? t('messages.updateSuccess') : t('messages.createSuccess'));
        setPolicyModalOpen(false);
        setEditingPolicy(null);
        policyForm.resetFields();
        fetchRows();
      } else {
        message.error(res?.message || t('messages.saveError'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('messages.saveError');
      message.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const deactivatePolicy = (record: IPricingPolicy) => {
    if (!authHeaders) return;
    modal.confirm({
      title: t('confirmDeactivate.title'),
      content: t('confirmDeactivate.content'),
      okText: t('actions.deactivate'),
      cancelText: t('actions.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        const res = await sendRequest<IBackendRes<{ _id: string; deactivated: boolean }>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/pricing-policies/${record._id}`,
          method: 'DELETE',
          headers: authHeaders,
        });

        if (res?.data?.deactivated) {
          message.success(t('messages.deactivateSuccess'));
          fetchRows();
        } else {
          message.error(res?.message || t('messages.deactivateError'));
        }
      },
    });
  };

  const submitPolicyForApproval = (record: IPricingPolicy) => {
    if (!authHeaders) return;
    modal.confirm({
      title: 'Xác nhận gửi duyệt',
      content: 'Bạn có chắc chắn muốn gửi duyệt chính sách giá này?',
      okText: 'Gửi duyệt',
      cancelText: t('actions.cancel'),
      onOk: async () => {
        const res = await sendRequest<IBackendRes<IPricingPolicy>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/pricing-policies/${record._id}/submit-approval`,
          method: 'POST',
          headers: authHeaders,
        });

        if (res?.data) {
          message.success('Đã gửi duyệt thành công');
          fetchRows();
        } else {
          message.error(res?.message || 'Lỗi khi gửi duyệt');
        }
      },
    });
  };

  const approvePolicyManually = (record: IPricingPolicy) => {
    if (!authHeaders) return;
    modal.confirm({
      title: 'Xác nhận phê duyệt',
      content: 'Bạn có chắc chắn muốn duyệt chính sách giá này ngay lập tức?',
      okText: 'Ký duyệt',
      cancelText: t('actions.cancel'),
      onOk: async () => {
        const res = await sendRequest<IBackendRes<IPricingPolicy>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/pricing-policies/${record._id}/approve`,
          method: 'POST',
          headers: authHeaders,
          body: { note: 'Approved manually from pricing policies page' },
        });

        if (res?.data) {
          message.success('Đã phê duyệt thành công');
          fetchRows();
        } else {
          message.error(res?.message || 'Lỗi khi phê duyệt');
        }
      },
    });
  };

  const openResolveModal = (record?: IPricingPolicy) => {
    setResolveResult(null);
    resolveForm.resetFields();
    resolveForm.setFieldsValue({
      productId: record?.productId,
      buyerId: record?.buyerId || undefined,
      marketRegion: record?.marketRegion || undefined,
      countryCode: normalizeCountryValue(record?.countryCode || record?.country),
      country: record?.country || undefined,
      origin_port_id: record?.origin_port_id || undefined,
      destination_port_id: record?.destination_port_id || undefined,
      quantity: record?.minQuantity || 1,
      incoterm: record?.incoterm || 'FOB',
      currency: record?.currency || 'USD',
      priceDate: dayjs(),
    });
    setResolveModalOpen(true);
  };

  const resolvePrice = async () => {
    if (!authHeaders) return;
    const values = await resolveForm.validateFields();
    setResolving(true);
    try {
      const res = await sendRequest<IBackendRes<IResolvedPrice>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/pricing-policies/resolve`,
        method: 'GET',
        queryParams: {
          productId: values.productId,
          buyerId: values.buyerId || undefined,
          quantity: getNumber(values.quantity),
          incoterm: values.incoterm,
          currency: values.currency.trim().toUpperCase(),
          marketRegion: values.marketRegion || undefined,
          countryCode: normalizeCountryValue(values.countryCode),
          country: values.country || undefined,
          origin_port_id: values.origin_port_id || undefined,
          destination_port_id: values.destination_port_id || undefined,
          priceDate: values.priceDate ? values.priceDate.format('YYYY-MM-DD') : undefined,
        },
        headers: authHeaders,
      });

      if (res?.data) {
        setResolveResult(res.data);
        message.success(t('messages.resolveSuccess'));
      } else {
        setResolveResult(null);
        message.error(res?.message || t('messages.resolveError'));
      }
    } finally {
      setResolving(false);
    }
  };

  const formatScope = (record: IPricingPolicy) => {
    if (record.buyer?.name) return record.buyer.name;
    if (record.country) return getCountryDisplayName(record.country, locale) || record.country;
    if (record.marketRegion) return record.marketRegion;
    return t('policyTable.globalPolicy');
  };

  const formatQuantityRange = (record: Pick<IPricingPolicy, 'minQuantity' | 'maxQuantity'>) => {
    return `${formatCurrency(record.minQuantity, 2)} - ${record.maxQuantity ? formatCurrency(record.maxQuantity, 2) : t('policyTable.infinity')}`;
  };

  const productOptions = products.map((product) => ({
    value: product._id,
    label: `${product.sku} - ${product.vietnameseName}`,
  }));

  const resolvedQuantity = resolveResult ? getNumber(resolveForm.getFieldValue('quantity')) : 0;
  const resolvedLineAmount = resolveResult ? resolvedQuantity * getNumber(resolveResult.unitPrice) : 0;
  const resolvedIncoterm = resolveResult
    ? resolveResult.priceBreakdown?.targetIncoterm || resolveResult.policy?.incoterm || resolveForm.getFieldValue('incoterm') || '-'
    : '-';
  const resolvedSourcePolicy = resolveResult
    ? resolveResult.pricingPolicyId || (
      resolveResult.source === 'PRODUCT_DEFAULT'
        ? resolverText('resolver.productDefaultSource', 'Giá mặc định sản phẩm', 'Product default price')
        : '-'
    )
    : '-';
  const resolvedRoute = resolveResult
    ? [
      formatPortScope(resolveResult.policy?.originPort, resolveResult.policy?.origin_port_id),
      formatPortScope(resolveResult.policy?.destinationPort, resolveResult.policy?.destination_port_id),
    ].filter(Boolean).join(' -> ') || t('policyTable.allRoutes')
    : '-';

  const buyerOptions = buyers.map((buyer) => ({
    value: buyer._id,
    label: `${buyer.name}${buyer.country ? ` - ${getCountryDisplayName(buyer.country, locale) || buyer.country}` : ''}`,
  }));

  const incotermOptions = useMemo(() => (
    INCOTERMS_KEYS.map((term) => ({
      value: term,
      label: tInc(term),
    }))
  ), [tInc]);

  const policyColumns: ColumnsType<IPricingPolicy> = [
    {
      title: t('policyTable.product'),
      key: 'product',
      fixed: 'left',
      width: 230,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.product?.sku || record.productId}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.product?.vietnameseName || '-'}</Text>
        </Space>
      ),
    },
    {
      title: t('policyTable.marketBuyer'),
      key: 'market',
      width: 220,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{formatScope(record)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {[
              record.marketRegion,
              record.country ? getCountryDisplayName(record.country, locale) || record.country : null,
            ].filter(Boolean).join(' / ') || t('policyTable.allMarkets')}
          </Text>
        </Space>
      ),
    },
    {
      title: t('policyTable.route'),
      key: 'route',
      width: 240,
      render: (_, record) => {
        const origin = formatPortScope(record.originPort, record.origin_port_id);
        const destination = formatPortScope(record.destinationPort, record.destination_port_id);

        return origin || destination ? (
          <Space orientation="vertical" size={0}>
            <Text>{origin || '-'}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{destination || '-'}</Text>
          </Space>
        ) : <Text type="secondary">{t('policyTable.allRoutes')}</Text>;
      },
    },
    {
      title: t('policyTable.incoterm'),
      dataIndex: 'incoterm',
      key: 'incoterm',
      width: 110,
      render: (value: Incoterm) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: t('policyTable.tier'),
      key: 'tier',
      width: 150,
      render: (_, record) => formatQuantityRange(record),
    },
    {
      title: t('policyTable.price'),
      key: 'unitPrice',
      width: 150,
      align: 'right',
      render: (_, record) => <Text strong>{formatMoneyStatic(record.unitPrice, record.currency)}</Text>,
    },
    {
      title: t('policyTable.derivation'),
      key: 'derivation',
      width: 210,
      render: (_, record) => {
        const availability = getDerivationAvailability(record.incoterm);

        return hasDerivationCost(record) ? (
          <Space wrap size={4}>
            {availability.inlandCostPerUnit && getNumber(record.inlandCostPerUnit) > 0 && <Tag>{t('breakdown.inland')}</Tag>}
            {availability.portChargePerUnit && getNumber(record.portChargePerUnit) > 0 && <Tag>{t('breakdown.port')}</Tag>}
            {availability.freightCostPerUnit && getNumber(record.freightCostPerUnit) > 0 && <Tag>{t('breakdown.freight')}</Tag>}
            {availability.insuranceCostPerUnit && getNumber(record.insuranceCostPerUnit) > 0 && <Tag>{t('breakdown.insurance')}</Tag>}
            {availability.destinationDeliveryCostPerUnit && getNumber(record.destinationDeliveryCostPerUnit) > 0 && (
              <Tag>{t('breakdown.destinationDelivery')}</Tag>
            )}
            {availability.customsCostPerUnit && getNumber(record.customsCostPerUnit) > 0 && <Tag>{t('breakdown.customs')}</Tag>}
          </Space>
        ) : <Text type="secondary">{t('policyTable.noDerivation')}</Text>;
      },
    },
    {
      title: t('policyTable.effective'),
      key: 'effective',
      width: 150,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{dayjs(record.effectiveFrom).format('DD/MM/YYYY')}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.effectiveTo ? dayjs(record.effectiveTo).format('DD/MM/YYYY') : t('policyTable.unlimited')}
          </Text>
        </Space>
      ),
    },
    {
      title: t('policyTable.status'),
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (value: string, record: IPricingPolicy) => {
        let color = 'default';
        let label = value;
        if (value === 'DRAFT') { color = 'default'; label = 'Nháp'; }
        else if (value === 'PENDING_APPROVAL') { color = 'processing'; label = 'Chờ duyệt'; }
        else if (value === 'APPROVED') { color = 'success'; label = 'Đã duyệt'; }
        else if (value === 'REJECTED') { color = 'error'; label = 'Từ chối'; }
        else if (value === 'CANCELLED') { color = 'default'; label = 'Đã hủy'; }
        
        return (
          <Space orientation="vertical" size={0}>
            <Tag color={color}>{label}</Tag>
            {!record.isActive && value === 'APPROVED' && <Tag color="default">Không hiệu lực</Tag>}
            {record.isActive && <Tag color="green">Hiệu lực</Tag>}
          </Space>
        );
      },
    },
    {
      title: t('policyTable.actions'),
      key: 'actions',
      fixed: 'right',
      width: 210,
      render: (_, record) => (
        <Space size={6}>
          <Button size="small" icon={<CalculatorOutlined />} onClick={() => openResolveModal(record)}>
            {t('actions.test')}
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            {t('actions.edit')}
          </Button>
          {(record.status === 'DRAFT' || record.status === 'REJECTED') && (
            <Button size="small" type="primary" onClick={() => submitPolicyForApproval(record)}>
              Gửi duyệt
            </Button>
          )}
          {record.status === 'PENDING_APPROVAL' && (
            <Button size="small" type="primary" onClick={() => approvePolicyManually(record)}>
              Ký duyệt
            </Button>
          )}
          <Button
            size="small"
            danger
            disabled={!record.isActive}
            icon={<StopOutlined />}
            onClick={() => deactivatePolicy(record)}
          >
            {t('actions.deactivate')}
          </Button>
        </Space>
      ),
    },
  ];

  const historyColumns: ColumnsType<ISalesPriceHistory> = [
    {
      title: t('historyTable.product'),
      key: 'product',
      width: 220,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.product?.sku || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.product?.vietnameseName || '-'}</Text>
        </Space>
      ),
    },
    { title: t('historyTable.buyer'), key: 'buyer', width: 180, render: (_, record) => record.buyer?.name || '-' },
    {
      title: t('historyTable.source'),
      key: 'source',
      width: 220,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Tag color={record.sourceType === 'SALES_CONTRACT' ? 'purple' : 'cyan'}>{record.sourceType}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.sourceNumber || record._id}</Text>
        </Space>
      ),
    },
    { title: t('historyTable.incoterm'), dataIndex: 'incoterm', key: 'incoterm', width: 110, render: (value: Incoterm) => <Tag>{value}</Tag> },
    { title: t('historyTable.quantity'), dataIndex: 'quantity', key: 'quantity', width: 120, align: 'right', render: (value: number) => formatCurrency(value, 2) },
    { title: t('historyTable.unitPrice'), key: 'unitPrice', width: 150, align: 'right', render: (_, record) => formatMoneyStatic(record.unitPrice, record.currency) },
    { title: t('historyTable.occurredAt'), dataIndex: 'occurredAt', key: 'occurredAt', width: 160, render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm') },
    { title: t('historyTable.createdBy'), dataIndex: 'createdByUsername', key: 'createdByUsername', width: 140 },
  ];

  const renderBreakdown = () => {
    if (!resolveResult?.priceBreakdown) return null;
    const breakdown = resolveResult.priceBreakdown;
    const rows = [
      { label: t('breakdown.base'), value: breakdown.baseUnitPrice },
      { label: t('breakdown.inland'), value: breakdown.inlandCostPerUnit },
      { label: t('breakdown.port'), value: breakdown.portChargePerUnit },
      { label: t('breakdown.freight'), value: breakdown.freightCostPerUnit },
      { label: t('breakdown.insurance'), value: breakdown.insuranceCostPerUnit },
      { label: t('breakdown.destinationDelivery'), value: breakdown.destinationDeliveryCostPerUnit },
      { label: t('breakdown.customs'), value: breakdown.customsCostPerUnit },
    ].filter((row) => row.value > 0 || row.label === t('breakdown.base'));

    return (
      <Card size="small" title={`${breakdown.baseIncoterm} -> ${breakdown.targetIncoterm}`} style={{ marginTop: 16 }}>
        <Table
          size="small"
          pagination={false}
          rowKey="label"
          dataSource={rows}
          columns={[
            { title: t('breakdown.component'), dataIndex: 'label' },
            { title: t('breakdown.amount'), dataIndex: 'value', align: 'right', render: (value: number) => formatMoneyStatic(value, resolveResult.currency) },
          ]}
        />
      </Card>
    );
  };

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('title')}
        icon={<DollarOutlined />}
        description={t('description')}
        extra={(
          <Space orientation="horizontal">
            <Button icon={<CalculatorOutlined />} onClick={() => openResolveModal()}>
              {t('actions.test')}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchReferenceData(); fetchRows(); }}>
              {t('actions.reload')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {t('actions.create')}
            </Button>
          </Space>
        )}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('summary.total')} value={policyMeta.total} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('summary.visibleActive')} value={visibleActiveCount} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('summary.visibleBuyer')} value={visibleBuyerPolicyCount} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('summary.history')} value={historyMeta.total} />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as PolicyTab)}
          items={[
            {
              key: 'policies',
              label: t('tabs.policies'),
              children: (
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} lg={8}>
                      <Input
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder={t('searchPlaceholder')}
                        value={filters.search}
                        onChange={(event) => {
                          setFilters((prev) => ({ ...prev, search: event.target.value }));
                          resetPolicyPagination();
                        }}
                      />
                    </Col>
                    <Col xs={12} lg={3}>
                      <Select
                        allowClear
                        placeholder={t('filters.incoterm')}
                        value={filters.incoterm}
                        options={incotermOptions}
                        style={{ width: '100%' }}
                        onChange={(value) => {
                          setFilters((prev) => ({ ...prev, incoterm: value }));
                          resetPolicyPagination();
                        }}
                      />
                    </Col>
                    <Col xs={12} lg={3}>
                      <Select
                        allowClear
                        showSearch
                        placeholder={t('filters.currency')}
                        value={filters.currency}
                        options={currencies.map((c) => ({ value: c.code, label: c.code }))}
                        style={{ width: '100%' }}
                        onChange={(value) => {
                          setFilters((prev) => ({ ...prev, currency: value }));
                          resetPolicyPagination();
                        }}
                      />
                    </Col>
                    <Col xs={12} lg={4}>
                      <Select
                        allowClear
                        placeholder={t('filters.status')}
                        value={filters.isActive}
                        options={[
                          { value: 'true', label: t('status.active') },
                          { value: 'false', label: t('status.inactive') },
                        ]}
                        style={{ width: '100%' }}
                        onChange={(value) => {
                          setFilters((prev) => ({ ...prev, isActive: value }));
                          resetPolicyPagination();
                        }}
                      />
                    </Col>
                    <Col xs={12} lg={4}>
                      <DatePicker
                        allowClear
                        placeholder={t('filters.effectiveOn')}
                        value={filters.effectiveOn}
                        style={{ width: '100%' }}
                        onChange={(value) => {
                          setFilters((prev) => ({ ...prev, effectiveOn: value }));
                          resetPolicyPagination();
                        }}
                      />
                    </Col>
                    <Col xs={24} lg={2}>
                      <Button block onClick={() => {
                        setFilters({ search: '' });
                        resetPolicyPagination();
                      }}>
                        {t('actions.reset')}
                      </Button>
                    </Col>
                  </Row>

                  <Table<IPricingPolicy>
                    rowKey="_id"
                    columns={policyColumns}
                    dataSource={policies}
                    loading={loading}
                    scroll={{ x: 1740 }}
                    pagination={{
                      current: policyMeta.current,
                      pageSize: policyMeta.pageSize,
                      total: policyMeta.total,
                      showSizeChanger: true,
                    }}
                    onChange={(pagination) => setPolicyMeta((prev) => ({
                      ...prev,
                      current: pagination.current ?? prev.current,
                      pageSize: pagination.pageSize ?? prev.pageSize,
                    }))}
                  />
                </Space>
              ),
            },
            {
              key: 'history',
              label: t('tabs.history'),
              children: (
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder={t('historySearchPlaceholder')}
                    value={historySearch}
                    onChange={(event) => {
                      setHistorySearch(event.target.value);
                      resetHistoryPagination();
                    }}
                    style={{ maxWidth: 420 }}
                  />
                  <Table<ISalesPriceHistory>
                    rowKey="_id"
                    columns={historyColumns}
                    dataSource={history}
                    loading={loading}
                    scroll={{ x: 1200 }}
                    pagination={{
                      current: historyMeta.current,
                      pageSize: historyMeta.pageSize,
                      total: historyMeta.total,
                      showSizeChanger: true,
                    }}
                    onChange={(pagination) => setHistoryMeta((prev) => ({
                      ...prev,
                      current: pagination.current ?? prev.current,
                      pageSize: pagination.pageSize ?? prev.pageSize,
                    }))}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {isClientReady && (
        <Modal
          title={editingPolicy ? t('modal.editTitle') : t('modal.title')}
          open={policyModalOpen}
          onCancel={() => {
            setPolicyModalOpen(false);
            setEditingPolicy(null);
          }}
          onOk={savePolicy}
          confirmLoading={saving}
          width={920}
          okText={t('actions.save')}
          cancelText={t('actions.cancel')}
          forceRender
          destroyOnHidden
        >
          <Form form={policyForm} layout="vertical">
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="productId" label={t('form.product')} rules={[{ required: true }]}>
                  <Select showSearch placeholder={t('form.productPlaceholder')} optionFilterProp="label" options={productOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="buyerId" label={t('form.buyer')}>
                  <Select
                    allowClear
                    showSearch
                    placeholder={t('form.buyerPlaceholder')}
                    optionFilterProp="label"
                    options={buyerOptions}
                    onChange={(buyerId?: string) => {
                      const scope = getBuyerMarketScope(buyerId);
                      policyForm.setFieldsValue({
                        country: scope.country,
                        marketRegion: scope.marketRegion,
                        destination_port_id: undefined,
                        ...(scope.currency ? { currency: scope.currency } : {}),
                      });
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="marketRegion" label={t('form.region')}>
                  <Select allowClear options={regionOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="countryCode" label={t('form.countryCode') || 'Mã quốc gia'}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      options={countryOptions}
                      placeholder="US, DE, JP..."
                      onChange={(value?: string) => {
                        const countryCode = normalizeCountryValue(value);
                        const countryName = countryCode ? (getCountryDisplayName(countryCode, locale) || countryCode) : undefined;
                        policyForm.setFieldsValue({
                          countryCode,
                          country: countryName,
                          marketRegion: getCountryRegion(countryCode),
                          destination_port_id: undefined,
                        });
                      }}
                    />
                    <Button icon={<PlusOutlined />} onClick={() => setQuickAddCountryVisible(true)} />
                  </Space.Compact>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="country" label={t('form.country')}>
                  <Input disabled placeholder={t('form.country')} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="incoterm" label={t('form.incoterm')} rules={[{ required: true }]}>
                  <Select options={incotermOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="origin_port_id" label={t('form.originPort')}>
                  <PortSelect />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="destination_port_id" label={t('form.destinationPort')}>
                  <PortSelect />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="currency" label={t('form.currency')} rules={[{ required: true }]}>
                  <Select showSearch options={currencies.map((c) => ({ value: c.code, label: c.code }))} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="unitPrice" label={t('form.unitPrice')} rules={[{ required: true }]}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Form.Item name="minQuantity" label={t('form.minQuantity')} rules={[{ required: true }]}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Form.Item name="maxQuantity" label={t('form.maxQuantity')}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Card
              size="small"
              title={t('form.derivationCosts')}
              extra={<Tag color="blue">{watchedPolicyIncoterm ?? 'FOB'}</Tag>}
              style={{ marginBottom: 16 }}
            >
              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <Form.Item name="inlandCostPerUnit" label={t('form.inlandCostPerUnit')}>
                    <InputNumber min={0} disabled={!derivationAvailability.inlandCostPerUnit} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="portChargePerUnit" label={t('form.portChargePerUnit')}>
                    <InputNumber min={0} disabled={!derivationAvailability.portChargePerUnit} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="freightCostPerUnit" label={t('form.freightCostPerUnit')}>
                    <InputNumber min={0} disabled={!derivationAvailability.freightCostPerUnit} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="insuranceCostPerUnit" label={t('form.insuranceCostPerUnit')}>
                    <InputNumber min={0} disabled={!derivationAvailability.insuranceCostPerUnit} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="destinationDeliveryCostPerUnit" label={t('form.destinationDeliveryCostPerUnit')}>
                    <InputNumber
                      min={0}
                      disabled={!derivationAvailability.destinationDeliveryCostPerUnit}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="customsCostPerUnit" label={t('form.customsCostPerUnit')}>
                    <InputNumber min={0} disabled={!derivationAvailability.customsCostPerUnit} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Text type="secondary">{t('form.derivationHint', { incoterm: watchedPolicyIncoterm ?? 'FOB' })}</Text>
            </Card>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item name="effectiveFrom" label={t('form.effectiveFrom')} rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="effectiveTo" label={t('form.effectiveTo')}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="isActive" label={t('form.active')} valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="note" label={t('form.note')}>
              <Input.TextArea rows={3} />
            </Form.Item>
          </Form>
        </Modal>
      )}

      {isClientReady && (
        <Modal
          title={t('resolver.title')}
          open={resolveModalOpen}
          onCancel={() => setResolveModalOpen(false)}
          onOk={resolvePrice}
          confirmLoading={resolving}
          width={860}
          okText={t('actions.resolve')}
          cancelText={t('actions.cancel')}
          forceRender
          destroyOnHidden
        >
          <Form form={resolveForm} layout="vertical" onValuesChange={() => setResolveResult(null)}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="productId" label={t('form.product')} rules={[{ required: true }]}>
                  <Select showSearch placeholder={t('form.productPlaceholder')} optionFilterProp="label" options={productOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="buyerId" label={t('form.buyer')}>
                  <Select
                    allowClear
                    showSearch
                    placeholder={t('form.buyerPlaceholder')}
                    optionFilterProp="label"
                    options={buyerOptions}
                    onChange={(buyerId?: string) => {
                      const scope = getBuyerMarketScope(buyerId);
                      resolveForm.setFieldsValue({
                        country: scope.country,
                        marketRegion: scope.marketRegion,
                        destination_port_id: undefined,
                        ...(scope.currency ? { currency: scope.currency } : {}),
                      });
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item name="quantity" label={t('historyTable.quantity')} rules={[{ required: true }]}>
                  <InputNumber min={0.01} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item name="incoterm" label={t('form.incoterm')} rules={[{ required: true }]}>
                  <Select options={incotermOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item name="currency" label={t('form.currency')} rules={[{ required: true }]}>
                  <Select showSearch options={currencies.map((c) => ({ value: c.code, label: c.code }))} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item name="priceDate" label={t('resolver.priceDate')}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="marketRegion" label={t('form.region')}>
                  <Select allowClear options={regionOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="countryCode" label={t('form.countryCode') || 'Mã quốc gia'}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      options={countryOptions}
                      placeholder="US, DE, JP..."
                      style={{ width: 'calc(100% - 40px)' }}
                      onChange={(value?: string) => {
                        const countryCode = normalizeCountryValue(value);
                        const countryName = countryCode ? (getCountryDisplayName(countryCode, locale) || countryCode) : undefined;
                        resolveForm.setFieldsValue({
                          countryCode,
                          country: countryName,
                          marketRegion: getCountryRegion(countryCode),
                          destination_port_id: undefined,
                        });
                      }}
                    />
                    <Button icon={<PlusOutlined />} onClick={() => setQuickAddCountryVisible(true)} />
                  </Space.Compact>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="country" label={t('form.country')}>
                  <Input disabled placeholder={t('form.country')} />
                </Form.Item>
              </Col>
              <Col xs={0} md={12} />
              <Col xs={24} md={12}>
                <Form.Item name="origin_port_id" label={t('form.originPort')}>
                  <PortSelect />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="destination_port_id" label={t('form.destinationPort')}>
                  <PortSelect />
                </Form.Item>
              </Col>
            </Row>
          </Form>

          {resolveResult && (
            <Card size="small" title={t('resolver.result')} style={{ marginTop: 8 }}>
              {resolveResult.source === 'PRODUCT_DEFAULT' && (
                <Alert
                  showIcon
                  type="warning"
                  style={{ marginBottom: 12 }}
                  title={resolverText(
                    'resolver.productDefaultWarningTitle',
                    'Không tìm thấy chính sách giá phù hợp',
                    'No matching pricing policy found',
                  )}
                  description={resolverText(
                    'resolver.productDefaultWarningDesc',
                    `Số lượng ${formatCurrency(resolvedQuantity, 2)} không nằm trong bảng giá active theo sản phẩm, khách hàng, Incoterm, tiền tệ và ngày áp giá. Hệ thống đang dùng giá mặc định của sản phẩm.`,
                    `Quantity ${formatCurrency(resolvedQuantity, 2)} is outside active pricing policies for the selected product, buyer, Incoterm, currency, and price date. The system is using the product default price.`,
                    { quantity: formatCurrency(resolvedQuantity, 2) },
                  )}
                />
              )}
              <Descriptions column={2} size="small">
                <Descriptions.Item label={t('resolver.source')}>
                  <Tag color={resolveResult.source === 'PRODUCT_DEFAULT' ? 'orange' : resolveResult.source === 'PRICING_POLICY_DERIVED' ? 'gold' : 'green'}>{resolveResult.source}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={resolverText('resolver.unitPrice', 'Đơn giá áp dụng', 'Applied unit price')}>
                  <Text strong>{formatMoneyStatic(resolveResult.unitPrice, resolveResult.currency)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={resolverText('resolver.quantity', 'Số lượng tính', 'Resolved quantity')}>
                  {formatCurrency(resolvedQuantity, 2)}
                </Descriptions.Item>
                <Descriptions.Item label={resolverText('resolver.estimatedAmount', 'Thành tiền dự kiến', 'Estimated line amount')}>
                  <Text strong>{formatMoneyStatic(resolvedLineAmount, resolveResult.currency)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('resolver.policy')}>
                  {resolvedSourcePolicy}
                </Descriptions.Item>
                <Descriptions.Item label={t('form.incoterm')}>
                  {resolvedIncoterm}
                </Descriptions.Item>
                <Descriptions.Item label={t('resolver.route')} span={2}>
                  {resolvedRoute}
                </Descriptions.Item>
              </Descriptions>
              {renderBreakdown()}
            </Card>
          )}
        </Modal>
      )}

      <QuickAddCountryModal
        open={quickAddCountryVisible}
        onCancel={() => setQuickAddCountryVisible(false)}
        onSuccess={(code) => {
          const countryName = getCountryDisplayName(code, locale) || code;
          if (resolveModalOpen) {
            resolveForm.setFieldsValue({
              countryCode: code,
              country: countryName,
              marketRegion: getCountryRegion(code),
            });
          } else {
            policyForm.setFieldsValue({
              countryCode: code,
              country: countryName,
              marketRegion: getCountryRegion(code),
            });
          }
          setQuickAddCountryVisible(false);
        }}
      />
    </AdminPageScroll>
  );
};

export default PricingPoliciesPage;
