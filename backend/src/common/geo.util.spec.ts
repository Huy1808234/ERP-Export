import {
  findCountryByCodeOrName,
  normalizeCountryCode,
  resolveRegionByCountry,
  MarketRegionCode,
} from './geo.util';

describe('geo utilities', () => {
  it('normalizes country labels with ISO code suffix', () => {
    expect(normalizeCountryCode('Viet Nam (VN)')).toBe('VN');
    expect(normalizeCountryCode('Vi\u1ec7t Nam (VN)')).toBe('VN');
    expect(findCountryByCodeOrName('Vietnam (VN)')?.code).toBe('VN');
  });

  it('keeps countryCode constrained to ISO alpha-2 values', () => {
    expect(normalizeCountryCode('US')).toBe('US');
    expect(normalizeCountryCode('Atlantis')).toBeNull();
  });

  it('resolves region from country labels', () => {
    expect(resolveRegionByCountry('Viet Nam (VN)')).toBe(
      MarketRegionCode.ASEAN,
    );
  });
});
