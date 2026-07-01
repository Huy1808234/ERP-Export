import { useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getAccessToken } from '@/lib/auth-token';
import {
  createPortalInquiry,
  downloadPortalStatement,
  downloadPortalStatementExcel,
  getPortalCurrencies,
  getPortalNotifications,
  getPortalOrders,
  getPortalProducts,
  getPortalProfile,
  getPortalShipments,
  getPortalStatement,
  getPortalQuotation,
  acceptPortalQuotation,
  rejectPortalQuotation,
  downloadPortalQuotationPdf,
  acceptCustomerQuotation,
  downloadCustomerQuotationPdf,
  downloadCustomerCommercialInvoicePdf,
  getCustomerCommercialDocument,
  getCustomerCommercialDocuments,
  getCustomerQuotation,
  rejectCustomerQuotation,
  requestCustomerQuotationRevision,
  acceptCustomerProformaInvoice,
  rejectCustomerProformaInvoice,
  requestCustomerContractSigning,
  type PortalContractSigningInvitation,
  type PortalShipmentQuery,
} from '@/services/customer-portal.service';
import { portService, type IPort } from '@/services/port.service';
import type { PortalProductQuery } from '@/services/customer-portal.service';
import type {
  CreatePortalInquiryPayload,
  CustomerCommercialDocument,
  CustomerCommercialDocumentList,
  CustomerCommercialDocumentQuery,
  CustomerTimelineItem,
  CustomerPortalOverview,
  PortalCurrency,
  PortalOrders,
  PortalProductCatalog,
  PortalProfile,
  PortalInquiry,
  PortalShipment,
  PortalShipmentList,
  PortalStatement,
  PortalQuotation,
} from '@/types/customer-portal';

type PortalActionResult = {
  success: boolean;
  message?: string;
};

const missingTokenMessage = 'Missing access token';

const defaultPortalShipmentMeta = {
  current: 1,
  pageSize: 10,
  pages: 0,
  total: 0,
};

const createPortalShipmentSummary = (shipments: PortalShipment[]) => {
  const statusCounts = shipments.reduce<Record<string, number>>((acc, shipment) => {
    const status = shipment.status || 'BOOKED';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return {
    total: shipments.length,
    statusCounts,
  };
};

const normalizePortalShipmentList = (
  value: PortalShipmentList | PortalShipment[],
): PortalShipmentList => {
  if (Array.isArray(value)) {
    return {
      results: value,
      meta: {
        current: 1,
        pageSize: value.length || 10,
        pages: value.length ? 1 : 0,
        total: value.length,
      },
      summary: createPortalShipmentSummary(value),
    };
  }

  return value;
};

const fallbackPortalCurrencies: PortalCurrency[] = [
  { _id: 'currency_usd', code: 'USD', name: 'US Dollar', symbol: '$', isActive: true },
  { _id: 'currency_vnd', code: 'VND', name: 'Vietnamese Dong', symbol: '₫', isActive: true },
  { _id: 'currency_eur', code: 'EUR', name: 'Euro', symbol: '€', isActive: true },
];

export const useCustomerPortalOverview = () => {
  const { data: session } = useSession();
  const [data, setData] = useState<CustomerPortalOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async (): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      setError(missingTokenMessage);
      return { success: false, message: missingTokenMessage };
    }

    setLoading(true);
    setError(null);
    try {
      const [profileRes, ordersRes, shipmentsRes, statementRes, notificationsRes] = await Promise.all([
        getPortalProfile(accessToken),
        getPortalOrders(accessToken),
        getPortalShipments(accessToken, { current: 1, pageSize: 5 }),
        getPortalStatement(accessToken),
        getPortalNotifications(accessToken),
      ]);

      if (
        !profileRes.data ||
        !ordersRes.data ||
        !shipmentsRes.data ||
        !statementRes.data ||
        !notificationsRes.data
      ) {
        const message = profileRes.message || 'Unable to load customer portal';
        setError(message);
        return { success: false, message };
      }

      setData({
        profile: profileRes.data,
        orders: ordersRes.data,
        shipments: normalizePortalShipmentList(shipmentsRes.data).results,
        statement: statementRes.data,
        notifications: notificationsRes.data,
      });
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { data, loading, error, fetchOverview };
};

export const useCustomerPortalOrders = () => {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<PortalOrders | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      setError(missingTokenMessage);
      return { success: false, message: missingTokenMessage };
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getPortalOrders(accessToken);
      if (!res.data) {
        const message = res.message || 'Unable to load orders';
        setError(message);
        return { success: false, message };
      }

      setOrders(res.data);
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { orders, loading, error, fetchOrders };
};

export const useCustomerPortalProfile = () => {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      setError(missingTokenMessage);
      return { success: false, message: missingTokenMessage };
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getPortalProfile(accessToken);
      if (!res.data) {
        const message = res.message || 'Unable to load buyer profile';
        setError(message);
        return { success: false, message };
      }

      setProfile(res.data);
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { profile, loading, error, fetchProfile };
};

export const useCustomerPortalFinance = () => {
  const { data: session } = useSession();
  const [statement, setStatement] = useState<PortalStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatement = useCallback(async (): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      setError(missingTokenMessage);
      return { success: false, message: missingTokenMessage };
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getPortalStatement(accessToken);
      if (!res.data) {
        const message = res.message || 'Unable to load finance statement';
        setError(message);
        return { success: false, message };
      }

      setStatement(res.data);
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, [session]);

  const downloadStatementCsv = useCallback(async (): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) return { success: false, message: missingTokenMessage };

    setDownloading(true);
    try {
      const blob = await downloadPortalStatement(accessToken);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `statement_of_account_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to download statement';
      return { success: false, message };
    } finally {
      setDownloading(false);
    }
  }, [session]);

  const downloadStatementExcel = useCallback(async (): Promise<PortalActionResult> => {
    if (!statement) return { success: false, message: 'Statement data is not loaded' };

    setDownloading(true);
    try {
      await downloadPortalStatementExcel(statement);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to download statement';
      return { success: false, message };
    } finally {
      setDownloading(false);
    }
  }, [statement]);

  return {
    statement,
    loading,
    downloading,
    error,
    fetchStatement,
    downloadStatementCsv,
    downloadStatementExcel,
  };
};

export const useCustomerPortalShipments = () => {
  const { data: session } = useSession();
  const [shipments, setShipments] = useState<PortalShipment[]>([]);
  const [meta, setMeta] = useState(defaultPortalShipmentMeta);
  const [summary, setSummary] = useState(createPortalShipmentSummary([]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShipments = useCallback(async (
    query: PortalShipmentQuery = {},
  ): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      setError(missingTokenMessage);
      return { success: false, message: missingTokenMessage };
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getPortalShipments(accessToken, query);
      if (!res.data) {
        const message = res.message || 'Unable to load shipments';
        setError(message);
        return { success: false, message };
      }

      const shipmentList = normalizePortalShipmentList(res.data);
      setShipments(shipmentList.results);
      setMeta(shipmentList.meta);
      setSummary(shipmentList.summary || createPortalShipmentSummary(shipmentList.results));
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { shipments, meta, summary, loading, error, fetchShipments };
};

export const useCustomerPortalProducts = () => {
  const { data: session } = useSession();
  const [catalog, setCatalog] = useState<PortalProductCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (
    query: PortalProductQuery = {},
  ): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      setError(missingTokenMessage);
      return { success: false, message: missingTokenMessage };
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getPortalProducts(accessToken, query);
      if (!res.data) {
        const message = res.message || 'Unable to load products';
        setError(message);
        return { success: false, message };
      }

      setCatalog(res.data);
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, [session]);

  const submitInquiry = useCallback(async (
    payload: CreatePortalInquiryPayload,
  ): Promise<PortalActionResult & { inquiry?: PortalInquiry }> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      return { success: false, message: missingTokenMessage };
    }

    setSubmitting(true);
    try {
      const res = await createPortalInquiry(accessToken, payload);
      if (!res.data) {
        return {
          success: false,
          message: res.message || 'Unable to submit inquiry',
        };
      }

      return { success: true, inquiry: res.data };
    } finally {
      setSubmitting(false);
    }
  }, [session]);

  return {
    catalog,
    loading,
    submitting,
    error,
    fetchProducts,
    submitInquiry,
  };
};

export const useCustomerPortalCurrencies = () => {
  const { data: session } = useSession();
  const [currencies, setCurrencies] = useState<PortalCurrency[]>(fallbackPortalCurrencies);
  const [loading, setLoading] = useState(false);

  const fetchCurrencies = useCallback(async (): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      return { success: false, message: missingTokenMessage };
    }

    setLoading(true);
    try {
      const res = await getPortalCurrencies(accessToken);
      const activeCurrencies = (res.data || []).filter((currency) => currency.isActive !== false);
      if (activeCurrencies.length) {
        setCurrencies(activeCurrencies);
      }
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load currencies';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { currencies, loading, fetchCurrencies };
};

export const useCustomerPortalPorts = () => {
  const { data: session } = useSession();
  const [ports, setPorts] = useState<IPort[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPorts = useCallback(async (
    search?: string,
  ): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      setError(missingTokenMessage);
      return { success: false, message: missingTokenMessage };
    }

    setLoading(true);
    setError(null);
    try {
      const res = await portService.findAll(
        {
          search,
          type: 'SEA',
          isActive: true,
          current: 1,
          pageSize: 100,
        },
        accessToken,
      );

      if (!res.data) {
        const message = res.message || 'Unable to load destination ports';
        setError(message);
        return { success: false, message };
      }

      setPorts(res.data.results || []);
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { ports, loading, error, fetchPorts };
};

export const useCustomerPortalQuotationDetails = () => {
  const { data: session } = useSession();
  const [quotation, setQuotation] = useState<PortalQuotation | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotation = useCallback(async (recordId: string): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      setError(missingTokenMessage);
      return { success: false, message: missingTokenMessage };
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getPortalQuotation(accessToken, recordId);
      if (!res.data) {
        const message = res.message || 'Unable to load quotation details';
        setError(message);
        return { success: false, message };
      }
      setQuotation(res.data);
      return { success: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to load quotation details';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, [session]);

  const acceptQuotation = useCallback(async (recordId: string): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      setError(missingTokenMessage);
      return { success: false, message: missingTokenMessage };
    }
    
    setLoading(true);
    try {
      const res = await acceptPortalQuotation(accessToken, recordId);
      if (!res.data) return { success: false, message: res.message || 'Unable to accept quotation' };
      setQuotation(res.data);
      return { success: true };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'Unable to accept quotation' };
    } finally {
      setLoading(false);
    }
  }, [session]);

  const rejectQuotation = useCallback(async (recordId: string, reason: string): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      setError(missingTokenMessage);
      return { success: false, message: missingTokenMessage };
    }
    
    setLoading(true);
    try {
      const res = await rejectPortalQuotation(accessToken, recordId, reason);
      if (!res.data) return { success: false, message: res.message || 'Unable to reject quotation' };
      setQuotation(res.data);
      return { success: true };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'Unable to reject quotation' };
    } finally {
      setLoading(false);
    }
  }, [session]);

  const downloadPdf = useCallback(async (recordId: string): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) return { success: false, message: missingTokenMessage };

    setDownloading(true);
    try {
      const blob = await downloadPortalQuotationPdf(accessToken, recordId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Quotation_${quotation?.quotationNumber || recordId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unable to download PDF' };
    } finally {
      setDownloading(false);
    }
  }, [session, quotation]);

  return { quotation, loading, downloading, error, fetchQuotation, acceptQuotation, rejectQuotation, downloadPdf };
};

export const useCustomerCommercialDocuments = () => {
  const { data: session } = useSession();
  const [documents, setDocuments] = useState<CustomerCommercialDocumentList | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<CustomerCommercialDocument | null>(null);
  const [timeline, setTimeline] = useState<CustomerTimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async (
    query: CustomerCommercialDocumentQuery,
  ): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) {
      setError(missingTokenMessage);
      return { success: false, message: missingTokenMessage };
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getCustomerCommercialDocuments(accessToken, query);
      if (!res.data) {
        const message = res.message || 'Unable to load commercial documents';
        setError(message);
        return { success: false, message };
      }

      setDocuments(res.data);
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, [session]);

  const openDocument = useCallback(async (
    document: CustomerCommercialDocument,
  ): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) return { success: false, message: missingTokenMessage };

    setDetailLoading(true);
    setSelectedDocument(document);
    setTimeline(document.timeline || []);
    try {
      const res = await getCustomerCommercialDocument(accessToken, document._id);
      if (!res.data) {
        return {
          success: false,
          message: res.message || 'Unable to load commercial document details',
        };
      }
      setSelectedDocument(res.data);
      setTimeline(res.data.timeline || []);
      return { success: true };
    } finally {
      setDetailLoading(false);
    }
  }, [session]);

  const closeDocument = useCallback(() => {
    setSelectedDocument(null);
    setTimeline([]);
  }, []);

  const acceptQuotation = useCallback(async (
    recordId: string,
  ): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) return { success: false, message: missingTokenMessage };

    setSubmitting(true);
    try {
      const isPI = selectedDocument?.documentType === 'PROFORMA_INVOICE';
      const res = isPI
        ? await acceptCustomerProformaInvoice(accessToken, recordId)
        : await acceptCustomerQuotation(accessToken, recordId);
        
      if (!res.data) {
        return {
          success: false,
          message: res.message || `Unable to accept ${isPI ? 'proforma invoice' : 'quotation'}`,
        };
      }
      const refreshed = isPI
        ? await getCustomerCommercialDocument(accessToken, recordId)
        : await getCustomerQuotation(accessToken, recordId);
        
      if (refreshed.data) {
        setSelectedDocument(refreshed.data);
        setTimeline(refreshed.data.timeline || []);
      }
      return { success: true };
    } finally {
      setSubmitting(false);
    }
  }, [session, selectedDocument]);

  const rejectQuotation = useCallback(async (
    recordId: string,
    reason: string,
  ): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) return { success: false, message: missingTokenMessage };

    setSubmitting(true);
    try {
      const isPI = selectedDocument?.documentType === 'PROFORMA_INVOICE';
      const res = isPI
        ? await rejectCustomerProformaInvoice(accessToken, recordId, reason)
        : await rejectCustomerQuotation(accessToken, recordId, reason);
        
      if (!res.data) {
        return {
          success: false,
          message: res.message || `Unable to reject ${isPI ? 'proforma invoice' : 'quotation'}`,
        };
      }
      const refreshed = isPI
        ? await getCustomerCommercialDocument(accessToken, recordId)
        : await getCustomerQuotation(accessToken, recordId);
        
      if (refreshed.data) {
        setSelectedDocument(refreshed.data);
        setTimeline(refreshed.data.timeline || []);
      }
      return { success: true };
    } finally {
      setSubmitting(false);
    }
  }, [session, selectedDocument]);

  const requestRevision = useCallback(async (
    recordId: string,
    reason: string,
  ): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) return { success: false, message: missingTokenMessage };

    setSubmitting(true);
    try {
      const res = await requestCustomerQuotationRevision(accessToken, recordId, reason);
      if (!res.data) {
        return {
          success: false,
          message: res.message || 'Unable to request revision',
        };
      }
      setSelectedDocument(res.data);
      setTimeline(res.data.timeline || []);
      return { success: true };
    } finally {
      setSubmitting(false);
    }
  }, [session]);

  const downloadQuotationPdf = useCallback(async (
    commercialDocument: CustomerCommercialDocument,
  ): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) return { success: false, message: missingTokenMessage };

    setDownloading(true);
    try {
      const blob = await downloadCustomerQuotationPdf(accessToken, commercialDocument._id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Quotation_${commercialDocument.documentNumber || commercialDocument._id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to download PDF',
      };
    } finally {
      setDownloading(false);
    }
  }, [session]);

  const downloadCommercialInvoicePdf = useCallback(async (
    commercialDocument: CustomerCommercialDocument,
  ): Promise<PortalActionResult> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) return { success: false, message: missingTokenMessage };

    setDownloading(true);
    try {
      const blob = await downloadCustomerCommercialInvoicePdf(accessToken, commercialDocument._id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CI-${commercialDocument.documentNumber || commercialDocument._id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to download Commercial Invoice PDF',
      };
    } finally {
      setDownloading(false);
    }
  }, [session]);

  const requestContractSigning = useCallback(async (
    recordId: string,
    signerEmail?: string,
  ): Promise<PortalActionResult & { invitation?: PortalContractSigningInvitation }> => {
    const accessToken = getAccessToken(session);
    if (!accessToken) return { success: false, message: missingTokenMessage };

    setSubmitting(true);
    try {
      const res = await requestCustomerContractSigning(accessToken, recordId, signerEmail ? { signerEmail } : {});
      if (!res.data) {
        return {
          success: false,
          message: res.message || 'Unable to issue signing invitation',
        };
      }
      const refreshed = await getCustomerCommercialDocument(accessToken, recordId);
      if (refreshed.data) {
        setSelectedDocument(refreshed.data);
        setTimeline(refreshed.data.timeline || []);
      }
      return { success: true, invitation: res.data };
    } finally {
      setSubmitting(false);
    }
  }, [session]);

  return {
    documents,
    selectedDocument,
    timeline,
    loading,
    detailLoading,
    submitting,
    downloading,
    error,
    fetchDocuments,
    openDocument,
    closeDocument,
    acceptQuotation,
    rejectQuotation,
    requestRevision,
    requestContractSigning,
    downloadQuotationPdf,
    downloadCommercialInvoicePdf,
  };
};
