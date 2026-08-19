import { describe, expect, it } from 'vitest';
import { extractPurchaseConsultationState } from '../src/purchase-consultation';
import { extractRentalConsultationState } from '../src/rental-consultation';
import { recommendRentalProperties, type RentalProperty } from '../src/rental-catalog';
import { recommendSaleProperties, type SaleProperty } from '../src/sale-catalog';
import { buildGuidedSearchOptions, purchaseChoicesForAvailability, rentalChoicesForAvailability, type GuidedSearchOptions } from '../src/guided-search-options';

describe('conversation fuzz audit', () => {
  it.each([
    ['２５００万円まで', 25_000_000],
    ['2,500万円まで', 25_000_000],
    ['0万円まで', undefined],
  ])('parses purchase budget variant %s', (input, expected) => {
    expect(extractPurchaseConsultationState([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '購入予算の上限を選んでにゃん。' },
    ], input).maxPriceYen).toBe(expected);
  });

  it('keeps prefecture as a filter when rental area is omitted', () => {
    const properties: RentalProperty[] = [
      { id: 'osaka', title: '大阪', url: 'https://orijyu.com/rent/osaka', property_type: 'マンション', rent_yen: 50_000, common_fee: '', address: '大阪府大阪市', transport: [], layout: '1K', walk_minutes: null, status: '' },
      { id: 'hyogo', title: '兵庫', url: 'https://orijyu.com/rent/hyogo', property_type: 'マンション', rent_yen: 50_000, common_fee: '', address: '兵庫県神戸市', transport: [], layout: '1K', walk_minutes: null, status: '' },
    ];
    expect(recommendRentalProperties(properties, { prefecture: '兵庫県' }).map((item) => item.id)).toEqual(['hyogo']);
  });

  it('does not allow a non-finite sale price to bypass a budget', () => {
    const properties: SaleProperty[] = [
      { id: 'nan', title: '不正価格', url: 'https://orijyu.com/buy/nan', property_type: '中古戸建て', price_yen: Number.NaN, address: '大阪府大阪市', transport: [], layout: '3LDK', walk_minutes: null, status: '' },
    ];
    expect(recommendSaleProperties(properties, { maxPriceYen: 30_000_000 })).toEqual([]);
  });

  it('keeps five-bedroom listings in guided options', () => {
    const options = buildGuidedSearchOptions([], [{
      id: '5ldk', title: '5LDK', url: 'https://orijyu.com/buy/5ldk', property_type: '中古一戸建て', price_yen: 30_000_000, address: '大阪府堺市中区', transport: [], layout: '5LDK', walk_minutes: null, status: '',
    }]);
    expect(options.sale.堺市?.layout_min_price_yen['5LDK']).toBe(30_000_000);
  });

  it('accepts unknown purchase budget and minimum layout wording', () => {
    const history = [
      { role: 'user' as const, content: '購入' },
      { role: 'assistant' as const, content: '購入予算の上限を選んでにゃん。' },
    ];
    const state = extractPurchaseConsultationState(history, '予算は相談したい');
    expect(state.maxPriceYen).toBe(Number.MAX_SAFE_INTEGER);
    expect(extractPurchaseConsultationState([], '堺市の購入、2LDK以上').layout).toBe('2LDK+');
  });

  it('accepts unknown rental preference wording and compact common-fee wording', () => {
    const state = extractRentalConsultationState([
      { role: 'user', content: '堺市の賃貸、共益費込、家賃8万円' },
      { role: 'assistant', content: '希望の間取りや条件を教えてにゃん。' },
    ], 'わからない');
    expect(state.includeCommonFee).toBe(true);
    expect(state.hasPreference).toBe(true);
  });

  it('matches purchase minimum layouts against larger homes', () => {
    const properties: SaleProperty[] = [
      { id: '2', title: '2LDK', url: 'https://orijyu.com/buy/2', property_type: '中古戸建て', price_yen: 20_000_000, address: '大阪府堺市', transport: [], layout: '2LDK', walk_minutes: null, status: '' },
      { id: '3', title: '3LDK', url: 'https://orijyu.com/buy/3', property_type: '中古戸建て', price_yen: 30_000_000, address: '大阪府堺市', transport: [], layout: '3LDK', walk_minutes: null, status: '' },
    ];
    expect(recommendSaleProperties(properties, { area: '堺市', layout: '2LDK+' }).map((item) => item.id)).toEqual(['2', '3']);
  });

  it('does not confuse room counts or layout kinds when matching exact purchase layouts', () => {
    const properties: SaleProperty[] = [
      { id: 'exact', title: '2LDK', url: 'https://orijyu.com/buy/exact', property_type: '中古戸建て', price_yen: 20_000_000, address: '大阪府堺市', transport: [], layout: '2LDK', walk_minutes: null, status: '' },
      { id: 'twelve', title: '12LDK', url: 'https://orijyu.com/buy/twelve', property_type: '中古戸建て', price_yen: 20_000_000, address: '大阪府堺市', transport: [], layout: '12LDK', walk_minutes: null, status: '' },
      { id: 'service', title: '3SLDK', url: 'https://orijyu.com/buy/service', property_type: '中古戸建て', price_yen: 20_000_000, address: '大阪府堺市', transport: [], layout: '3SLDK', walk_minutes: null, status: '' },
      { id: 'range', title: '3LDK〜4LDK', url: 'https://orijyu.com/buy/range', property_type: '中古戸建て', price_yen: 20_000_000, address: '大阪府堺市', transport: [], layout: '3LDK〜4LDK', walk_minutes: null, status: '' },
      { id: 'dk', title: '2DK', url: 'https://orijyu.com/buy/dk', property_type: '中古戸建て', price_yen: 20_000_000, address: '大阪府堺市', transport: [], layout: '2DK', walk_minutes: null, status: '' },
    ];
    expect(recommendSaleProperties(properties, { area: '堺市', layout: '2LDK' }).map((item) => item.id)).toEqual(['exact']);
    expect(recommendSaleProperties(properties, { area: '堺市', layout: '3LDK' }).map((item) => item.id)).toEqual(['service', 'range']);
    expect(recommendSaleProperties(properties, { area: '堺市', layout: '2LDK+' }).map((item) => item.id)).toEqual(['exact', 'twelve', 'service']);
  });

  it('checks every layout token in ranges and separator lists', () => {
    const sale: SaleProperty[] = [
      { id: 'range', title: 'range', url: 'https://orijyu.com/buy/range', property_type: '中古戸建て', price_yen: 20_000_000, address: '大阪府堺市', transport: [], layout: '3LDK〜4LDK', walk_minutes: null, status: '' },
      { id: 'list', title: 'list', url: 'https://orijyu.com/buy/list', property_type: '中古戸建て', price_yen: 21_000_000, address: '大阪府堺市', transport: [], layout: '3LDK・4LDK', walk_minutes: null, status: '' },
      { id: 'double-service', title: 'double service', url: 'https://orijyu.com/buy/double-service', property_type: '中古戸建て', price_yen: 22_000_000, address: '大阪府堺市', transport: [], layout: '2SSLDK', walk_minutes: null, status: '' },
    ];
    expect(recommendSaleProperties(sale, { area: '堺市', layout: '4LDK' }).map((item) => item.id)).toEqual(['range', 'list']);
    expect(recommendSaleProperties(sale, { area: '堺市', layout: '2LDK' }).map((item) => item.id)).toEqual(['double-service']);

    const rental = sale.map((item) => ({
      ...item,
      url: item.url.replace('/buy/', '/rent/'),
      property_type: 'マンション',
      rent_yen: item.price_yen / 500,
      common_fee: '',
    })) as RentalProperty[];
    expect(recommendRentalProperties(rental, { area: '堺市', layout: '4LDK' }).map((item) => item.id)).toEqual(['range', 'list']);
  });

  it('supports a safe custom result limit while retaining the default cap', () => {
    const sale: SaleProperty[] = Array.from({ length: 5 }, (_, index) => ({
      id: `sale-${index}`, title: `sale-${index}`, url: `https://orijyu.com/buy/${index}`,
      property_type: '中古戸建て', price_yen: 20_000_000 + index * 100_000, address: '大阪府堺市', transport: [], layout: '3LDK', walk_minutes: null, status: '',
    }));
    const rental: RentalProperty[] = sale.map((item) => ({
      ...item, url: item.url.replace('/buy/', '/rent/'), property_type: 'マンション', rent_yen: item.price_yen / 500, common_fee: '',
    }));
    expect(recommendSaleProperties(sale, { area: '堺市' })).toHaveLength(3);
    expect(recommendSaleProperties(sale, { area: '堺市' }, {}, 4)).toHaveLength(4);
    expect(recommendRentalProperties(rental, { area: '堺市' })).toHaveLength(3);
    expect(recommendRentalProperties(rental, { area: '堺市' }, new Set(), 4)).toHaveLength(4);
    expect(recommendSaleProperties(sale, { area: '堺市' }, {}, 0)).toHaveLength(3);
    expect(recommendSaleProperties(sale, { area: '堺市' }, {}, 1_000_000)).toHaveLength(3);
    expect(recommendRentalProperties(rental, { area: '堺市' }, new Set(), Number.NaN)).toHaveLength(3);
  });

  it('does not turn negative numeric answers into valid criteria', () => {
    expect(extractPurchaseConsultationState([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '購入予算の上限を選んでにゃん。' },
    ], '−1000万円まで').maxPriceYen).toBeUndefined();
    const rental = extractRentalConsultationState([], '堺市の賃貸、家賃-8万円、家族-4人、徒歩-5分');
    expect(rental.maxRentYen).toBeUndefined();
    expect(rental.householdSize).toBeUndefined();
    expect(rental.maxWalkMinutes).toBeUndefined();
  });

  it('excludes zero-priced inventory from both recommendation paths', () => {
    const sale: SaleProperty = { id: 'sale-zero', title: '0円', url: 'https://orijyu.com/buy/zero', property_type: '土地', price_yen: 0, address: '大阪府堺市', transport: [], layout: '', walk_minutes: null, status: '' };
    const rental: RentalProperty = { id: 'rent-zero', title: '0円', url: 'https://orijyu.com/rent/zero', property_type: 'マンション', rent_yen: 0, common_fee: '', address: '大阪府堺市', transport: [], layout: '1K', walk_minutes: null, status: '' };
    expect(recommendSaleProperties([sale], { area: '堺市' })).toEqual([]);
    expect(recommendRentalProperties([rental], { area: '堺市' })).toEqual([]);
  });

  it('keeps the official pri2 sale route reachable', () => {
    const property: SaleProperty = {
      id: 'pri2', title: 'プリッ2 東中浜', url: 'https://orijyu.com/pri2/post-65240.html',
      property_type: 'アパート', price_yen: 39_800_000, address: '大阪市城東区東中浜6丁目',
      transport: [], layout: '1K', walk_minutes: null, status: '',
    };
    expect(recommendSaleProperties([property], { prefecture: '大阪府', area: '大阪市' })).toEqual([property]);
  });

  it('does not build guided choices from invalid zero-priced inventory', () => {
    const sale: SaleProperty = { id: 'sale-zero', title: '0円', url: 'https://orijyu.com/buy/zero', property_type: '土地', price_yen: 0, address: '大阪府堺市', transport: [], layout: '', walk_minutes: null, status: '' };
    const rental: RentalProperty = { id: 'rent-zero', title: '0円', url: 'https://orijyu.com/rent/zero', property_type: 'マンション', rent_yen: 0, common_fee: '', address: '大阪府堺市', transport: [], layout: '1K', walk_minutes: null, status: '' };
    expect(buildGuidedSearchOptions([rental], [sale])).toEqual({ version: 3, rental: {}, sale: {} });
  });

  it('surfaces layouts present only in the inventory instead of making them unreachable', () => {
    const options: GuidedSearchOptions = {
      version: 3,
      rental: { 堺市: { prefecture: '大阪府', min_rent_yen: 50_000, layout_min_rent_yen: { '1R': 50_000, '2DK': 70_000, '5DK': 120_000 } } },
      sale: { 堺市: { prefecture: '大阪府', min_price_yen: 10_000_000, type_min_price_yen: { 戸建て: 10_000_000 }, layout_min_price_yen: { '1LDK': 10_000_000, '6DK': 15_000_000, '7LDK': 20_000_000 }, layout_min_price_yen_by_type: { 戸建て: { '1LDK': 10_000_000, '6DK': 15_000_000, '7LDK': 20_000_000 } } } },
    };
    expect(rentalChoicesForAvailability('希望の間取りや条件を教えてにゃん。', options, { area: '堺市', maxRentYen: 200_000 }).map((item) => item.value)).toEqual(expect.arrayContaining(['2DK', '5DK']));
    expect(purchaseChoicesForAvailability('購入物件の希望間取りを選んでにゃん。', options, { area: '堺市', maxPriceYen: 30_000_000, propertyType: '戸建て' }).map((item) => item.value)).toEqual(expect.arrayContaining(['6DK', '7LDK']));
  });
});
