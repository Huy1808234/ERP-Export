export enum MarketRegionCode {
  EU = 'EU',
  US = 'US',
  ASEAN = 'ASEAN',
  APAC = 'APAC',
  MIDDLE_EAST = 'MIDDLE_EAST',
  OTHER = 'OTHER',
}

export const MARKET_REGION_CODES = Object.values(MarketRegionCode);

export interface CountryCatalogItem {
  code: string;
  name: string;
  nameVi?: string; // Optional nameVi since backend does not strict-require it, but good to have
  region: MarketRegionCode;
  aliases: string[];
}

export const COUNTRY_CATALOG: CountryCatalogItem[] = [
  {
    code: 'VN',
    name: 'Vietnam',
    region: MarketRegionCode.ASEAN,
    aliases: ['VIETNAM', 'VIET NAM', 'VN'],
  },
  {
    code: 'US',
    name: 'United States',
    region: MarketRegionCode.US,
    aliases: ['US', 'USA', 'UNITED STATES', 'AMERICA', 'HOA KY', 'MY'],
  },
  {
    code: 'JP',
    name: 'Japan',
    region: MarketRegionCode.APAC,
    aliases: ['JP', 'JAPAN', 'NHAT BAN'],
  },
  {
    code: 'NL',
    name: 'Netherlands',
    region: MarketRegionCode.EU,
    aliases: ['NL', 'NETHERLANDS', 'HOLLAND', 'HA LAN'],
  },
  {
    code: 'SG',
    name: 'Singapore',
    region: MarketRegionCode.ASEAN,
    aliases: ['SG', 'SINGAPORE'],
  },
  {
    code: 'DE',
    name: 'Germany',
    region: MarketRegionCode.EU,
    aliases: ['DE', 'GERMANY', 'DEUTSCHLAND', 'DUC'],
  },
  {
    code: 'FR',
    name: 'France',
    region: MarketRegionCode.EU,
    aliases: ['FR', 'FRANCE', 'PHAP'],
  },
  {
    code: 'IT',
    name: 'Italy',
    region: MarketRegionCode.EU,
    aliases: ['IT', 'ITALY', 'Y'],
  },
  {
    code: 'ES',
    name: 'Spain',
    region: MarketRegionCode.EU,
    aliases: ['ES', 'SPAIN', 'TAY BAN NHA'],
  },
  {
    code: 'CN',
    name: 'China',
    region: MarketRegionCode.APAC,
    aliases: ['CN', 'CHINA', 'TRUNG QUOC'],
  },
  {
    code: 'KR',
    name: 'South Korea',
    region: MarketRegionCode.APAC,
    aliases: ['KR', 'KOREA', 'SOUTH KOREA', 'HAN QUOC'],
  },
  {
    code: 'AU',
    name: 'Australia',
    region: MarketRegionCode.APAC,
    aliases: ['AU', 'AUSTRALIA', 'UC'],
  },
  {
    code: 'TH',
    name: 'Thailand',
    region: MarketRegionCode.ASEAN,
    aliases: ['TH', 'THAILAND', 'THAI LAN'],
  },
  {
    code: 'MY',
    name: 'Malaysia',
    region: MarketRegionCode.ASEAN,
    aliases: ['MY', 'MALAYSIA'],
  },
  {
    code: 'ID',
    name: 'Indonesia',
    region: MarketRegionCode.ASEAN,
    aliases: ['ID', 'INDONESIA'],
  },
  {
    code: 'PH',
    name: 'Philippines',
    region: MarketRegionCode.ASEAN,
    aliases: ['PH', 'PHILIPPINES'],
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    region: MarketRegionCode.MIDDLE_EAST,
    aliases: ['AE', 'UAE', 'UNITED ARAB EMIRATES'],
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    region: MarketRegionCode.MIDDLE_EAST,
    aliases: ['SA', 'SAUDI', 'SAUDI ARABIA'],
  },
  {
    code: 'QA',
    name: 'Qatar',
    region: MarketRegionCode.MIDDLE_EAST,
    aliases: ['QA', 'QATAR'],
  },
];

export const updateCountryCatalog = (items: CountryCatalogItem[]) => {
  COUNTRY_CATALOG.length = 0;
  COUNTRY_CATALOG.push(...items);
};

const normalizeLookupText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

const extractCountryCode = (value: string): string | null => {
  const trimmed = value.trim();
  const directCode = trimmed.match(/^[A-Za-z]{2}$/);
  if (directCode) return trimmed.toUpperCase();

  const labelCode = trimmed.match(/\(([A-Za-z]{2})\)\s*$/);
  return labelCode?.[1]?.toUpperCase() || null;
};

export const findCountryByCodeOrName = (
  value?: string | null,
): CountryCatalogItem | undefined => {
  const normalized = value ? normalizeLookupText(value) : '';
  if (!normalized) return undefined;
  const code = extractCountryCode(value || '');
  const normalizedWithoutCode = normalized.replace(/\s*\([A-Z]{2}\)\s*$/, '');

  return COUNTRY_CATALOG.find(
    (country) =>
      country.code === normalized ||
      country.code === code ||
      normalizeLookupText(country.name) === normalized ||
      normalizeLookupText(country.name) === normalizedWithoutCode ||
      (country.nameVi &&
        (normalizeLookupText(country.nameVi) === normalized ||
          normalizeLookupText(country.nameVi) === normalizedWithoutCode)) ||
      country.aliases.some(
        (alias) =>
          normalizeLookupText(alias) === normalized ||
          normalizeLookupText(alias) === normalizedWithoutCode,
      ),
  );
};

export const normalizeCountryCode = (value?: string | null): string | null => {
  const normalized = value?.trim();
  if (!normalized) return null;
  return findCountryByCodeOrName(normalized)?.code || extractCountryCode(normalized);
};

export const resolveRegionByCountry = (
  value?: string | null,
): MarketRegionCode | null => findCountryByCodeOrName(value)?.region || null;

export const getCountryName = (value?: string | null): string | null => {
  const normalized = value?.trim();
  if (!normalized) return null;
  return findCountryByCodeOrName(normalized)?.name || normalized;
};

export const getCountryLookupValues = (value?: string | null): string[] => {
  const country = findCountryByCodeOrName(value);
  if (!country) {
    const normalized = normalizeCountryCode(value);
    return normalized ? [normalized] : [];
  }

  return Array.from(
    new Set(
      [country.code, country.name, ...country.aliases].map((item) =>
        item.toUpperCase(),
      ),
    ),
  );
};
