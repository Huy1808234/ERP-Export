const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const HAS_TIME_ZONE_SUFFIX = /(?:z|[+-]\d{2}:?\d{2})$/i;

export const parseApiDateTimeAsUtc = (value?: string | Date | null): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalized = HAS_TIME_ZONE_SUFFIX.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatVietnamDate = (value?: string | Date | null): string => {
  const date = parseApiDateTimeAsUtc(value);
  if (!date) return '-';

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

export const formatVietnamTime = (value?: string | Date | null, withSeconds = false): string => {
  const date = parseApiDateTimeAsUtc(value);
  if (!date) return '-';

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' as const } : {}),
    hourCycle: 'h23',
  }).format(date);
};
