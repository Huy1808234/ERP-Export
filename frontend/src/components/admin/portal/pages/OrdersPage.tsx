'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Alert,
  App,
  Button,
  Card,
  Input,
  Select,
  Space,
  Tabs,
} from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';

import { useCustomerCommercialDocuments } from '@/hooks/useCustomerPortal';
import { PageState, PortalShell } from '@/components/admin/portal/_shared/PortalShell';
import { translateCustomerDocumentStatus } from '@/components/admin/portal/_shared/helpers';
import { orderStatusValues, type OrdersDocumentTab } from '@/components/admin/portal/_shared/constants';
import { CustomerOrderSummaryCards } from '@/components/guest/portal/orders/CustomerOrderSummaryCards';
import { CommercialDocumentsTable } from '@/components/guest/portal/orders/CommercialDocumentsTable';
import { CommercialDocumentDetailDrawer } from '@/components/guest/portal/orders/CommercialDocumentDetailDrawer';
import type {
  CustomerCommercialDocument,
  CustomerCommercialDocumentQuery,
  CustomerCommercialDocumentSortField,
} from '@/types/customer-portal';

export const OrdersPage = () => {
  const locale = useLocale();
  const t = useTranslations('CustomerPortal');
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
    downloadQuotationPdf,
    requestContractSigning,
  } = useCustomerCommercialDocuments();
  const [query, setQuery] = useState<CustomerCommercialDocumentQuery>({
    type: 'ALL',
    current: 1,
    pageSize: 10,
    sortBy: 'documentDate',
    sortOrder: 'DESC',
  });
  const [searchInput, setSearchInput] = useState('');
  const orderDocumentTabs: Array<{ key: OrdersDocumentTab; label: string }> = [
    { key: 'ALL', label: t('allDocuments') },
    { key: 'QUOTATION', label: t('quotations') },
    { key: 'SALES_CONTRACT', label: t('contracts') },
    { key: 'PROFORMA_INVOICE', label: t('proformaInvoices') },
    { key: 'ORDER', label: t('orders') },
  ];
  const orderStatusOptions = orderStatusValues.map((status) => ({
    value: status,
    label: translateCustomerDocumentStatus(status, locale),
  }));

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
    const result = await downloadQuotationPdf(document);
    if (result.success) {
      message.success(t('pdfDownloaded'));
      return;
    }

    if (result.message) {
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
      message.success(t('quotationAccepted'));
      await refreshAfterAction();
      return;
    }

    if (result.message) {
      message.error(result.message);
    }
  };

  const handleReject = async (recordId: string, reason: string) => {
    const result = await rejectQuotation(recordId, reason);
    if (result.success) {
      message.success(t('quotationRejected'));
      await refreshAfterAction();
      return;
    }

    if (result.message) {
      message.error(result.message);
    }
  };

  const handleRequestRevision = async (recordId: string, reason: string) => {
    const result = await requestRevision(recordId, reason);
    if (result.success) {
      message.success(t('revisionRequestSent'));
      await refreshAfterAction();
      return;
    }

    if (result.message) {
      message.error(result.message);
    }
  };

  const handleRequestSigning = async (recordId: string) => {
    const result = await requestContractSigning(recordId);
    if (!result.success) {
      message.error(result.message || 'Unable to open signing portal');
      return { success: false, message: result.message };
    }
    message.success('OTP sent. Complete signing in the new tab.');
    await refreshAfterAction();
    return { success: true, signingUrl: result.invitation?.signingUrl };
  };

  const tabItems = orderDocumentTabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
  }));

  return (
    <PortalShell title={t('ordersTitle')} subtitle={t('ordersSubtitle')} icon={<ShoppingCartOutlined />}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <CustomerOrderSummaryCards summary={documents?.summary} />

        {error ? (
          <Alert
            type="error"
            showIcon
            title={t('unableToLoadCommercialDocuments')}
            description={error}
            action={<Button onClick={() => void loadDocuments()}>{t('retry')}</Button>}
          />
        ) : null}

        <Card
          variant="borderless"
          extra={(
            <Button icon={<ReloadOutlined />} onClick={() => void loadDocuments()}>
              {t('refresh')}
            </Button>
          )}
          styles={{ body: { padding: '16px 24px' } }}
        >
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Tabs
              activeKey={query.type || 'ALL'}
              items={tabItems}
              onChange={(key) => {
                setQuery((current) => ({
                  ...current,
                  type: key as OrdersDocumentTab,
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
                placeholder={t('searchOrdersPlaceholder')}
                style={{ width: 340 }}
              />
              <Select
                allowClear
                placeholder={t('filterStatus')}
                value={query.status}
                options={orderStatusOptions}
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
          onRequestSigning={handleRequestSigning}
        />
      </Space>
    </PortalShell>
  );
};