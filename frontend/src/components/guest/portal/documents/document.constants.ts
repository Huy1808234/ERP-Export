export type DisabledReasonCode =
  | 'QUOTATION_EXPIRED'
  | 'ACTION_UNAVAILABLE'
  | 'READ_ONLY_DOCUMENT';

export const DISABLED_REASON_MAP: Record<string, DisabledReasonCode> = {
  'Quotation has expired': 'QUOTATION_EXPIRED',
  'Action is not available in current status': 'ACTION_UNAVAILABLE',
  'Read-only commercial document': 'READ_ONLY_DOCUMENT',
};

export const statusColor = (status: string): string => {
  const normalized = status.toUpperCase();
  if (['ACCEPTED', 'APPROVED', 'CONFIRMED', 'PAID', 'COMPLETED', 'BUYER_SIGNED'].includes(normalized)) {
    return 'success';
  }
  if (['SENT', 'PENDING_APPROVAL', 'PENDING_BUYER_SIGNATURE', 'SHIPPED'].includes(normalized)) {
    return 'processing';
  }
  if (['REJECTED', 'CANCELLED', 'EXPIRED'].includes(normalized)) {
    return 'error';
  }
  return 'warning';
};

export const SIGNING_STEP = {
  VERIFY_OTP: 0,
  SIGN: 1,
  COMPLETE: 2,
} as const;

export type SigningStep = typeof SIGNING_STEP[keyof typeof SIGNING_STEP];
