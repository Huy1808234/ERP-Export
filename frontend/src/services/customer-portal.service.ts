import { backendFetch, sendRequest } from '@/lib/api-client';
import type {
  CreatePortalInquiryPayload,
  CustomerCommercialDocument,
  CustomerCommercialDocumentList,
  CustomerCommercialDocumentQuery,
  CustomerTimelineItem,
  PortalCurrency,
  PortalInquiry,
  PortalNotificationList,
  PortalOrders,
  PortalProductCatalog,
  PortalProfile,
  PortalQuotation,
  PortalShipment,
  PortalStatement,
} from '@/types/customer-portal';

const getAuthHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

const portalUrl = (path: string): string => {
  return `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/portal${path}`;
};

const customerUrl = (path: string): string => {
  return `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/customer${path}`;
};

const commercialInvoicesUrl = (path: string): string => {
  return `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/commercial-invoices${path}`;
};

export type PortalProductQuery = {
  search?: string;
  category?: string;
  quantity?: number;
  currency?: string;
  incoterm?: string;
};

export const getPortalProfile = async (
  accessToken: string,
): Promise<IBackendRes<PortalProfile>> => {
  return sendRequest<IBackendRes<PortalProfile>>({
    url: portalUrl('/profile'),
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
};

export const getPortalOrders = async (
  accessToken: string,
): Promise<IBackendRes<PortalOrders>> => {
  return sendRequest<IBackendRes<PortalOrders>>({
    url: portalUrl('/orders'),
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
};

export const getPortalShipments = async (
  accessToken: string,
): Promise<IBackendRes<PortalShipment[]>> => {
  return sendRequest<IBackendRes<PortalShipment[]>>({
    url: portalUrl('/shipments'),
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
};

export const getPortalProducts = async (
  accessToken: string,
  query: PortalProductQuery = {},
): Promise<IBackendRes<PortalProductCatalog>> => {
  return sendRequest<IBackendRes<PortalProductCatalog>>({
    url: portalUrl('/products'),
    method: 'GET',
    queryParams: query,
    headers: getAuthHeaders(accessToken),
  });
};

export const createPortalInquiry = async (
  accessToken: string,
  payload: CreatePortalInquiryPayload,
): Promise<IBackendRes<PortalInquiry>> => {
  return sendRequest<IBackendRes<PortalInquiry>>({
    url: portalUrl('/inquiries'),
    method: 'POST',
    body: payload,
    headers: getAuthHeaders(accessToken),
  });
};

export const getPortalStatement = async (
  accessToken: string,
): Promise<IBackendRes<PortalStatement>> => {
  return sendRequest<IBackendRes<PortalStatement>>({
    url: portalUrl('/finance/statement'),
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
};

export const getPortalNotifications = async (
  accessToken: string,
): Promise<IBackendRes<PortalNotificationList>> => {
  return sendRequest<IBackendRes<PortalNotificationList>>({
    url: portalUrl('/notifications'),
    method: 'GET',
    queryParams: { current: 1, pageSize: 5 },
    headers: getAuthHeaders(accessToken),
  });
};

export const getPortalCurrencies = async (
  accessToken: string,
): Promise<IBackendRes<PortalCurrency[]>> => {
  return sendRequest<IBackendRes<PortalCurrency[]>>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies`,
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
};

export const downloadPortalStatement = async (
  accessToken: string,
): Promise<Blob> => {
  const response = await backendFetch(portalUrl('/finance/statement/download'), {
    method: 'GET',
    headers: {
      ...getAuthHeaders(accessToken),
      Accept: 'text/csv',
    },
  });

  if (!response.ok) {
    throw new Error(response.statusText || 'Unable to download statement');
  }

  return response.blob();
};

export const getPortalQuotation = async (
  accessToken: string,
  recordId: string,
): Promise<IBackendRes<PortalQuotation>> => {
  return sendRequest<IBackendRes<PortalQuotation>>({
    url: portalUrl(`/quotations/${recordId}`),
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
};

export const acceptPortalQuotation = async (
  accessToken: string,
  recordId: string,
): Promise<IBackendRes<PortalQuotation>> => {
  return sendRequest<IBackendRes<PortalQuotation>>({
    url: portalUrl(`/quotations/${recordId}/accept`),
    method: 'POST',
    headers: getAuthHeaders(accessToken),
  });
};

export const rejectPortalQuotation = async (
  accessToken: string,
  recordId: string,
  reason: string,
): Promise<IBackendRes<PortalQuotation>> => {
  return sendRequest<IBackendRes<PortalQuotation>>({
    url: portalUrl(`/quotations/${recordId}/reject`),
    method: 'POST',
    body: { reason },
    headers: getAuthHeaders(accessToken),
  });
};

export const downloadPortalQuotationPdf = async (
  accessToken: string,
  recordId: string,
): Promise<Blob> => {
  const response = await backendFetch(portalUrl(`/quotations/${recordId}/pdf`), {
    method: 'GET',
    headers: {
      ...getAuthHeaders(accessToken),
      Accept: 'application/pdf',
    },
  });

  if (!response.ok) {
    throw new Error(response.statusText || 'Unable to download quotation PDF');
  }

  return response.blob();
};

export const getCustomerOrdersSummary = async (
  accessToken: string,
): Promise<IBackendRes<CustomerCommercialDocumentList['summary']>> => {
  return sendRequest<IBackendRes<CustomerCommercialDocumentList['summary']>>({
    url: customerUrl('/orders/summary'),
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
};

export const getCustomerCommercialDocuments = async (
  accessToken: string,
  query: CustomerCommercialDocumentQuery,
): Promise<IBackendRes<CustomerCommercialDocumentList>> => {
  return sendRequest<IBackendRes<CustomerCommercialDocumentList>>({
    url: customerUrl('/commercial-documents'),
    method: 'GET',
    queryParams: query,
    headers: getAuthHeaders(accessToken),
  });
};

export const getCustomerCommercialDocument = async (
  accessToken: string,
  recordId: string,
): Promise<IBackendRes<CustomerCommercialDocument>> => {
  return sendRequest<IBackendRes<CustomerCommercialDocument>>({
    url: customerUrl(`/commercial-documents/${recordId}`),
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
};

export const getCustomerQuotation = async (
  accessToken: string,
  recordId: string,
): Promise<IBackendRes<CustomerCommercialDocument>> => {
  return sendRequest<IBackendRes<CustomerCommercialDocument>>({
    url: customerUrl(`/quotations/${recordId}`),
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
};

export const acceptCustomerQuotation = async (
  accessToken: string,
  recordId: string,
): Promise<IBackendRes<PortalQuotation>> => {
  return sendRequest<IBackendRes<PortalQuotation>>({
    url: customerUrl(`/quotations/${recordId}/accept`),
    method: 'POST',
    headers: getAuthHeaders(accessToken),
  });
};


export const rejectCustomerQuotation = async (
  accessToken: string,
  recordId: string,
  reason: string,
): Promise<IBackendRes<PortalQuotation>> => {
  return sendRequest<IBackendRes<PortalQuotation>>({
    url: customerUrl(`/quotations/${recordId}/reject`),
    method: 'POST',
    body: { reason },
    headers: getAuthHeaders(accessToken),
  });
};

export const acceptCustomerProformaInvoice = async (
  accessToken: string,
  recordId: string,
): Promise<IBackendRes<CustomerCommercialDocument>> => {
  return sendRequest<IBackendRes<CustomerCommercialDocument>>({
    url: customerUrl(`/proforma-invoices/${recordId}/accept`),
    method: 'POST',
    headers: getAuthHeaders(accessToken),
  });
};

export const rejectCustomerProformaInvoice = async (
  accessToken: string,
  recordId: string,
  reason: string,
): Promise<IBackendRes<CustomerCommercialDocument>> => {
  return sendRequest<IBackendRes<CustomerCommercialDocument>>({
    url: customerUrl(`/proforma-invoices/${recordId}/reject`),
    method: 'POST',
    body: { reason },
    headers: getAuthHeaders(accessToken),
  });
};

export const requestCustomerQuotationRevision = async (
  accessToken: string,
  recordId: string,
  reason: string,
): Promise<IBackendRes<CustomerCommercialDocument>> => {
  return sendRequest<IBackendRes<CustomerCommercialDocument>>({
    url: customerUrl(`/quotations/${recordId}/request-revision`),
    method: 'POST',
    body: { reason },
    headers: getAuthHeaders(accessToken),
  });
};

export const downloadCustomerQuotationPdf = async (
  accessToken: string,
  recordId: string,
): Promise<Blob> => {
  const response = await backendFetch(customerUrl(`/quotations/${recordId}/pdf`), {
    method: 'GET',
    headers: {
      ...getAuthHeaders(accessToken),
      Accept: 'application/pdf',
    },
  });

  if (!response.ok) {
    throw new Error(response.statusText || 'Unable to download quotation PDF');
  }

  return response.blob();
};

export const downloadCustomerCommercialInvoicePdf = async (
  accessToken: string,
  recordId: string,
): Promise<Blob> => {
  const response = await backendFetch(commercialInvoicesUrl(`/${recordId}/export-pdf`), {
    method: 'GET',
    headers: {
      ...getAuthHeaders(accessToken),
      Accept: 'application/pdf',
    },
  });

  if (!response.ok) {
    throw new Error(response.statusText || 'Unable to download commercial invoice PDF');
  }

  return response.blob();
};

export const getCustomerOrderTimeline = async (
  accessToken: string,
  recordId: string,
): Promise<IBackendRes<CustomerTimelineItem[]>> => {
  return sendRequest<IBackendRes<CustomerTimelineItem[]>>({
    url: customerUrl(`/orders/${recordId}/timeline`),
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
};

export type PortalContractSigningInvitation = {
  contractId: string;
  token: string;
  signingUrl: string;
  signerName: string;
  signerEmail: string;
  expiresAt: string | null;
};

export const requestCustomerContractSigning = async (
  accessToken: string,
  recordId: string,
  payload: {
    signerName?: string;
    signerTitle?: string;
    signerEmail?: string;
    expiresInDays?: number;
  } = {},
): Promise<IBackendRes<PortalContractSigningInvitation>> => {
  return sendRequest<IBackendRes<PortalContractSigningInvitation>>({
    url: customerUrl(`/contracts/${recordId}/signing-invitation`),
    method: 'POST',
    body: payload,
    headers: getAuthHeaders(accessToken),
  });
};

// ==================== Payment Receipt Functions ====================

export type PaymentReceiptPayload = {
  receiptType: 'TT_ADVANCE' | 'TT_BALANCE' | 'SWIFT' | 'VIETQR';
  accountReceivableId?: string;
  salesContractId?: string;
  fileAsset_id?: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  paymentDate?: string;
  transactionDate?: string;
  bankChargeType?: 'SHA' | 'OUR' | 'BEN';
  bankChargeForeign?: number;
  attachmentUrl?: string;
  attachmentFilename?: string;
  senderBankName?: string;
  senderAccountNumber?: string;
  senderName?: string;
  swiftCode?: string;
  note?: string;
  source?: 'SEPAY_WEBHOOK' | 'CUSTOMER_PORTAL_UPLOAD' | 'CUSTOMER_QR_INITIATED' | 'MANUAL_ENTRY';
  autoApprove?: boolean;
  transferReference?: string;
};

export const submitPaymentReceipt = async (
  accessToken: string,
  payload: PaymentReceiptPayload,
): Promise<IBackendRes<{ _id: string; receiptNumber: string; status: string }>> => {
  return sendRequest<IBackendRes<{ _id: string; receiptNumber: string; status: string }>>({
    url: portalUrl('/finance/tt-receipts'),
    method: 'POST',
    body: payload,
    headers: getAuthHeaders(accessToken),
  });
};

export type UploadPaymentAttachmentResult = {
  url: string;
  filename: string;
};

export const uploadPaymentAttachment = async (
  accessToken: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadPaymentAttachmentResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            url: response.url,
            filename: file.name,
          });
        } catch {
          reject(new Error('Invalid response format'));
        }
      } else {
        reject(new Error(xhr.statusText || 'Upload failed'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('POST', `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/files/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.send(formData);
  });
};

export const downloadPdfBlob = async (
  url: string,
  accessToken: string,
  filename: string,
): Promise<void> => {
  const response = await backendFetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/pdf',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.statusText}`);
  }

  const blob = await response.blob();

  // Create download link
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup
  window.URL.revokeObjectURL(downloadUrl);
};

export const getPaymentReceiptStatus = async (
  accessToken: string,
  receiptId: string,
): Promise<IBackendRes<{ _id: string; receiptNumber: string; status: string }>> => {
  return sendRequest<IBackendRes<{ _id: string; receiptNumber: string; status: string }>>({
    url: portalUrl(`/finance/tt-receipts/${receiptId}`),
    method: 'GET',
    headers: getAuthHeaders(accessToken),
  });
};
