import { PRStatus } from "@/types/purchase-request";

export const PR_STATUS_CONFIG: Record<PRStatus, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: 'Nháp' },
  PENDING: { color: 'orange', label: 'Chờ duyệt' },
  APPROVED: { color: 'green', label: 'Đã duyệt' },
  REJECTED: { color: 'red', label: 'Từ chối' },
  PARTIAL_PO: { color: 'cyan', label: 'PO một phần' },
  COMPLETED: { color: 'blue', label: 'Hoàn thành' },
  CANCELLED: { color: 'black', label: 'Đã hủy' },
};

export const PR_STATUS_OPTIONS = Object.entries(PR_STATUS_CONFIG).map(([value, { label }]) => ({
  value,
  label,
}));
