'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Dropdown,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Steps,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  notification,
  theme,
} from 'antd';
import type { MenuProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownOutlined,
  DollarOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  GlobalOutlined,
  LinkOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  SyncOutlined,
  TruckOutlined,
  UnorderedListOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useLocale } from 'next-intl';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import { getAccessToken } from '@/lib/auth-token';
import {
  useCustomerPortalFinance,
  useCustomerPortalCurrencies,
  useCustomerCommercialDocuments,
  useCustomerPortalOverview,
  useCustomerPortalPorts,
  useCustomerPortalProfile,
  useCustomerPortalProducts,
  useCustomerPortalShipments,
} from '@/hooks/useCustomerPortal';
import { downloadPdfBlob } from '@/services/customer-portal.service';
import { formatPortLabel } from '@/services/port.service';
import { CommercialDocumentDetailDrawer } from '@/components/guest/portal/orders/CommercialDocumentDetailDrawer';
import { CommercialDocumentsTable } from '@/components/guest/portal/orders/CommercialDocumentsTable';
import { CustomerOrderSummaryCards } from '@/components/guest/portal/orders/CustomerOrderSummaryCards';
import { AgingSummaryCards } from '@/components/guest/portal/finance/AgingSummaryCards';
import { PaymentAdviceModal } from '@/components/guest/portal/orders/PaymentAdviceModal';
import type {
  CustomerCommercialDocument,
  CustomerCommercialDocumentQuery,
  CustomerCommercialDocumentSortField,
  CustomerCommercialDocumentType,
  PortalPaymentReceipt,
  PortalProduct,
  PortalProductPricing,
  PortalShipment,
  PortalStatementLine,
} from '@/types/customer-portal';

type CustomerPortalView =
  | 'overview'
  | 'products'
  | 'orders'
  | 'finance'
  | 'shipments'
  | 'settings'
  | 'tickets';

type CustomerPortalPageProps = {
  view: CustomerPortalView;
};

const { Text, Title } = Typography;

// CSS for overdue row highlighting
const styleSheet = `
  .overdue-row-highlight {
    background-color: rgba(255, 75, 74, 0.08) !important;
    border-left: 3px solid #ff4b4a !important;
  }
  .due-soon-row-highlight {
    background-color: rgba(250, 173, 20, 0.08) !important;
    border-left: 3px solid #faad14 !important;
  }
`;

// Inject styles on client-side
if (typeof document !== 'undefined') {
  const styleId = 'customer-portal-finance-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styleSheet;
    document.head.appendChild(styleEl);
  }
}

const getCopy = (locale: string) => {
  const isVietnamese = locale === 'vi';

  return {
    overviewTitle: isVietnamese ? 'Tổng quan Customer Portal' : 'Customer Portal Overview',
    overviewSubtitle: isVietnamese
      ? 'Theo dõi đơn hàng, công nợ và lô hàng của doanh nghiệp bạn.'
      : 'Track your orders, receivables and shipments in one place.',
    ordersTitle: isVietnamese ? 'Báo giá & Đơn hàng' : 'Commercial Documents',
    ordersSubtitle: isVietnamese
      ? 'Danh sách hợp đồng xuất khẩu và Proforma Invoice liên quan đến tài khoản buyer.'
      : 'Export contracts and proforma invoices linked to your buyer account.',
    financeTitle: isVietnamese ? 'Tài chính & Công nợ' : 'Finance & Receivables',
    financeSubtitle: isVietnamese
      ? 'Statement of account, hóa đơn mở và các biên nhận T/T đã gửi.'
      : 'Statement of account, open invoices and submitted T/T receipts.',
    shipmentsTitle: isVietnamese ? 'Tra cứu lô hàng' : 'Shipment Tracking',
    shipmentsSubtitle: isVietnamese
      ? 'Theo dõi trạng thái logistics và mốc xử lý của từng lô hàng.'
      : 'Track logistics status and milestones for each shipment.',
    productsTitle: isVietnamese ? 'Sản phẩm xuất khẩu' : 'Export Products',
    productsSubtitle: isVietnamese
      ? 'Xem danh mục sản phẩm đang bán và gửi yêu cầu mua hàng trực tiếp cho đội sales.'
      : 'Browse available export products and send purchase requests directly to sales.',
    searchLabel: isVietnamese ? 'Tìm kiếm sản phẩm' : 'Product search',
    productSearch: isVietnamese ? 'Tìm SKU, tên sản phẩm, HS code, danh mục...' : 'Search SKU, product name, HS code, category...',
    productQuantity: isVietnamese ? 'Số lượng' : 'Quantity',
    currency: isVietnamese ? 'Tiền tệ' : 'Currency',
    allCategories: isVietnamese ? 'Tất cả danh mục' : 'All categories',
    applyFilters: isVietnamese ? 'Lọc sản phẩm' : 'Apply filters',
    clearFilters: isVietnamese ? 'Xóa lọc' : 'Clear filters',
    cancel: isVietnamese ? 'Hủy' : 'Cancel',
    addToInquiry: isVietnamese ? 'Thêm vào RFQ' : 'Add to RFQ',
    inquiryCart: isVietnamese ? 'Giỏ yêu cầu báo giá' : 'Inquiry cart',
    inquiryCartEmpty: isVietnamese ? 'Chưa có sản phẩm trong RFQ' : 'No products in this RFQ yet',
    buildRfq: isVietnamese ? 'Lập RFQ' : 'Build RFQ',
    inquiryEmail: isVietnamese ? 'Email liên hệ' : 'Contact email',
    incoterm: isVietnamese ? 'Incoterms mong muốn' : 'Preferred Incoterms',
    destinationPort: isVietnamese ? 'Cảng đến' : 'Destination port',
    destinationPortPlaceholder: isVietnamese
      ? 'Chọn hoặc tìm theo mã cảng, tên cảng...'
      : 'Select or search by port code, port name...',
    expectedShipmentDate: isVietnamese ? 'Ngày cần giao' : 'Expected shipment date',
    targetPrice: isVietnamese ? 'Giá kỳ vọng' : 'Target price',
    lineItems: isVietnamese ? 'Dòng hàng RFQ' : 'RFQ line items',
    requestQuote: isVietnamese ? 'Gửi yêu cầu' : 'Send request',
    requestProduct: isVietnamese ? 'Yêu cầu sản phẩm' : 'Request product',
    inquiryNote: isVietnamese ? 'Ghi chú yêu cầu' : 'Request note',
    inquiryPhone: isVietnamese ? 'Số điện thoại liên hệ' : 'Contact phone',
    inquiryNotePlaceholder: isVietnamese
      ? 'Quy cách đóng gói, cảng đến, thời gian giao mong muốn...'
      : 'Packing specs, destination port, expected delivery window...',
    inquirySubmitted: isVietnamese ? 'Đã gửi yêu cầu' : 'Inquiry submitted',
    inquirySubmittedDesc: isVietnamese
      ? 'Yêu cầu đã vào module Yêu cầu báo giá để đội sales xử lý.'
      : 'The request is now in the internal inquiry module for sales follow-up.',
    inquiryFailed: isVietnamese ? 'Không gửi được yêu cầu' : 'Unable to submit inquiry',
    contactSales: isVietnamese ? 'Liên hệ báo giá' : 'Contact sales',
    stock: isVietnamese ? 'Tồn kho' : 'Stock',
    origin: isVietnamese ? 'Xuất xứ' : 'Origin',
    packing: isVietnamese ? 'Đóng gói' : 'Packing',
    category: isVietnamese ? 'Danh mục' : 'Category',
    price: isVietnamese ? 'Giá tham khảo' : 'Reference price',
    loading: isVietnamese ? 'Đang tải dữ liệu portal...' : 'Loading portal data...',
    retry: isVietnamese ? 'Tải lại' : 'Retry',
    empty: isVietnamese ? 'Chưa có dữ liệu phù hợp cho tài khoản này.' : 'No matching data for this account yet.',
    openBalance: isVietnamese ? 'Công nợ mở' : 'Open balance',
    openInvoices: isVietnamese ? 'Hóa đơn mở' : 'Open invoices',
    quotations: isVietnamese ? 'Báo giá' : 'Quotations',
    quoteNumber: isVietnamese ? 'Mã báo giá' : 'Quote No.',
    expiryDate: isVietnamese ? 'Ngày hết hạn' : 'Expiry Date',
    contracts: isVietnamese ? 'Hợp đồng' : 'Contracts',
    shipments: isVietnamese ? 'Lô hàng' : 'Shipments',
    notifications: isVietnamese ? 'Thông báo gần đây' : 'Recent notifications',
    contractNumber: isVietnamese ? 'Mã hợp đồng' : 'Contract No.',
    piNumber: isVietnamese ? 'Mã PI' : 'PI No.',
    status: isVietnamese ? 'Trạng thái' : 'Status',
    signature: isVietnamese ? 'Ký buyer' : 'Buyer signature',
    amount: isVietnamese ? 'Giá trị' : 'Amount',
    createdAt: isVietnamese ? 'Ngày tạo' : 'Created',
    invoices: isVietnamese ? 'Hóa đơn công nợ' : 'Receivable invoices',
    receipts: isVietnamese ? 'Biên nhận T/T' : 'T/T receipts',
    reference: isVietnamese ? 'Tham chiếu' : 'Reference',
    downloadStatement: isVietnamese ? 'Tải statement' : 'Download statement',
    downloadStatementExcel: isVietnamese ? 'Tải Excel (.xlsx)' : 'Download Excel (.xlsx)',
    downloadStatementCsv: isVietnamese ? 'Tải CSV' : 'Download CSV',
    invoiceNumber: isVietnamese ? 'Số hóa đơn' : 'Invoice No.',
    dueDate: isVietnamese ? 'Hạn thanh toán' : 'Due date',
    paid: isVietnamese ? 'Đã thanh toán' : 'Paid',
    open: isVietnamese ? 'Còn lại' : 'Open',
    receiptNumber: isVietnamese ? 'Số biên nhận' : 'Receipt No.',
    bankReference: isVietnamese ? 'Mã ngân hàng' : 'Bank reference',
    submittedAt: isVietnamese ? 'Ngày gửi' : 'Submitted',
    pendingShort: isVietnamese ? 'chờ duyệt' : 'pending',
    invalidZeroAmount: isVietnamese ? 'Số tiền bằng 0 không hợp lệ' : 'Invalid zero amount',
    receiptCurrency: isVietnamese ? 'Tiền tệ biên nhận' : 'Receipt currency',
    invoiceCurrency: isVietnamese ? 'Tiền tệ hóa đơn' : 'Invoice currency',
    required: isVietnamese ? 'Bắt buộc' : 'Required',
    pay: isVietnamese ? 'Thanh toán' : 'Pay',
    viewReceipts: isVietnamese ? 'Xem biên lai' : 'View receipts',
    hideReceipts: isVietnamese ? 'Ẩn biên lai' : 'Hide receipts',
    pendingApproval: isVietnamese ? 'Chờ duyệt' : 'Pending',
    closed: isVietnamese ? 'Đã đóng' : 'Closed',
    shipmentNumber: isVietnamese ? 'Mã lô hàng' : 'Shipment No.',
    route: isVietnamese ? 'Tuyến' : 'Route',
    eta: 'ETA',
    blNumber: 'B/L',
    downloadOk: isVietnamese ? 'Đã tải statement' : 'Statement downloaded',
    downloadFailed: isVietnamese ? 'Không tải được statement' : 'Unable to download statement',
    
    // Thêm các key mới cho Báo giá
    quotationDetails: isVietnamese ? 'Chi tiết báo giá' : 'Quotation Details',
    downloadPdfBtn: isVietnamese ? 'Tải PDF' : 'Download PDF',
    confirmReject: isVietnamese ? 'Xác nhận từ chối' : 'Confirm Reject',
    rejectBtn: isVietnamese ? 'Từ chối' : 'Reject',
    acceptQuotationTitle: isVietnamese ? 'Xác nhận báo giá' : 'Accept Quotation',
    acceptQuotationDesc: isVietnamese ? 'Bạn có chắc chắn muốn xác nhận báo giá này không?' : 'Are you sure you want to accept this quotation?',
    acceptBtn: isVietnamese ? 'Xác nhận' : 'Accept',
    errorTitle: isVietnamese ? 'Lỗi' : 'Error',
    rejectAlert: isVietnamese ? 'Bạn đang chuẩn bị từ chối báo giá này. Vui lòng cung cấp lý do ở bên dưới.' : 'You are about to reject this quotation. Please provide a reason below.',
    rejectReasonPlaceholder: isVietnamese ? 'Vui lòng nhập lý do từ chối...' : 'Please enter the reason for rejection...',
    quotationExpiredAlert: isVietnamese ? 'Báo giá đã hết hạn' : 'Quotation expired',
    quotationNo: isVietnamese ? 'Số báo giá' : 'Quotation No.',
    rejectionReasonLabel: isVietnamese ? 'Lý do từ chối' : 'Reason for Rejection',
    lineItemsTitle: isVietnamese ? 'Danh sách sản phẩm' : 'Line Items',
    productHeader: isVietnamese ? 'Sản phẩm' : 'Product',
    qtyHeader: isVietnamese ? 'SL' : 'Qty',
    unitHeader: isVietnamese ? 'Đơn vị' : 'Unit',
    unitPriceHeader: isVietnamese ? 'Đơn giá' : 'Unit Price',
    totalHeader: isVietnamese ? 'Thành tiền' : 'Total',
    totalAmountLabel: isVietnamese ? 'Tổng cộng:' : 'Total Amount:',
    quotationExpiredOn: isVietnamese ? 'Báo giá đã hết hạn vào ngày' : 'Quotation expired on',
    actionNotAvailable: isVietnamese ? 'Thao tác không khả dụng ở trạng thái hiện tại' : 'Action is not available in current status',
    quotationAcceptedMsg: isVietnamese ? 'Đã xác nhận báo giá' : 'Quotation Accepted',
    unableToAcceptMsg: isVietnamese ? 'Không thể xác nhận báo giá' : 'Unable to accept quotation',
    provideReasonMsg: isVietnamese ? 'Vui lòng nhập lý do' : 'Please provide a reason',
    quotationRejectedMsg: isVietnamese ? 'Đã từ chối báo giá' : 'Quotation Rejected',
    unableToRejectMsg: isVietnamese ? 'Không thể từ chối báo giá' : 'Unable to reject quotation',
    searchOrdersPlaceholder: isVietnamese ? 'Tìm theo mã hoặc trạng thái...' : 'Search document number or status',
    allDocuments: isVietnamese ? 'Tất cả' : 'All',
    proformaInvoices: isVietnamese ? 'Proforma Invoice' : 'Proforma Invoices',
    orders: isVietnamese ? 'Đơn hàng' : 'Orders',
    refresh: isVietnamese ? 'Làm mới' : 'Refresh',
    filterStatus: isVietnamese ? 'Lọc trạng thái' : 'Filter status',
    unableToLoadCommercialDocuments: isVietnamese
      ? 'Không tải được danh sách chứng từ thương mại'
      : 'Unable to load commercial documents',
    pdfDownloaded: isVietnamese ? 'Đã tải PDF' : 'PDF downloaded',
    quotationAccepted: isVietnamese ? 'Đã chấp nhận báo giá' : 'Quotation accepted',
    quotationRejected: isVietnamese ? 'Đã từ chối báo giá' : 'Quotation rejected',
    revisionRequestSent: isVietnamese ? 'Đã gửi yêu cầu chỉnh sửa' : 'Revision request sent',
    
    // Overview page
    welcomeBack: isVietnamese ? 'Chào mừng trở lại' : 'Welcome back',
    dashboard: isVietnamese ? 'Bảng điều khiển' : 'Dashboard',
    financialOverview: isVietnamese ? 'Tổng quan tài chính' : 'Financial Overview',
    orderOverview: isVietnamese ? 'Tổng quan đơn hàng' : 'Order Overview',
    recentShipments: isVietnamese ? 'Lô hàng gần đây' : 'Recent Shipments',
    quickActions: isVietnamese ? 'Thao tác nhanh' : 'Quick Actions',
    recentNotifications: isVietnamese ? 'Thông báo gần đây' : 'Recent Notifications',
    pendingSignature: isVietnamese ? 'Chờ ký' : 'Pending Signature',
    totalOutstanding: isVietnamese ? 'Tổng công nợ' : 'Total Outstanding',
    totalPaid: isVietnamese ? 'Đã thanh toán' : 'Total Paid',
    totalOverdue: isVietnamese ? 'Quá hạn' : 'Overdue',
    viewAllOrders: isVietnamese ? 'Xem tất cả đơn hàng' : 'View all orders',
    viewAllShipments: isVietnamese ? 'Xem tất cả lô hàng' : 'View all shipments',
    browseProducts: isVietnamese ? 'Duyệt sản phẩm' : 'Browse Products',
    downloadReport: isVietnamese ? 'Tải báo cáo' : 'Download Report',
    contactSupport: isVietnamese ? 'Liên hệ hỗ trợ' : 'Contact Support',
    creditLimit: isVietnamese ? 'Hạn mức tín dụng' : 'Credit Limit',
    used: isVietnamese ? 'Đã sử dụng' : 'Used',
    available: isVietnamese ? 'Khả dụng' : 'Available',
    accountRisk: isVietnamese ? 'Mức độ rủi ro' : 'Account Risk',
    noRecentShipments: isVietnamese ? 'Chưa có lô hàng gần đây' : 'No recent shipments',
    noRecentNotifications: isVietnamese ? 'Chưa có thông báo' : 'No recent notifications',
    viewOrders: isVietnamese ? 'Xem đơn hàng' : 'View Orders',
    viewShipments: isVietnamese ? 'Xem lô hàng' : 'View Shipments',
    
    // Action Required section
    actionRequired: isVietnamese ? 'Cần xử lý' : 'Action Required',
    overdueInvoices: isVietnamese ? 'Hóa đơn quá hạn' : 'Overdue Invoices',
    invoicesOverdueDesc: isVietnamese ? 'hóa đơn chưa thanh toán' : 'invoices pending payment',
    contractsAwaitingSignature: isVietnamese ? 'hợp đồng đang chờ ký' : 'contracts awaiting signature',
    openQuotations: isVietnamese ? 'Báo giá đang mở' : 'Open Quotations',
    quotationsAwaitingReview: isVietnamese ? 'báo giá đang chờ xem xét' : 'quotations awaiting your review',
    reviewNow: isVietnamese ? 'Xem ngay' : 'Review Now',
    noActionRequired: isVietnamese ? 'Không có việc cần xử lý!' : 'No action required!',
    
    // Dashboard metrics
    completedOrders: isVietnamese ? 'Đã hoàn thành' : 'Completed',
    totalOrdersValue: isVietnamese ? 'Tổng giá trị đơn hàng' : 'Total Orders Value',
  };
};

const formatDate = (value: string | null | undefined, locale: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US');
};

const formatMoney = (
  value: number | string | null | undefined,
  currency: string | null | undefined,
  locale: string,
): string => {
  const amount = Number(value ?? 0);
  const displayCurrency = currency || 'USD';

  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: displayCurrency,
    maximumFractionDigits: displayCurrency === 'VND' ? 0 : 2,
  }).format(Number.isFinite(amount) ? amount : 0);
};

const statusColor = (status?: string | null): string => {
  const normalized = status?.toUpperCase();
  if (!normalized) return 'default';
  if (['PAID', 'CONFIRMED', 'APPROVED', 'SHIPPED', 'CLOSED', 'ARRIVED'].includes(normalized)) return 'success';
  if (['PENDING', 'SUBMITTED', 'BOOKED', 'LOADING'].includes(normalized)) return 'processing';
  if (['OVERDUE', 'REJECTED', 'CANCELLED', 'CANCELED'].includes(normalized)) return 'error';
  return 'warning';
};

const PageState = ({
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}) => {
  const locale = useLocale();
  const copy = getCopy(locale);

  if (loading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        title={error}
        action={<Button onClick={onRetry}>{copy.retry}</Button>}
      />
    );
  }

  if (empty) {
    return <Empty description={copy.empty} />;
  }

  return <>{children}</>;
};

const OverviewPage = () => {
  const locale = useLocale();
  const copy = getCopy(locale);
  const { data, loading, error, fetchOverview } = useCustomerPortalOverview();
  const [refreshing, setRefreshing] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOverview();
    setRefreshing(false);
  };

  if (!data) {
    return (
      <PortalShell title={copy.overviewTitle} subtitle={copy.overviewSubtitle} icon={<UserOutlined />}>
        <PageState loading={loading} error={error} empty={!data} onRetry={() => void fetchOverview()}>
          <></>
        </PageState>
      </PortalShell>
    );
  }

  const { profile, orders, shipments, statement } = data;
  const defaultCurrency = profile.finance.defaultCurrency || 'USD';

  // Financial summary data
  const financialData = [
    {
      label: copy.totalOutstanding,
      value: statement.summary.openForeign,
      color: '#ff4d4f',
      icon: <DollarOutlined />,
      prefix: defaultCurrency === 'VND' ? '' : '$',
    },
    {
      label: copy.totalPaid,
      value: statement.summary.paidForeign,
      color: '#52c41a',
      icon: <CheckCircleOutlined />,
      prefix: defaultCurrency === 'VND' ? '' : '$',
    },
    {
      label: copy.openInvoices,
      value: statement.summary.openInvoiceCount,
      color: '#faad14',
      icon: <FileDoneOutlined />,
      isCount: true,
    },
    {
      label: copy.pendingSignature,
      value: orders.summary.pendingSignatureCount,
      color: '#1890ff',
      icon: <UnorderedListOutlined />,
      isCount: true,
    },
  ];

  // Order summary data
  const orderSummaryData = [
    { label: copy.quotations, value: orders.summary.quotationCount, color: '#1890ff' },
    { label: copy.contracts, value: orders.summary.contractCount, color: '#52c41a' },
    { label: copy.proformaInvoices, value: orders.summary.proformaInvoiceCount, color: '#722ed1' },
    { label: copy.shipments, value: orders.summary.shippedCount, color: '#fa8c16' },
  ];

  // Open quotations count
  const openQuotations = orders.quotations?.filter(q => q.status === 'SENT' || q.status === 'PENDING') || [];
  const openQuotationsCount = openQuotations.length;
  
  // Recent shipments (latest 3)
  const recentShipments = shipments.slice(0, 3);

  return (
    <PortalShell
      title={copy.dashboard}
      subtitle={`${copy.welcomeBack}, ${profile.contact.contactName || profile.partner.name}`}
      icon={<UserOutlined />}
      extra={
        <Button icon={<SyncOutlined spin={refreshing} />} onClick={() => void handleRefresh()}>
          {copy.refresh}
        </Button>
      }
    >
      <Space orientation="vertical" size={20} style={{ width: '100%' }}>
        {/* Welcome Banner - Premium Hero Section */}
        <Card 
          variant="borderless" 
          styles={{ body: { padding: 0 } }}
          style={{ overflow: 'hidden', boxShadow: '0 4px 24px rgba(0, 21, 41, 0.08)' }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #001529 0%, #003a70 50%, #0050b3 100%)',
            borderRadius: 16,
            padding: '32px 40px',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Decorative circles */}
            <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
            <div style={{ position: 'absolute', bottom: -30, right: 100, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
            
            <Row gutter={48} align="middle">
              <Col flex="auto">
                <Space align="center" size={20}>
                  <div style={{
                    width: 72,
                    height: 72,
                    borderRadius: 16,
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                    fontWeight: 700,
                    border: '2px solid rgba(255,255,255,0.2)',
                  }}>
                    {profile.partner.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <Title level={2} style={{ color: '#fff', margin: 0, fontSize: 24 }}>
                      {profile.partner.name}
                    </Title>
                    <Space size={12} style={{ marginTop: 8 }}>
                      <Tag 
                        color={profile.finance.riskLevel === 'HIGH' ? 'red' : profile.finance.riskLevel === 'MEDIUM' ? 'orange' : 'gold'}
                        style={{ margin: 0, fontWeight: 500 }}
                      >
                        {profile.finance.riskLevel || 'NORMAL'} RISK
                      </Tag>
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
                        <GlobalOutlined style={{ marginRight: 6 }} />
                        {profile.partner.country || '-'} / {profile.partner.region || '-'}
                      </Text>
                    </Space>
                  </div>
                </Space>
              </Col>
              <Col>
                <Row gutter={[40, 16]} align="middle">
                  <Col>
                    <div style={{ textAlign: 'right' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 4, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {copy.creditLimit}
                      </Text>
                      <Text style={{ color: '#fff', fontSize: 20, fontWeight: 600 }}>
                        {formatMoney(profile.finance.creditLimit, defaultCurrency, locale)}
                      </Text>
                    </div>
                  </Col>
                  <Col>
                    <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.2)' }} />
                  </Col>
                  <Col>
                    <div style={{ textAlign: 'right' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 4, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {copy.openBalance}
                      </Text>
                      <Text style={{ color: '#ff7875', fontSize: 20, fontWeight: 700 }}>
                        {formatMoney(profile.finance.openBalanceForeign, defaultCurrency, locale)}
                      </Text>
                    </div>
                  </Col>
                </Row>
              </Col>
            </Row>
          </div>
        </Card>

        {/* Financial Overview Cards */}
        <Row gutter={[16, 16]}>
          {financialData.map((item, index) => (
            <Col xs={24} sm={12} xl={6} key={index}>
              <Card 
                variant="borderless" 
                styles={{ body: { padding: 24 } }}
                style={{ boxShadow: '0 2px 12px rgba(0, 21, 41, 0.06)', transition: 'all 0.3s ease', cursor: 'pointer' }}
                hoverable
              >
                <Row align="middle" gutter={16}>
                  <Col>
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      background: `linear-gradient(135deg, ${item.color}20, ${item.color}10)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: item.color,
                      fontSize: 22,
                    }}>
                      {item.icon}
                    </div>
                  </Col>
                  <Col flex="auto">
                    <Text type="secondary" style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>
                      {item.label}
                    </Text>
                    <Text strong style={{ fontSize: 26, display: 'block', marginTop: 4 }}>
                      {item.isCount ? item.value : formatMoney(item.value, defaultCurrency, locale)}
                    </Text>
                  </Col>
                </Row>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Order & Shipment Overview */}
        <Row gutter={[20, 20]}>
          <Col xs={24} xl={14}>
            <Card
              variant="borderless"
              title={<Space><FileDoneOutlined style={{ color: '#1890ff' }} /><span style={{ fontWeight: 600 }}>{copy.orderOverview}</span></Space>}
              extra={<Button type="link" style={{ color: '#1890ff', fontWeight: 500 }} onClick={() => window.location.href = '/dashboard/portal/orders'}>{copy.viewAllOrders} →</Button>}
              styles={{ body: { padding: 24 } }}
              style={{ boxShadow: '0 2px 12px rgba(0, 21, 41, 0.06)' }}
            >
              <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                {orderSummaryData.map((item, index) => (
                  <Col xs={12} md={6} key={index}>
                    <div style={{
                      textAlign: 'center',
                      padding: '20px 12px',
                      background: `linear-gradient(135deg, ${item.color}08, ${item.color}05)`,
                      borderRadius: 12,
                      border: `1px solid ${item.color}20`,
                      transition: 'all 0.3s ease',
                    }}>
                      <div style={{ fontSize: 36, fontWeight: 700, color: item.color, lineHeight: 1.2 }}>
                        {item.value}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>{item.label}</Text>
                    </div>
                  </Col>
                ))}
              </Row>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>{copy.quotations}</Text>
                {orders.quotations && orders.quotations.length > 0 ? (
                  <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                    {orders.quotations.slice(0, 3).map((quotation) => (
                      <Card
                        key={quotation._id}
                        size="small"
                        styles={{ body: { padding: '14px 16px' } }}
                        style={{ borderRadius: 10, border: `1px solid ${token.colorBorderSecondary}`, transition: 'all 0.2s ease' }}
                        hoverable
                      >
                        <Row justify="space-between" align="middle">
                          <Col>
                            <Space>
                              <div style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: statusColor(quotation.status) === 'success' ? '#52c41a' : 
                                           statusColor(quotation.status) === 'error' ? '#ff4d4f' : 
                                           statusColor(quotation.status) === 'processing' ? '#1890ff' : '#faad14',
                              }} />
                              <Text strong style={{ fontSize: 14 }}>{quotation.quotationNumber || 'N/A'}</Text>
                            </Space>
                            <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
                              {formatDate(quotation.createdAt, locale)}
                            </Text>
                          </Col>
                          <Col>
                            <Space>
                              <Tag color={statusColor(quotation.status)} style={{ borderRadius: 6, fontWeight: 500 }}>
                                {quotation.status || 'N/A'}
                              </Tag>
                              <Text strong style={{ fontSize: 14 }}>
                                {formatMoney(quotation.totalAmount, quotation.currency, locale)}
                              </Text>
                            </Space>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </Space>
                ) : (
                  <Empty description={copy.empty} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </div>
            </Card>
          </Col>

          <Col xs={24} xl={10}>
            {/* Recent Shipments */}
            <Card
              variant="borderless"
              title={<Space><TruckOutlined style={{ color: '#fa8c16' }} /><span style={{ fontWeight: 600 }}>{copy.recentShipments}</span></Space>}
              extra={<Button type="link" style={{ color: '#fa8c16', fontWeight: 500 }} onClick={() => window.location.href = '/dashboard/portal/shipments'}>{copy.viewAllShipments} →</Button>}
              styles={{ body: { padding: 24 } }}
              style={{ boxShadow: '0 2px 12px rgba(0, 21, 41, 0.06)', marginBottom: 20 }}
            >
              {recentShipments.length > 0 ? (
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                  {recentShipments.map((shipment) => (
                    <Card
                      key={shipment._id}
                      size="small"
                      styles={{ body: { padding: '16px' } }}
                      style={{ borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}`, transition: 'all 0.2s ease' }}
                      hoverable
                    >
                      <Row gutter={12} align="middle">
                        <Col>
                          <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, #1890ff15, #1890ff08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <TruckOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                          </div>
                        </Col>
                        <Col flex="auto">
                          <Text strong style={{ display: 'block', fontSize: 14 }}>
                            {shipment.shipmentNumber || shipment._id}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {shipment.pol || '-'} → {shipment.pod || '-'}
                          </Text>
                        </Col>
                        <Col>
                          <Tag color={statusColor(shipment.status)} style={{ borderRadius: 6, fontWeight: 500 }}>
                            {shipment.status || 'N/A'}
                          </Tag>
                          {shipment.eta && (
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'right', marginTop: 4 }}>
                              ETA: {formatDate(shipment.eta, locale)}
                            </Text>
                          )}
                        </Col>
                      </Row>
                      {shipment.timeline && shipment.timeline.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <Row gutter={8}>
                            {shipment.timeline.slice(0, 4).map((item, i) => (
                              <Col key={i} flex="auto">
                                <div style={{
                                  height: 4,
                                  borderRadius: 2,
                                  background: item.state === 'finish' ? token.colorSuccess : 
                                             item.state === 'process' ? token.colorPrimary : token.colorFillSecondary,
                                }} />
                              </Col>
                            ))}
                          </Row>
                        </div>
                      )}
                    </Card>
                  ))}
                </Space>
              ) : (
                <Empty description={copy.noRecentShipments} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>

            {/* Action Required */}
            <Card
              variant="borderless"
              title={<Space><ClockCircleOutlined style={{ color: '#ff4d4f' }} /><span style={{ fontWeight: 600 }}>{copy.actionRequired}</span></Space>}
              styles={{ body: { padding: 24 } }}
              style={{ boxShadow: '0 2px 12px rgba(0, 21, 41, 0.06)' }}
            >
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                {statement.summary.openInvoiceCount > 0 && (
                  <Card
                    size="small"
                    styles={{ body: { padding: '14px 16px' } }}
                    style={{ borderRadius: 10, borderLeft: `4px solid ${token.colorError}`, background: token.colorErrorBg }}
                  >
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Space>
                          <ClockCircleOutlined style={{ color: '#ff4d4f' }} />
                          <Text strong style={{ fontSize: 14 }}>{copy.overdueInvoices}</Text>
                        </Space>
                        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                          {statement.summary.openInvoiceCount} {copy.invoicesOverdueDesc}
                        </Text>
                      </Col>
                      <Col>
                        <Text strong style={{ color: '#ff4d4f', fontSize: 16 }}>
                          {formatMoney(statement.summary.openForeign, defaultCurrency, locale)}
                        </Text>
                      </Col>
                    </Row>
                  </Card>
                )}

                {orders.summary.pendingSignatureCount > 0 && (
                  <Card
                    size="small"
                    styles={{ body: { padding: '14px 16px' } }}
                    style={{ borderRadius: 10, borderLeft: `4px solid ${token.colorWarning}`, background: token.colorWarningBg }}
                  >
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Space>
                          <FileDoneOutlined style={{ color: '#faad14' }} />
                          <Text strong style={{ fontSize: 14 }}>{copy.pendingSignature}</Text>
                        </Space>
                        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                          {orders.summary.pendingSignatureCount} {copy.contractsAwaitingSignature}
                        </Text>
                      </Col>
                      <Col>
                        <Button type="primary" size="small" onClick={() => window.location.href = '/dashboard/portal/orders'}>
                          {copy.reviewNow}
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                )}

                {openQuotationsCount > 0 && (
                  <Card
                    size="small"
                    styles={{ body: { padding: '14px 16px' } }}
                    style={{ borderRadius: 10, borderLeft: `4px solid ${token.colorInfo}`, background: token.colorInfoBg }}
                  >
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Space>
                          <UnorderedListOutlined style={{ color: '#1890ff' }} />
                          <Text strong style={{ fontSize: 14 }}>{copy.openQuotations}</Text>
                        </Space>
                        <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                          {openQuotationsCount} {copy.quotationsAwaitingReview}
                        </Text>
                      </Col>
                      <Col>
                        <Button type="primary" size="small" onClick={() => window.location.href = '/dashboard/portal/orders'}>
                          {copy.viewAllOrders}
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                )}

                {statement.summary.openInvoiceCount === 0 && 
                 orders.summary.pendingSignatureCount === 0 && 
                 openQuotationsCount === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', background: token.colorSuccessBg, borderRadius: 10 }}>
                    <CheckCircleOutlined style={{ fontSize: 48, color: token.colorSuccess, marginBottom: 12 }} />
                    <Text style={{ display: 'block', fontSize: 14 }}>{copy.noActionRequired}</Text>
                  </div>
                )}
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Quick Actions */}
        <Card 
          variant="borderless" 
          title={<Space><UnorderedListOutlined style={{ color: '#722ed1' }} /><span style={{ fontWeight: 600 }}>{copy.quickActions}</span></Space>}
          styles={{ body: { padding: 24 } }}
          style={{ boxShadow: '0 2px 12px rgba(0, 21, 41, 0.06)' }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Button
                block
                size="large"
                icon={<ShoppingCartOutlined style={{ fontSize: 20 }} />}
                onClick={() => window.location.href = '/dashboard/portal/products'}
                style={{ height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: 12, fontWeight: 500 }}
              >
                {copy.browseProducts}
              </Button>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Button
                block
                size="large"
                icon={<FileDoneOutlined style={{ fontSize: 20 }} />}
                onClick={() => window.location.href = '/dashboard/portal/orders'}
                style={{ height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: 12, fontWeight: 500 }}
              >
                {copy.viewOrders}
              </Button>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Button
                block
                size="large"
                icon={<TruckOutlined style={{ fontSize: 20 }} />}
                onClick={() => window.location.href = '/dashboard/portal/shipments'}
                style={{ height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: 12, fontWeight: 500 }}
              >
                {copy.viewShipments}
              </Button>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Button
                block
                size="large"
                icon={<DownloadOutlined style={{ fontSize: 20 }} />}
                onClick={() => window.location.href = '/dashboard/portal/finance'}
                style={{ height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: 12, fontWeight: 500 }}
              >
                {copy.downloadReport}
              </Button>
            </Col>
          </Row>
        </Card>
      </Space>
    </PortalShell>
  );
};

type OrdersDocumentTab = CustomerCommercialDocumentType;

const orderStatusValues = [
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

const translateCustomerDocumentStatus = (status: string, locale: string): string => {
  if (locale !== 'vi') return status;

  const labels: Record<string, string> = {
    SENT: 'Đã gửi',
    ACCEPTED: 'Đã chấp nhận',
    REJECTED: 'Đã từ chối',
    EXPIRED: 'Hết hạn',
    PENDING_BUYER_SIGNATURE: 'Chờ buyer ký',
    BUYER_SIGNED: 'Buyer đã ký',
    CONFIRMED: 'Đã xác nhận',
    SHIPPED: 'Đã giao hàng',
    PAID: 'Đã thanh toán',
  };

  return labels[status] || status;
};

const OrdersPage = () => {
  const locale = useLocale();
  const copy = getCopy(locale);
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
    { key: 'ALL', label: copy.allDocuments },
    { key: 'QUOTATION', label: copy.quotations },
    { key: 'SALES_CONTRACT', label: copy.contracts },
    { key: 'PROFORMA_INVOICE', label: copy.proformaInvoices },
    { key: 'ORDER', label: copy.orders },
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
      message.success(copy.pdfDownloaded);
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
      message.success(copy.quotationAccepted);
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
      message.success(copy.quotationRejected);
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
      message.success(copy.revisionRequestSent);
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
    <PortalShell title={copy.ordersTitle} subtitle={copy.ordersSubtitle} icon={<ShoppingCartOutlined />}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <CustomerOrderSummaryCards summary={documents?.summary} />

        {error ? (
          <Alert
            type="error"
            showIcon
            title={copy.unableToLoadCommercialDocuments}
            description={error}
            action={<Button onClick={() => void loadDocuments()}>{copy.retry}</Button>}
          />
        ) : null}

        <Card
          variant="borderless"
          extra={(
            <Button icon={<ReloadOutlined />} onClick={() => void loadDocuments()}>
              {copy.refresh}
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
                placeholder={copy.searchOrdersPlaceholder}
                style={{ width: 340 }}
              />
              <Select
                allowClear
                placeholder={copy.filterStatus}
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

type InquiryFormValues = {
  incoterm: string;
  destinationPort?: string;
  expectedShipmentDate?: Dayjs;
  customerPhone?: string;
  contactEmail?: string;
  note?: string;
};

type InquiryCartItem = {
  product: PortalProduct;
  quantity: number;
  targetPrice: number | null;
  unitPrice: number | string | null;
  currency: string;
  incoterm: string;
};

const incotermOptions = [
  { value: 'EXW', label: 'EXW - Ex Works', description: 'Buyer handles pickup and export logistics.' },
  { value: 'FOB', label: 'FOB - Free On Board', description: 'Seller delivers cargo on board at origin port.' },
  { value: 'CFR', label: 'CFR - Cost and Freight', description: 'Seller includes ocean freight to destination port.' },
  { value: 'CIF', label: 'CIF - Cost, Insurance and Freight', description: 'Seller includes freight and cargo insurance.' },
  { value: 'DAP', label: 'DAP - Delivered at Place', description: 'Seller delivers to named destination place.' },
  { value: 'DDP', label: 'DDP - Delivered Duty Paid', description: 'Seller handles duties and final delivery.' },
];

const ProductsPage = () => {
  const locale = useLocale();
  const copy = getCopy(locale);
  const [form] = Form.useForm<InquiryFormValues>();
  const [api, contextHolder] = notification.useNotification();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [incoterm, setIncoterm] = useState('FOB');
  const [isRfqOpen, setIsRfqOpen] = useState(false);
  const [cartItems, setCartItems] = useState<InquiryCartItem[]>([]);
  const { profile, fetchProfile } = useCustomerPortalProfile();
  const { currencies, loading: currenciesLoading, fetchCurrencies } = useCustomerPortalCurrencies();
  const { ports, loading: portsLoading, fetchPorts } = useCustomerPortalPorts();
  const {
    catalog,
    loading,
    submitting,
    error,
    fetchProducts,
    submitInquiry,
  } = useCustomerPortalProducts();

  const fetchCatalog = useCallback(() => fetchProducts({
    search: search.trim(),
    category: categoryFilter || undefined,
    quantity: 1,
    currency,
    incoterm,
  }), [categoryFilter, currency, fetchProducts, incoterm, search]);

  useEffect(() => {
    void fetchProducts({
      search: '',
      category: undefined,
      quantity: 1,
      currency: 'USD',
      incoterm: 'FOB',
    });
  }, [fetchProducts]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    void fetchCurrencies();
  }, [fetchCurrencies]);

  useEffect(() => {
    void fetchPorts();
  }, [fetchPorts]);

  useEffect(() => {
    if (!isRfqOpen) return;
    form.setFieldsValue({
      incoterm,
      customerPhone: profile?.contact.phone || '',
      contactEmail: profile?.contact.email || '',
    });
  }, [form, incoterm, profile, isRfqOpen]);

  useEffect(() => {
    const defaultCurrency = profile?.finance.defaultCurrency || profile?.partner.defaultCurrency;
    if (defaultCurrency && currency === 'USD') {
      setCurrency(defaultCurrency);
    }
  }, [currency, profile]);

  const products = catalog?.results || [];
  const categoryOptions = useMemo(() => (
    (catalog?.categories || []).map((item) => ({
      value: item,
      label: item,
    }))
  ), [catalog?.categories]);
  const destinationPortOptions = useMemo(() => (
    ports.map((port) => {
      const label = `${formatPortLabel(port)} (${port.countryCode})`;
      return {
        value: label,
        label,
      };
    })
  ), [ports]);
  const currencyOptions = useMemo(() => (
    currencies.map((item) => ({
      value: item.code,
      label: `${item.code} - ${item.name}${item.symbol ? ` (${item.symbol})` : ''}`,
    }))
  ), [currencies]);
  const cartTotalQuantity = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  const clearProductFilters = () => {
    setSearch('');
    setCategoryFilter('');
    void fetchProducts({
      search: '',
      category: undefined,
      quantity: 1,
      currency,
      incoterm,
    });
  };

  const addToCart = (item: PortalProductPricing) => {
    const nextQuantity = Number(item.quantity || 1);
    setCartItems((currentItems) => {
      const existingItem = currentItems.find((cartItem) => cartItem.product._id === item.product._id);
      if (existingItem) {
        return currentItems.map((cartItem) => (
          cartItem.product._id === item.product._id
            ? { ...cartItem, quantity: cartItem.quantity + nextQuantity }
            : cartItem
        ));
      }

      return [
        ...currentItems,
        {
          product: item.product,
          quantity: nextQuantity,
          targetPrice: typeof item.unitPrice === 'number' ? item.unitPrice : null,
          unitPrice: item.unitPrice,
          currency: item.currency,
          incoterm: item.incoterm,
        },
      ];
    });
  };

  const updateCartQuantity = (product_id: string, value: number | null) => {
    setCartItems((currentItems) => currentItems.map((item) => (
      item.product._id === product_id ? { ...item, quantity: Number(value || 1) } : item
    )));
  };

  const updateCartTargetPrice = (product_id: string, value: number | null) => {
    setCartItems((currentItems) => currentItems.map((item) => (
      item.product._id === product_id ? { ...item, targetPrice: value } : item
    )));
  };

  const removeCartItem = (product_id: string) => {
    setCartItems((currentItems) => currentItems.filter((item) => item.product._id !== product_id));
  };

  const handleSubmitInquiry = async () => {
    if (!cartItems.length) return;
    const values = await form.validateFields();

    const result = await submitInquiry({
      lineItems: cartItems.map((item) => ({
        product_id: item.product._id,
        quantity: item.quantity,
        targetPrice: item.targetPrice,
        note: null,
      })),
      incoterm: values.incoterm,
      destinationPort: values.destinationPort || null,
      expectedShipmentDate: values.expectedShipmentDate?.toISOString() || null,
      targetPriceCurrency: currency,
      customerPhone: values.customerPhone || null,
      contactEmail: values.contactEmail || null,
      note: values.note || null,
    });

    if (!result.success) {
      api.error({
        title: copy.inquiryFailed,
        description: result.message,
      });
      return;
    }

    api.success({
      title: copy.inquirySubmitted,
      description: result.inquiry?.inquiryNumber
        ? `${copy.inquirySubmittedDesc} (${result.inquiry.inquiryNumber})`
        : copy.inquirySubmittedDesc,
    });
    setCartItems([]);
    setIsRfqOpen(false);
    form.resetFields();
  };

  return (
    <PortalShell title={copy.productsTitle} subtitle={copy.productsSubtitle} icon={<ShoppingCartOutlined />} fullWidth>
      {contextHolder}
      <Row gutter={[24, 24]}>
        {/* Left Column: Products & Filters */}
        <Col xs={24} lg={16} xl={17} xxl={18}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card variant="borderless" styles={{ body: { padding: 16 } }}>
              <Row gutter={[16, 16]} align="bottom">
                <Col xs={24} md={8} xl={6}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
                    {copy.searchLabel}
                  </Text>
                  <Input.Search
                    allowClear
                    size="large"
                    value={search}
                    placeholder={copy.productSearch}
                    onChange={(event) => setSearch(event.target.value)}
                    onSearch={() => void fetchCatalog()}
                  />
                </Col>
                <Col xs={12} md={8} xl={5}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
                    {copy.category}
                  </Text>
                  <Select
                    allowClear
                    showSearch
                    size="large"
                    value={categoryFilter || undefined}
                    placeholder={copy.allCategories}
                    style={{ width: '100%' }}
                    popupMatchSelectWidth={280}
                    optionFilterProp="label"
                    options={categoryOptions}
                    onChange={(value) => setCategoryFilter(value || '')}
                  />
                </Col>
                <Col xs={12} md={8} xl={4}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
                    {copy.currency}
                  </Text>
                  <Select
                    showSearch
                    loading={currenciesLoading}
                    size="large"
                    value={currency}
                    style={{ width: '100%' }}
                    popupMatchSelectWidth={320}
                    optionFilterProp="label"
                    options={currencyOptions}
                    onChange={setCurrency}
                  />
                </Col>
                <Col xs={24} md={12} xl={5}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
                    {copy.incoterm}
                  </Text>
                  <Select
                    showSearch
                    size="large"
                    value={incoterm}
                    style={{ width: '100%' }}
                    popupMatchSelectWidth={360}
                    optionFilterProp="label"
                    options={incotermOptions}
                    onChange={setIncoterm}
                  />
                </Col>
                <Col xs={24} md={12} xl={4}>
                  <Space.Compact block>
                    <Button block size="large" type="primary" loading={loading} onClick={() => void fetchCatalog()}>
                      {copy.applyFilters}
                    </Button>
                    <Button size="large" onClick={clearProductFilters}>
                      {copy.clearFilters}
                    </Button>
                  </Space.Compact>
                </Col>
              </Row>
            </Card>

            <PageState loading={loading} error={error} empty={products.length === 0} onRetry={() => void fetchCatalog()}>
              <Row gutter={[16, 16]}>
                {products.map((item) => {
                  const product = item.product;
                  const productName = product.englishName || product.vietnameseName;
                  const priceText = item.unitPrice === null
                    ? copy.contactSales
                    : formatMoney(item.unitPrice, item.currency, locale);
                  const stockText = Number(product.currentStock || 0).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US');

                  return (
                    <Col xs={24} md={12} xl={8} xxl={8} key={product._id}>
                      <Card
                        variant="borderless"
                        cover={product.imageUrl ? (
                          <Image
                            preview={false}
                            src={product.imageUrl}
                            alt={productName}
                            height={180}
                            width="100%"
                            style={{ objectFit: 'cover' }}
                          />
                        ) : undefined}
                        actions={[
                          <Button
                            key="request"
                            type="primary"
                            icon={<ShoppingCartOutlined />}
                            onClick={() => addToCart(item)}
                          >
                            {copy.addToInquiry}
                          </Button>,
                        ]}
                      >
                        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                          <Space wrap>
                            <Tag color="blue">{product.sku}</Tag>
                            {product.isNew ? <Tag color="green">New</Tag> : null}
                            {product.isBestseller ? <Tag color="gold">Best seller</Tag> : null}
                          </Space>
                          <Title level={5} style={{ margin: 0 }}>{productName}</Title>
                          <Text type="secondary">{product.description || product.vietnameseName}</Text>
                          <Row gutter={[8, 8]}>
                            <Col span={12}>
                              <Text type="secondary">{copy.price}</Text>
                              <div><Text strong>{priceText}</Text></div>
                            </Col>
                            <Col span={12}>
                              <Text type="secondary">{copy.stock}</Text>
                              <div><Text strong>{stockText} {product.unitOfMeasure || ''}</Text></div>
                            </Col>
                            <Col span={12}>
                              <Text type="secondary">HS</Text>
                              <div>{product.hsCode || '-'}</div>
                            </Col>
                            <Col span={12}>
                              <Text type="secondary">{copy.origin}</Text>
                              <div>{product.originCountry || '-'}</div>
                            </Col>
                          </Row>
                          <Space wrap>
                            {product.category ? <Tag>{copy.category}: {product.category}</Tag> : null}
                            {product.packingType ? <Tag>{copy.packing}: {product.packingType}</Tag> : null}
                          </Space>
                        </Space>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </PageState>
          </Space>
        </Col>

        {/* Right Column: RFQ Cart Sidebar */}
        <Col xs={24} lg={8} xl={7} xxl={6}>
          <div style={{ position: 'sticky', top: 16 }}>
            <Card
              variant="borderless"
              title={copy.inquiryCart}
              extra={<Tag color="blue">{cartItems.length} SKU</Tag>}
              actions={[
                <div key="build-rfq" style={{ padding: '0 16px' }}>
                  <Button
                    type="primary"
                    size="large"
                    block
                    disabled={!cartItems.length}
                    icon={<ShoppingCartOutlined />}
                    onClick={() => setIsRfqOpen(true)}
                  >
                    {copy.buildRfq} ({cartTotalQuantity.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')})
                  </Button>
                </div>
              ]}
              styles={{ body: { padding: '12px 16px', maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' } }}
            >
              {cartItems.length ? (
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  {cartItems.map((item) => (
                    <div key={item.product._id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 12 }}>
                      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                        <Col span={20}>
                          <Text strong>{item.product.englishName || item.product.vietnameseName}</Text>
                          <div><Text type="secondary" style={{ fontSize: 12 }}>{item.product.sku}</Text></div>
                        </Col>
                        <Col span={4} style={{ textAlign: 'right' }}>
                          <Button
                            danger
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => removeCartItem(item.product._id)}
                          />
                        </Col>
                      </Row>
                      <Row gutter={8}>
                        <Col span={10}>
                          <Text type="secondary" style={{ fontSize: 12 }}>{copy.productQuantity}</Text>
                          <Space.Compact style={{ width: '100%' }}>
                            <InputNumber
                              min={1}
                              size="small"
                              value={item.quantity}
                              style={{ width: '100%' }}
                              onChange={(value) => updateCartQuantity(item.product._id, value)}
                            />
                            {item.product.unitOfMeasure ? (
                              <Input
                                readOnly
                                tabIndex={-1}
                                value={item.product.unitOfMeasure}
                                size="small"
                                style={{ width: 48, padding: '0 4px', textAlign: 'center', pointerEvents: 'none' }}
                              />
                            ) : null}
                          </Space.Compact>
                        </Col>
                        <Col span={14}>
                          <Text type="secondary" style={{ fontSize: 12 }}>{copy.targetPrice}</Text>
                          <Space.Compact style={{ width: '100%' }}>
                            <InputNumber
                              min={0}
                              size="small"
                              value={item.targetPrice}
                              style={{ width: '100%' }}
                              onChange={(value) => updateCartTargetPrice(item.product._id, value)}
                            />
                            <Input
                              readOnly
                              tabIndex={-1}
                              value={item.currency}
                              size="small"
                              style={{ width: 48, padding: '0 4px', textAlign: 'center', pointerEvents: 'none' }}
                            />
                          </Space.Compact>
                        </Col>
                      </Row>
                    </div>
                  ))}
                </Space>
              ) : (
                <Empty description={copy.inquiryCartEmpty} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </div>
        </Col>
      </Row>

      <Modal
        open={isRfqOpen}
        title={copy.buildRfq}
        okText={copy.requestQuote}
        cancelText={copy.cancel}
        confirmLoading={submitting}
        okButtonProps={{ disabled: !cartItems.length }}
        onCancel={() => setIsRfqOpen(false)}
        onOk={() => void handleSubmitInquiry()}
        width={760}
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="customerPhone" label={copy.inquiryPhone}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="contactEmail" label={copy.inquiryEmail}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="incoterm"
                label={copy.incoterm}
                rules={[{ required: true, message: copy.incoterm }]}
              >
                <Select
                  showSearch
                  popupMatchSelectWidth={360}
                  optionFilterProp="label"
                  options={incotermOptions}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="destinationPort" label={copy.destinationPort}>
                <Select
                  allowClear
                  showSearch
                  loading={portsLoading}
                  placeholder={copy.destinationPortPlaceholder}
                  optionFilterProp="label"
                  options={destinationPortOptions}
                  popupMatchSelectWidth={360}
                  onSearch={(value) => {
                    if (value.trim().length >= 2 || value.trim().length === 0) {
                      void fetchPorts(value.trim() || undefined);
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="expectedShipmentDate" label={copy.expectedShipmentDate}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Card size="small" title={copy.lineItems} style={{ marginBottom: 16 }}>
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              {cartItems.map((item) => (
                <Row key={item.product._id} gutter={8} align="middle">
                  <Col span={12}>
                    <Text strong>{item.product.sku}</Text>
                    <div><Text type="secondary">{item.product.englishName || item.product.vietnameseName}</Text></div>
                  </Col>
                  <Col span={5}>
                    <Text>{item.quantity.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} {item.product.unitOfMeasure || ''}</Text>
                  </Col>
                  <Col span={7}>
                    <Text type="secondary">{copy.targetPrice}: </Text>
                    <Text>{item.targetPrice === null ? '-' : formatMoney(item.targetPrice, item.currency, locale)}</Text>
                  </Col>
                </Row>
              ))}
            </Space>
          </Card>
          <Form.Item name="note" label={copy.inquiryNote}>
            <Input.TextArea rows={4} placeholder={copy.inquiryNotePlaceholder} />
          </Form.Item>
        </Form>
      </Modal>
    </PortalShell>
  );
};

const FinancePage = () => {
  const locale = useLocale();
  const copy = getCopy(locale);
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
      api.error({ title: copy.downloadFailed, description: 'Missing access token' });
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
      const message = error instanceof Error ? error.message : copy.downloadFailed;
      api.error({ title: copy.downloadFailed, description: message });
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const invoiceColumns: ColumnsType<PortalStatementLine> = [
    {
      title: copy.invoiceNumber,
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
      title: copy.status,
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
      title: copy.dueDate,
      dataIndex: 'dueDate',
      width: 130,
      render: (value: string | null | undefined) => formatDate(value, locale),
    },
    {
      title: copy.amount,
      align: 'right',
      width: 160,
      onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
      render: (_value: unknown, record) => renderMoneyText(record.amountForeign, record.currency),
    },
    {
      title: copy.paid,
      align: 'right',
      width: 160,
      onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
      render: (_value: unknown, record) => renderMoneyText(record.paidAmountForeign, record.currency),
    },
    {
      title: copy.open,
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
            {receipts.length}{pendingCount ? ` / ${pendingCount} ${copy.pendingShort}` : ''}
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
              {copy.pay}
            </Button>
          ) : getReceiptsForInvoice(record).length > 0 ? (
            <Button size="small" onClick={() => toggleInvoiceReceipts(record)}>
              {expandedInvoiceKeys.includes(record._id)
                ? copy.hideReceipts
                : copy.viewReceipts}
            </Button>
          ) : (
            <Button size="small" disabled>
              {hasPendingReceipt(record)
                ? copy.pendingApproval
                : copy.closed}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const receiptColumns: ColumnsType<PortalPaymentReceipt> = [
    {
      title: copy.reference,
      render: (_value: unknown, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.accountReceivable?.invoiceNumber || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.accountReceivableId || '-'}</Text>
        </Space>
      ),
    },
    {
      title: copy.receiptNumber,
      dataIndex: 'receiptNumber',
      render: (value: string | null | undefined, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value || record._id}</Text>
          {record.receiptType ? <Tag style={{ width: 'fit-content' }}>{record.receiptType}</Tag> : null}
        </Space>
      ),
    },
    {
      title: copy.status,
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
      title: copy.amount,
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
              <Text type="danger" style={{ fontSize: 12 }}>{copy.invalidZeroAmount}</Text>
            ) : null}
            {hasCurrencyMismatch ? (
              <Space orientation="vertical" size={0}>
                <Text type="danger" style={{ fontSize: 12 }}>{copy.receiptCurrency}: {record.currency}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{copy.invoiceCurrency}: {invoiceCurrency}</Text>
              </Space>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: copy.bankReference,
      dataIndex: 'bankReference',
      render: (value: string | null | undefined) => (
        value ? <Text code>{value}</Text> : <Text type="danger">{copy.required}</Text>
      ),
    },
    { title: copy.submittedAt, dataIndex: 'submittedAt', render: (value: string | null | undefined) => formatDate(value, locale) },
  ];

  const handleDownloadStatement = async (format: 'excel' | 'csv'): Promise<void> => {
    const result = format === 'excel'
      ? await downloadStatementExcel()
      : await downloadStatementCsv();

    if (result.success) {
      api.success({ title: copy.downloadOk });
      return;
    }

    api.error({ title: copy.downloadFailed, description: result.message });
  };

  const statementDownloadMenuItems: MenuProps['items'] = [
    {
      key: 'excel',
      icon: <FileExcelOutlined />,
      label: copy.downloadStatementExcel,
    },
    {
      key: 'csv',
      icon: <DownloadOutlined />,
      label: copy.downloadStatementCsv,
    },
  ];

  const isEmpty = !statement || (statement.lines.length === 0 && statement.receipts.length === 0);

  // Determine currency for display
  const defaultCurrency = statement?.lines?.[0]?.currency || 'USD';
  const unallocatedReceipts = statement?.receipts.filter((receipt) => !receipt.accountReceivableId) || [];

  return (
    <PortalShell
      title={copy.financeTitle}
      subtitle={copy.financeSubtitle}
      icon={<DollarOutlined />}
      extra={(
        <Dropdown.Button
          type="primary"
          icon={<DownOutlined />}
          loading={downloading}
          disabled={!statement}
          menu={{
            items: statementDownloadMenuItems,
            onClick: ({ key }) => void handleDownloadStatement(key === 'csv' ? 'csv' : 'excel'),
          }}
          onClick={() => void handleDownloadStatement('excel')}
        >
          <FileExcelOutlined /> {copy.downloadStatementExcel}
        </Dropdown.Button>
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
                      title={<Text type="secondary">{copy.amount}</Text>}
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
                      title={<Text type="secondary">{copy.paid}</Text>}
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
                      title={<Text type="secondary">{copy.open}</Text>}
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
                      title={<Text type="secondary">{copy.openInvoices}</Text>}
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
              title={<Space><FileDoneOutlined style={{ color: token.colorPrimary }} /><span style={{ fontWeight: 600 }}>{copy.invoices}</span></Space>}
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

// Helper function for locale check
const isVietnameseText = (locale: string): boolean => locale === 'vi';

const ShipmentsPage = () => {
  const locale = useLocale();
  const copy = getCopy(locale);
  const { shipments, loading, error, fetchShipments } = useCustomerPortalShipments();

  useEffect(() => {
    void fetchShipments();
  }, [fetchShipments]);

  const columns: ColumnsType<PortalShipment> = [
    { title: copy.shipmentNumber, dataIndex: 'shipmentNumber', render: (value: string | null | undefined, record) => value || record._id },
    { title: copy.status, dataIndex: 'status', render: (value: string | null | undefined) => <Tag color={statusColor(value)}>{value || '-'}</Tag> },
    { title: copy.route, render: (_value: unknown, record) => `${record.pol || '-'} -> ${record.pod || '-'}` },
    { title: copy.blNumber, dataIndex: 'blNumber', render: (value: string | null | undefined) => value || '-' },
    { title: copy.eta, dataIndex: 'eta', render: (value: string | null | undefined) => formatDate(value, locale) },
  ];

  return (
    <PortalShell title={copy.shipmentsTitle} subtitle={copy.shipmentsSubtitle} icon={<GlobalOutlined />}>
      <PageState loading={loading} error={error} empty={shipments.length === 0} onRetry={() => void fetchShipments()}>
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Card variant="borderless">
            <Table rowKey="_id" columns={columns} dataSource={shipments} pagination={{ pageSize: 8 }} />
          </Card>
          <Row gutter={[16, 16]}>
            {shipments.map((shipment) => (
              <Col xs={24} xl={12} key={shipment._id}>
                <Card
                  title={shipment.shipmentNumber || shipment._id}
                  extra={<Tag color={statusColor(shipment.status)}>{shipment.status || '-'}</Tag>}
                  variant="borderless"
                >
                  <Steps
                    orientation="vertical"
                    size="small"
                    items={(shipment.timeline || []).map((item) => ({
                      title: item.label,
                      content: formatDate(item.date, locale),
                      status: item.state,
                    }))}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </Space>
      </PageState>
    </PortalShell>
  );
};

const PortalShell = ({
  title,
  subtitle,
  icon,
  extra,
  fullWidth = true,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  extra?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}) => (
  <AdminPageScroll>
    <PageHeader title={title} description={subtitle} icon={icon} extra={extra} />
    <div style={{ width: '100%', maxWidth: fullWidth ? '100%' : 1440, margin: fullWidth ? 0 : '0 auto' }}>
      {children}
    </div>
  </AdminPageScroll>
);

const CustomerPortalPage = ({ view }: CustomerPortalPageProps) => {
  if (view === 'products') return <ProductsPage />;
  if (view === 'orders') return <OrdersPage />;
  if (view === 'finance') return <FinancePage />;
  if (view === 'shipments') return <ShipmentsPage />;
  if (view === 'settings') return <OverviewPage />;
  if (view === 'tickets') return <OverviewPage />;
  return <OverviewPage />;
};

export default CustomerPortalPage;
