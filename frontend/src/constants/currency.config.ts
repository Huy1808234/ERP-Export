/**
 * Currency configuration for the ERP system.
 *
 * Rules:
 *  - VND  → 0 decimal places  (convention in Vietnam)
 *  - All other currencies → 2 decimal places (ISO standard)
 *
 * The `locale` here is NOT used for number formatting.
 * All numbers are formatted according to the ACTIVE USER LOCALE
 * (e.g. vi-VN), not the currency's country locale.
 * This ensures a consistent separator style across the whole UI.
 */

export interface CurrencyConfig {
  /** ISO 4217 currency code */
  code: string;
  /** Display symbol */
  symbol: string;
  /** Number of decimal places to display */
  decimals: number;
  /** Human-readable label */
  label: string;
}

export const CURRENCY_CONFIGS: Record<string, CurrencyConfig> = {
  VND: { code: 'VND', symbol: '₫', decimals: 0, label: 'Việt Nam Đồng' },
  USD: { code: 'USD', symbol: '$', decimals: 2, label: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', decimals: 2, label: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', decimals: 2, label: 'British Pound' },
  JPY: { code: 'JPY', symbol: '¥', decimals: 0, label: 'Japanese Yen' },
  CNY: { code: 'CNY', symbol: '¥', decimals: 2, label: 'Chinese Yuan' },
  KRW: { code: 'KRW', symbol: '₩', decimals: 0, label: 'Korean Won' },
  SGD: { code: 'SGD', symbol: 'S$', decimals: 2, label: 'Singapore Dollar' },
  THB: { code: 'THB', symbol: '฿', decimals: 2, label: 'Thai Baht' },
  AUD: { code: 'AUD', symbol: 'A$', decimals: 2, label: 'Australian Dollar' },
};

/** Fallback config for unknown currency codes */
export const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  code: 'USD',
  symbol: '$',
  decimals: 2,
  label: 'Unknown Currency',
};

/**
 * Returns the decimal precision for a given currency code.
 * VND / JPY / KRW → 0; everything else → 2.
 */
export function getCurrencyDecimals(currency: string): number {
  return CURRENCY_CONFIGS[currency]?.decimals ?? DEFAULT_CURRENCY_CONFIG.decimals;
}

/**
 * Returns the full config object for a currency code.
 */
export function getCurrencyConfig(currency: string): CurrencyConfig {
  return CURRENCY_CONFIGS[currency] ?? { ...DEFAULT_CURRENCY_CONFIG, code: currency };
}

/**
 * The base currency used for consolidated financial reporting (P&L, KPIs).
 * All foreign-currency amounts must be converted to this before aggregation.
 */
export const BASE_CURRENCY = 'VND';

/**
 * Global exchange rate for USD/VND conversion (fallback if no live rate).
 * Convention: 1 USD = GLOBAL_EXCHANGE_RATE VND
 */
export const GLOBAL_EXCHANGE_RATE = 26128;


/**
 * Supported user locale strings mapped to Intl locale identifiers.
 * The user locale controls the NUMBER FORMAT (separators),
 * independently of the currency being displayed.
 */
export const USER_LOCALES: Record<string, string> = {
  'vi': 'vi-VN',   // Vietnamese: dấu . nghìn, dấu , thập phân
  'en': 'en-US',   // English:    comma thousands, period decimal
  'zh': 'zh-CN',   // Chinese
  'ja': 'ja-JP',   // Japanese
  'ko': 'ko-KR',   // Korean
  'de': 'de-DE',   // German: dấu . nghìn, dấu , thập phân (same visual as vi-VN)
  'fr': 'fr-FR',   // French
};

export type SupportedLocale = keyof typeof USER_LOCALES;
