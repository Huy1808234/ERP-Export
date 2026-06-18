import { useCallback, useState } from 'react';
import { backendFetch, sendRequest } from '@/lib/api-client';
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

export const useCommercialInvoices = () => {
  const [rows, setRows] = useState<ICommercialInvoice[]>([]);
  const [shipments, setShipments] = useState<ICommercialInvoiceShipmentOption[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInvoices = useCallback(async (query: Record<string, string | number | undefined> = {}) => {
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<IPaginatedResponse<ICommercialInvoice>>>({
        url: `${backendUrl}/api/v1/commercial-invoices`,
        method: 'GET',
        queryParams: { current: 1, pageSize: 50, ...query },
      });
      setRows(res?.data?.results ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchShipmentOptions = useCallback(async () => {
    const res = await sendRequest<IBackendRes<IPaginatedResponse<ICommercialInvoiceShipmentOption>>>({
      url: `${backendUrl}/api/v1/shipments`,
      method: 'GET',
      queryParams: { current: 1, pageSize: 100 },
    });
    setShipments((res?.data?.results ?? []).filter((item) => Boolean(item.salesContract?._id)));
  }, []);

  const createFromShipment = useCallback(async (
    shipment_id: string,
    payload: CreateCommercialInvoicePayload,
  ) => {
    const res = await sendRequest<IBackendRes<ICommercialInvoice>>({
      url: `${backendUrl}/api/v1/commercial-invoices/from-shipment/${shipment_id}`,
      method: 'POST',
      body: payload,
    });

    return res?.data ?? null;
  }, []);

  const issueInvoice = useCallback(async (
    invoice_id: string,
    payload: IssueCommercialInvoicePayload = {},
  ) => {
    const res = await sendRequest<IBackendRes<ICommercialInvoice>>({
      url: `${backendUrl}/api/v1/commercial-invoices/${invoice_id}/issue`,
      method: 'PATCH',
      body: payload,
    });

    return res?.data ?? null;
  }, []);

  const cancelInvoice = useCallback(async (invoice_id: string, reason: string) => {
    const res = await sendRequest<IBackendRes<ICommercialInvoice>>({
      url: `${backendUrl}/api/v1/commercial-invoices/${invoice_id}/cancel`,
      method: 'PATCH',
      body: { reason },
    });

    return res?.data ?? null;
  }, []);

  const fetchInvoiceDetail = useCallback(async (invoice_id: string) => {
    try {
      const res = await sendRequest<IBackendRes<ICommercialInvoice>>({
        url: `${backendUrl}/api/v1/commercial-invoices/${invoice_id}`,
        method: 'GET',
      });

      return res?.data ?? null;
    } catch {
      return null;
    }
  }, []);

  const downloadCommercialInvoicePdf = useCallback(async (shipment_id: string, filename: string) => {
    try {
      const response = await backendFetch(`${backendUrl}/api/v1/export-documents/download/${shipment_id}/CI`, {
        method: 'GET',
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
    } catch {
      return false;
    }
  }, []);

  return {
    rows,
    shipments,
    loading,
    fetchInvoices,
    fetchShipmentOptions,
    createFromShipment,
    issueInvoice,
    cancelInvoice,
    fetchInvoiceDetail,
    downloadCommercialInvoicePdf,
  };
};
