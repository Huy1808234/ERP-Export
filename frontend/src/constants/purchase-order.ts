import { POStatus } from '@/types/purchase-order';

export const PO_STATUS_CONFIG: Record<POStatus, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: 'Nháp' },
  PENDING_APPROVAL: { color: 'processing', label: 'Chờ duyệt' },
  APPROVED: { color: 'green', label: 'Đã duyệt' },
  REJECTED: { color: 'red', label: 'Từ chối' },
  SENT: { color: 'blue', label: 'Đã gửi NCC' },
  PARTIAL_RECEIPT: { color: 'orange', label: 'Nhận một phần' },
  RECEIVED: { color: 'cyan', label: 'Đã nhận đủ' },
  COMPLETED: { color: 'green', label: 'Hoàn tất' },
  CANCELLED: { color: 'red', label: 'Đã hủy' },
};

export const PO_STATUS_OPTIONS = Object.entries(PO_STATUS_CONFIG).map(([value, { label }]) => ({
  value,
  label,
}));
