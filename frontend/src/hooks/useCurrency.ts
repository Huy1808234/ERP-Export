'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';
import {
  getCurrencyDecimals,
  getCurrencyConfig,
  USER_LOCALES,
  BASE_CURRENCY,
  type SupportedLocale,
} from '@/constants/currency.config';

/**
 * `useCurrency` — Locale-aware, production-grade currency formatter.
 *
 * ## Core principle
 * Numbers are formatted according to the **user's active UI locale**
 * (e.g. `vi-VN`), NOT the locale of the currency being displayed.
 *
 * Example with a Vietnamese user:
 *   - $22,000.00  →  $ 22.000,00   (dấu . nghìn, dấu , thập phân)
 *   - € 725,36    →  € 725,36      (same separators as above)
 *   - 2.200.000 ₫ →  2.200.000 ₫  (0 decimals, same separators)
 *
 * ## Decimal precision
 *   - VND, JPY, KRW: 0 decimal places
 *   - All other currencies: 2 decimal places
 */
export function useCurrency() {
  const locale = useLocale() as SupportedLocale;

  /**
   * Resolves the Intl locale string for the current user locale.
   * Falls back to 'vi-VN' (the default app locale) if unmapped.
   */
  const userLocale = USER_LOCALES[locale] ?? 'vi-VN';

  /**
   * Format an amount as currency using the USER's locale for separators.
   *
   * @param amount   - Numeric value or string representation
   * @param currency - ISO 4217 code (e.g. 'USD', 'VND', 'EUR')
   * @returns        Formatted string e.g. "$ 22.000,00" or "2.200.000 ₫"
   */
  const formatMoney = useCallback(
    (amount: number | string | null | undefined, currency: string = BASE_CURRENCY): string => {
      const value = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
      if (!isFinite(value)) return `0 ${currency}`;

      const decimals = getCurrencyDecimals(currency);

      try {
        return new Intl.NumberFormat(userLocale, {
          style: 'currency',
          currency,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
          // currencyDisplay: 'symbol' is the default, which gives $, €, ₫
        }).format(value);
      } catch {
        // Fallback for unknown currency codes not in Intl database
        const config = getCurrencyConfig(currency);
        const numberStr = new Intl.NumberFormat(userLocale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(value);
        return `${config.symbol} ${numberStr}`;
      }
    },
    [userLocale]
  );

  /**
   * Format a raw number (no currency symbol) using the user's locale.
   * Useful for KPI numbers, chart axis labels, quantity fields, etc.
   *
   * @param value    - Numeric value
   * @param decimals - Optional override for decimal places
   */
  const formatNumber = useCallback(
    (value: number | string | null | undefined, decimals = 0): string => {
      const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
      if (!isFinite(num)) return '0';
      return new Intl.NumberFormat(userLocale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(num);
    },
    [userLocale]
  );

  /**
   * Format a VND amount specifically (convenience wrapper).
   * Always 0 decimals. Uses user's locale for separators.
   */
  const formatVND = useCallback(
    (amount: number | string | null | undefined): string => {
      return formatMoney(amount, 'VND');
    },
    [formatMoney]
  );

  /**
   * Format a compact number for chart axes / small spaces.
   * Example: 1,200,000 → "1.2M" (always uses en-US for compactness)
   */
  const formatCompact = useCallback(
    (value: number | string | null | undefined): string => {
      const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
      if (!isFinite(num)) return '0';
      return new Intl.NumberFormat(userLocale, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(num);
    },
    [userLocale]
  );

  return {
    /** Current Intl locale string (e.g. "vi-VN") */
    userLocale,
    formatMoney,
    formatNumber,
    formatVND,
    formatCompact,
  };
}
