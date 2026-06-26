'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Card, Input, Select, Space, Tabs } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useLocale } from 'next-intl';
import PageBanner from '@/components/guest/PageBanner';
import { useCustomerCommercialDocuments } from '@/hooks/useCustomerPortal';
import type {
  CustomerCommercialDocument,
  CustomerCommercialDocumentQuery,
  CustomerCommercialDocumentSortField,
  CustomerCommercialDocumentType,
} from '@/types/customer-portal';
import { CommercialDocumentDetailDrawer } from './CommercialDocumentDetailDrawer';
import { CommercialDocumentsTable } from './CommercialDocumentsTable';
import { CustomerOrderSummaryCards } from './CustomerOrderSummaryCards';

type DocumentTab = CustomerCommercialDocumentType;

const statusValues = [
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'PENDING_BUYER_SIGNATURE',
  'BUYER_SIGNED',
  'CONFIRMED',
  'SHIPPED',
  'PAID',
] as const;

const getOrdersCopy = (locale: string) => {
  const isVietnamese = locale === 'vi';

  return {
    title: isVietnamese ? 'Báo giá & Đơn hàng' : 'Commercial Orders',
    subtitle: isVietnamese
      ? 'Theo dõi báo giá, hợp đồng, Proforma Invoice, thanh toán và giao hàng trong vòng đời thương mại.'
      : 'Track quotations, contracts, proforma invoices, payment and shipment progress across the customer lifecycle.',
    portal: 'Portal',
    orders: isVietnamese ? 'Đơn hàng' : 'Orders',
    all: isVietnamese ? 'Tất cả' : 'All',
    quotations: isVietnamese ? 'Báo giá' : 'Quotations',
    contracts: isVietnamese ? 'Hợp đồng' : 'Contracts',
    proformaInvoices: 'Proforma Invoice',
    retry: isVietnamese ? 'Tải lại' : 'Retry',
    refresh: isVietnamese ? 'Làm mới' : 'Refresh',
    searchPlaceholder: isVietnamese ? 'Tìm theo mã chứng từ hoặc trạng thái' : 'Search document number or status',
    filterStatus: isVietnamese ? 'Lọc trạng thái' : 'Filter status',
    unableToLoad: isVietnamese ? 'Không tải được danh sách chứng từ thương mại' : 'Unable to load commercial documents',
    pdfDownloaded: isVietnamese ? 'Đã tải PDF' : 'PDF downloaded',
    documentAccepted: isVietnamese ? 'Đã chấp nhận chứng từ' : 'Document accepted',
    documentRejected: isVietnamese ? 'Đã từ chối chứng từ' : 'Document rejected',
    revisionRequestSent: isVietnamese ? 'Đã gửi yêu cầu chỉnh sửa' : 'Revision request sent',
    statuses: {
      SENT: isVietnamese ? 'Đã gửi' : 'SENT',
      ACCEPTED: isVietnamese ? 'Đã chấp nhận' : 'ACCEPTED',
      REJECTED: isVietnamese ? 'Đã từ chối' : 'REJECTED',
      EXPIRED: isVietnamese ? 'Hết hạn' : 'EXPIRED',
      PENDING_BUYER_SIGNATURE: isVietnamese ? 'Chờ buyer ký' : 'PENDING_BUYER_SIGNATURE',
      BUYER_SIGNED: isVietnamese ? 'Buyer đã ký' : 'BUYER_SIGNED',
      CONFIRMED: isVietnamese ? 'Đã xác nhận' : 'CONFIRMED',
      SHIPPED: isVietnamese ? 'Đã giao hàng' : 'SHIPPED',
      PAID: isVietnamese ? 'Đã thanh toán' : 'PAID',
    } as Record<string, string>,
  };
};

export function CustomerOrdersPageContent() {
  const locale = useLocale();
  const copy = getOrdersCopy(locale);
  const { message } = App.useApp();
  const {
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
  } = useCustomerCommercialDocuments();
  const [query, setQuery] = useState<CustomerCommercialDocumentQuery>({
    type: 'ALL',
    current: 1,
    pageSize: 10,
    sortBy: 'documentDate',
    sortOrder: 'DESC',
  });
  const [searchInput, setSearchInput] = useState('');

  const loadDocuments = useCallback(async () => {
    const result = await fetchDocuments(query);
    if (!result.success && result.message) {
      message.error(result.message);
    }
  }, [fetchDocuments, message, query]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleOpenDocument = async (document: CustomerCommercialDocument) => {
    const result = await openDocument(document);
    if (!result.success && result.message) {
      message.error(result.message);
    }
  };

  const handleDownloadPdf = async (document: CustomerCommercialDocument) => {
    let result;
    if (document.documentType === 'COMMERCIAL_INVOICE') {
      result = await downloadCommercialInvoicePdf(document);
    } else {
      result = await downloadQuotationPdf(document);
    }
    if (result.success) {
      message.success(copy.pdfDownloaded);
    } else if (result.message) {
      message.error(result.message);
    }
  };

  const refreshAfterAction = async () => {
    await loadDocuments();
    if (selectedDocument) {
      await openDocument(selectedDocument);
    }
  };

  const handleAccept = async (recordId: string) => {
    const result = await acceptQuotation(recordId);
    if (result.success) {
      message.success(copy.documentAccepted);
      await refreshAfterAction();
    } else if (result.message) {
      message.error(result.message);
    }
  };

  const handleReject = async (recordId: string, reason: string) => {
    const result = await rejectQuotation(recordId, reason);
    if (result.success) {
      message.success(copy.documentRejected);
      await refreshAfterAction();
    } else if (result.message) {
      message.error(result.message);
    }
  };

  const handleRequestRevision = async (recordId: string, reason: string) => {
    const result = await requestRevision(recordId, reason);
    if (result.success) {
      message.success(copy.revisionRequestSent);
      await refreshAfterAction();
    } else if (result.message) {
      message.error(result.message);
    }
  };

  const tabItems: Array<{ key: DocumentTab; label: string }> = [
    { key: 'ALL', label: copy.all },
    { key: 'QUOTATION', label: copy.quotations },
    { key: 'SALES_CONTRACT', label: copy.contracts },
    { key: 'PROFORMA_INVOICE', label: copy.proformaInvoices },
    { key: 'ORDER', label: copy.orders },
  ];
  const statusOptions = statusValues.map((status) => ({
    value: status,
    label: copy.statuses[status] || status,
  }));

  return (
    <div style={{ margin: '-48px -48px 0 -48px' }}>
      <PageBanner
        title={copy.title}
        subtitle={copy.subtitle}
        height="260px"
        offset={false}
        breadcrumbs={[{ title: copy.portal, href: '/portal' }, { title: copy.orders }]}
        imageUrl="https://images.unsplash.com/photo-1454165833267-028ec48467b8?auto=format&fit=crop&q=80&w=2500"
      />

      <div style={{ padding: 48 }}>
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <CustomerOrderSummaryCards summary={documents?.summary} />

          {error ? (
            <Alert
              type="error"
              showIcon
              title={copy.unableToLoad}
              description={error}
              action={<Button onClick={() => void loadDocuments()}>{copy.retry}</Button>}
            />
          ) : null}

          <Card
            variant="borderless"
            extra={
              <Button icon={<ReloadOutlined />} onClick={() => void loadDocuments()}>
                {copy.refresh}
              </Button>
            }
          >
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Tabs
                activeKey={query.type || 'ALL'}
                items={tabItems}
                onChange={(key) => {
                  setQuery((current) => ({
                    ...current,
                    type: key as DocumentTab,
                    current: 1,
                  }));
                }}
              />

              <Space wrap>
                <Input.Search
                  allowClear
                  prefix={<SearchOutlined />}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onSearch={(value) => {
                    setQuery((current) => ({
                      ...current,
                      search: value.trim() || undefined,
                      current: 1,
                    }));
                  }}
                  placeholder={copy.searchPlaceholder}
                  style={{ width: 340 }}
                />
                <Select
                  allowClear
                  placeholder={copy.filterStatus}
                  value={query.status}
                  options={statusOptions}
                  style={{ width: 240 }}
                  onChange={(status?: string) => {
                    setQuery((current) => ({
                      ...current,
                      status,
                      current: 1,
                    }));
                  }}
                />
              </Space>

              <CommercialDocumentsTable
                data={documents?.results || []}
                loading={loading}
                current={documents?.meta.current || query.current || 1}
                pageSize={documents?.meta.pageSize || query.pageSize || 10}
                total={documents?.meta.total || 0}
                onOpen={(document) => void handleOpenDocument(document)}
                onDownloadPdf={(document) => void handleDownloadPdf(document)}
                onTableChange={(pagination, sortBy, sortOrder) => {
                  setQuery((current) => ({
                    ...current,
                    current: pagination.current || 1,
                    pageSize: pagination.pageSize || 10,
                    sortBy: sortBy as CustomerCommercialDocumentSortField,
                    sortOrder,
                  }));
                }}
              />
            </Space>
          </Card>
        </Space>
      </div>

      <CommercialDocumentDetailDrawer
        open={Boolean(selectedDocument)}
        document={selectedDocument}
        timeline={timeline}
        loading={detailLoading}
        submitting={submitting}
        downloading={downloading}
        onClose={closeDocument}
        onAccept={handleAccept}
        onReject={handleReject}
        onRequestRevision={handleRequestRevision}
        onDownloadPdf={handleDownloadPdf}
        onRequestSigning={async (id, email) => {
          const res = await requestContractSigning(id, email);
          return {
            success: res.success,
            message: res.message,
            signingUrl: res.invitation?.signingUrl,
          };
        }}
      />
    </div>
  );
}
