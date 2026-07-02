'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';

import {
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  notification,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  DownOutlined,
  DownloadOutlined,
  FileDoneOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  LinkOutlined,
  TruckOutlined,
  UploadOutlined,
} from '@ant-design/icons';

import { useCustomerPortalFinance } from '@/hooks/useCustomerPortal';
import { PageState, PortalShell } from '@/components/admin/portal/_shared/PortalShell';
import { formatDate, formatMoney, isVietnameseText } from '@/components/admin/portal/_shared/helpers';
import { getAccessToken } from '@/lib/auth-token';
import { downloadPdfBlob } from '@/services/customer-portal.service';
import { AgingSummaryCards } from '@/components/guest/portal/finance/AgingSummaryCards';
import { PaymentAdviceModal } from '@/components/guest/portal/orders/PaymentAdviceModal';
import type { PortalPaymentReceipt, PortalStatementLine } from '@/types/customer-portal';

const { Text } = Typography;

export const FinancePage = () => {
  const locale = useLocale();
  const t = useTranslations('CustomerPortal');
  const { token } = theme.useToken();
  const [api, contextHolder] = notification.useNotification();
  const {
    statement,
    loading,
    downloading,
    error,
    fetchStatement,
    downloadStatementCsv,
    downloadStatementExcel,
  } = useCustomerPortalFinance();
  const { data: session } = useSession();

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PortalStatementLine | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [expandedInvoiceKeys, setExpandedInvoiceKeys] = useState<string[]>([]);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  useEffect(() => {
    void fetchStatement();
  }, [fetchStatement]);

  useEffect(() => {
    setAccessToken(session ? getAccessToken(session) ?? null : null);
  }, [session]);

  // Inject overdue row highlight styles (client-side only)
  useEffect(() => {
    const STYLE_ID = 'customer-portal-finance-styles';
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      .overdue-row-highlight {
        background-color: rgba(255, 75, 74, 0.08) !important;
        border-left: 3px solid #ff4b4a !important;
      }
      .due-soon-row-highlight {
        background-color: rgba(250, 173, 20, 0.08) !important;
        border-left: 3px solid #faad14 !important;
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

  // Aging bucket badge
  const agingBucketBadge = (bucket: string) => {
    const config: Record<string, { color: string; label: string; labelVi: string }> = {
      CURRENT: { color: 'green', label: 'Current', labelVi: 'Trong hạn' },
      DUE_1_30: { color: 'gold', label: '1-30 days', labelVi: 'Qua hạn 1-30 ngày' },
      DUE_31_60: { color: 'orange', label: '31-60 days', labelVi: 'Qua hạn 31-60 ngày' },
      DUE_61_90: { color: 'red', label: '61-90 days', labelVi: 'Qua hạn 61-90 ngày' },
      OVERDUE_90: { color: 'red', label: '>90 days', labelVi: 'Qua hạn >90 ngày' },
    };
    const c = config[bucket] || config.CURRENT;
    const label = locale === 'vi' ? c.labelVi : c.label;
    return (
      <Tag color={c.color} style={{ borderRadius: 6, fontWeight: 500 }}>
        {label}
      </Tag>
    );
  };

  const renderFinanceStatusTag = (status?: string | null) => {
    const normalized = status?.toUpperCase() || '-';
    const config: Record<string, { color: string; background: string }> = {
      PAID: { color: '#22c55e', background: 'rgba(34,197,94,.18)' },
      CONFIRMED: { color: '#22c55e', background: 'rgba(34,197,94,.18)' },
      UNPAID: { color: '#f59e0b', background: 'rgba(245,158,11,.18)' },
      PARTIAL: { color: '#38bdf8', background: 'rgba(56,189,248,.16)' },
      SUBMITTED: { color: '#f59e0b', background: 'rgba(245,158,11,.18)' },
      OVERDUE: { color: '#f87171', background: 'rgba(248,113,113,.18)' },
      REJECTED: { color: '#f87171', background: 'rgba(248,113,113,.18)' },
      CANCELLED: { color: '#94a3b8', background: 'rgba(148,163,184,.16)' },
    };
    const meta = config[normalized] || { color: token.colorTextSecondary, background: token.colorFillSecondary };
    const labels: Record<string, { en: string; vi: string }> = {
      PAID: { en: 'Paid', vi: 'Đã thanh toán' },
      CONFIRMED: { en: 'Confirmed', vi: 'Đã xác nhận' },
      UNPAID: { en: 'Unpaid', vi: 'Chưa thanh toán' },
      PARTIAL: { en: 'Partial', vi: 'Thanh toán một phần' },
      SUBMITTED: { en: 'Submitted', vi: 'Đã gửi' },
      OVERDUE: { en: 'Overdue', vi: 'Quá hạn' },
      REJECTED: { en: 'Rejected', vi: 'Từ chối' },
      CANCELLED: { en: 'Cancelled', vi: 'Đã hủy' },
    };
    const label = labels[normalized]
      ? (locale === 'vi' ? labels[normalized].vi : labels[normalized].en)
      : normalized;

    return (
      <Tag
        style={{
          marginInlineEnd: 0,
          borderRadius: 6,
          borderColor: `${meta.color}66`,
          color: meta.color,
          background: meta.background,
          fontWeight: 700,
        }}
      >
        {label}
      </Tag>
    );
  };

  const getReceiptsForInvoice = (invoice: PortalStatementLine): PortalPaymentReceipt[] => (
    statement?.receipts.filter((receipt) => (
      receipt.accountReceivableId === invoice._id ||
      receipt.accountReceivable?._id === invoice._id
    )) || []
  );

  const hasPendingReceipt = (invoice: PortalStatementLine): boolean => (
    getReceiptsForInvoice(invoice).some((receipt) => receipt.status === 'SUBMITTED')
  );

  const isInvoicePayable = (invoice: PortalStatementLine): boolean => (
    !['PAID', 'CANCELLED'].includes(invoice.status?.toUpperCase()) &&
    Number(invoice.openAmountForeign || 0) > 0 &&
    !hasPendingReceipt(invoice)
  );

  const toggleInvoiceReceipts = (invoice: PortalStatementLine) => {
    setExpandedInvoiceKeys((keys) => (
      keys.includes(invoice._id)
        ? keys.filter((key) => key !== invoice._id)
        : [...keys, invoice._id]
    ));
  };

  const renderMoneyText = (
    value: number | string | null | undefined,
    currency: string | null | undefined,
    options: { strong?: boolean; color?: string; minWidth?: number } = {},
  ) => (
    <Text
      strong={options.strong}
      style={{
        color: options.color,
        display: 'inline-block',
        fontVariantNumeric: 'tabular-nums',
        minWidth: options.minWidth || 120,
        textAlign: 'right',
        whiteSpace: 'nowrap',
      }}
    >
      {formatMoney(value, currency, locale)}
    </Text>
  );

  const renderCodeText = (
    value: string | null | undefined,
    options: { strong?: boolean; maxWidth?: number } = {},
  ) => {
    const displayValue = value || '-';

    return (
      <Tooltip title={displayValue}>
        <Text
          strong={options.strong}
          style={{
            display: 'inline-block',
            maxWidth: options.maxWidth || 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            verticalAlign: 'bottom',
            whiteSpace: 'nowrap',
          }}
        >
          {displayValue}
        </Text>
      </Tooltip>
    );
  };

  const handleInvoicePdfDownload = async (invoice: PortalStatementLine) => {
    if (!invoice.pdfUrl) return;

    if (!accessToken) {
      api.error({ title: t('downloadFailed'), description: 'Missing access token' });
      return;
    }

    setDownloadingPdfId(invoice._id);
    try {
      await downloadPdfBlob(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}${invoice.pdfUrl}`,
        accessToken,
        `Invoice_${invoice.invoiceNumber || invoice._id}.pdf`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t('downloadFailed');
      api.error({ title: t('downloadFailed'), description: message });
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const invoiceColumns: ColumnsType<PortalStatementLine> = [
    {
      title: t('invoiceNumber'),
      dataIndex: 'invoiceNumber',
      width: 260,
      render: (value: string) => (
        <Space style={{ minWidth: 0, maxWidth: 240 }}>
          <FileTextOutlined style={{ color: token.colorPrimary }} />
          {renderCodeText(value, { strong: true, maxWidth: 210 })}
        </Space>
      ),
    },
    {
      title: t('status'),
      dataIndex: 'status',
      width: 110,
      render: (value: string) => renderFinanceStatusTag(value),
    },
    {
      title: locale === 'vi' ? 'Tuổi nợ' : 'Aging',
      key: 'aging',
      width: 140,
      render: (_: unknown, record) => agingBucketBadge(record.agingBucket),
    },
    {
      title: t('dueDate'),
      dataIndex: 'dueDate',
      width: 130,
      render: (value: string | null | undefined) => formatDate(value, locale),
    },
    {
      title: t('amount'),
      align: 'right',
      width: 160,
      onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
      render: (_value: unknown, record) => renderMoneyText(record.amountForeign, record.currency),
    },
    {
      title: t('paid'),
      align: 'right',
      width: 160,
      onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
      render: (_value: unknown, record) => renderMoneyText(record.paidAmountForeign, record.currency),
    },
    {
      title: t('open'),
      align: 'right',
      width: 160,
      onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
      render: (_value: unknown, record) => (
        renderMoneyText(record.openAmountForeign, record.currency, {
          strong: true,
          color: record.openAmountForeign > 0 ? token.colorErrorText : token.colorSuccessText,
        })
      ),
    },
    // Cross-linking columns
    {
      title: locale === 'vi' ? 'Hợp đồng' : 'Contract',
      key: 'contract',
      width: 180,
      render: (_: unknown, record) =>
        record.contractNumber ? (
          <Space size={4} style={{ minWidth: 0, maxWidth: 160 }}>
            <LinkOutlined style={{ color: token.colorPrimary }} />
            {renderCodeText(record.contractNumber, { maxWidth: 132 })}
          </Space>
        ) : '-',
    },
    {
      title: locale === 'vi' ? 'Lô hàng' : 'Shipment',
      key: 'shipment',
      width: 150,
      render: (_: unknown, record) =>
        record.shipmentNumber ? (
          <Space size={4} style={{ minWidth: 0, maxWidth: 132 }}>
            <TruckOutlined style={{ color: '#fa8c16' }} />
            {renderCodeText(record.shipmentNumber, { maxWidth: 104 })}
          </Space>
        ) : '-',
    },
    {
      title: 'T/T',
      key: 'ttReceipts',
      align: 'center',
      width: 120,
      render: (_: unknown, record) => {
        const receipts = getReceiptsForInvoice(record);
        const pendingCount = receipts.filter((receipt) => receipt.status === 'SUBMITTED').length;
        if (!receipts.length) return <Text type="secondary">-</Text>;

        return (
          <Button size="small" onClick={() => toggleInvoiceReceipts(record)}>
            {receipts.length}{pendingCount ? ` / ${pendingCount} ${t('pendingShort')}` : ''}
          </Button>
        );
      },
    },
    // Actions
    {
      title: '',
      key: 'actions',
      width: 190,
      align: 'right',
      render: (_: unknown, record) => (
        <Space size={4}>
          {record.pdfUrl && (
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              loading={downloadingPdfId === record._id}
              onClick={() => void handleInvoicePdfDownload(record)}
            >
              PDF
            </Button>
          )}
          {isInvoicePayable(record) ? (
            <Button
              type="primary"
              size="small"
              icon={<UploadOutlined />}
              onClick={() => {
                setSelectedInvoice(record);
                setPaymentModalOpen(true);
              }}
            >
              {t('pay')}
            </Button>
          ) : getReceiptsForInvoice(record).length > 0 ? (
            <Button size="small" onClick={() => toggleInvoiceReceipts(record)}>
              {expandedInvoiceKeys.includes(record._id)
                ? t('hideReceipts')
                : t('viewReceipts')}
            </Button>
          ) : (
            <Button size="small" disabled>
              {hasPendingReceipt(record)
                ? t('pendingApproval')
                : t('closed')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const receiptColumns: ColumnsType<PortalPaymentReceipt> = [
    {
      title: t('reference'),
      render: (_value: unknown, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.accountReceivable?.invoiceNumber || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.accountReceivableId || '-'}</Text>
        </Space>
      ),
    },
    {
      title: t('receiptNumber'),
      dataIndex: 'receiptNumber',
      render: (value: string | null | undefined, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value || record._id}</Text>
          {record.receiptType ? <Tag style={{ width: 'fit-content' }}>{record.receiptType}</Tag> : null}
        </Space>
      ),
    },
    {
      title: t('status'),
      dataIndex: 'status',
      render: (value: string | null | undefined, record) => (
        <Space orientation="vertical" size={2}>
          {renderFinanceStatusTag(value)}
          {record.rejectionReason ? (
            <Text type="secondary" style={{ fontSize: 12 }}>{record.rejectionReason}</Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('amount'),
      align: 'right',
      width: 190,
      onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
      render: (_value: unknown, record) => {
        const receiptAmount = Number(record.amount || 0);
        const invoiceCurrency = record.accountReceivable?.currency;
        const hasCurrencyMismatch = Boolean(invoiceCurrency && record.currency && invoiceCurrency !== record.currency);
        return (
          <Space orientation="vertical" size={0} style={{ textAlign: 'right' }}>
            {renderMoneyText(record.amount, record.currency, {
              strong: true,
              color: receiptAmount <= 0 || hasCurrencyMismatch ? token.colorErrorText : undefined,
              minWidth: 100,
            })}
            {receiptAmount <= 0 ? (
              <Text type="danger" style={{ fontSize: 12 }}>{t('invalidZeroAmount')}</Text>
            ) : null}
            {hasCurrencyMismatch ? (
              <Space orientation="vertical" size={0}>
                <Text type="danger" style={{ fontSize: 12 }}>{t('receiptCurrency')}: {record.currency}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('invoiceCurrency')}: {invoiceCurrency}</Text>
              </Space>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: t('bankReference'),
      dataIndex: 'bankReference',
      render: (value: string | null | undefined) => (
        value ? <Text code>{value}</Text> : <Text type="danger">{t('required')}</Text>
      ),
    },
    { title: t('submittedAt'), dataIndex: 'submittedAt', render: (value: string | null | undefined) => formatDate(value, locale) },
  ];

  const handleDownloadStatement = async (format: 'excel' | 'csv'): Promise<void> => {
    const result = format === 'excel'
      ? await downloadStatementExcel()
      : await downloadStatementCsv();

    if (result.success) {
      api.success({ title: t('downloadOk') });
      return;
    }

    api.error({ title: t('downloadFailed'), description: result.message });
  };

  const statementDownloadMenuItems: MenuProps['items'] = [
    {
      key: 'excel',
      icon: <FileExcelOutlined />,
      label: t('downloadStatementExcel'),
    },
    {
      key: 'csv',
      icon: <DownloadOutlined />,
      label: t('downloadStatementCsv'),
    },
  ];

  const isEmpty = !statement || (statement.lines.length === 0 && statement.receipts.length === 0);

  // Determine currency for display
  const defaultCurrency = statement?.lines?.[0]?.currency || 'USD';
  const unallocatedReceipts = statement?.receipts.filter((receipt) => !receipt.accountReceivableId) || [];

  return (
    <PortalShell
      title={t('financeTitle')}
      subtitle={t('financeSubtitle')}
      icon={<DollarOutlined />}
      extra={(
        <Space.Compact>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            loading={downloading}
            disabled={!statement}
            onClick={() => void handleDownloadStatement('excel')}
          >
            {t('downloadStatementExcel')}
          </Button>
          <Dropdown
            disabled={!statement || downloading}
            menu={{
              items: statementDownloadMenuItems,
              onClick: ({ key }) => void handleDownloadStatement(key === 'csv' ? 'csv' : 'excel'),
            }}
            trigger={['click']}
          >
            <Button
              type="primary"
              icon={<DownOutlined />}
              aria-label="Chon dinh dang tai statement"
            />
          </Dropdown>
        </Space.Compact>
      )}
    >
      {contextHolder}
      <PageState loading={loading} error={error} empty={isEmpty} onRetry={() => void fetchStatement()}>
        {statement ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {/* Summary Cards - Only show if there's data */}
            {(statement.summary.totalForeign > 0 || statement.summary.paidForeign > 0 || statement.summary.openForeign > 0) && (
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} xl={6}>
                  <Card
                    variant="borderless"
                    styles={{ body: { padding: 24 } }}
                    style={{
                      background: `linear-gradient(135deg, ${token.colorPrimary}15, ${token.colorPrimary}05)`,
                      border: `1px solid ${token.colorPrimary}20`,
                    }}
                  >
                    <Statistic
                      title={<Text type="secondary">{t('amount')}</Text>}
                      value={statement.summary.totalForeign}
                      precision={2}
                      prefix={<DollarOutlined style={{ color: token.colorPrimary }} />}
                      formatter={(value) => formatMoney(Number(value), defaultCurrency, locale)}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <Card
                    variant="borderless"
                    styles={{ body: { padding: 24 } }}
                    style={{
                      background: 'linear-gradient(135deg, #52c41a15, #52c41a05)',
                      border: '1px solid #52c41a20',
                    }}
                  >
                    <Statistic
                      title={<Text type="secondary">{t('paid')}</Text>}
                      value={statement.summary.paidForeign}
                      precision={2}
                      prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                      formatter={(value) => formatMoney(Number(value), defaultCurrency, locale)}
                      styles={{ content: { color: '#52c41a' } }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <Card
                    variant="borderless"
                    styles={{ body: { padding: 24 } }}
                    style={{
                      background: 'linear-gradient(135deg, #ff4d4f15, #ff4d4f05)',
                      border: '1px solid #ff4d4f20',
                    }}
                  >
                    <Statistic
                      title={<Text type="secondary">{t('open')}</Text>}
                      value={statement.summary.openForeign}
                      precision={2}
                      prefix={<ClockCircleOutlined style={{ color: '#ff4d4f' }} />}
                      formatter={(value) => formatMoney(Number(value), defaultCurrency, locale)}
                      styles={{ content: { color: '#ff4d4f' } }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <Card
                    variant="borderless"
                    styles={{ body: { padding: 24 } }}
                    style={{
                      background: 'linear-gradient(135deg, #faad1415, #faad1405)',
                      border: '1px solid #faad1420',
                    }}
                  >
                    <Statistic
                      title={<Text type="secondary">{t('openInvoices')}</Text>}
                      value={statement.summary.openInvoiceCount}
                      prefix={<FileDoneOutlined style={{ color: '#faad14' }} />}
                    />
                  </Card>
                </Col>
              </Row>
            )}

            {/* Aging Summary Cards - Phase 1 Enhancement */}
            <AgingSummaryCards
              summary={statement.summary}
              defaultCurrency={defaultCurrency}
              locale={locale}
            />

            {/* Invoices Table */}
            {unallocatedReceipts.length > 0 ? (
              <Card
                variant="borderless"
                style={{ borderLeft: '3px solid #faad14' }}
              >
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space>
                    <ClockCircleOutlined style={{ color: '#faad14' }} />
                    <Text strong>
                      {locale === 'vi'
                        ? 'Biên nhận cần gắn hóa đơn'
                        : 'Receipts needing invoice allocation'}
                    </Text>
                  </Space>
                  {unallocatedReceipts.slice(0, 3).map((receipt) => (
                    <Space
                      key={receipt._id}
                      style={{ justifyContent: 'space-between', width: '100%' }}
                    >
                      <Space>
                        <Text code>{receipt.receiptNumber || receipt._id}</Text>
                        <Text type="secondary">{receipt.bankReference || 'Missing bank reference'}</Text>
                      </Space>
                      <Text strong>{formatMoney(receipt.amount, receipt.currency, locale)}</Text>
                    </Space>
                  ))}
                </Space>
              </Card>
            ) : null}

            <Card
              title={<Space><FileDoneOutlined style={{ color: token.colorPrimary }} /><span style={{ fontWeight: 600 }}>{t('invoices')}</span></Space>}
              variant="borderless"
              styles={{ body: { padding: statement.lines.length > 0 ? 0 : 24 } }}
            >
              {statement.lines.length > 0 ? (
                <Table
                  rowKey="_id"
                  columns={invoiceColumns}
                  dataSource={statement.lines}
                  pagination={{ pageSize: 8 }}
                  expandable={{
                    expandedRowKeys: expandedInvoiceKeys,
                    onExpandedRowsChange: (keys) => setExpandedInvoiceKeys(keys.map(String)),
                    rowExpandable: (record) => getReceiptsForInvoice(record).length > 0,
                    expandedRowRender: (record) => (
                      <div style={{ padding: '8px 0 8px 40px', borderLeft: `3px solid ${token.colorPrimary}` }}>
                        <Table<PortalPaymentReceipt>
                          rowKey="_id"
                          size="small"
                          columns={receiptColumns}
                          dataSource={getReceiptsForInvoice(record)}
                          pagination={false}
                        />
                      </div>
                    ),
                  }}
                  rowClassName={(_, index) => {
                    const line = statement.lines[index];
                    if (!line) return '';
                    if (line.agingBucket === 'OVERDUE_90' || (line.daysOverdue ?? 0) > 60) {
                      return 'overdue-row-highlight';
                    }
                    if (line.agingBucket?.startsWith('DUE_')) {
                      return 'due-soon-row-highlight';
                    }
                    return '';
                  }}
                />
              ) : (
                <Empty
                  description={
                    <Space orientation="vertical" size={4}>
                      <Text type="secondary">{isVietnameseText(locale) ? 'Chưa có hóa đơn công nợ nào' : 'No receivable invoices yet'}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {isVietnameseText(locale)
                          ? 'Hóa đơn sẽ xuất hiện khi có Commercial Invoice được tạo cho đơn hàng của bạn.'
                          : 'Invoices will appear when Commercial Invoices are created for your orders.'}
                      </Text>
                    </Space>
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Card>
          </Space>
        ) : null}
      </PageState>
      {/* Payment Advice Modal */}
      {selectedInvoice ? (
        <PaymentAdviceModal
          open={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedInvoice(null);
          }}
          onSuccess={() => {
            void fetchStatement();
          }}
          invoice={selectedInvoice}
          accessToken={accessToken || ''}
          profile={{
            companyBankInfo: `Bank Name: VIETCOMBANK
Beneficiary: CÔNG TY TNHH XUẤT NHẬP KHẨU ANTIGRAVITY
Account Number: 0123456789
Swift Code: BFTVVNVX`,
            companyName: 'ANTIGRAVITY EXPORT CO., LTD',
            companyAddress: '123 Export Street, Dist 1, HCMC, Vietnam',
            vietQrAccountNo: '0123456789',
            vietQrBankCode: 'VCBVNVX',
          }}
        />
      ) : null}
    </PortalShell>
  );
};
