import { POStatus } from '@/types/purchase-order';

export const PO_STATUS_CONFIG: Record<POStatus, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: 'Nháp' },
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
