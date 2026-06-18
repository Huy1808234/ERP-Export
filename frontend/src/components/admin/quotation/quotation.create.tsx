'use client'

import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Row,
  Col,
  Divider,
  Card,
  theme,
} from 'antd';
import { useTheme } from '@/context/theme.context';
import { 
  DeleteOutlined, 
  PlusOutlined, 
  EditOutlined,
  InfoCircleOutlined, 
  ShoppingCartOutlined,
  CalculatorOutlined,
  FileTextOutlined,
  TruckOutlined,
  SafetyCertificateOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { IProduct } from '@/types/product';
import { IQuotation, IQuotationLine } from '@/types/o2c';
import { INCOTERMS_KEYS, PAYMENT_TERM_KEYS, SELLER_LED_INCOTERMS, IncotermKey } from '@/constants/o2c';
import { useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';
import PortSelect from '@/components/admin/ports/PortSelect';
import { normalizeCountryCode } from '@/constants/geo';

const { Text, Title } = Typography;

interface IProps {
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (v: boolean) => void;
  fetchQuotations: () => void;
  editData?: IQuotation;
  initialInquiryData?: InitialInquiryData;
}

// Removed local INCOTERMS_OPTIONS

const CURRENCY_OPTIONS = [
  { value: 'USD', label: '🇺🇸 USD' },
  { value: 'EUR', label: '🇪🇺 EUR' },
  { value: 'VND', label: '🇻🇳 VND' },
  { value: 'CNY', label: '🇨🇳 CNY' },
];
// UNIT_OPTIONS moved inside component with i18n

type PricingSource = 'PRICING_POLICY' | 'PRICING_POLICY_DERIVED' | 'PRODUCT_DEFAULT';
type PriceStateSource = PricingSource | 'MANUAL' | 'UNRESOLVED';
type LogisticsFeeField = 'seaFreight' | 'insuranceCost' | 'domesticTransportCost' | 'portCharges';
type BreakdownCostField =
  | 'inlandCostPerUnit'
  | 'portChargePerUnit'
  | 'freightCostPerUnit'
  | 'insuranceCostPerUnit'
  | 'destinationDeliveryCostPerUnit';

interface PriceBreakdown {
  baseIncoterm: IncotermKey;
  targetIncoterm: IncotermKey;
  baseUnitPrice: number;
  inlandCostPerUnit: number;
  portChargePerUnit: number;
  freightCostPerUnit: number;
  insuranceCostPerUnit: number;
  destinationDeliveryCostPerUnit: number;
  customsCostPerUnit: number;
  derivedUnitPrice: number;
}

interface ResolvePriceResult {
  source: PricingSource;
  pricingPolicyId: string | null;
  unitPrice: number;
  currency: string;
  priceBreakdown?: PriceBreakdown;
}

interface PriceLineState {
  source: PriceStateSource;
  pricingPolicyId?: string | null;
  priceBreakdown?: PriceBreakdown;
  message?: string;
}

interface QuotationFormLine {
  productId?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  note?: string;
}

interface QuotationFormValues {
  customerId?: string;
  incoterm?: IncotermKey;
  currency?: string;
  portOfLoading?: string;
  portOfLoading_port_id?: string | null;
  portOfDischarge?: string;
  portOfDischarge_port_id?: string | null;
  paymentTerms?: string[] | string;
  note?: string;
  issueDate?: Dayjs;
  expiryDate?: Dayjs;
  items?: QuotationFormLine[];
  logisticsFee?: number;
  otherFee?: number;
  domesticTransportCost?: number;
  portCharges?: number;
  seaFreight?: number;
  insuranceCost?: number;
  bankInfo?: string;
}

interface InitialInquiryData {
  _id?: string;
  customerId?: string;
  customerName?: string;
  productId?: string;
  quantity?: number;
  product?: Pick<IProduct, 'unitOfMeasure'>;
  note?: string;
}

interface CompanyBankInfoSetting {
  value?: string;
}

interface QuotationMutationResult {
  quotationNumber: string;
}

const LOGISTICS_INCLUDED_RULES: Array<{
  field: LogisticsFeeField;
  breakdownFields: BreakdownCostField[];
}> = [
  {
    field: 'domesticTransportCost',
    breakdownFields: ['inlandCostPerUnit', 'destinationDeliveryCostPerUnit'],
  },
  {
    field: 'portCharges',
    breakdownFields: ['portChargePerUnit'],
  },
  {
    field: 'seaFreight',
    breakdownFields: ['freightCostPerUnit'],
  },
  {
    field: 'insuranceCost',
    breakdownFields: ['insuranceCostPerUnit'],
  },
];

const EXACT_POLICY_INCLUDED_FIELDS_BY_INCOTERM: Record<IncotermKey, LogisticsFeeField[]> = {
  EXW: [],
  FOB: ['domesticTransportCost', 'portCharges'],
  CFR: ['domesticTransportCost', 'portCharges', 'seaFreight'],
  CIF: ['domesticTransportCost', 'portCharges', 'seaFreight', 'insuranceCost'],
  DAP: ['domesticTransportCost', 'portCharges', 'seaFreight', 'insuranceCost'],
  DDP: ['domesticTransportCost', 'portCharges', 'seaFreight', 'insuranceCost'],
};

type EditableQuotation = IQuotation & {
  issueDate?: string;
};

type EditableQuotationLine = IQuotationLine & {
  productId?: string;
};

const isIncotermKey = (value?: string): value is IncotermKey =>
  Boolean(value && INCOTERMS_KEYS.includes(value as IncotermKey));

const isSellerLedIncoterm = (value?: string): value is IncotermKey =>
  isIncotermKey(value) && SELLER_LED_INCOTERMS.includes(value);

const getIncludedLogisticsFields = (
  priceStates: Record<number, PriceLineState>,
  incoterm?: IncotermKey,
): Set<LogisticsFeeField> => {
  const includedFields = new Set<LogisticsFeeField>();

  Object.values(priceStates).forEach((state) => {
    if (state.source === 'PRICING_POLICY' && incoterm) {
      EXACT_POLICY_INCLUDED_FIELDS_BY_INCOTERM[incoterm].forEach((field) => includedFields.add(field));
      return;
    }

    if (state.source !== 'PRICING_POLICY_DERIVED' || !state.priceBreakdown) return;

    LOGISTICS_INCLUDED_RULES.forEach((rule) => {
      const isIncluded = rule.breakdownFields.some((field) => Number(state.priceBreakdown?.[field] || 0) > 0);
      if (isIncluded) includedFields.add(rule.field);
    });
  });

  return includedFields;
};

const normalizeQuotationLogisticsFees = (
  values: QuotationFormValues,
  includedFields: Set<LogisticsFeeField>,
): QuotationFormValues => {
  const nextValues: QuotationFormValues = { ...values };

  if (!isSellerLedIncoterm(nextValues.incoterm)) {
    nextValues.seaFreight = 0;
    nextValues.domesticTransportCost = 0;
    nextValues.portCharges = 0;
    nextValues.logisticsFee = 0;
  }

  if (nextValues.incoterm !== 'CIF') {
    nextValues.insuranceCost = 0;
  }

  includedFields.forEach((field) => {
    nextValues[field] = 0;
  });

  return nextValues;
};

const shiftIndexSetAfterRemove = (source: Set<number>, removedIndex: number) => {
  const next = new Set<number>();
  source.forEach((rowIndex) => {
    if (rowIndex < removedIndex) next.add(rowIndex);
    if (rowIndex > removedIndex) next.add(rowIndex - 1);
  });
  return next;
};

const shiftPriceStatesAfterRemove = (
  source: Record<number, PriceLineState>,
  removedIndex: number,
) => {
  const next: Record<number, PriceLineState> = {};
  Object.entries(source).forEach(([rawIndex, state]) => {
    const rowIndex = Number(rawIndex);
    if (rowIndex < removedIndex) next[rowIndex] = state;
    if (rowIndex > removedIndex) next[rowIndex - 1] = state;
  });
  return next;
};

const QuotationCreateModal = (props: IProps) => {
  const { isCreateModalOpen, setIsCreateModalOpen, editData, initialInquiryData } = props;
  const isEditMode = !!editData;
  const { token } = theme.useToken();
  const tQ = useTranslations('Quotation');
  const [submitting, setSubmitting] = useState(false);

  // TECH LEAD: Using a key to force re-mounting and cleanup of form state
  const modalKey = useMemo(() => isEditMode ? `edit-${editData?._id}` : (initialInquiryData ? `inquiry-${initialInquiryData._id}` : 'create'), [isEditMode, editData?._id, initialInquiryData]);

  const handleClose = () => {
    setIsCreateModalOpen(false);
  };

  return (
    <Modal
      key={modalKey}
      title={
        <Space>
          <FileTextOutlined style={{ color: token.colorPrimary }} />
          <span style={{ fontWeight: 700 }}>{isEditMode ? tQ('create.editTitle') : tQ('create.modalTitle')}</span>
        </Space>
      }
      open={isCreateModalOpen}
      onOk={() => {
        // We will trigger a custom event or use a ref, but let's use the simplest way:
        // Pass a 'submitTrigger' or similar, or just find the form.
        // Actually, since we want to keep it simple, we'll keep the Form outside but lazy render the content.
        // BUT to fix the warning, the useForm() must be inside the same level as <Form>.
      }}
      // Actually, the easiest fix for "not connected" is to move useForm and Form into a separate component
      // and only render it when open.
      footer={null} // We will use custom buttons inside the lazy-loaded content or handle it via a Ref.
      onCancel={handleClose}
      mask={{ closable: false }}
      width={1100}
      style={{ top: 20 }}
      destroyOnHidden
    >
      {isCreateModalOpen && (
        <QuotationFormInner 
          {...props} 
          handleClose={handleClose} 
          setSubmitting={setSubmitting}
          submitting={submitting}
        />
      )}
    </Modal>
  );
};

interface InnerProps extends IProps {
    handleClose: () => void;
    setSubmitting: (v: boolean) => void;
    submitting: boolean;
}

const QuotationFormInner = (props: InnerProps) => {
  const { handleClose, fetchQuotations, editData, initialInquiryData, setSubmitting, submitting } = props;
  const isEditMode = !!editData;
  const { notification } = App.useApp();
  const { data: session } = useSession();
  const tQ = useTranslations('Quotation');
  const tInc = useTranslations('Incoterms');
  const tPayment = useTranslations('PaymentTerms');
  const tUom = useTranslations('UOM');

  const incotermOptions = useMemo(() => {
    return INCOTERMS_KEYS.map(key => ({
      value: key,
      label: tInc(key)
    }));
  }, [tInc]);

  const paymentTermsOptions = useMemo(() => {
    return PAYMENT_TERM_KEYS.map(key => ({
      value: key,
      label: tPayment(key)
    }));
  }, [tPayment]);

  const unitOptions = useMemo(() => {
    return [
      { value: 'PCS', label: tUom('PCS') },
      { value: 'SETS', label: tUom('SETS') },
      { value: 'CARTONS', label: tUom('CARTONS') },
      { value: 'TONS', label: tUom('TONS') },
      { value: 'KGS', label: tUom('KGS') },
    ];
  }, [tUom]);

  const [form] = Form.useForm();
  const [customers, setCustomers] = useState<IPartner[]>([]);
  const [products, setProducts] = useState<IProduct[]>([]);
  const [manualPriceRows, setManualPriceRows] = useState<Set<number>>(new Set());
  const [resolvingPriceRows, setResolvingPriceRows] = useState<Set<number>>(new Set());
  const [priceLineStates, setPriceLineStates] = useState<Record<number, PriceLineState>>({});
  const priceResolveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const priceResolveSequenceRef = useRef<Record<number, number>>({});

  // Watch for dynamic calculation
  const watchedItems = Form.useWatch('items', form);
  const watchedCurrency = Form.useWatch('currency', form) || 'USD';
  const watchedIncoterm = Form.useWatch('incoterm', form);
  const watchedCustomerId = Form.useWatch('customerId', form);
  const watchedIssueDate = Form.useWatch('issueDate', form);
  const watchedPortOfLoading_port_id = Form.useWatch('portOfLoading_port_id', form);
  const watchedPortOfDischarge_port_id = Form.useWatch('portOfDischarge_port_id', form);
  const watchedPortOfLoading = Form.useWatch('portOfLoading', form);
  const watchedPortOfDischarge = Form.useWatch('portOfDischarge', form);
  const selectedCustomerCountryCode = useMemo(() => {
    const customer = customers.find((item) => item._id === watchedCustomerId);
    return normalizeCountryCode(customer?.country);
  }, [customers, watchedCustomerId]);

  // TECH LEAD LOGIC: Reset fees when switching to Buyer-Led Incoterms
  useEffect(() => {
    if (watchedIncoterm && !isSellerLedIncoterm(watchedIncoterm)) {
      form.setFieldsValue({
        seaFreight: 0,
        insuranceCost: 0,
        domesticTransportCost: 0,
        portCharges: 0,
        logisticsFee: 0
      });
    }
  }, [watchedIncoterm, form]);

  useEffect(() => {
    if (watchedIncoterm && watchedIncoterm !== 'CIF') {
      form.setFieldValue('insuranceCost', 0);
    }
  }, [watchedIncoterm, form]);

  const fetchDropdowns = useCallback(async () => {
    const accessToken = getAccessToken(session);
    if (!accessToken) return;

    const headers = { Authorization: `Bearer ${accessToken}` };

    const [partnersRes, productsRes] = await Promise.all([
      sendRequest<IBackendRes<IModelPaginate<IPartner>>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 500, partnerType: 'CUSTOMER' },
        headers,
      }),
      sendRequest<IBackendRes<IModelPaginate<IProduct>>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 500, isActive: true },
        headers,
      }),
    ]);

    if (partnersRes?.data) {
      const fetchedCustomers = partnersRes.data.results || [];
      // TECH LEAD: Ensure initial customer from inquiry is in the list to avoid UUID display issue
      if (initialInquiryData?.customerId && !fetchedCustomers.find((c) => c._id === initialInquiryData.customerId)) {
        fetchedCustomers.unshift({
          _id: initialInquiryData.customerId,
          name: initialInquiryData.customerName || initialInquiryData.customerId,
          defaultCurrency: 'USD',
        });
      }
      setCustomers(fetchedCustomers);
    }
    if (productsRes?.data) {
      setProducts(productsRes.data.results || []);
    }
  }, [session, initialInquiryData]);

  const setRowResolving = useCallback((rowIndex: number, isResolving: boolean) => {
    setResolvingPriceRows((prev) => {
      const next = new Set(prev);
      if (isResolving) {
        next.add(rowIndex);
      } else {
        next.delete(rowIndex);
      }
      return next;
    });
  }, []);

  const clearRowPriceState = useCallback((rowIndex: number) => {
    setPriceLineStates((prev) => {
      const next = { ...prev };
      delete next[rowIndex];
      return next;
    });
  }, []);

  const clearAllPriceTimers = useCallback(() => {
    Object.values(priceResolveTimersRef.current).forEach((timer) => clearTimeout(timer));
    priceResolveTimersRef.current = {};
  }, []);

  useEffect(() => () => clearAllPriceTimers(), [clearAllPriceTimers]);

  const resolveLinePrice = useCallback(async (
    rowIndex: number,
    linePatch: Partial<QuotationFormLine> = {},
  ) => {
    if (manualPriceRows.has(rowIndex)) return;

    const accessToken = getAccessToken(session);
    const values = form.getFieldsValue(true) as QuotationFormValues;
    const items = Array.isArray(values.items) ? values.items : [];
    const currentLine: QuotationFormLine = {
      ...(items[rowIndex] || {}),
      ...linePatch,
    };
    const quantity = Number(currentLine.quantity || 0);
    const incoterm = isIncotermKey(values.incoterm) ? values.incoterm : undefined;
    const currency = values.currency || 'USD';

    if (!accessToken || !values.customerId || !currentLine.productId || !incoterm || quantity <= 0) {
      return;
    }

    const nextSequence = (priceResolveSequenceRef.current[rowIndex] || 0) + 1;
    priceResolveSequenceRef.current[rowIndex] = nextSequence;
    setRowResolving(rowIndex, true);

    try {
      const res = await sendRequest<IBackendRes<ResolvePriceResult>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/pricing-policies/resolve`,
        method: 'GET',
        queryParams: {
          productId: currentLine.productId,
          buyerId: values.customerId,
          quantity,
          incoterm,
          currency,
          origin_port_id: values.portOfLoading_port_id || undefined,
          destination_port_id: values.portOfDischarge_port_id || undefined,
          priceDate: values.issueDate?.format('YYYY-MM-DD'),
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (priceResolveSequenceRef.current[rowIndex] !== nextSequence) return;

      const latestItems = [...((form.getFieldValue('items') || []) as QuotationFormLine[])];
      if (!latestItems[rowIndex]) return;

      if (res?.data) {
        const resolvedPrice = res.data;
        latestItems[rowIndex] = {
          ...latestItems[rowIndex],
          ...currentLine,
          quantity,
          unitPrice: Number(resolvedPrice.unitPrice || 0),
        };
        form.setFieldsValue({ items: latestItems });
        setPriceLineStates((prev) => ({
          ...prev,
          [rowIndex]: {
            source: resolvedPrice.source,
            pricingPolicyId: resolvedPrice.pricingPolicyId,
            priceBreakdown: resolvedPrice.priceBreakdown,
          },
        }));
        return;
      }

      latestItems[rowIndex] = {
        ...latestItems[rowIndex],
        ...currentLine,
        quantity,
        unitPrice: 0,
      };
      form.setFieldsValue({ items: latestItems });
      setPriceLineStates((prev) => ({
        ...prev,
        [rowIndex]: {
          source: 'UNRESOLVED',
          message: res?.message || tQ('create.pricing.unresolvedHint'),
        },
      }));
    } catch (error) {
      if (priceResolveSequenceRef.current[rowIndex] !== nextSequence) return;
      const message = error instanceof Error ? error.message : tQ('create.pricing.unresolvedHint');
      setPriceLineStates((prev) => ({
        ...prev,
        [rowIndex]: {
          source: 'UNRESOLVED',
          message,
        },
      }));
    } finally {
      if (priceResolveSequenceRef.current[rowIndex] === nextSequence) {
        setRowResolving(rowIndex, false);
      }
    }
  }, [form, manualPriceRows, session, setRowResolving, tQ]);

  const scheduleResolveLinePrice = useCallback((
    rowIndex: number,
    linePatch: Partial<QuotationFormLine> = {},
  ) => {
    const currentTimer = priceResolveTimersRef.current[rowIndex];
    if (currentTimer) clearTimeout(currentTimer);
    priceResolveTimersRef.current[rowIndex] = setTimeout(() => {
      void resolveLinePrice(rowIndex, linePatch);
    }, 250);
  }, [resolveLinePrice]);

  const resolveAllAutoLines = useCallback(() => {
    const items = (form.getFieldValue('items') || []) as QuotationFormLine[];
    items.forEach((line, rowIndex) => {
      if (manualPriceRows.has(rowIndex)) return;
      if (!line?.productId || Number(line.quantity || 0) <= 0) return;
      scheduleResolveLinePrice(rowIndex);
    });
  }, [form, manualPriceRows, scheduleResolveLinePrice]);

  useEffect(() => {
    resolveAllAutoLines();
  }, [
    watchedCustomerId,
    watchedIncoterm,
    watchedCurrency,
    watchedIssueDate,
    watchedPortOfLoading_port_id,
    watchedPortOfDischarge_port_id,
    resolveAllAutoLines,
  ]);

  useEffect(() => {
    fetchDropdowns();
    if (editData) {
      const editableData = editData as EditableQuotation;
      const existingItems = (editData.items || []) as EditableQuotationLine[];
      form.setFieldsValue({
        customerId: editData.customer?._id,
        incoterm: editData.incoterm,
        currency: editData.currency,
        portOfLoading: editData.portOfLoading,
        portOfLoading_port_id: editData.portOfLoading_port_id || undefined,
        portOfDischarge: editData.portOfDischarge,
        portOfDischarge_port_id: editData.portOfDischarge_port_id || undefined,
        paymentTerms: editData.paymentTerms ? editData.paymentTerms.split(', ') : [],
        note: editData.note,
        issueDate: editableData.issueDate ? dayjs(editableData.issueDate) : dayjs(),
        expiryDate: editData.expiryDate ? dayjs(editData.expiryDate) : null,
        items: existingItems.map((line) => ({
          productId: line.product?._id || line.productId,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unitPrice,
        })),
        logisticsFee: editData.logisticsFee || 0,
        otherFee: editData.otherFee || 0,
        domesticTransportCost: editData.domesticTransportCost || 0,
        portCharges: editData.portCharges || 0,
        seaFreight: editData.seaFreight || 0,
        insuranceCost: editData.insuranceCost || 0,
        bankInfo: editData.bankInfo,
      });
      setManualPriceRows(new Set(existingItems.map((_, rowIndex) => rowIndex)));
      setPriceLineStates(existingItems.reduce<Record<number, PriceLineState>>((acc, _, rowIndex) => {
        acc[rowIndex] = { source: 'MANUAL' };
        return acc;
      }, {}));
    } else if (initialInquiryData) {
      // TECH LEAD: Auto-fill from Inquiry (I2Q Workflow)
      form.setFieldsValue({
        customerId: initialInquiryData.customerId || undefined, // Nếu có mapping khách hàng
        currency: 'USD',
        incoterm: 'FOB',
        logisticsFee: 0,
        otherFee: 0,
        domesticTransportCost: 0,
        portCharges: 0,
        seaFreight: 0,
        insuranceCost: 0,
        issueDate: dayjs(),
        items: [{
          productId: initialInquiryData.productId,
          quantity: initialInquiryData.quantity,
          unit: initialInquiryData.product?.unitOfMeasure || 'CARTONS',
          unitPrice: 0,
        }],
        note: `Được tạo từ Yêu cầu báo giá của: ${initialInquiryData.customerName}\n${initialInquiryData.note || ''}`,
      });
      setManualPriceRows(new Set());
      setPriceLineStates({});
    } else {
      form.setFieldsValue({ 
        currency: 'USD', 
        incoterm: 'FOB',
        logisticsFee: 0,
        otherFee: 0,
        domesticTransportCost: 0,
        portCharges: 0,
        seaFreight: 0,
        insuranceCost: 0,
        issueDate: dayjs(),
        items: [{ quantity: 1, unit: 'CARTONS', unitPrice: 0 }] 
      });
      setManualPriceRows(new Set());
      setPriceLineStates({});

      // Fetch default bank info for new quotation
      const fetchDefaultBank = async () => {
        const accessToken = getAccessToken(session);
        if (accessToken) {
           const bankSetting = await sendRequest<IBackendRes<CompanyBankInfoSetting>>({
              url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/settings/COMPANY_BANK_INFO`,
              method: 'GET',
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (bankSetting?.data?.value) {
              form.setFieldValue('bankInfo', bankSetting.data.value);
            }
        }
      };
      fetchDefaultBank();
    }
  }, [editData, form, fetchDropdowns, initialInquiryData, session]);

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find(c => c._id === customerId);
    if (customer) {
      form.setFieldsValue({
        currency: customer.defaultCurrency || 'USD',
        paymentTerms: customer.defaultPaymentTerm ? [customer.defaultPaymentTerm] : [],
        portOfDischarge: undefined,
        portOfDischarge_port_id: undefined,
      });
    }
  };

  const handleProductChange = (productId: string, index: number) => {
    const product = products.find(p => p._id === productId);
    
    if (product) {
      const currentItems = [...((form.getFieldValue('items') || []) as QuotationFormLine[])];
      currentItems[index] = {
        ...currentItems[index],
        productId,
        unit: product.unitOfMeasure || 'CARTONS',
        unitPrice: 0,
      };
      form.setFieldsValue({ items: currentItems });
      setManualPriceRows((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      clearRowPriceState(index);
      scheduleResolveLinePrice(index, currentItems[index]);
    }
  };

  const handleQuantityChange = (index: number, value: number | null) => {
    if (manualPriceRows.has(index)) return;
    scheduleResolveLinePrice(index, { quantity: Number(value || 0) });
  };

  const handleUnitPriceChange = (index: number, value: number | null) => {
    priceResolveSequenceRef.current[index] = (priceResolveSequenceRef.current[index] || 0) + 1;
    const nextPrice = Number(value || 0);
    if (nextPrice > 0) {
      setManualPriceRows((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
      setPriceLineStates((prev) => ({
        ...prev,
        [index]: { source: 'MANUAL' },
      }));
      setRowResolving(index, false);
      return;
    }

    setManualPriceRows((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    clearRowPriceState(index);
    scheduleResolveLinePrice(index, { unitPrice: 0 });
  };

  const watchedLogisticsFee = Form.useWatch('logisticsFee', form) || 0;
  const watchedOtherFee = Form.useWatch('otherFee', form) || 0;
  const watchedDomesticTransport = Form.useWatch('domesticTransportCost', form) || 0;
  const watchedPortCharges = Form.useWatch('portCharges', form) || 0;
  const watchedSeaFreight = Form.useWatch('seaFreight', form) || 0;
  const watchedInsurance = Form.useWatch('insuranceCost', form) || 0;
  const includedLogisticsFields = useMemo(() => (
    getIncludedLogisticsFields(priceLineStates, isIncotermKey(watchedIncoterm) ? watchedIncoterm : undefined)
  ), [priceLineStates, watchedIncoterm]);
  const includedLogisticsLabels = useMemo(() => {
    const labelByField: Record<LogisticsFeeField, string> = {
      seaFreight: tQ('create.logistics.seaFreight'),
      insuranceCost: tQ('create.logistics.insurance'),
      domesticTransportCost: tQ('create.logistics.domestic'),
      portCharges: tQ('create.logistics.portCharges'),
    };

    return Array.from(includedLogisticsFields).map((field) => labelByField[field]);
  }, [includedLogisticsFields, tQ]);

  useEffect(() => {
    const currentValues = form.getFieldsValue(true) as QuotationFormValues;
    const normalizedValues = normalizeQuotationLogisticsFees(currentValues, includedLogisticsFields);
    const resetPatch: Partial<Pick<QuotationFormValues, LogisticsFeeField>> = {};
    let shouldReset = false;

    includedLogisticsFields.forEach((field) => {
      if (Number(currentValues[field] || 0) !== Number(normalizedValues[field] || 0)) {
        resetPatch[field] = normalizedValues[field];
        shouldReset = true;
      }
    });

    if (shouldReset) {
      form.setFieldsValue(resetPatch);
    }
  }, [form, includedLogisticsFields]);

  const grandTotal = useMemo(() => {
    if (!watchedItems) return 0;
    const itemsTotal = (watchedItems as QuotationFormLine[]).reduce((acc: number, curr) => {
      const q = curr?.quantity || 0;
      const p = curr?.unitPrice || 0;
      return acc + (q * p);
    }, 0);
    return itemsTotal + 
           (watchedLogisticsFee || 0) + 
           (watchedOtherFee || 0) + 
           (watchedDomesticTransport || 0) + 
           (watchedPortCharges || 0) + 
           (watchedSeaFreight || 0) + 
           (watchedInsurance || 0);
  }, [watchedItems, watchedLogisticsFee, watchedOtherFee, watchedDomesticTransport, watchedPortCharges, watchedSeaFreight, watchedInsurance]);

  const onFinish = async (values: QuotationFormValues) => {
    if (!values.items || values.items.length === 0) {
      notification.warning({ title: tQ('create.notifications.atLeastOneItem') });
      return;
    }
    clearAllPriceTimers();

    setSubmitting(true);
    const accessToken = getAccessToken(session);

    const normalizedValues = normalizeQuotationLogisticsFees(values, includedLogisticsFields);
    const payload = {
      ...normalizedValues,
      issueDate: normalizedValues.issueDate ? normalizedValues.issueDate.format('YYYY-MM-DD') : undefined,
      expiryDate: normalizedValues.expiryDate ? normalizedValues.expiryDate.format('YYYY-MM-DD') : undefined,
      paymentTerms: Array.isArray(normalizedValues.paymentTerms) ? normalizedValues.paymentTerms.join(', ') : normalizedValues.paymentTerms,
      items: values.items.map((line, rowIndex) => ({
        ...line,
        quantity: Number(line.quantity),
        unitPrice: manualPriceRows.has(rowIndex) ? Number(line.unitPrice) : 0,
      })),
    };

    const res = await sendRequest<IBackendRes<QuotationMutationResult>>({
      url: isEditMode
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations/${editData._id}`
        : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations`,
      method: isEditMode ? 'PATCH' : 'POST',
      body: payload,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    setSubmitting(false);

    if (res?.data) {
      handleClose();
      fetchQuotations();
      notification.success({
        title: isEditMode ? tQ('create.notifications.updateSuccess') : tQ('create.notifications.success'),
        description: tQ('create.notifications.numberLabel', { number: res.data.quotationNumber }),
      });

      // TECH LEAD: If this was from an inquiry, mark it as PROCESSED
      if (initialInquiryData?._id) {
        try {
          await sendRequest({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inquiries/${initialInquiryData._id}/status`,
            method: 'PATCH',
            body: { status: 'PROCESSED' },
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        } catch (e) {
          console.error("Failed to update inquiry status", e);
        }
      }
    } else {
      notification.error({ title: tQ('create.notifications.error'), description: res?.message });
    }
  };

  const { token } = theme.useToken();
  const { isDark } = useTheme();

  const getPriceSourceLabel = (source: PriceStateSource) => {
    switch (source) {
      case 'PRICING_POLICY':
        return tQ('create.pricing.sourcePolicy');
      case 'PRICING_POLICY_DERIVED':
        return tQ('create.pricing.sourceDerived');
      case 'PRODUCT_DEFAULT':
        return tQ('create.pricing.sourceProductDefault');
      case 'MANUAL':
        return tQ('create.pricing.sourceManual');
      case 'UNRESOLVED':
        return tQ('create.pricing.sourceUnresolved');
      default:
        return source;
    }
  };

  const getPriceSourceColor = (source: PriceStateSource) => {
    switch (source) {
      case 'PRICING_POLICY':
        return 'green';
      case 'PRICING_POLICY_DERIVED':
        return 'gold';
      case 'PRODUCT_DEFAULT':
        return 'orange';
      case 'UNRESOLVED':
        return 'red';
      case 'MANUAL':
      default:
        return 'blue';
    }
  };

  const getIncludedCostLabels = (breakdown: PriceBreakdown): string[] => {
    const costs = [
      { label: tQ('create.pricing.costInland'), value: breakdown.inlandCostPerUnit },
      { label: tQ('create.pricing.costPort'), value: breakdown.portChargePerUnit },
      { label: tQ('create.pricing.costFreight'), value: breakdown.freightCostPerUnit },
      { label: tQ('create.pricing.costInsurance'), value: breakdown.insuranceCostPerUnit },
      { label: tQ('create.pricing.costDestination'), value: breakdown.destinationDeliveryCostPerUnit },
      { label: tQ('create.pricing.costCustoms'), value: breakdown.customsCostPerUnit },
    ];

    return costs
      .filter((cost) => Number(cost.value || 0) > 0)
      .map((cost) => cost.label);
  };

  const renderPriceSourceMeta = (rowIndex: number) => {
    if (resolvingPriceRows.has(rowIndex)) {
      return <Tag color="processing">{tQ('create.pricing.resolving')}</Tag>;
    }

    const state = priceLineStates[rowIndex] ?? (manualPriceRows.has(rowIndex) ? { source: 'MANUAL' as const } : undefined);
    if (!state) return null;
    const includedCosts = state.priceBreakdown ? getIncludedCostLabels(state.priceBreakdown) : [];

    return (
      <Space orientation="vertical" size={2} style={{ width: '100%' }}>
        <Tag color={getPriceSourceColor(state.source)} style={{ width: 'fit-content', marginInlineEnd: 0 }}>
          {getPriceSourceLabel(state.source)}
        </Tag>
        {state.source === 'PRICING_POLICY_DERIVED' && state.priceBreakdown && includedCosts.length > 0 && (
          <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.45 }}>
            {state.priceBreakdown.baseIncoterm} -&gt; {state.priceBreakdown.targetIncoterm}.{' '}
            {tQ('create.pricing.includedCosts', { items: includedCosts.join(', ') })}
          </Text>
        )}
        {state.source === 'PRODUCT_DEFAULT' && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {tQ('create.pricing.productDefaultHint')}
          </Text>
        )}
        {state.source === 'UNRESOLVED' && (
          <Text type="danger" style={{ fontSize: 11 }}>
            {state.message || tQ('create.pricing.unresolvedHint')}
          </Text>
        )}
      </Space>
    );
  };

  return (
      <Form form={form} onFinish={onFinish} layout="vertical">
        {/* --- PHẦN 1: THÔNG TIN CHUNG --- */}
        <Divider titlePlacement="left" plain>
          <Space><InfoCircleOutlined /> <Text strong>{tQ('create.sections.customerInfo').toUpperCase()}</Text></Space>
        </Divider>
        
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label={tQ('create.form.customer')}
              name="customerId"
              rules={[{ required: true, message: tQ('create.form.customerRequired') }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={tQ('create.form.customerPlaceholder')}
                options={customers.map(c => ({ value: c._id, label: c.name }))}
                onChange={handleCustomerChange}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label={tQ('create.form.incoterm')}
              name="incoterm"
              rules={[{ required: true }]}
              extra={
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {watchedIncoterm && (isSellerLedIncoterm(watchedIncoterm)
                    ? tQ('create.form.incotermHintSeller') 
                    : tQ('create.form.incotermHintBuyer'))}
                </Text>
              }
            >
              <Select options={incotermOptions} />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item label={tQ('create.form.currency')} name="currency" rules={[{ required: true }]}>
              <Select options={CURRENCY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item label={tQ('create.form.issueDate')} name="issueDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item label={tQ('create.form.expiryDate')} name="expiryDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder={tQ('create.form.expiryPlaceholder')} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="portOfLoading" hidden>
              <Input />
            </Form.Item>
            <Form.Item label={tQ('create.form.pol')} name="portOfLoading_port_id">
              <PortSelect
                placeholder={tQ('create.form.polPlaceholder')}
                legacyText={watchedPortOfLoading}
                afterChange={(value) => {
                  form.setFieldsValue({
                    portOfLoading_port_id: value ?? null,
                    portOfLoading: null,
                  });
                }}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="portOfDischarge" hidden>
              <Input />
            </Form.Item>
            <Form.Item label={tQ('create.form.pod')} name="portOfDischarge_port_id">
              <PortSelect
                placeholder={tQ('create.form.podPlaceholder')}
                countryCode={selectedCustomerCountryCode}
                legacyText={watchedPortOfDischarge}
                afterChange={(value) => {
                  form.setFieldsValue({
                    portOfDischarge_port_id: value ?? null,
                    portOfDischarge: null,
                  });
                }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={tQ('create.form.paymentTerms')} name="paymentTerms">
              <Select 
                mode="tags" 
                placeholder={tQ('create.form.paymentTermsPlaceholder')}
                options={paymentTermsOptions}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* --- PHẦN 2: CHI TIẾT HÀNG HÓA --- */}
        <Divider titlePlacement="left" plain>
          <Space><ShoppingCartOutlined /> <Text strong>{tQ('create.sections.items').toUpperCase()}</Text></Space>
        </Divider>

        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
                <Table
                  dataSource={fields}
                  pagination={false}
                  bordered
                  size="small"
                  columns={[
                    {
                      title: tQ('table.stt'),
                      width: 50,
                      align: 'center',
                      render: (_, __, index) => index + 1,
                    },
                    {
                      title: tQ('table.product'),
                      dataIndex: 'productId',
                      render: (_, { key, name, ...restField }) => (
                        <Form.Item
                          {...restField}
                          key={key}
                          name={[name, 'productId']}
                          rules={[{ required: true, message: tQ('table.required') }]}
                          noStyle
                        >
                          <Select
                            showSearch
                            style={{ width: '100%' }}
                            placeholder={tQ('table.productPlaceholder')}
                            optionFilterProp="label"
                            onChange={(val) => handleProductChange(val, name)}
                            options={products.map(p => ({ 
                            value: p._id, 
                            label: `[${p.sku}] ${p.vietnameseName}` 
                          }))}
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: tQ('table.quantity'),
                      dataIndex: 'quantity',
                      width: 120,
                      render: (_, { key, name, ...restField }) => (
                        <Form.Item
                          {...restField}
                          key={key}
                          name={[name, 'quantity']}
                          rules={[{ required: true }]}
                          noStyle
                        >
                          <InputNumber<number>
                            min={0.01}
                            style={{ width: '100%' }}
                            onChange={(value) => handleQuantityChange(name, value)}
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: tQ('table.unit'),
                      dataIndex: 'unit',
                      width: 100,
                      render: (_, { key, name, ...restField }) => (
                        <Form.Item
                          {...restField}
                          key={key}
                          name={[name, 'unit']}
                          noStyle
                        >
                          <Select
                            options={unitOptions}
                            placeholder={tQ('table.unit')}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: tQ('table.price', { currency: watchedCurrency }),
                      dataIndex: 'unitPrice',
                      width: 150,
                      render: (_, { key, name, ...restField }) => (
                        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                          <Form.Item
                            {...restField}
                            key={key}
                            name={[name, 'unitPrice']}
                            rules={[{ required: true }]}
                            noStyle
                          >
                            <InputNumber<number>
                              min={0}
                              style={{ width: '100%' }}
                              disabled={resolvingPriceRows.has(name)}
                              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={value => Number((value || '').replace(/\$\s?|(,*)/g, ''))}
                              onChange={(value) => handleUnitPriceChange(name, value)}
                            />
                          </Form.Item>
                          {renderPriceSourceMeta(name)}
                        </Space>
                      ),
                    },
                    {
                      title: tQ('table.total'),
                      width: 150,
                      align: 'right',
                      render: (_, { name }) => {
                        const q = form.getFieldValue(['items', name, 'quantity']) || 0;
                        const p = form.getFieldValue(['items', name, 'unitPrice']) || 0;
                        return (
                          <Text strong style={{ color: token.colorPrimary }}>
                            {(q * p).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </Text>
                        );
                      },
                    },
                    {
                      title: '',
                      width: 50,
                      align: 'center',
                      render: (_, { name }) => (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            clearAllPriceTimers();
                            Object.keys(priceResolveSequenceRef.current).forEach((rawIndex) => {
                              const rowIndex = Number(rawIndex);
                              priceResolveSequenceRef.current[rowIndex] = (priceResolveSequenceRef.current[rowIndex] || 0) + 1;
                            });
                            setManualPriceRows((prev) => shiftIndexSetAfterRemove(prev, name));
                            setResolvingPriceRows((prev) => shiftIndexSetAfterRemove(prev, name));
                            setPriceLineStates((prev) => shiftPriceStatesAfterRemove(prev, name));
                            remove(name);
                          }}
                        />
                      ),
                    },
                  ]}
                />
              </div>
              <Button
                type="dashed"
                onClick={() => add({ quantity: 1, unit: 'CARTONS', unitPrice: 0 })}
                block
                icon={<PlusOutlined />}
              >
                {tQ('create.form.addBtn')}
              </Button>
            </>
          )}
        </Form.List>

        {/* --- PHẦN 3: TỔNG HỢP & GHI CHÚ --- */}
        <Row gutter={24} style={{ marginTop: 24 }}>
          <Col span={14}>
            <Form.Item label={tQ('create.form.note')} name="note">
              <Input.TextArea rows={4} placeholder={tQ('create.form.notePlaceholder')} />
            </Form.Item>
            <Form.Item 
                label={<Space><SafetyCertificateOutlined /> <Text>{tQ('create.form.bankInfo')}</Text></Space>} 
                name="bankInfo"
            >
                <Input.TextArea rows={4} placeholder={tQ('create.form.bankInfoPlaceholder')} />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Card 
              size="small" 
              style={{ 
                background: isDark ? token.colorBgContainer : token.colorPrimaryBg, 
                border: `1px solid ${isDark ? token.colorBorder : token.colorPrimaryBorder}`,
                borderRadius: 12,
                boxShadow: token.boxShadowSecondary
              }}
            >
              <div style={{ padding: '12px' }}>
                <Row justify="space-between" style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 14, color: token.colorTextHeading, fontWeight: 500 }}>{tQ('create.form.subtotal')}:</Text>
                  <Text strong style={{ fontSize: 15 }}>{watchedCurrency} {(grandTotal - watchedLogisticsFee - watchedOtherFee - watchedSeaFreight - watchedInsurance - watchedDomesticTransport - watchedPortCharges).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                </Row>

                <Divider style={{ margin: '8px 0 16px 0', borderTop: `1px solid ${token.colorBorderSecondary}` }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Title level={5} style={{ margin: 0, color: token.colorTextHeading, fontSize: 15 }}>
                    <DashboardOutlined /> {tQ('create.sections.logistics')}
                  </Title>
                  {watchedIncoterm && !isSellerLedIncoterm(watchedIncoterm) && (
                    <Tag color="blue" style={{ borderRadius: 4, margin: 0 }}>
                      {tQ('create.logistics.buyerCollect')}
                    </Tag>
                  )}
                  <Tag style={{ borderRadius: 4, margin: 0 }}>
                    {tQ('create.logistics.optional')}
                  </Tag>
                </div>
                {includedLogisticsLabels.length > 0 && (
                  <Text type="secondary" style={{ display: 'block', fontSize: 12, lineHeight: 1.45, marginBottom: 12 }}>
                    {tQ('create.logistics.includedLocked', { items: includedLogisticsLabels.join(', ') })}
                  </Text>
                )}
                
                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                  <Space>
                    <TruckOutlined style={{ color: token.colorPrimary }} />
                    <Text style={{ fontSize: 13, color: token.colorTextDescription }}>{tQ('create.logistics.seaFreight')}:</Text>
                  </Space>
                  <Form.Item 
                    name="seaFreight" 
                    noStyle
                  >
                    <InputNumber<number>
                      size="small" 
                      min={0} 
                      disabled={!isSellerLedIncoterm(watchedIncoterm) || includedLogisticsFields.has('seaFreight')}
                      style={{ width: 130, borderRadius: 6, fontWeight: 'bold' }} 
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => Number((v || '').replace(/\$\s?|(,*)/g, ''))}
                    />
                  </Form.Item>
                </Row>

                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                  <Space>
                    <SafetyCertificateOutlined style={{ color: token.colorSuccess }} />
                    <Text style={{ fontSize: 13, color: token.colorTextDescription }}>{tQ('create.logistics.insurance')}:</Text>
                  </Space>
                  <Form.Item 
                    name="insuranceCost" 
                    noStyle
                  >
                    <InputNumber<number>
                      size="small" 
                      min={0} 
                      disabled={watchedIncoterm !== 'CIF' || includedLogisticsFields.has('insuranceCost')}
                      style={{ width: 130, borderRadius: 6, fontWeight: 'bold' }} 
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => Number((v || '').replace(/\$\s?|(,*)/g, ''))}
                    />
                  </Form.Item>
                </Row>

                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                  <Space>
                    <TruckOutlined style={{ color: token.colorWarning }} />
                    <Text style={{ fontSize: 13, color: token.colorTextDescription }}>Vận chuyển nội địa:</Text>
                  </Space>
                  <Form.Item 
                    name="domesticTransportCost" 
                    noStyle
                  >
                    <InputNumber<number>
                      size="small" 
                      min={0} 
                      disabled={!isSellerLedIncoterm(watchedIncoterm) || includedLogisticsFields.has('domesticTransportCost')}
                      style={{ width: 130, borderRadius: 6, fontWeight: 'bold' }} 
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => Number((v || '').replace(/\$\s?|(,*)/g, ''))}
                    />
                  </Form.Item>
                </Row>

                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                  <Space>
                    <CalculatorOutlined style={{ color: token.colorInfo }} />
                    <Text style={{ fontSize: 13, color: token.colorTextDescription }}>Phí cảng (Port Charges):</Text>
                  </Space>
                  <Form.Item name="portCharges" noStyle>
                    <InputNumber<number>
                      size="small" 
                      min={0} 
                      disabled={!isSellerLedIncoterm(watchedIncoterm) || includedLogisticsFields.has('portCharges')}
                      style={{ width: 130, borderRadius: 6, fontWeight: 'bold' }} 
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => Number((v || '').replace(/\$\s?|(,*)/g, ''))}
                    />
                  </Form.Item>
                </Row>

                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                  <Space>
                    <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                    <Text style={{ fontSize: 13, color: token.colorTextDescription }}>Phí khác (Other):</Text>
                  </Space>
                  <Form.Item name="otherFee" noStyle>
                    <InputNumber<number>
                      size="small" 
                      min={0} 
                      style={{ width: 130, borderRadius: 6, fontWeight: 'bold' }} 
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => Number((v || '').replace(/\$\s?|(,*)/g, ''))}
                    />
                  </Form.Item>
                </Row>

                <Divider style={{ margin: '14px 0', borderTop: `2px dashed ${token.colorBorderSecondary}` }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Title level={5} style={{ margin: 0, color: token.colorTextHeading, letterSpacing: 0.5 }}>
                    <CalculatorOutlined /> TỔNG CỘNG:
                  </Title>
                  <div style={{ textAlign: 'right' }}>
                    <Text strong style={{ color: token.colorError, fontSize: 13, display: 'block', lineHeight: 1 }}>{watchedCurrency}</Text>
                    <Text strong style={{ color: token.colorError, fontSize: 24, fontWeight: 900 }}>
                      {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
        <Divider style={{ marginTop: 32 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={handleClose}>
            Đóng
          </Button>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={submitting}
            icon={isEditMode ? <EditOutlined /> : <PlusOutlined />}
            style={{ minWidth: 160 }}
          >
            {isEditMode ? 'Lưu thay đổi' : 'Phát hành báo giá'}
          </Button>
        </div>
      </Form>
  );
};

export default QuotationCreateModal;
