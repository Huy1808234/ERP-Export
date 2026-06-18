import { useEffect, useMemo, useState } from 'react';
import { countryService } from '@/services/country.service';

export const BUYER_REGION_KEYS = ['EU', 'US', 'ASEAN', 'APAC', 'MIDDLE_EAST', 'OTHER'] as const;

export type BuyerRegionKey = (typeof BUYER_REGION_KEYS)[number];

export interface CountryCatalogItem {
  code: string;
  name: string;
  nameVi: string;
  region: BuyerRegionKey;
  aliases: string[];
}

export const COUNTRY_CATALOG: CountryCatalogItem[] = [
  { code: 'VN', name: 'Vietnam', nameVi: 'Việt Nam', region: 'ASEAN', aliases: ['VIETNAM', 'VIET NAM', 'VN'] },
  { code: 'US', name: 'United States', nameVi: 'Hoa Kỳ', region: 'US', aliases: ['US', 'USA', 'UNITED STATES', 'AMERICA', 'HOA KY', 'MY'] },
  { code: 'JP', name: 'Japan', nameVi: 'Nhật Bản', region: 'APAC', aliases: ['JP', 'JAPAN', 'NHAT BAN'] },
  { code: 'NL', name: 'Netherlands', nameVi: 'Hà Lan', region: 'EU', aliases: ['NL', 'NETHERLANDS', 'HOLLAND', 'HA LAN'] },
  { code: 'SG', name: 'Singapore', nameVi: 'Singapore', region: 'ASEAN', aliases: ['SG', 'SINGAPORE'] },
  { code: 'DE', name: 'Germany', nameVi: 'Đức', region: 'EU', aliases: ['DE', 'GERMANY', 'DEUTSCHLAND', 'DUC'] },
  { code: 'FR', name: 'France', nameVi: 'Pháp', region: 'EU', aliases: ['FR', 'FRANCE', 'PHAP'] },
  { code: 'IT', name: 'Italy', nameVi: 'Ý', region: 'EU', aliases: ['IT', 'ITALY', 'Y'] },
  { code: 'ES', name: 'Spain', nameVi: 'Tây Ban Nha', region: 'EU', aliases: ['ES', 'SPAIN', 'TAY BAN NHA'] },
  { code: 'CN', name: 'China', nameVi: 'Trung Quốc', region: 'APAC', aliases: ['CN', 'CHINA', 'TRUNG QUOC'] },
  { code: 'KR', name: 'South Korea', nameVi: 'Hàn Quốc', region: 'APAC', aliases: ['KR', 'KOREA', 'SOUTH KOREA', 'HAN QUOC'] },
  { code: 'AU', name: 'Australia', nameVi: 'Úc', region: 'APAC', aliases: ['AU', 'AUSTRALIA', 'UC'] },
  { code: 'TH', name: 'Thailand', nameVi: 'Thái Lan', region: 'ASEAN', aliases: ['TH', 'THAILAND', 'THAI LAN'] },
  { code: 'MY', name: 'Malaysia', nameVi: 'Malaysia', region: 'ASEAN', aliases: ['MY', 'MALAYSIA'] },
  { code: 'ID', name: 'Indonesia', nameVi: 'Indonesia', region: 'ASEAN', aliases: ['ID', 'INDONESIA'] },
  { code: 'PH', name: 'Philippines', nameVi: 'Philippines', region: 'ASEAN', aliases: ['PH', 'PHILIPPINES'] },
  { code: 'AE', name: 'United Arab Emirates', nameVi: 'UAE', region: 'MIDDLE_EAST', aliases: ['AE', 'UAE', 'UNITED ARAB EMIRATES'] },
  { code: 'SA', name: 'Saudi Arabia', nameVi: 'Saudi Arabia', region: 'MIDDLE_EAST', aliases: ['SA', 'SAUDI', 'SAUDI ARABIA'] },
  { code: 'QA', name: 'Qatar', nameVi: 'Qatar', region: 'MIDDLE_EAST', aliases: ['QA', 'QATAR'] },
];

const subscribers = new Set<() => void>();

export const updateCountryCatalog = (items: CountryCatalogItem[]) => {
  COUNTRY_CATALOG.length = 0;
  COUNTRY_CATALOG.push(...items);
  subscribers.forEach((callback) => callback());
};

let isFetching = false;
let isLoaded = false;

export const loadCountries = async (accessToken?: string, force: boolean = false) => {
  if ((isLoaded && !force) || isFetching) return;
  isFetching = true;
  try {
    const res = await countryService.findAll({ pageSize: 1000, isActive: true }, accessToken);
    if (res.data?.results) {
      const items: CountryCatalogItem[] = res.data.results.map((c) => ({
        code: c.code,
        name: c.name,
        nameVi: c.nameVi,
        region: (c.region as BuyerRegionKey) || 'OTHER',
        aliases: c.aliases || [],
      }));
      updateCountryCatalog(items);
      isLoaded = true;
      console.log(' loadCountries SUCCESS! Items count:', items.length);
    } else {
      console.error(' loadCountries FAILED: res.data?.results is undefined', res);
    }
  } catch (error) {
    console.error('Failed to load countries from backend, using fallback catalog:', error);
  } finally {
    isFetching = false;
  }
};

// Hook for dynamic countries usage in React
export const useCountries = (locale?: string) => {
  const [countries, setCountries] = useState<CountryCatalogItem[]>(COUNTRY_CATALOG);

  useEffect(() => {
    const handleChange = () => {
      setCountries([...COUNTRY_CATALOG]);
    };
    subscribers.add(handleChange);
    // Ensure we have current catalog elements
    handleChange();
    return () => {
      subscribers.delete(handleChange);
    };
  }, []);

  const options = useMemo(() => {
    return countries.map((country) => ({
      value: country.code,
      label: `${locale === 'vi' ? country.nameVi : country.name} (${country.code})`,
    }));
  }, [countries, locale]);

  return {
    countries,
    options,
  };
};

const normalizeLookupText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

export const findCountry = (value?: string | null): CountryCatalogItem | undefined => {
  const normalized = value ? normalizeLookupText(value) : '';
  if (!normalized) return undefined;

  return COUNTRY_CATALOG.find((country) => (
    country.code === normalized ||
    normalizeLookupText(country.name) === normalized ||
    normalizeLookupText(country.nameVi) === normalized ||
    country.aliases.some((alias) => normalizeLookupText(alias) === normalized)
  ));
};

export const normalizeCountryCode = (value?: string | null): string | undefined => findCountry(value)?.code;

export const getCountryRegion = (value?: string | null): BuyerRegionKey | undefined => findCountry(value)?.region;

export const getCountryDisplayName = (value?: string | null, locale?: string): string => {
  const country = findCountry(value);
  if (!country) return value?.trim() || '';
  return locale === 'vi' ? country.nameVi : country.name;
};

export const buildCountryOptions = (locale?: string) =>
  COUNTRY_CATALOG.map((country) => ({
    value: country.code,
    label: `${locale === 'vi' ? country.nameVi : country.name} (${country.code})`,
  }));

export const buildRegionOptions = (translate: (key: string) => string) =>
  BUYER_REGION_KEYS.map((region) => ({
    value: region,
    label: translate(`regions.${region}`),
  }));
