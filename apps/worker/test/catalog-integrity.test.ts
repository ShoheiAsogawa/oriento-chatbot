import { describe, expect, it } from 'vitest';
import saleCatalogJson from '../../../knowledge/initial/sale_catalog.json';
import rentalCatalogJson from '../../../knowledge/initial/rental_catalog.json';
import { buildGuidedSearchOptions } from '../src/guided-search-options';
import { propertyArea } from '../src/property-areas';
import { normalizeSaleAddress, type SaleProperty } from '../src/sale-catalog';
import type { RentalProperty } from '../src/rental-catalog';

const sales = saleCatalogJson.properties as SaleProperty[];
const rentals = rentalCatalogJson.properties as RentalProperty[];

describe('checked-in catalog runtime integrity', () => {
  it('keeps every property on one unique Japanese official detail URL', () => {
    expect(sales.length).toBeGreaterThanOrEqual(500);
    expect(rentals.length).toBeGreaterThanOrEqual(20);
    const allUrls = [...sales.map((item) => item.url), ...rentals.map((item) => item.url)];
    expect(new Set(allUrls).size).toBe(allUrls.length);
    expect(sales.filter((item) => !/^https:\/\/orijyu\.com\/(?:buy|pri2)\/post-\d+(?:-\d+)?\.html$/u.test(item.url))).toEqual([]);
    expect(rentals.filter((item) => !/^https:\/\/orijyu\.com\/rent\/post-\d+(?:-\d+)?\.html$/u.test(item.url))).toEqual([]);
  });

  it('has positive finite prices and a resolvable Japanese location for every listing', () => {
    expect(sales.filter((item) => !Number.isFinite(item.price_yen) || item.price_yen <= 0).map((item) => item.url)).toEqual([]);
    expect(rentals.filter((item) => !Number.isFinite(item.rent_yen) || item.rent_yen <= 0).map((item) => item.url)).toEqual([]);
    expect(sales.filter((item) => !propertyArea(normalizeSaleAddress(item.address))).map((item) => ({ url: item.url, address: item.address }))).toEqual([]);
    expect(rentals.filter((item) => !propertyArea(item.address)).map((item) => ({ url: item.url, address: item.address }))).toEqual([]);
  });

  it('does not retain duplicated municipality prefixes in generated addresses', () => {
    const repeatedMunicipalityPrefix = (address: string) => {
      const normalized = address.normalize('NFKC').replace(/\s+/gu, ' ').trim();
      for (let start = 0; start < normalized.length; start += 1) {
        for (let end = start + 2; end <= normalized.length; end += 1) {
          if (!/[市区町村]$/u.test(normalized.slice(start, end))) continue;
          const prefix = normalized.slice(start, end);
          if (normalized.slice(end).startsWith(prefix)) return true;
        }
      }
      return false;
    };
    const properties = [...sales, ...rentals];
    expect(properties.filter((item) => repeatedMunicipalityPrefix(item.address)).map((item) => ({ id: item.id, address: item.address }))).toEqual([]);
  });

  it('makes every represented prefecture and municipality available to guided search', () => {
    const options = buildGuidedSearchOptions(rentals, sales.map((item) => ({
      ...item,
      address: normalizeSaleAddress(item.address),
    })));
    const expectedSaleAreas = new Set(sales.map((item) => propertyArea(normalizeSaleAddress(item.address))?.municipality).filter(Boolean));
    const expectedRentalAreas = new Set(rentals
      .filter((item) => /(?:賃貸住宅|マンション|アパート|貸家|一戸建|戸建|テラスハウス|メゾネット|長屋|ハイツ)/u.test(item.property_type))
      .map((item) => propertyArea(item.address)?.municipality)
      .filter(Boolean));
    expect(new Set(Object.keys(options.sale))).toEqual(expectedSaleAreas);
    expect(new Set(Object.keys(options.rental))).toEqual(expectedRentalAreas);
    expect(new Set(Object.values(options.sale).map((item) => item.prefecture)).size).toBeGreaterThanOrEqual(8);
  });
});
