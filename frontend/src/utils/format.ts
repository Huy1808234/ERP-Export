/**
 * @file format.ts
 * Static formatting utilities (no React hooks).
 *
 * For React components, prefer the `useCurrency` hook which automatically
 * picks up the user's active locale from next-intl.
 *
 * These static helpers use a fixed locale and are suitable for:
 *  - Server components
 *  - Non-React contexts (e.g. Excel export, email templates)
 *  - Legacy call sites not yet migrated to useCurrency
 */

import { getCurrencyDecimals } from '@/constants/currency.config';

// ---------------------------------------------------------------------------
// Core static formatter
// ---------------------------------------------------------------------------

/**
 * Format a monetary value with the correct locale separators and
 * currency-appropriate decimal precision.
 *
 * @param amount   - Numeric value or its string representation
 * @param currency - ISO 4217 code ('VND', 'USD', 'EUR', …)
 * @param locale   - Intl locale for number formatting (default: 'vi-VN')
 *
 * Examples with locale='vi-VN':
 *   formatMoneyStatic(22000,    'USD') → "$ 22.000,00"
 *   formatMoneyStatic(725.36,   'EUR') → "€ 725,36"
 *   formatMoneyStatic(2200000,  'VND') → "2.200.000 ₫"
 */
export const formatMoneyStatic = (
  amount: number | string | null | undefined,
  currency = 'VND',
  locale = 'vi-VN'
): string => {
  const value = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (!isFinite(value)) return `0 ${currency}`;

  const decimals = getCurrencyDecimals(currency);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    // Fallback for currency codes unknown to Intl (shouldn't happen in practice)
    const numberStr = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
    return `${currency} ${numberStr}`;
  }
};

// ---------------------------------------------------------------------------
// Convenience wrappers (kept for backward compatibility)
// ---------------------------------------------------------------------------

/**
 * Format number to VND currency string.
 * Uses vi-VN locale: dấu . cho hàng nghìn, 0 thập phân.
 * @deprecated Prefer `useCurrency().formatVND()` in React components.
 */
export const formatVND = (amount: number | string): string =>
  formatMoneyStatic(amount, 'VND', 'vi-VN');

/**
 * Format date string to local format (vi-VN).
 * @param date ISO date string or Date object
 * @returns Formatted date e.g. 25/04/2026
 */
export const formatDate = (date?: string | Date | null): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('vi-VN').format(d);
};

/**
 * Format a raw number with fixed decimal places.
 * @param amount  - Numeric value
 * @param decimals - Decimal places (default 2)
 * @deprecated Prefer `useCurrency().formatNumber()` in React components.
 */
export const formatCurrency = (amount: number | string, decimals = 2): string => {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(value)) return '0';
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Format price with specific currency, using the user locale (vi-VN default).
 *
 * Decimal precision is driven by `getCurrencyDecimals()`:
 *   VND → 0 decimals | USD/EUR/… → 2 decimals
 *
 * @deprecated Prefer `useCurrency().formatMoney()` in React components.
 */
export const formatPrice = (
  amount: number | string,
  currency = 'VND',
  locale = 'vi-VN'
): string => formatMoneyStatic(amount, currency, locale);
