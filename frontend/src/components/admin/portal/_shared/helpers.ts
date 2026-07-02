export const isVietnameseText = (locale?: string | null): boolean => {
  if (!locale) return false;
  return locale.toLowerCase().startsWith('vi');
};
export const formatDate = (value?: string | null, locale?: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(locale || 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
};

export const formatMoney = (
  value: number | string | null | undefined,
  currency?: string | null,
  locale?: string,
): string => {
  if (value === null || value === undefined || value === '') return '-';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  try {
    return new Intl.NumberFormat(locale || 'en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${currency || ''} ${numeric.toLocaleString()}`;
  }
};

const STATUS_COLOR_MAP: Record<string, string> = {
  DRAFT: 'default',
  SUBMITTED: 'gold',
  IN_REVIEW: 'blue',
  QUOTED: 'cyan',
  ACCEPTED: 'green',
  REJECTED: 'red',
  REVISION_REQUESTED: 'orange',
  EXPIRED: 'volcano',
  BOOKED: 'blue',
  LOADING: 'processing',
  CUSTOMS_CLEARED: 'purple',
  ON_BOARD: 'cyan',
  ARRIVED: 'orange',
  CLOSED: 'green',
  PAID: 'green',
  PARTIALLY_PAID: 'gold',
  OVERDUE: 'red',
  OPEN: 'gold',
  CANCELLED: 'default',
};

export const statusColor = (status?: string | null): string => {
  if (!status) return 'default';
  const key = String(status).toUpperCase();
  return STATUS_COLOR_MAP[key] || 'default';
};

const DOCUMENT_STATUS_LABEL: Record<string, { vi: string; en: string }> = {
  DRAFT: { vi: 'Bản nháp', en: 'Draft' },
  SUBMITTED: { vi: 'Đã gửi', en: 'Submitted' },
  IN_REVIEW: { vi: 'Đang xét duyệt', en: 'In review' },
  QUOTED: { vi: 'Đã báo giá', en: 'Quoted' },
  ACCEPTED: { vi: 'Đã chấp nhận', en: 'Accepted' },
  REJECTED: { vi: 'Đã từ chối', en: 'Rejected' },
  REVISION_REQUESTED: { vi: 'Yêu cầu chỉnh sửa', en: 'Revision requested' },
  EXPIRED: { vi: 'Hết hạn', en: 'Expired' },
  BOOKED: { vi: 'Đã đặt lịch', en: 'Booked' },
  LOADING: { vi: 'Đang đóng hàng', en: 'Loading' },
  CUSTOMS_CLEARED: { vi: 'Đã thông quan', en: 'Customs cleared' },
  ON_BOARD: { vi: 'Đang vận chuyển', en: 'On board' },
  ARRIVED: { vi: 'Chờ nhận hàng', en: 'Awaiting receipt' },
  CLOSED: { vi: 'Hoàn tất', en: 'Closed' },
  PAID: { vi: 'Đã thanh toán', en: 'Paid' },
  PARTIALLY_PAID: { vi: 'Thanh toán một phần', en: 'Partially paid' },
  OVERDUE: { vi: 'Quá hạn', en: 'Overdue' },
  OPEN: { vi: 'Đang mở', en: 'Open' },
  CANCELLED: { vi: 'Đã hủy', en: 'Cancelled' },
};

export const translateCustomerDocumentStatus = (status?: string | null, locale?: string): string => {
  if (!status) return '-';
  const key = String(status).toUpperCase();
  const entry = DOCUMENT_STATUS_LABEL[key];
  if (entry) {
    return isVietnameseText(locale) ? entry.vi : entry.en;
  }
  return status;
};
