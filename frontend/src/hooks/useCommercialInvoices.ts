import { useCallback, useState } from 'react';
import { getSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import type {
  ICommercialInvoice,
  ICommercialInvoiceShipmentOption,
  IPaginatedResponse,
} from '@/types/commercial-invoice';

type CreateCommercialInvoicePayload = {
  invoiceDate?: string;
  dueDate?: string;
  taxRatePercent?: number;
  note?: string;
};

type IssueCommercialInvoicePayload = {
  invoiceDate?: string;
  dueDate?: string;
  note?: string;
};

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export const useCommercialInvoices = (session?: Session | null) => {
  const [rows, setRows] = useState<ICommercialInvoice[]>([]);
  const [shipments, setShipments] = useState<ICommercialInvoiceShipmentOption[]>([]);
  const [loading, setLoading] = useState(false);

  const resolveAccessToken = useCallback(async () => {
    const directToken = getAccessToken(session);
    if (directToken) return directToken;

    const currentSession = await getSession();
    return getAccessToken(currentSession);
  }, [session]);

  const buildHeaders = useCallback(async () => {
    const accessToken = await resolveAccessToken();
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : null;
  }, [resolveAccessToken]);

  const fetchInvoices = useCallback(async (query: Record<string, string | number | undefined> = {}) => {
    const headers = await buildHeaders();
    if (!headers) return;

    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<IPaginatedResponse<ICommercialInvoice>>>({
        url: `${backendUrl}/api/v1/commercial-invoices`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 50, ...query },
        headers,
      });
      setRows(res?.data?.results ?? []);
    } finally {
      setLoading(false);
    }
  }, [buildHeaders]);

  const fetchShipmentOptions = useCallback(async () => {
    const headers = await buildHeaders();
    if (!headers) return;

    const res = await sendRequest<IBackendRes<IPaginatedResponse<ICommercialInvoiceShipmentOption>>>({
      url: `${backendUrl}/api/v1/shipments`,
      method: 'GET',
      queryParams: { current: 1, pageSize: 100 },
      headers,
    });
    setShipments((res?.data?.results ?? []).filter((item) => Boolean(item.salesContract?._id)));
  }, [buildHeaders]);

  const createFromShipment = useCallback(async (
    shipment_id: string,
    payload: CreateCommercialInvoicePayload,
  ) => {
    const headers = await buildHeaders();
    if (!headers) return null;

    const res = await sendRequest<IBackendRes<ICommercialInvoice>>({
      url: `${backendUrl}/api/v1/commercial-invoices/from-shipment/${shipment_id}`,
      method: 'POST',
      body: payload,
      headers,
    });

    return res?.data ?? null;
  }, [buildHeaders]);

  const issueInvoice = useCallback(async (
    invoice_id: string,
    payload: IssueCommercialInvoicePayload = {},
  ) => {
    const headers = await buildHeaders();
    if (!headers) return null;

    const res = await sendRequest<IBackendRes<ICommercialInvoice>>({
      url: `${backendUrl}/api/v1/commercial-invoices/${invoice_id}/issue`,
      method: 'PATCH',
      body: payload,
      headers,
    });

    return res?.data ?? null;
  }, [buildHeaders]);

  const cancelInvoice = useCallback(async (invoice_id: string, reason: string) => {
    const headers = await buildHeaders();
    if (!headers) return null;

    const res = await sendRequest<IBackendRes<ICommercialInvoice>>({
      url: `${backendUrl}/api/v1/commercial-invoices/${invoice_id}/cancel`,
      method: 'PATCH',
      body: { reason },
      headers,
    });

    return res?.data ?? null;
  }, [buildHeaders]);

  const downloadSignaturePacketPdf = useCallback(async (salesContract_id: string, filename: string) => {
    const headers = await buildHeaders();
    if (!headers) return false;

    const response = await fetch(`${backendUrl}/api/v1/sales-contracts/${salesContract_id}/signature-packet.pdf`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) return false;

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    return true;
  }, [buildHeaders]);

  return {
    rows,
    shipments,
    loading,
    fetchInvoices,
    fetchShipmentOptions,
    createFromShipment,
    issueInvoice,
    cancelInvoice,
    downloadSignaturePacketPdf,
  };
};
