import type { useFormatter } from 'next-intl';
export type Formatter = ReturnType<typeof useFormatter>;

export type DateFormatMode = 'date' | 'dateTime';

export const formatDate = (
  value: string | null | undefined,
  format: Formatter,
  mode: DateFormatMode = 'date',
): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return format.dateTime(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(mode === 'dateTime'
      ? {
          hour: '2-digit',
          minute: '2-digit',
        }
      : {}),
  });
};

export const formatMoney = (
  value: number | string | null | undefined,
  currency: string,
  format: Formatter,
): string => {
  const normalizedCurrency = currency || 'USD';
  const fractionDigits = normalizedCurrency === 'VND' ? 0 : 2;
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  return format.number(Number.isFinite(numValue) ? (numValue as number) : 0, {
    style: 'currency',
    currency: normalizedCurrency,
    currencyDisplay: 'code',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

export const formatQuantity = (
  value: number | string | null | undefined,
  unit: string | null,
  format: Formatter,
): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const quantity = Number.isFinite(numValue) ? (numValue as number) : 0;
  
  const formattedValue = format.number(quantity, {
    maximumFractionDigits: 2,
  });

  return unit ? `${formattedValue} ${unit}` : formattedValue;
};
